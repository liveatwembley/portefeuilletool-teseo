from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user
from app.dependencies import get_db
from core.database import (
    get_all_positions, get_position_by_ticker, get_latest_snapshot,
    get_holdings_for_snapshot, get_transactions_for_position,
)
from core.market_data import (
    get_historical_prices, get_fundamental_data, get_current_prices,
    get_live_fx_rates, classify_style,
)
from core.calculations import enrich_all_holdings
from core.config.tickers import is_pence_ticker

router = APIRouter()


class AdviceUpdate(BaseModel):
    advice: Optional[str] = None
    motivation: Optional[str] = None


@router.get('/')
def list_positions(db=Depends(get_db), user=Depends(get_current_user)):
    return get_all_positions(db)


@router.get('/{ticker}')
def get_position_detail(ticker: str, db=Depends(get_db), user=Depends(get_current_user)):
    position = get_position_by_ticker(db, ticker)
    if not position:
        raise HTTPException(status_code=404, detail=f'Positie {ticker} niet gevonden')

    snapshot = get_latest_snapshot(db)
    holding_data = None
    if snapshot:
        holdings = get_holdings_for_snapshot(db, snapshot['id'])
        live_prices = get_current_prices(tuple([h['eq_positions']['ticker'] for h in holdings if h.get('eq_positions')]))
        fx_rates = get_live_fx_rates()
        enriched = enrich_all_holdings(holdings, live_prices, fx_rates)
        for h in enriched:
            if h.get('ticker') == ticker:
                holding_data = h
                break

    fundamentals = get_fundamental_data(ticker)
    style = classify_style(fundamentals.get('market_cap'), fundamentals.get('pb'))

    # Pence-correctie voor 52W range
    if is_pence_ticker(ticker):
        for key in ['fifty_two_week_high', 'fifty_two_week_low']:
            if fundamentals.get(key):
                fundamentals[key] = fundamentals[key] / 100.0

    transactions = get_transactions_for_position(db, position['id'])

    return {
        'position': position,
        'holding': holding_data,
        'fundamentals': fundamentals,
        'style': {'row': style[0], 'col': style[1]},
        'transactions': transactions,
    }


@router.get('/{ticker}/history')
def get_position_history(ticker: str, period: str = '1y', user=Depends(get_current_user)):
    hist = get_historical_prices(ticker, period)
    if hist.empty:
        return {'data': []}
    return {
        'data': [
            {
                'date': idx.strftime('%Y-%m-%d'),
                'open': float(row.get('Open', 0)),
                'high': float(row.get('High', 0)),
                'low': float(row.get('Low', 0)),
                'close': float(row.get('Close', 0)),
                'volume': int(row.get('Volume', 0)),
            }
            for idx, row in hist.iterrows()
        ]
    }


@router.put('/{ticker}/advice')
def update_advice(ticker: str, body: AdviceUpdate, db=Depends(get_db), user=Depends(get_current_user)):
    snapshot = get_latest_snapshot(db)
    if not snapshot:
        raise HTTPException(status_code=404, detail='Geen snapshot gevonden')

    holdings = get_holdings_for_snapshot(db, snapshot['id'])
    target = None
    for h in holdings:
        if h.get('eq_positions', {}).get('ticker') == ticker:
            target = h
            break

    if not target:
        raise HTTPException(status_code=404, detail=f'Holding voor {ticker} niet gevonden')

    update_data = {}
    if body.advice is not None:
        update_data['advice'] = body.advice
    if body.motivation is not None:
        update_data['motivation'] = body.motivation

    if update_data:
        db.table('eq_holdings').update(update_data).eq('id', target['id']).execute()

    return {'status': 'ok'}
