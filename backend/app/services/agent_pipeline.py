"""
Agent Pipeline Service - Orchestrates the 3-agent pipeline
"""

import logging
import asyncio
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime

from app.agents.enhanced_profiler_agent import EnhancedDataProfilerAgent
from app.agents.chart_recommender_agent import ChartRecommenderAgent
from app.agents.validation_agent import ValidationAgent
from app.models.analysis import (
    ComprehensiveDataAnalysis,
    ChartRecommendation,
    ValidatedRecommendation,
    ValidationResult,
    AnalysisResponse
)
from app.models.processing_context import ProcessingContext
from app.database.supabase_client import get_supabase_client
from app.utils.memory_manager import get_memory_manager, RequestPriority
from app.utils.intelligent_cache import get_intelligent_cache
from app.utils.data_sampling import DataSampler

logger = logging.getLogger(__name__)


def convert_to_json_serializable(obj):
    """Convert numpy/pandas types and enums to JSON serializable types"""
    import enum
    from decimal import Decimal
    
    # Handle None first
    if obj is None:
        return None
    
    # Handle enums - check if it's an enum type
    if isinstance(obj, enum.Enum):
        return obj.value
    elif hasattr(obj, 'value') and hasattr(obj, '_name_'):  # Enum-like objects
        return obj.value
    elif hasattr(obj, '_value_'):  # Alternative enum attribute
        return obj._value_
    
    # Handle numpy types
    elif hasattr(obj, 'item'):  # numpy scalars
        return obj.item()
    elif hasattr(obj, 'tolist'):  # numpy arrays
        return obj.tolist()
    
    # Handle Python built-in types that need conversion
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    
    # Handle collections
    elif isinstance(obj, dict):
        # Handle special pydantic enum serialization format
        if '_name_' in obj and '_value_' in obj:
            return obj.get('_value_')
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, tuple):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, set):
        return [convert_to_json_serializable(item) for item in obj]
    
    # Handle pydantic models
    elif hasattr(obj, '__dict__'):
        if hasattr(obj, 'dict'):
            return convert_to_json_serializable(obj.dict())
        else:
            return convert_to_json_serializable(obj.__dict__)
    
    # Handle other types that might not be JSON serializable
    else:
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)


