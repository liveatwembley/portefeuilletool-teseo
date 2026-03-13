from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user
from app.dependencies import get_db
from core.database import get_all_transactions, add_transaction, get_position_by_ticker

router = APIRouter()


class TransactionCreate(BaseModel):
    ticker: str
    transaction_date: str
    type: str  # BUY or SELL
    shares: float
    price_local: float
    price_eur: float
    fx_rate: Optional[float] = None
    fees: float = 0
    notes: Optional[str] = None


@router.get('/')
def list_transactions(db=Depends(get_db), user=Depends(get_current_user)):
    return get_all_transactions(db)


@router.post('/')
def create_transaction(body: TransactionCreate, db=Depends(get_db), user=Depends(get_current_user)):
    position = get_position_by_ticker(db, body.ticker)
    if not position:
        return {'status': 'error', 'message': f'Positie {body.ticker} niet gevonden'}

    result = add_transaction(
        db,
        position_id=position['id'],
        transaction_date=body.transaction_date,
        tx_type=body.type,
        shares=body.shares,
        price_local=body.price_local,
        price_eur=body.price_eur,
        fx_rate=body.fx_rate,
        fees=body.fees,
        notes=body.notes,
    )
    return {'status': 'ok', 'data': result}
