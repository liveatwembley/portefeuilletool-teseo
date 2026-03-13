from core.database import get_supabase_client


def get_db():
    return get_supabase_client()
