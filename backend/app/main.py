import sys
import os

# Voeg backend/ toe aan sys.path zodat core.* imports werken
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import portfolio, positions, transactions, market, sync, auth_router

app = FastAPI(
    title='Teseo Portefeuilletool API',
    version='1.0.0',
    docs_url='/api/docs',
    openapi_url='/api/openapi.json',
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get('FRONTEND_URL', 'http://localhost:3000'),
        'http://localhost:3000',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# --- ROUTERS ---
app.include_router(auth_router.router, prefix='/api/auth', tags=['auth'])
app.include_router(portfolio.router, prefix='/api/portfolio', tags=['portfolio'])
app.include_router(positions.router, prefix='/api/positions', tags=['positions'])
app.include_router(transactions.router, prefix='/api/transactions', tags=['transactions'])
app.include_router(market.router, prefix='/api/market', tags=['market'])
app.include_router(sync.router, prefix='/api/sync', tags=['sync'])


@app.get('/api/health')
def health():
    return {'status': 'ok'}
