"""
Live Refresh: Herberekent portefeuillewaarde met Yahoo Finance live koersen.

Neemt de laatst bekende posities (uit Google Sheets of IBKR) en combineert
deze met live koersen en wisselkoersen om een actueel snapshot te maken.

Databronnen:
  - 2019 – eind 2025: Google Sheets (historische snapshots)
  - 1 jan 2026 – heden: Live refresh (Yahoo Finance) + IBKR Flex Query (wanneer beschikbaar)
"""

import logging
from datetime import date, datetime

logger = logging.getLogger(__name__)

# Grens: Google Sheets data tot eind 2025, daarna live/IBKR
SHEETS_END_DATE = date(2025, 12, 31)
IBKR_START_DATE = date(2026, 1, 1)


def refresh_live_snapshot(supabase):
    """
    Maak een live snapshot op basis van de laatste bekende posities
    gecombineerd met actuele Yahoo Finance koersen.

    Dit wordt gebruikt voor dagelijkse updates wanneer IBKR Flex nog niet
    geconfigureerd is. De posities (aantallen) komen uit het laatste Sheets-snapshot,
    de koersen worden live opgehaald.

    Returns: dict met resultaten of None bij fout.
    """
    from core.database import (
        get_latest_snapshot, get_holdings_for_snapshot,
        upsert_snapshot, save_holding
    )
    from core.market_data import get_current_prices, get_live_fx_rates
    from core.calculations import enrich_all_holdings

    today = date.today()
    today_str = today.isoformat()

    # Zoek het meest recente snapshot met posities (als basis voor aantallen)
    latest = get_latest_snapshot(supabase)
    if not latest:
        return {'status': 'error', 'message': 'Geen bestaande snapshots gevonden.'}

    # Als het laatste snapshot al van vandaag is EN het is een live refresh, skip
    if latest.get('snapshot_date') == today_str and 'Live refresh' in (latest.get('notes') or ''):
        return {'status': 'skipped', 'message': f'Live snapshot van vandaag bestaat al ({today_str}).'}

    holdings = get_holdings_for_snapshot(supabase, latest['id'])
    if not holdings:
        return {'status': 'error', 'message': 'Geen posities in laatste snapshot.'}

    # Haal live koersen op
    tickers = [h.get('eq_positions', {}).get('ticker', '') for h in holdings]
    tickers = [t for t in tickers if t]

    live_prices = get_current_prices(tickers) if tickers else {}
    fx_rates = get_live_fx_rates()

    if not live_prices:
        return {'status': 'error', 'message': 'Kon geen live koersen ophalen van Yahoo Finance.'}

    # Bereken via centrale calculations module
    enriched = enrich_all_holdings(holdings, live_prices, fx_rates)
    total_value = sum(r['value'] for r in enriched)

    # Cash overnemen van het laatste snapshot
    cash_eur = float(latest.get('cash_eur', 0) or 0)
    portfolio_total = total_value + cash_eur
    cash_pct = (cash_eur / portfolio_total * 100) if portfolio_total > 0 else 0

    # Maak nieuw snapshot
    snapshot_id = upsert_snapshot(
        supabase,
        snapshot_date=today_str,
        cash_eur=cash_eur,
        total_value_eur=portfolio_total,
        cash_pct=cash_pct,
        notes=f'Live refresh {datetime.now().strftime("%H:%M")} (basis: {latest["snapshot_date"]})',
        eur_usd=fx_rates.get('EUR/USD'),
        eur_gbp=fx_rates.get('EUR/GBP'),
        eur_dkk=fx_rates.get('EUR/DKK'),
        eur_hkd=None,
    )

    # Verwijder eventuele oude holdings voor dit snapshot (bij re-refresh)
    supabase.table('eq_holdings').delete().eq('snapshot_id', snapshot_id).execute()

    # Sla holdings op met berekende gewichten
    for row in enriched:
        weight = (row['value'] / portfolio_total * 100) if portfolio_total else 0
        save_holding(
            supabase,
            snapshot_id=snapshot_id,
            position_id=row['position_id'],
            shares=row['shares'],
            price_local=row['price_local'],
            price_eur=row['price_eur'],
            avg_cost=row['avg_cost'],  # Origineel in lokale valuta
            value_eur=row['value'],
            pnl_nominal=row['pnl_nominal'],
            pnl_pct=row['pnl_pct'],
            weight_pct=weight,
            advice=row['advice'],
            mandate_buy=row['mandate_buy'],
            mandate_sell=row['mandate_sell'],
            motivation=row['motivation'],
        )

    return {
        'status': 'success',
        'snapshot_date': today_str,
        'total_value': portfolio_total,
        'cash_eur': cash_eur,
        'positions': len(enriched),
        'prices_live': len(live_prices),
        'prices_stale': len(enriched) - len(live_prices),
        'basis_snapshot': latest['snapshot_date'],
    }


def get_data_source_info(snapshot_date_str):
    """
    Geeft informatie over de databron voor een bepaalde snapshot datum.

    Returns: dict met bron info.
    """
    try:
        snap_date = date.fromisoformat(snapshot_date_str)
    except (ValueError, TypeError):
        return {'source': 'unknown', 'label': 'Onbekend'}

    if snap_date <= SHEETS_END_DATE:
        return {
            'source': 'sheets',
            'label': 'Google Sheets (historisch)',
            'icon': '📊',
        }
    else:
        return {
            'source': 'live',
            'label': 'Live refresh (Yahoo Finance)',
            'icon': '🔄',
        }
