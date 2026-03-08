import importlib
import os
from typing import Any


def get_supabase() -> Any:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase = importlib.import_module("supabase")
    create_client = getattr(supabase, "create_client")
    return create_client(url, key)


engine = None
AsyncSessionLocal = None


async def get_session():
    """Legacy async session dependency is no longer supported."""
    raise RuntimeError("get_session is deprecated. Use get_supabase instead.")
