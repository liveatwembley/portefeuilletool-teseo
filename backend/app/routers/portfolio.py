import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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
    try:
        enriched, meta, fx_rates = _get_enriched_portfolio(db)
    except Exception as e:
        logger.error("Portfolio overview fout: %s", e)
        raise HTTPException(status_code=500, detail=f"Fout bij laden portfolio: {e}")
    if enriched is None:
        return {'meta': None, 'holdings': [], 'fx_rates': {}, 'treasury_eur': 0}
    treasury_eur = _get_treasury_eur(db)

    # Herbereken gewichten en cash_pct inclusief treasury
    if treasury_eur > 0 and meta:
        total_with_treasury = meta['portfolio_total'] + treasury_eur
        if total_with_treasury > 0:
            for h in enriched:
                h['weight'] = h['value'] / total_with_treasury * 100
            meta['cash_pct'] = (meta['cash'] + treasury_eur) / total_with_treasury * 100

    return {'meta': meta, 'holdings': enriched, 'fx_rates': fx_rates, 'treasury_eur': treasury_eur}


@router.get('/xray')
def xray(db=Depends(get_db), user=Depends(get_current_user)):
    try:
        enriched, meta, fx_rates = _get_enriched_portfolio(db)
    except Exception as e:
        logger.error("Portfolio xray fout: %s", e)
        raise HTTPException(status_code=500, detail=f"Fout bij laden X-Ray: {e}")
    if enriched is None:
        return {'concentration': {}, 'sectors': [], 'geo': [], 'currencies': [], 'advice': []}

    # Herbereken gewichten inclusief treasury
    treasury_eur = _get_treasury_eur(db)
    if treasury_eur > 0 and meta:
        total_with_treasury = meta['portfolio_total'] + treasury_eur
        if total_with_treasury > 0:
            for h in enriched:
                h['weight'] = h['value'] / total_with_treasury * 100

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
    try:
        snapshots = get_all_snapshots(db)
    except Exception as e:
        logger.error("Snapshots ophalen mislukt: %s", e)
        snapshots = []
    try:
        benchmarks_raw = get_benchmark_history('1y')
    except Exception as e:
        logger.error("Benchmark data ophalen mislukt: %s", e)
        benchmarks_raw = {}

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
    try:
        enriched, meta, fx_rates = _get_enriched_portfolio(db)
    except Exception as e:
        logger.error("Holdings ophalen mislukt: %s", e)
        raise HTTPException(status_code=500, detail=f"Fout bij laden holdings: {e}")
    if enriched is None:
        return {'holdings': [], 'fundamentals': {}}

    # Herbereken gewichten inclusief treasury
    treasury_eur = _get_treasury_eur(db)
    if treasury_eur > 0 and meta:
        total_with_treasury = meta['portfolio_total'] + treasury_eur
        if total_with_treasury > 0:
            for h in enriched:
                h['weight'] = h['value'] / total_with_treasury * 100

    tickers = [h['ticker'] for h in enriched]
    fund_data = get_fundamental_data_batch(tuple(tickers))

    return {'holdings': enriched, 'fundamentals': fund_data, 'meta': meta}
