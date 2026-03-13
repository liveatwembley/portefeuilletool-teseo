import json
import logging
from datetime import datetime

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user
from app.dependencies import get_db
from core.database import get_latest_snapshot, get_holdings_for_snapshot
from core.market_data import get_current_prices, get_live_fx_rates
from core.calculations import enrich_all_holdings

logger = logging.getLogger(__name__)

router = APIRouter()


# --- MODELS ---

class ThesisUpdate(BaseModel):
    thesis: Optional[str] = None
    kpis: Optional[str] = None
    last_review: Optional[str] = None


# --- HELPERS ---

def _get_earnings_date(ticker):
    """Haal de eerstvolgende earnings datum op via yfinance."""
    try:
        stock = yf.Ticker(ticker)
        cal = stock.calendar
        if cal is not None:
            # yfinance calendar kan een dict of DataFrame zijn
            if isinstance(cal, dict):
                ed = cal.get('Earnings Date')
                if ed:
                    if isinstance(ed, list) and len(ed) > 0:
                        return ed[0].strftime('%Y-%m-%d') if hasattr(ed[0], 'strftime') else str(ed[0])
                    elif hasattr(ed, 'strftime'):
                        return ed.strftime('%Y-%m-%d')
                    return str(ed)
            else:
                # DataFrame variant
                if 'Earnings Date' in cal.columns:
                    vals = cal['Earnings Date'].tolist()
                    if vals:
                        v = vals[0]
                        return v.strftime('%Y-%m-%d') if hasattr(v, 'strftime') else str(v)
                elif 'Earnings Date' in cal.index:
                    vals = cal.loc['Earnings Date'].tolist()
                    if vals:
                        v = vals[0]
                        return v.strftime('%Y-%m-%d') if hasattr(v, 'strftime') else str(v)
    except Exception as e:
        logger.warning("Earnings date ophalen mislukt voor %s: %s", ticker, e)
    return None


# --- ENDPOINTS ---

@router.get('/calendar')
def earnings_calendar(db=Depends(get_db), user=Depends(get_current_user)):
    """Geeft earnings data terug voor alle posities in de portefeuille."""
    snapshot = get_latest_snapshot(db)
    if not snapshot:
        return []

    holdings = get_holdings_for_snapshot(db, snapshot['id'])
    tickers = [h['eq_positions']['ticker'] for h in holdings if h.get('eq_positions')]
    live_prices = get_current_prices(tuple(tickers))
    fx_rates = get_live_fx_rates()
    enriched = enrich_all_holdings(holdings, live_prices, fx_rates)

    results = []
    for h in enriched:
        ticker = h.get('ticker', '')
        earnings_date = _get_earnings_date(ticker)
        results.append({
            'ticker': ticker,
            'name': h.get('name', ''),
            'sector': h.get('sector', ''),
            'earnings_date': earnings_date,
            'weight': h.get('weight', 0),
        })

    # Sorteer: posities met datum eerst (ascending), daarna nulls
    results.sort(key=lambda x: (x['earnings_date'] is None, x['earnings_date'] or '9999-12-31'))

    return results


@router.get('/thesis/{ticker}')
def get_thesis(ticker: str, db=Depends(get_db), user=Depends(get_current_user)):
    """Haal investment thesis op voor een positie."""
    try:
        result = db.table('eq_settings').select('*').eq('key', f'thesis_{ticker}').limit(1).execute()
        if result.data:
            value = result.data[0].get('value', '{}')
            data = json.loads(value)
            return {
                'ticker': ticker,
                'thesis': data.get('thesis', ''),
                'kpis': data.get('kpis', ''),
                'last_review': data.get('last_review', ''),
            }
    except Exception as e:
        logger.warning("Thesis ophalen mislukt voor %s: %s", ticker, e)

    return {
        'ticker': ticker,
        'thesis': '',
        'kpis': '',
        'last_review': '',
    }


@router.put('/thesis/{ticker}')
def update_thesis(ticker: str, body: ThesisUpdate, db=Depends(get_db), user=Depends(get_current_user)):
    """Sla investment thesis op voor een positie."""
    value = json.dumps({
        'thesis': body.thesis or '',
        'kpis': body.kpis or '',
        'last_review': body.last_review or '',
    })

    db.table('eq_settings').upsert(
        {'key': f'thesis_{ticker}', 'value': value},
        on_conflict='key'
    ).execute()

    return {'status': 'ok'}
