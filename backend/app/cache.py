from cachetools import TTLCache
from functools import wraps
import hashlib
import json

# --- CACHE STORES ---
_price_cache = TTLCache(maxsize=100, ttl=300)       # 5 min
_fx_cache = TTLCache(maxsize=10, ttl=900)            # 15 min
_fundamental_cache = TTLCache(maxsize=200, ttl=3600) # 1 uur
_historical_cache = TTLCache(maxsize=100, ttl=3600)  # 1 uur
_benchmark_cache = TTLCache(maxsize=10, ttl=3600)    # 1 uur


def _make_key(args, kwargs):
    raw = json.dumps([str(a) for a in args] + [f"{k}={v}" for k, v in sorted(kwargs.items())], sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def cached(cache_store):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{_make_key(args, kwargs)}"
            if key in cache_store:
                return cache_store[key]
            result = func(*args, **kwargs)
            cache_store[key] = result
            return result
        return wrapper
    return decorator


# --- DECORATORS ---
def cache_prices(func):
    return cached(_price_cache)(func)

def cache_fx(func):
    return cached(_fx_cache)(func)

def cache_fundamental(func):
    return cached(_fundamental_cache)(func)

def cache_historical(func):
    return cached(_historical_cache)(func)

def cache_benchmark(func):
    return cached(_benchmark_cache)(func)
