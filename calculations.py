"""
Centrale portfolio berekeningen.

Eén plek voor alle waarde-, P&L- en gewichtberekeningen.
Wordt gebruikt door dashboard.py (display) en live_refresh.py (snapshot opslaan).
"""

from config.tickers import get_sector, get_currency, is_pence_ticker
from market_data import convert_to_eur
from utils import geo_from_ticker


def _correct_pence_avg_cost(ticker, avg_cost, price_local):
    """
    Corrigeer avg_cost voor pence-tickers.

    avg_cost kan in pence of in pounds opgeslagen zijn (afhankelijk van bron).
    Vergelijk met price_local (altijd al pence-adjusted = in pounds) om te bepalen:
    - Als avg_cost > 10 × price_local → waarschijnlijk in pence, delen door 100
    - Anders → al in pounds, niks doen
    """
    if not is_pence_ticker(ticker) or avg_cost <= 0 or price_local <= 0:
        return avg_cost

    # Als avg_cost veel groter is dan de huidige koers in pounds, dan is het in pence
    if avg_cost > price_local * 10:
        return avg_cost / 100.0
    return avg_cost


def enrich_holding(holding, live_prices, fx_rates):
    """
    Verrijk een enkele holding met live koersen, FX-conversie en P&L.

    Args:
        holding: dict uit Supabase eq_holdings (met nested eq_positions)
        live_prices: dict van ticker → {price, prev_close, volume}
        fx_rates: dict van paar → rate (bv. 'EUR/USD' → 1.08)

    Returns: dict met alle berekende velden, of None als holding ongeldig is.
    """
    pos = holding.get('eq_positions', {})
    ticker = pos.get('ticker', '')
    name = pos.get('name', ticker)
    currency = pos.get('currency', 'EUR')
    shares = holding.get('shares', 0)

    if not ticker or shares == 0:
        return None

    # Koers: live of fallback naar laatst bekende
    if ticker in live_prices:
        price_local = live_prices[ticker]['price']
        prev_close = live_prices[ticker].get('prev_close', price_local)
    else:
        price_local = float(holding.get('price_local', 0) or 0)
        # Fallback voor pence-tickers: IBKR slaat price_local in pence op
        if is_pence_ticker(ticker) and price_local > 500:
            price_local = price_local / 100.0
        prev_close = price_local

    # FX conversie
    price_eur = convert_to_eur(price_local, currency, fx_rates)
    prev_eur = convert_to_eur(prev_close, currency, fx_rates)

    # Waarde
    value = shares * price_eur
    prev_value = shares * prev_eur

    # Gemiddelde kostprijs — slimme pence-correctie op basis van koersvergelijking
    avg_cost = float(holding.get('avg_cost', 0) or 0)
    avg_cost = _correct_pence_avg_cost(ticker, avg_cost, price_local)
    avg_cost_eur = convert_to_eur(avg_cost, currency, fx_rates) if avg_cost > 0 else 0

    # P&L
    if avg_cost_eur > 0:
        pnl_nominal = value - (shares * avg_cost_eur)
        pnl_pct = ((price_eur - avg_cost_eur) / avg_cost_eur * 100)
    else:
        pnl_nominal = float(holding.get('pnl_nominal', 0) or 0)
        pnl_pct = float(holding.get('pnl_pct', 0) or 0)

    # Dagverandering
    day_change = price_eur - prev_eur
    day_change_pct = (day_change / prev_eur * 100) if prev_eur else 0

    # FX rate voor deze holding (voor lokale valuta weergave)
    fx_pair = f'EUR/{currency}'
    fx_rate = fx_rates.get(fx_pair, 1.0) if currency != 'EUR' else 1.0

    return {
        # Identificatie
        'name': name,
        'ticker': ticker,
        'currency': currency,
        'sector': get_sector(ticker),
        'geo': geo_from_ticker(ticker),
        'position_id': holding.get('position_id') or pos.get('id'),
        # Koersen
        'shares': shares,
        'price_local': price_local,
        'price_eur': price_eur,
        'prev_close_local': prev_close,
        'prev_close_eur': prev_eur,
        'avg_cost': avg_cost,                      # Lokale valuta (na pence-correctie)
        'avg_cost_eur': avg_cost_eur,
        'fx_rate': fx_rate,                        # EUR/XXX rate
        # Waarden
        'value': value,
        'prev_value': prev_value,
        # P&L
        'pnl_nominal': pnl_nominal,
        'pnl_pct': pnl_pct,
        'day_change': day_change,
        'day_change_pct': day_change_pct,
        # Metadata (doorgesluisd)
        'advice': holding.get('advice', ''),
        'mandate_buy': holding.get('mandate_buy', 0),
        'mandate_sell': holding.get('mandate_sell', 0),
        'motivation': holding.get('motivation'),
    }


def enrich_all_holdings(holdings, live_prices, fx_rates):
    """
    Verrijk alle holdings en bereken gewichten.

    Returns: list van enriched holding dicts (met 'weight' veld).
    """
    enriched = []
    for h in holdings:
        row = enrich_holding(h, live_prices, fx_rates)
        if row:
            enriched.append(row)

    total_value = sum(r['value'] for r in enriched)

    for r in enriched:
        r['weight'] = (r['value'] / total_value * 100) if total_value else 0

    return enriched


def calculate_portfolio_meta(enriched_holdings, cash, fx_rates, snapshot_date=''):
    """
    Bereken portfolio-level meta data.

    Args:
        enriched_holdings: output van enrich_all_holdings()
        cash: cash bedrag in EUR
        fx_rates: wisselkoersen dict
        snapshot_date: datum string

    Returns: dict met portfolio totalen en percentages.
    """
    total_value = sum(r['value'] for r in enriched_holdings)
    total_prev_value = sum(r['prev_value'] for r in enriched_holdings)
    portfolio_total = total_value + cash

    # Herbereken gewichten inclusief cash
    for r in enriched_holdings:
        r['weight'] = (r['value'] / portfolio_total * 100) if portfolio_total else 0

    return {
        'cash': cash,
        'portfolio_total': portfolio_total,
        'total_value': total_value,
        'total_prev_value': total_prev_value,
        'day_delta': total_value - total_prev_value,
        'day_delta_pct': ((total_value - total_prev_value) / total_prev_value * 100) if total_prev_value else 0,
        'cash_pct': (cash / portfolio_total * 100) if portfolio_total else 0,
        'fx_rates': fx_rates,
        'snapshot_date': snapshot_date,
    }
