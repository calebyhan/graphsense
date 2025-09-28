"""
Pipeline Orchestrator - Central coordinator for the 3-agent analysis pipeline
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from app.models.processing_context import ProcessingContext
from app.agents.data_profiler_agent import DataProfilerAgent
from app.agents.chart_recommender_agent import ChartRecommenderAgent
from app.agents.validation_agent import ValidationAgent
from app.models.analysis import AnalysisResponse, ComprehensiveDataAnalysis, ValidatedRecommendation
from app.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class PipelineStatus(Enum):
    """Pipeline execution status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class PipelineProgress:
    """Pipeline progress tracking"""
    dataset_id: str
    status: PipelineStatus
    current_agent: Optional[str] = None
    progress_percentage: int = 0
    error_message: Optional[str] = None
    completed_agents: List[str] = None
    processing_time_ms: int = 0
    
    def __post_init__(self):
        if self.completed_agents is None:
            self.completed_agents = []


class PipelineOrchestrator:
    """
    Central coordinator that manages the entire analysis pipeline.
    Executes agents in linear sequence: Profiler → Recommender → Validator
    """

    def __init__(self):
        # Initialize agents
        self.profiler_agent = DataProfilerAgent()
        self.recommender_agent = ChartRecommenderAgent()
        self.validation_agent = ValidationAgent()
        
        # Database client
        self.supabase = get_supabase_client()
        
        # Pipeline configuration
        self.max_processing_time_seconds = 300  # 5 minutes timeout
        self.agent_timeout_seconds = 60  # 1 minute per agent
        
        logger.info("Pipeline orchestrator initialized")

    async def analyze_dataset(
        self, 
        data: List[Dict[str, Any]], 
        dataset_id: str,
        progress_callback: Optional[Callable[[PipelineProgress], None]] = None
    ) -> AnalysisResponse:
        """
        Run the complete 3-agent analysis pipeline.
        
        Args:
            data: The dataset to analyze
            dataset_id: ID of the dataset
            progress_callback: Optional callback for progress updates
            
        Returns:
            AnalysisResponse with comprehensive analysis results
        """
        start_time = datetime.now()
        progress = PipelineProgress(dataset_id=dataset_id, status=PipelineStatus.PROCESSING)
        
        try:
            logger.info(f"Starting pipeline orchestration for dataset {dataset_id}")
            
            # Initialize shared processing context
            context = ProcessingContext.create_from_data(dataset_id, data)
            logger.info(f"Created processing context with {len(context.sample_data)} sample rows")
            
            # Update initial status
            await self._update_dataset_status(dataset_id, "processing")
            if progress_callback:
                progress_callback(progress)

            # Execute pipeline stages sequentially
            profiler_result = await self._execute_profiler_stage(context, progress, progress_callback)
            recommender_result = await self._execute_recommender_stage(context, progress, progress_callback)
            validation_result = await self._execute_validation_stage(context, progress, progress_callback)

            # Build final response
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Extract results
            profiler_data = profiler_result.data if profiler_result.success else {}
            validated_recommendations = validation_result.data.get("validated_recommendations", []) if validation_result.success else []
            
            # Convert to proper objects
            data_profile = None
            if profiler_data:
                try:
                    data_profile = ComprehensiveDataAnalysis(**profiler_data)
                except Exception as e:
                    logger.warning(f"Failed to create ComprehensiveDataAnalysis: {e}")
            
            final_recommendations = []
            for rec_data in validated_recommendations:
                try:
                    final_recommendations.append(ValidatedRecommendation(**rec_data))
                except Exception as e:
                    logger.warning(f"Failed to create ValidatedRecommendation: {e}")

            # Update final status
            progress.status = PipelineStatus.COMPLETED
            progress.progress_percentage = 100
            progress.processing_time_ms = processing_time
            await self._update_dataset_status(dataset_id, "completed")
            
            if progress_callback:
                progress_callback(progress)

            # Cleanup context
            context.cleanup()

            logger.info(f"Pipeline completed successfully for dataset {dataset_id} in {processing_time}ms")

            return AnalysisResponse(
                success=True,
                dataset_id=dataset_id,
                recommendations=final_recommendations,
                data_profile=data_profile,
                processing_time_ms=processing_time,
                message="Analysis completed successfully"
            )

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"Pipeline failed for dataset {dataset_id}: {e}")
            
            # Update error status
            progress.status = PipelineStatus.FAILED
            progress.error_message = str(e)
            progress.processing_time_ms = processing_time
            await self._update_dataset_status(dataset_id, "failed")
            
            if progress_callback:
                progress_callback(progress)

            # Try to cleanup context if it exists
            try:
                if 'context' in locals():
                    context.cleanup()
            except:
                pass

            # Return partial results if available
            return await self._create_error_response(dataset_id, str(e), processing_time)

    async def _execute_profiler_stage(
        self, 
        context: ProcessingContext, 
        progress: PipelineProgress,
        progress_callback: Optional[Callable[[PipelineProgress], None]] = None
    ):
        """Execute the data profiler agent stage"""
        logger.info(f"Executing profiler stage for dataset {context.dataset_id}")
        
        progress.current_agent = "profiler"
        progress.progress_percentage = 10
        if progress_callback:
            progress_callback(progress)

        try:
            # Execute profiler with timeout
            profiler_result = await asyncio.wait_for(
                self.profiler_agent._safe_process(context),
                timeout=self.agent_timeout_seconds
            )
            
            if profiler_result.success:
                # Store profiler results in database
                await self._store_agent_analysis(
                    context.dataset_id, 
                    "profiler", 
                    profiler_result.data,
                    profiler_result.confidence,
                    profiler_result.processing_time_ms
                )
                
                progress.completed_agents.append("profiler")
                progress.progress_percentage = 33
                logger.info(f"Profiler stage completed successfully")
            else:
                logger.warning(f"Profiler stage failed: {profiler_result.error_message}")
            
            if progress_callback:
                progress_callback(progress)
                
            return profiler_result

        except asyncio.TimeoutError:
            logger.error(f"Profiler stage timed out after {self.agent_timeout_seconds} seconds")
            raise Exception(f"Profiler agent timed out")
        except Exception as e:
            logger.error(f"Profiler stage failed: {e}")
            raise

    async def _execute_recommender_stage(
        self, 
        context: ProcessingContext, 
        progress: PipelineProgress,
        progress_callback: Optional[Callable[[PipelineProgress], None]] = None
    ):
        """Execute the chart recommender agent stage"""
        logger.info(f"Executing recommender stage for dataset {context.dataset_id}")
        
        progress.current_agent = "recommender"
        progress.progress_percentage = 40
        if progress_callback:
            progress_callback(progress)

        try:
            # Execute recommender with timeout
            recommender_result = await asyncio.wait_for(
                self.recommender_agent._safe_process(context),
                timeout=self.agent_timeout_seconds
            )
            
            if recommender_result.success:
                # Cache recommendations for validation stage
                recommendations = recommender_result.data.get("recommendations", [])
                context.cache_computation("recommendations", recommendations)
                
                # Store recommender results in database
                await self._store_agent_analysis(
                    context.dataset_id, 
                    "recommender", 
                    recommender_result.data,
                    recommender_result.confidence,
                    recommender_result.processing_time_ms
                )
                
                progress.completed_agents.append("recommender")
                progress.progress_percentage = 66
                logger.info(f"Recommender stage completed with {len(recommendations)} recommendations")
            else:
                logger.warning(f"Recommender stage failed: {recommender_result.error_message}")
            
            if progress_callback:
                progress_callback(progress)
                
            return recommender_result

        except asyncio.TimeoutError:
            logger.error(f"Recommender stage timed out after {self.agent_timeout_seconds} seconds")
            raise Exception(f"Recommender agent timed out")
        except Exception as e:
            logger.error(f"Recommender stage failed: {e}")
            raise

    async def _execute_validation_stage(
        self, 
        context: ProcessingContext, 
        progress: PipelineProgress,
        progress_callback: Optional[Callable[[PipelineProgress], None]] = None
    ):
        """Execute the validation agent stage"""
        logger.info(f"Executing validation stage for dataset {context.dataset_id}")
        
        progress.current_agent = "validator"
        progress.progress_percentage = 70
        if progress_callback:
            progress_callback(progress)

        try:
            # Execute validator with timeout
            validation_result = await asyncio.wait_for(
                self.validation_agent._safe_process(context),
                timeout=self.agent_timeout_seconds
            )
            
            if validation_result.success:
                # Store validation results in database
                await self._store_agent_analysis(
                    context.dataset_id, 
                    "validator", 
                    validation_result.data,
                    validation_result.confidence,
                    validation_result.processing_time_ms
                )
                
                progress.completed_agents.append("validator")
                progress.progress_percentage = 90
                
                validated_recs = validation_result.data.get("validated_recommendations", [])
                logger.info(f"Validation stage completed with {len(validated_recs)} validated recommendations")
            else:
                logger.warning(f"Validation stage failed: {validation_result.error_message}")
            
            if progress_callback:
                progress_callback(progress)
                
            return validation_result

        except asyncio.TimeoutError:
            logger.error(f"Validation stage timed out after {self.agent_timeout_seconds} seconds")
            raise Exception(f"Validation agent timed out")
        except Exception as e:
            logger.error(f"Validation stage failed: {e}")
            raise

    async def get_status(self, dataset_id: str) -> Dict[str, Any]:
        """Get the current pipeline status for a dataset"""
        try:
            # Get dataset status from database
            dataset_response = self.supabase.table("datasets").select("processing_status").eq("id", dataset_id).execute()

            if not dataset_response.data:
                return {"status": "not_found"}

            status = dataset_response.data[0]["processing_status"]

            # Get completed agent analyses
            analyses_response = self.supabase.table("agent_analyses").select("agent_type, created_at").eq("dataset_id", dataset_id).execute()
            completed_agents = [analysis["agent_type"] for analysis in analyses_response.data]

            # Calculate progress percentage
            progress_map = {"pending": 0, "processing": 25, "completed": 100, "failed": 0}
            if status == "processing":
                # More granular progress based on completed agents
                if "validator" in completed_agents:
                    progress = 90
                elif "recommender" in completed_agents:
                    progress = 66
                elif "profiler" in completed_agents:
                    progress = 33
                else:
                    progress = 10
            else:
                progress = progress_map.get(status, 0)

            return {
                "status": status,
                "progress_percentage": progress,
                "completed_agents": completed_agents,
                "current_agent": self._get_current_agent(status, completed_agents),
                "progress": {
                    "profiler": "profiler" in completed_agents,
                    "recommender": "recommender" in completed_agents,
                    "validator": "validator" in completed_agents
                }
            }

        except Exception as e:
            logger.error(f"Failed to get pipeline status for dataset {dataset_id}: {e}")
            return {"status": "error", "error": str(e)}

    async def get_results(self, dataset_id: str) -> Optional[AnalysisResponse]:
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
            validated_recommendations = []

            for analysis in analyses_response.data:
                agent_type = analysis["agent_type"]
                analysis_data = analysis["analysis_data"]

                if agent_type == "profiler":
                    try:
                        profiler_data = ComprehensiveDataAnalysis(**analysis_data)
                    except Exception as e:
                        logger.error(f"Failed to create ComprehensiveDataAnalysis: {e}")
                        profiler_data = None

                elif agent_type == "validator":
                    val_recs_data = analysis_data.get("validated_recommendations", [])
                    try:
                        validated_recommendations = [ValidatedRecommendation(**rec) for rec in val_recs_data]
                    except Exception as e:
                        logger.error(f"Failed to parse validated recommendations: {e}")
                        validated_recommendations = []

            if not profiler_data or not validated_recommendations:
                logger.warning(f"Missing required data - profiler: {profiler_data is not None}, validated_recs: {len(validated_recommendations)}")
                return None

            return AnalysisResponse(
                success=True,
                dataset_id=dataset_id,
                recommendations=validated_recommendations,
                data_profile=profiler_data,
                processing_time_ms=0,  # Historical data
                message="Analysis results retrieved successfully"
            )

        except Exception as e:
            logger.error(f"Failed to get analysis results for dataset {dataset_id}: {e}")
            return None

    def _get_current_agent(self, status: str, completed_agents: List[str]) -> Optional[str]:
        """Determine current agent based on status and completed agents"""
        if status != "processing":
            return None
        
        if "validator" in completed_agents:
            return None  # All done
        elif "recommender" in completed_agents:
            return "validator"
        elif "profiler" in completed_agents:
            return "recommender"
        else:
            return "profiler"

    async def _store_agent_analysis(
        self,
        dataset_id: str,
        agent_type: str,
        analysis_data: Dict[str, Any],
        confidence_score: float,
        processing_time_ms: int
    ) -> None:
        """Store agent analysis results in the database"""
        try:
            self.supabase.table("agent_analyses").insert({
                "dataset_id": dataset_id,
                "agent_type": agent_type,
                "analysis_data": analysis_data,
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

    async def _create_error_response(
        self, 
        dataset_id: str, 
        error_message: str, 
        processing_time_ms: int
    ) -> AnalysisResponse:
        """Create error response with any partial results available"""
        try:
            # Try to get any partial results
            partial_results = await self.get_results(dataset_id)
            
            if partial_results:
                # Return partial results with error message
                partial_results.success = False
                partial_results.message = f"Partial results available. Error: {error_message}"
                return partial_results
        except:
            pass  # Ignore errors when getting partial results
        
        # Return minimal error response
        return AnalysisResponse(
            success=False,
            dataset_id=dataset_id,
            recommendations=[],
            data_profile=None,
            processing_time_ms=processing_time_ms,
            message=f"Analysis failed: {error_message}"
        )