class AgentPipelineService:
    """Service for orchestrating the 3-agent pipeline"""

    def __init__(self):
        self.profiler_agent = EnhancedDataProfilerAgent()
        self.recommender_agent = ChartRecommenderAgent()
        self.validation_agent = ValidationAgent()
        self.supabase = get_supabase_client()
        self.memory_manager = get_memory_manager()
        self.cache = get_intelligent_cache()
        self.data_sampler = DataSampler(max_sample_size=5000)

    async def analyze_dataset(
        self,
        data: List[Dict[str, Any]],
        dataset_id: str,
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> AnalysisResponse:
        """
        Run the complete 3-agent analysis pipeline with intelligent caching.
        This method now uses shared context by default for better performance.

        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset
            progress_callback: Optional callback for progress updates

        Returns:
            AnalysisResponse with recommendations and analysis
        """
        # Use the new context-aware pipeline by default
        return await self.analyze_dataset_with_shared_context(data, dataset_id, progress_callback)

    async def analyze_dataset_legacy(
        self,
        data: List[Dict[str, Any]],
        dataset_id: str,
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> AnalysisResponse:
        """
        Legacy method: Run the complete 3-agent analysis pipeline with intelligent caching
        (without shared context - kept for backward compatibility)

        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset
            progress_callback: Optional callback for progress updates

        Returns:
            AnalysisResponse with recommendations and analysis
        """
        try:
            start_time = datetime.now()

            if progress_callback:
                progress_callback("pipeline", "starting")

            # Generate data fingerprint for caching
            fingerprint = self.cache.get_data_fingerprint(data)
            logger.info(f"Generated fingerprint for dataset {dataset_id}: {fingerprint}")

            # Check if we have cached analysis results
            cached_analysis = self.cache.get_cached_analysis(fingerprint)
            if cached_analysis:
                logger.info(f"Using cached analysis for dataset {dataset_id} (fingerprint: {fingerprint})")
                
                # Check for cached chart recommendations
                cached_recommendations = self.cache.get_cached_chart_recommendations(fingerprint)
                if cached_recommendations:
                    logger.info(f"Using cached chart recommendations for dataset {dataset_id}")
                    
                    # Create validated recommendations from cached data
                    # Note: In a real scenario, we might want to run validation again
                    # but for performance, we'll use cached recommendations
                    validated_recommendations = []
                    for rec in cached_recommendations:
                        # Convert to ValidatedRecommendation (simplified)
                        validated_rec = ValidatedRecommendation(
                            chart_type=rec.chart_type,
                            confidence=rec.confidence,
                            data_mapping=rec.data_mapping,
                            reasoning=rec.reasoning,
                            validation_result=ValidationResult(
                                chart_type=rec.chart_type,
                                validation_score=rec.suitability_score,
                                quality_metrics={},
                                final_score=rec.suitability_score
                            ),
                            interaction_config=rec.interaction_config,
                            styling_suggestions=rec.styling_suggestions
                        )
                        validated_recommendations.append(validated_rec)
                    
                    processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
                    
                    if progress_callback:
                        progress_callback("pipeline", "completed")
                    
                    logger.info(f"Pipeline completed using cache for dataset {dataset_id} in {processing_time}ms")
                    
                    return AnalysisResponse(
                        success=True,
                        dataset_id=dataset_id,
                        recommendations=validated_recommendations,
                        data_profile=cached_analysis,
                        processing_time_ms=processing_time
                    )

            # Stage 1: Enhanced Data Profiler Agent
            if progress_callback:
                progress_callback("profiler", "running")

            logger.info(f"Starting profiler agent for dataset {dataset_id}")
            analysis = await self.profiler_agent.analyze(data)
            analysis.dataset_id = dataset_id

            # Cache the analysis result
            self.cache.cache_analysis_result(fingerprint, analysis)

            # Store profiler results
            await self._store_agent_analysis(dataset_id, "profiler", analysis.dict())

            if progress_callback:
                progress_callback("profiler", "completed")

            # Stage 2: Chart Recommender Agent
            if progress_callback:
                progress_callback("recommender", "running")

            logger.info(f"Starting recommender agent for dataset {dataset_id}")
            recommendations = await self.recommender_agent.recommend(analysis)

            # Cache the chart recommendations
            self.cache.cache_chart_recommendations(fingerprint, recommendations)

            # Store recommender results
            recommendations_data = [rec.dict() for rec in recommendations]
            await self._store_agent_analysis(dataset_id, "recommender", {
                "recommendations": recommendations_data
            })

            if progress_callback:
                progress_callback("recommender", "completed")

            # Stage 3: Validation Agent
            if progress_callback:
                progress_callback("validator", "running")

            logger.info(f"Starting validation agent for dataset {dataset_id}")
            validated_recommendations = await self.validation_agent.validate(
                recommendations, analysis
            )

            # Store validation results
            validated_data = [rec.dict() for rec in validated_recommendations]
            await self._store_agent_analysis(dataset_id, "validator", {
                "validated_recommendations": validated_data
            })

            if progress_callback:
                progress_callback("validator", "completed")

            # Update dataset status
            await self._update_dataset_status(dataset_id, "completed")

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            if progress_callback:
                progress_callback("pipeline", "completed")

            logger.info(f"Pipeline completed for dataset {dataset_id} in {processing_time}ms")

            return AnalysisResponse(
                success=True,
                dataset_id=dataset_id,
                recommendations=validated_recommendations,
                data_profile=analysis,
                processing_time_ms=processing_time
            )

        except Exception as e:
            logger.error(f"Pipeline failed for dataset {dataset_id}: {e}")

            if progress_callback:
                progress_callback("pipeline", "failed")

            # Update dataset status to failed
            await self._update_dataset_status(dataset_id, "failed")

            raise

    async def analyze_dataset_with_memory_management(
        self,
        data: List[Dict[str, Any]],
        dataset_id: str,
        priority: RequestPriority = RequestPriority.NORMAL
    ) -> None:
        """
        Run analysis with memory management and queuing
        
        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset
            priority: Processing priority
        """
        try:
            # Estimate memory requirements based on data size
            data_size_mb = len(str(data)) / (1024 * 1024)
            estimated_memory_mb = max(100, int(data_size_mb * 3))  # Conservative estimate
            
            logger.info(f"Queuing analysis for dataset {dataset_id} (estimated memory: {estimated_memory_mb}MB)")
            
            # Create analysis callback
            async def analysis_callback():
                return await self.analyze_dataset(data, dataset_id)
            
            # Queue the analysis request
            success = await self.memory_manager.queue_request(
                request_id=f"analysis_{dataset_id}",
                callback=analysis_callback,
                estimated_memory_mb=estimated_memory_mb,
                priority=priority,
                timeout_seconds=600  # 10 minutes timeout
            )
            
            if not success:
                logger.error(f"Failed to queue analysis for dataset {dataset_id}")
                await self._update_dataset_status(dataset_id, "failed")
                raise Exception("System overloaded - analysis request rejected")
            
            logger.info(f"Analysis queued successfully for dataset {dataset_id}")
            
        except Exception as e:
            logger.error(f"Memory-managed analysis failed for dataset {dataset_id}: {e}")
            await self._update_dataset_status(dataset_id, "failed")
            raise

    async def analyze_dataset_with_shared_context(
        self,
        data: List[Dict[str, Any]],
        dataset_id: str,
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> AnalysisResponse:
        """
        Run the complete 3-agent analysis pipeline using shared processing context
        to avoid redundant data copying and calculations.

        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset
            progress_callback: Optional callback for progress updates

        Returns:
            AnalysisResponse with recommendations and analysis
        """
        try:
            start_time = datetime.now()

            if progress_callback:
                progress_callback("pipeline", "starting")

            # Generate data fingerprint for caching
            fingerprint = self.cache.get_data_fingerprint(data)
            logger.info(f"Generated fingerprint for dataset {dataset_id}: {fingerprint}")

            # Check if we have cached analysis results
            cached_analysis = self.cache.get_cached_analysis(fingerprint)
            if cached_analysis:
                logger.info(f"Using cached analysis for dataset {dataset_id} (fingerprint: {fingerprint})")
                
                # Check for cached chart recommendations
                cached_recommendations = self.cache.get_cached_chart_recommendations(fingerprint)
                if cached_recommendations:
                    logger.info(f"Using cached chart recommendations for dataset {dataset_id}")
                    
                    # Create validated recommendations from cached data
                    validated_recommendations = []
                    for rec in cached_recommendations:
                        # Convert to ValidatedRecommendation (simplified)
                        validated_rec = ValidatedRecommendation(
                            chart_type=rec.chart_type,
                            confidence=rec.confidence,
                            data_mapping=rec.data_mapping,
                            reasoning=rec.reasoning,
                            validation_result=ValidationResult(
                                chart_type=rec.chart_type,
                                validation_score=rec.suitability_score,
                                quality_metrics={},
                                final_score=rec.suitability_score
                            ),
                            interaction_config=rec.interaction_config,
                            styling_suggestions=rec.styling_suggestions
                        )
                        validated_recommendations.append(validated_rec)
                    
                    processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
                    
                    if progress_callback:
                        progress_callback("pipeline", "completed")
                    
                    logger.info(f"Pipeline completed using cache for dataset {dataset_id} in {processing_time}ms")
                    
                    return AnalysisResponse(
                        success=True,
                        dataset_id=dataset_id,
                        recommendations=validated_recommendations,
                        data_profile=cached_analysis,
                        processing_time_ms=processing_time
                    )

            # Create shared processing context
            logger.info(f"Creating shared processing context for dataset {dataset_id}")
            
            # Apply intelligent sampling for large datasets
            original_size = len(data)
            sampled_data = self.data_sampler.smart_sample(data, 5000)
            sampled_df = pd.DataFrame(sampled_data)
            
            # Create processing context with sampled data
            context = ProcessingContext(
                dataset_id=dataset_id,
                original_data_size=original_size,
                sample_data=sampled_df
            )
            
            logger.info(f"Created processing context: {context.get_cache_summary()}")

            # Stage 1: Enhanced Data Profiler Agent with shared context
            if progress_callback:
                progress_callback("profiler", "running")

            logger.info(f"Starting context-aware profiler agent for dataset {dataset_id}")
            analysis = await self.profiler_agent.analyze_with_context(context)
            analysis.dataset_id = dataset_id

            # Cache the analysis result
            self.cache.cache_analysis_result(fingerprint, analysis)

            # Store profiler results
            await self._store_agent_analysis(dataset_id, "profiler", analysis.dict())

            if progress_callback:
                progress_callback("profiler", "completed")

            # Stage 2: Chart Recommender Agent with shared context
            if progress_callback:
                progress_callback("recommender", "running")

            logger.info(f"Starting context-aware recommender agent for dataset {dataset_id}")
            recommendations = await self.recommender_agent.recommend_with_context(context)

            # Cache the chart recommendations
            self.cache.cache_chart_recommendations(fingerprint, recommendations)

            # Store recommender results
            recommendations_data = [rec.dict() for rec in recommendations]
            await self._store_agent_analysis(dataset_id, "recommender", {
                "recommendations": recommendations_data
            })

            if progress_callback:
                progress_callback("recommender", "completed")

            # Stage 3: Validation Agent with shared context
            if progress_callback:
                progress_callback("validator", "running")

            logger.info(f"Starting context-aware validation agent for dataset {dataset_id}")
            validated_recommendations = await self.validation_agent.validate_with_context(
                recommendations, context
            )

            # Store validation results
            validated_data = [rec.dict() for rec in validated_recommendations]
            await self._store_agent_analysis(dataset_id, "validator", {
                "validated_recommendations": validated_data
            })

            if progress_callback:
                progress_callback("validator", "completed")

            # Update dataset status
            await self._update_dataset_status(dataset_id, "completed")

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            if progress_callback:
                progress_callback("pipeline", "completed")

            # Clean up context to free memory
            context.clear_cache()

            logger.info(f"Context-aware pipeline completed for dataset {dataset_id} in {processing_time}ms")

            return AnalysisResponse(
                success=True,
                dataset_id=dataset_id,
                recommendations=validated_recommendations,
                data_profile=analysis,
                processing_time_ms=processing_time
            )

        except Exception as e:
            logger.error(f"Context-aware pipeline failed for dataset {dataset_id}: {e}")

            if progress_callback:
                progress_callback("pipeline", "failed")

            # Update dataset status to failed
            await self._update_dataset_status(dataset_id, "failed")

            raise

    async def get_analysis_status(self, dataset_id: str) -> Dict[str, Any]:
        """Get the current analysis status for a dataset"""
        try:
            # Get dataset status
            dataset_response = self.supabase.table("datasets").select("processing_status").eq("id", dataset_id).execute()

            if not dataset_response.data:
                return {"status": "not_found"}

            status = dataset_response.data[0]["processing_status"]

            # Get completed agent analyses
            analyses_response = self.supabase.table("agent_analyses").select("agent_type, created_at").eq("dataset_id", dataset_id).execute()

            completed_agents = [analysis["agent_type"] for analysis in analyses_response.data]

            return {
                "status": status,
                "completed_agents": completed_agents,
                "progress": {
                    "profiler": "profiler" in completed_agents,
                    "recommender": "recommender" in completed_agents,
                    "validator": "validator" in completed_agents
                }
            }

        except Exception as e:
            logger.error(f"Failed to get analysis status for dataset {dataset_id}: {e}")
            return {"status": "error", "error": str(e)}

    async def get_analysis_results(self, dataset_id: str) -> Optional[AnalysisResponse]:
        """Get the complete analysis results for a dataset"""
        try:
            # Get all agent analyses
            analyses_response = self.supabase.table("agent_analyses").select("*").eq("dataset_id", dataset_id).order("created_at").execute()

            if not analyses_response.data:
                logger.warning(f"No analysis data found for dataset {dataset_id}")
                return None

            logger.info(f"Found {len(analyses_response.data)} analyses for dataset {dataset_id}")

            # Process results by agent type
            profiler_data = None
            recommendations = []
            validated_recommendations = []

            for analysis in analyses_response.data:
                agent_type = analysis["agent_type"]
                analysis_data = analysis["analysis_data"]
                logger.info(f"Processing {agent_type} analysis with keys: {list(analysis_data.keys()) if analysis_data else 'None'}")

                if agent_type == "profiler":
                    try:
                        profiler_data = ComprehensiveDataAnalysis(**analysis_data)
                    except Exception as e:
                        logger.error(f"Failed to create ComprehensiveDataAnalysis: {e}")
                        # Create a minimal profiler data structure if parsing fails
                        profiler_data = ComprehensiveDataAnalysis(
                            dataset_id=dataset_id,
                            statistical_summary=analysis_data.get("statistical_summary", {}),
                            patterns=analysis_data.get("patterns", {}),
                            data_quality=analysis_data.get("data_quality", {}),
                            processing_time_ms=analysis_data.get("processing_time_ms", 0)
                        )
                elif agent_type == "recommender":
                    recs_data = analysis_data.get("recommendations", [])
                    try:
                        recommendations = [ChartRecommendation(**rec) for rec in recs_data]
                    except Exception as e:
                        logger.error(f"Failed to parse recommendations: {e}")
                        recommendations = []
                elif agent_type == "validator":
                    val_recs_data = analysis_data.get("validated_recommendations", [])
                    try:
                        validated_recommendations = [ValidatedRecommendation(**rec) for rec in val_recs_data]
                    except Exception as e:
                        logger.error(f"Failed to parse validated recommendations: {e}")
                        validated_recommendations = []

            logger.info(f"Results summary - profiler_data: {profiler_data is not None}, validated_recommendations: {len(validated_recommendations)}")

            if not profiler_data or not validated_recommendations:
                logger.warning(f"Missing required data - profiler: {profiler_data is not None}, validated_recs: {len(validated_recommendations)}")
                return None

            return AnalysisResponse(
                success=True,
                dataset_id=dataset_id,
                recommendations=validated_recommendations,
                data_profile=profiler_data,
                processing_time_ms=0  # Historical data
            )

        except Exception as e:
            logger.error(f"Failed to get analysis results for dataset {dataset_id}: {e}")
            return None

    async def _store_agent_analysis(
        self,
        dataset_id: str,
        agent_type: str,
        analysis_data: Dict[str, Any]
    ) -> None:
        """Store agent analysis results in the database"""
        try:
            # Convert analysis_data to JSON serializable format
            serializable_data = convert_to_json_serializable(analysis_data)
            
            confidence_score = None
            processing_time_ms = serializable_data.get("processing_time_ms")

            # Extract confidence score based on agent type
            if agent_type == "profiler":
                confidence_score = 0.9  # Profiler is typically highly confident
            elif agent_type == "recommender":
                recs = serializable_data.get("recommendations", [])
                if recs:
                    confidence_score = sum(rec.get("confidence", 0) for rec in recs) / len(recs)
            elif agent_type == "validator":
                val_recs = serializable_data.get("validated_recommendations", [])
                if val_recs:
                    confidence_score = sum(rec.get("validation_result", {}).get("final_score", 0) for rec in val_recs) / len(val_recs)

            self.supabase.table("agent_analyses").insert({
                "dataset_id": dataset_id,
                "agent_type": agent_type,
                "analysis_data": serializable_data,
                "confidence_score": confidence_score,
                "processing_time_ms": processing_time_ms
            }).execute()

            logger.info(f"Stored {agent_type} analysis for dataset {dataset_id}")

        except Exception as e:
            logger.error(f"Failed to store agent analysis: {e}")
            # Don't raise - this shouldn't break the pipeline

    async def _update_dataset_status(self, dataset_id: str, status: str) -> None:
        """Update dataset processing status"""
        try:
            self.supabase.table("datasets").update({
                "processing_status": status,
                "updated_at": datetime.now().isoformat()
            }).eq("id", dataset_id).execute()

            logger.info(f"Updated dataset {dataset_id} status to {status}")

        except Exception as e:
            logger.error(f"Failed to update dataset status: {e}")
            # Don't raise - this shouldn't break the pipeline

    async def get_cache_metrics(self) -> Dict[str, Any]:
        """Get comprehensive cache performance metrics"""
        try:
            metrics = self.cache.get_cache_metrics()
            cache_sizes = self.cache.get_cache_sizes()
            optimization_report = self.cache.optimize_cache_performance()
            
            return {
                "metrics": metrics,
                "cache_sizes": cache_sizes,
                "optimization": optimization_report,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get cache metrics: {e}")
            return {"error": str(e)}

    async def clear_cache(self, cache_type: Optional[str] = None) -> Dict[str, Any]:
        """Clear cache and return status"""
        try:
            self.cache.clear_cache(cache_type)
            return {
                "success": True,
                "message": f"Cleared {'all caches' if cache_type is None else f'{cache_type} cache'}",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return {"success": False, "error": str(e)}