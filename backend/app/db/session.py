"""Supabase client management for WEET Director."""

import importlib
import os
from typing import Any

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase() -> Any:
    """Get Supabase client with service role key."""
    supabase = importlib.import_module("supabase")
    create_client = getattr(supabase, "create_client")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


engine = None
AsyncSessionLocal = None


async def get_session():
    """Legacy async session dependency is no longer supported."""
    raise RuntimeError("get_session is deprecated. Use get_supabase instead.")
