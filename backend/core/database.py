import os
from supabase import create_client

_client = None


def get_supabase_client():
    global _client
    if _client is None:
        _client = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_KEY')
        )
    return _client

# ─── POSITIONS ───────────────────────────────────────────────

def get_all_positions(supabase):
    return supabase.table('eq_positions').select('*').eq('is_active', True).order('name').execute().data

def get_position_by_ticker(supabase, ticker):
    result = supabase.table('eq_positions').select('*').eq('ticker', ticker).limit(1).execute()
    return result.data[0] if result.data else None

def upsert_position(supabase, ticker, name, currency='EUR', sector=None, country=None):
    existing = get_position_by_ticker(supabase, ticker)
    data = {'ticker': ticker, 'name': name, 'currency': currency, 'sector': sector, 'country': country}
    if existing:
        supabase.table('eq_positions').update(data).eq('id', existing['id']).execute()
        return existing['id']
    else:
        result = supabase.table('eq_positions').insert(data).execute()
        return result.data[0]['id']

# ─── SNAPSHOTS ───────────────────────────────────────────────

def get_all_snapshots(supabase):
    return supabase.table('eq_snapshots').select('*').order('snapshot_date', desc=True).execute().data

def get_snapshot_by_date(supabase, date_str):
    result = supabase.table('eq_snapshots').select('*').eq('snapshot_date', date_str).limit(1).execute()
    return result.data[0] if result.data else None

def get_latest_snapshot(supabase):
    result = supabase.table('eq_snapshots').select('*').order('snapshot_date', desc=True).limit(1).execute()
    return result.data[0] if result.data else None

def upsert_snapshot(supabase, snapshot_date, cash_eur=0, total_value_eur=0, cash_pct=0,
                    notes=None, eur_usd=None, eur_gbp=None, eur_dkk=None, eur_hkd=None):
    existing = get_snapshot_by_date(supabase, snapshot_date)
    data = {
        'snapshot_date': snapshot_date,
        'cash_eur': cash_eur,
        'total_value_eur': total_value_eur,
        'cash_pct': cash_pct,
        'notes': notes,
        'eur_usd': eur_usd,
        'eur_gbp': eur_gbp,
        'eur_dkk': eur_dkk,
        'eur_hkd': eur_hkd,
    }
    if existing:
        supabase.table('eq_snapshots').update(data).eq('id', existing['id']).execute()
        return existing['id']
    else:
        result = supabase.table('eq_snapshots').insert(data).execute()
        return result.data[0]['id']

# ─── HOLDINGS ────────────────────────────────────────────────

def get_holdings_for_snapshot(supabase, snapshot_id):
    return supabase.table('eq_holdings').select('*, eq_positions(*)').eq('snapshot_id', snapshot_id).order('value_eur', desc=True).execute().data

def save_holding(supabase, snapshot_id, position_id, shares, price_local=None, price_eur=None,
                 avg_cost=None, value_eur=None, pnl_nominal=None, pnl_pct=None, weight_pct=None,
                 advice=None, mandate_buy=0, mandate_sell=0, motivation=None):
    data = {
        'snapshot_id': snapshot_id,
        'position_id': position_id,
        'shares': shares,
        'price_local': price_local,
        'price_eur': price_eur,
        'avg_cost': avg_cost,
        'value_eur': value_eur,
        'pnl_nominal': pnl_nominal,
        'pnl_pct': pnl_pct,
        'weight_pct': weight_pct,
        'advice': advice,
        'mandate_buy': mandate_buy,
        'mandate_sell': mandate_sell,
        'motivation': motivation,
    }
    supabase.table('eq_holdings').insert(data).execute()

# ─── TRANSACTIONS ────────────────────────────────────────────

def get_all_transactions(supabase):
    return supabase.table('eq_transactions').select('*, eq_positions(*)').order('transaction_date', desc=True).execute().data

def get_transactions_for_position(supabase, position_id):
    return supabase.table('eq_transactions').select('*').eq('position_id', position_id).order('transaction_date', desc=True).execute().data

def add_transaction(supabase, position_id, transaction_date, tx_type, shares, price_local, price_eur,
                    fx_rate=None, fees=0, notes=None):
    return supabase.table('eq_transactions').insert({
        'position_id': position_id,
        'transaction_date': transaction_date,
        'type': tx_type,
        'shares': shares,
        'price_local': price_local,
        'price_eur': price_eur,
        'fx_rate': fx_rate,
        'fees': fees,
        'notes': notes,
    }).execute().data

# ─── PRICE CACHE ─────────────────────────────────────────────

def get_cached_price(supabase, ticker, date_str):
    result = supabase.table('eq_price_cache').select('*').eq('ticker', ticker).eq('price_date', date_str).limit(1).execute()
    return result.data[0] if result.data else None

def cache_price(supabase, ticker, price_date, open_p, high_p, low_p, close_p, volume, currency):
    supabase.table('eq_price_cache').upsert({
        'ticker': ticker,
        'price_date': price_date,
        'open_price': open_p,
        'high_price': high_p,
        'low_price': low_p,
        'close_price': close_p,
        'volume': volume,
        'currency': currency,
    }).execute()

# ─── FX RATES ────────────────────────────────────────────────

def get_fx_rate(supabase, pair, date_str):
    result = supabase.table('eq_fx_rates').select('*').eq('pair', pair).eq('rate_date', date_str).limit(1).execute()
    return result.data[0]['rate'] if result.data else None

def cache_fx_rate(supabase, pair, rate_date, rate):
    supabase.table('eq_fx_rates').upsert({
        'pair': pair,
        'rate_date': rate_date,
        'rate': rate,
    }).execute()
