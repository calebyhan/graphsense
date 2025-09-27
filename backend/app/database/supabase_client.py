"""
Supabase client configuration and utilities
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client instance"""
    global _supabase_client

    if _supabase_client is None:
        try:
            _supabase_client = create_client(
                supabase_url=settings.supabase_url,
                supabase_key=settings.supabase_service_key
            )
            logger.info("Supabase client created successfully")
        except Exception as e:
            logger.error(f"Failed to create Supabase client: {e}")
            raise

    return _supabase_client

async def test_connection() -> bool:
    """Test Supabase connection"""
    try:
        client = get_supabase_client()
        # Simple health check
        response = client.table("datasets").select("id").limit(1).execute()
        logger.info("Supabase connection test successful")
        return True
    except Exception as e:
        logger.error(f"Supabase connection test failed: {e}")
        return False