from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.dependencies import get_db
from core.database import get_latest_snapshot, get_holdings_for_snapshot, get_all_snapshots
from core.market_data import get_current_prices, get_live_fx_rates, get_fundamental_data_batch, get_benchmark_history, classify_style
from core.calculations import enrich_all_holdings, calculate_portfolio_meta
from core.utils import concentration_metrics

router = APIRouter()


# --- SETTINGS ---

class SettingsBody(BaseModel):
    treasury_eur: float = 0


def _get_treasury_eur(db):
    """Lees treasury_eur uit eq_settings, default 0."""
    try:
        result = db.table('eq_settings').select('*').eq('key', 'treasury_eur').limit(1).execute()
        if result.data:
            return float(result.data[0].get('value', 0))
    except Exception:
        pass
    return 0


@router.get('/settings')
def get_settings(db=Depends(get_db), user=Depends(get_current_user)):
    treasury_eur = _get_treasury_eur(db)
    return {'treasury_eur': treasury_eur}


@router.put('/settings')
def update_settings(body: SettingsBody, db=Depends(get_db), user=Depends(get_current_user)):
    db.table('eq_settings').upsert(
        {'key': 'treasury_eur', 'value': str(body.treasury_eur)},
        on_conflict='key'
    ).execute()
    return {'treasury_eur': body.treasury_eur}


def _get_enriched_portfolio(db):
    snapshot = get_latest_snapshot(db)
    if not snapshot:
        return None, None, None
    holdings = get_holdings_for_snapshot(db, snapshot['id'])
    tickers = [h['eq_positions']['ticker'] for h in holdings if h.get('eq_positions')]
    live_prices = get_current_prices(tuple(tickers))
    fx_rates = get_live_fx_rates()
    enriched = enrich_all_holdings(holdings, live_prices, fx_rates)
    cash = float(snapshot.get('cash_eur', 0) or 0)
    meta = calculate_portfolio_meta(enriched, cash, fx_rates, snapshot.get('snapshot_date', ''))
    return enriched, meta, fx_rates


@router.get('/overview')
def overview(db=Depends(get_db), user=Depends(get_current_user)):
    enriched, meta, fx_rates = _get_enriched_portfolio(db)
    if enriched is None:
        return {'meta': None, 'holdings': [], 'fx_rates': {}, 'treasury_eur': 0}
    treasury_eur = _get_treasury_eur(db)
    return {'meta': meta, 'holdings': enriched, 'fx_rates': fx_rates, 'treasury_eur': treasury_eur}


@router.get('/xray')
def xray(db=Depends(get_db), user=Depends(get_current_user)):
    enriched, meta, fx_rates = _get_enriched_portfolio(db)
    if enriched is None:
        return {'concentration': {}, 'sectors': [], 'geo': [], 'currencies': [], 'advice': []}

    weights = [h.get('weight', 0) for h in enriched]
    conc = concentration_metrics(weights)

    # Sector aggregatie
    sectors = {}
    for h in enriched:
        s = h.get('sector', 'Overig')
        if s not in sectors:
            sectors[s] = {'sector': s, 'weight': 0, 'value': 0, 'pnl': 0, 'count': 0}
        sectors[s]['weight'] += h.get('weight', 0)
        sectors[s]['value'] += h.get('value', 0)
        sectors[s]['pnl'] += h.get('pnl_nominal', 0)
        sectors[s]['count'] += 1

    # Geo aggregatie
    geo = {}
    for h in enriched:
        g = h.get('geo', 'Overig')
        if g not in geo:
            geo[g] = {'geo': g, 'weight': 0, 'value': 0, 'count': 0}
        geo[g]['weight'] += h.get('weight', 0)
        geo[g]['value'] += h.get('value', 0)
        geo[g]['count'] += 1

    # Currency aggregatie
    currencies = {}
    for h in enriched:
        c = h.get('currency', 'EUR')
        if c not in currencies:
            currencies[c] = {'currency': c, 'weight': 0, 'value': 0, 'count': 0}
        currencies[c]['weight'] += h.get('weight', 0)
        currencies[c]['value'] += h.get('value', 0)
        currencies[c]['count'] += 1

    # Advice aggregatie
    advice = {}
    for h in enriched:
        a = h.get('advice', '') or ''
        if a:
            if a not in advice:
                advice[a] = {'advice': a, 'count': 0, 'value': 0}
            advice[a]['count'] += 1
            advice[a]['value'] += h.get('value', 0)

    return {
        'concentration': conc,
        'sectors': sorted(sectors.values(), key=lambda x: x['weight'], reverse=True),
        'geo': sorted(geo.values(), key=lambda x: x['weight'], reverse=True),
        'currencies': sorted(currencies.values(), key=lambda x: x['weight'], reverse=True),
        'advice': list(advice.values()),
        'holdings': enriched,
    }


@router.get('/performance')
def performance(db=Depends(get_db), user=Depends(get_current_user)):
    snapshots = get_all_snapshots(db)
    benchmarks_raw = get_benchmark_history('1y')

    # Converteer DataFrames naar serializable dicts
    benchmarks = {}
    for name, df in benchmarks_raw.items():
        benchmarks[name] = [
            {'date': idx.strftime('%Y-%m-%d'), 'close': float(row['Close'])}
            for idx, row in df.iterrows()
        ]

    return {'snapshots': snapshots, 'benchmarks': benchmarks}


@router.get('/holdings')
def holdings(db=Depends(get_db), user=Depends(get_current_user)):
    enriched, meta, fx_rates = _get_enriched_portfolio(db)
    if enriched is None:
        return {'holdings': [], 'fundamentals': {}}

    tickers = [h['ticker'] for h in enriched]
    fund_data = get_fundamental_data_batch(tuple(tickers))

    return {'holdings': enriched, 'fundamentals': fund_data, 'meta': meta}
