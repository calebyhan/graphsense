"""
Agent Pipeline Service - Orchestrates the 3-agent pipeline
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.agents.enhanced_profiler_agent import EnhancedDataProfilerAgent
from app.agents.chart_recommender_agent import ChartRecommenderAgent
from app.agents.validation_agent import ValidationAgent
from app.models.analysis import (
    ComprehensiveDataAnalysis,
    ChartRecommendation,
    ValidatedRecommendation,
    AnalysisResponse
)
from app.database.supabase_client import get_supabase_client

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
            return convert_to_json_serializable(obj.model_dump())
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

    async def analyze_dataset(
        self,
        data: List[Dict[str, Any]],
        dataset_id: str
    ) -> AnalysisResponse:
        """
        Run the complete 3-agent analysis pipeline.
        Essential core functionality only - no caching or complex context systems.

        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset

        Returns:
            AnalysisResponse with recommendations and analysis
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting pipeline for dataset {dataset_id}")

            # Stage 1: Enhanced Data Profiler Agent
            logger.info(f"Starting profiler agent for dataset {dataset_id}")
            analysis = await self.profiler_agent.analyze(data)
            analysis.dataset_id = dataset_id

            # Store profiler results
            await self._store_agent_analysis(dataset_id, "profiler", analysis.model_dump())

            # Stage 2: Chart Recommender Agent
            logger.info(f"Starting recommender agent for dataset {dataset_id}")
            recommendations = await self.recommender_agent.recommend(analysis)

            # Store recommender results
            recommendations_data = [rec.model_dump() for rec in recommendations]
            await self._store_agent_analysis(dataset_id, "recommender", {
                "recommendations": recommendations_data
            })

            # Stage 3: Validation Agent
            logger.info(f"Starting validation agent for dataset {dataset_id}")
            validated_recommendations = await self.validation_agent.validate(
                recommendations, analysis
            )

            # Store validation results
            validated_data = [rec.model_dump() for rec in validated_recommendations]
            await self._store_agent_analysis(dataset_id, "validator", {
                "validated_recommendations": validated_data
            })

            # Update dataset status
            await self._update_dataset_status(dataset_id, "completed")

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
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

