from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user
from app.dependencies import get_db
from core.market_data import get_fundamental_data, get_current_prices

router = APIRouter()


class WatchlistCreate(BaseModel):
    ticker: str
    name: str
    sector: Optional[str] = None
    owner: Optional[str] = None
    bio: Optional[str] = None


class WatchlistUpdate(BaseModel):
    owner: Optional[str] = None
    bio: Optional[str] = None
    comment: Optional[str] = None
    trigger_buy: Optional[float] = None
    trigger_sell: Optional[float] = None


@router.get('/')
def list_watchlist(db=Depends(get_db), user=Depends(get_current_user)):
    result = db.table('eq_watchlist').select('*').order('sector', desc=False).execute()
    items = result.data or []

    if not items:
        return []

    # Haal live prijzen + fundamentals op
    tickers = tuple([item['ticker'] for item in items])
    live_prices = get_current_prices(tickers)

    enriched = []
    for item in items:
        ticker = item['ticker']
        price_data = live_prices.get(ticker, {})
        fundamentals = get_fundamental_data(ticker)

        current_price = price_data.get('price', 0)
        alert = None
        if item.get('trigger_buy') and current_price and current_price <= item['trigger_buy']:
            alert = 'buy'
        elif item.get('trigger_sell') and current_price and current_price >= item['trigger_sell']:
            alert = 'sell'

        enriched.append({
            **item,
            'current_price': current_price,
            'prev_close': price_data.get('prev_close', 0),
            'day_change_pct': price_data.get('day_change_pct', 0),
            'pe': fundamentals.get('pe_trailing'),
            'pb': fundamentals.get('pb'),
            'dividend_yield': fundamentals.get('dividend_yield'),
            'market_cap': fundamentals.get('market_cap'),
            'fifty_two_week_high': fundamentals.get('fifty_two_week_high'),
            'fifty_two_week_low': fundamentals.get('fifty_two_week_low'),
            'alert': alert,
        })

    return enriched


@router.post('/')
def add_to_watchlist(body: WatchlistCreate, db=Depends(get_db), user=Depends(get_current_user)):
    data = {
        'ticker': body.ticker,
        'name': body.name,
        'sector': body.sector,
        'owner': body.owner,
        'bio': body.bio,
    }
    result = db.table('eq_watchlist').insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail='Kon niet toevoegen')
    return result.data[0]


@router.put('/{item_id}')
def update_watchlist_item(item_id: int, body: WatchlistUpdate, db=Depends(get_db), user=Depends(get_current_user)):
    update_data = {}
    if body.owner is not None:
        update_data['owner'] = body.owner
    if body.bio is not None:
        update_data['bio'] = body.bio
    if body.comment is not None:
        update_data['comment'] = body.comment
    if body.trigger_buy is not None:
        update_data['trigger_buy'] = body.trigger_buy
    if body.trigger_sell is not None:
        update_data['trigger_sell'] = body.trigger_sell

    if not update_data:
        return {'status': 'ok'}

    db.table('eq_watchlist').update(update_data).eq('id', item_id).execute()
    return {'status': 'ok'}


@router.delete('/{item_id}')
def remove_from_watchlist(item_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    db.table('eq_watchlist').delete().eq('id', item_id).execute()
    return {'status': 'ok'}
