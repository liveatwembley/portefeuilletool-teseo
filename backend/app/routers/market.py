from fastapi import APIRouter, Depends, Query
from typing import List

from app.auth import get_current_user
from core.market_data import get_current_prices, get_live_fx_rates, get_fundamental_data

router = APIRouter()


@router.get('/prices')
def prices(tickers: str = Query(..., description='Komma-gescheiden tickers'), user=Depends(get_current_user)):
    ticker_list = [t.strip() for t in tickers.split(',') if t.strip()]
    return get_current_prices(tuple(ticker_list))


@router.get('/fx')
def fx_rates(user=Depends(get_current_user)):
    return get_live_fx_rates()


@router.get('/fundamentals/{ticker}')
def fundamentals(ticker: str, user=Depends(get_current_user)):
    return get_fundamental_data(ticker)
