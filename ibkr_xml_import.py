"""
IBKR XML Activity Statement Import.

Alternatief voor de Flex Query API: importeer een manueel gedownload
Activity Statement XML bestand van IBKR Client Portal of TWS.

Hoe een Activity Statement te exporteren:
  - Client Portal: Performance & Reports > Statements > Activity > XML
  - TWS: Account > Reports > Activity Statement > Download XML
"""

import xml.etree.ElementTree as ET
import logging
from datetime import date

logger = logging.getLogger(__name__)


def parse_activity_statement_xml(xml_content):
    """
    Parse een IBKR Activity Statement XML bestand.

    Args:
        xml_content: bytes of string met XML inhoud

    Returns: dict met parsed data (positions, cash, trades, nav)
    """
    from ibkr_flex import (
        parse_open_positions, parse_cash_report,
        parse_nav, parse_trades, parse_fx_rates_from_report
    )

    if isinstance(xml_content, bytes):
        xml_content = xml_content.decode('utf-8')

    root = ET.fromstring(xml_content)

    return {
        'positions': parse_open_positions(root),
        'cash': parse_cash_report(root),
        'nav': parse_nav(root),
        'trades': parse_trades(root),
        'fx_rates': parse_fx_rates_from_report(root),
        'raw_root': root,
    }


def import_xml_to_supabase(supabase, xml_content, snapshot_date=None):
    """
    Importeer een IBKR Activity Statement XML naar Supabase.

    Args:
        supabase: Supabase client
        xml_content: bytes of string met XML inhoud
        snapshot_date: optionele datum (default: vandaag)

    Returns: dict met import resultaten
    """
    from database import upsert_position, upsert_snapshot, save_holding
    from config.tickers import get_sector, get_ibkr_symbol_map
    from ibkr_flex import _safe_float, _safe_int

    parsed = parse_activity_statement_xml(xml_content)

    positions = parsed['positions']
    cash = parsed['cash']
    nav = parsed['nav']
    fx_rates = parsed['fx_rates']

    if not positions:
        return {'status': 'error', 'message': 'Geen posities gevonden in XML bestand.'}

    if not snapshot_date:
        # Probeer datum uit XML te halen
        for pos in positions:
            rd = pos.get('report_date', '')
            if rd:
                try:
                    snapshot_date = f"{rd[:4]}-{rd[4:6]}-{rd[6:8]}"
                    break
                except (IndexError, ValueError):
                    pass
        if not snapshot_date:
            snapshot_date = date.today().isoformat()

    total_value = nav['total'] if nav['total'] > 0 else sum(p['market_value'] for p in positions) + cash['total_eur']
    cash_eur = cash['total_eur']
    cash_pct = (cash_eur / total_value * 100) if total_value > 0 else 0

    # Snapshot aanmaken
    snapshot_id = upsert_snapshot(
        supabase,
        snapshot_date=snapshot_date,
        cash_eur=cash_eur,
        total_value_eur=total_value,
        cash_pct=cash_pct,
        notes=f'IBKR XML import',
        eur_usd=fx_rates.get('EUR/USD'),
        eur_gbp=fx_rates.get('EUR/GBP'),
        eur_dkk=fx_rates.get('EUR/DKK'),
        eur_hkd=fx_rates.get('EUR/HKD'),
    )

    # Verwijder oude holdings (bij re-import)
    supabase.table('eq_holdings').delete().eq('snapshot_id', snapshot_id).execute()

    # IBKR symbol → ticker mapping (uit centrale config)
    ibkr_to_ticker = get_ibkr_symbol_map()

    synced = 0
    for pos in positions:
        symbol = pos['symbol']
        ticker = ibkr_to_ticker.get(symbol, symbol)
        currency = pos['currency']
        name = pos['description'] or symbol

        position_id = upsert_position(
            supabase, ticker=ticker, name=name, currency=currency,
            sector=get_sector(ticker),
        )

        market_value_eur = pos['market_value']
        if currency != 'EUR':
            pair = f'EUR/{currency}'
            rate = fx_rates.get(pair, 1.0)
            if rate > 0:
                market_value_eur = pos['market_value'] / rate

        shares = pos['shares']
        price_eur = market_value_eur / shares if shares else 0
        weight = (market_value_eur / total_value * 100) if total_value else 0

        save_holding(
            supabase,
            snapshot_id=snapshot_id,
            position_id=position_id,
            shares=shares,
            price_local=pos['mark_price'],
            price_eur=price_eur,
            avg_cost=pos['cost_basis_price'],
            value_eur=market_value_eur,
            pnl_nominal=pos['unrealized_pnl'],
            pnl_pct=(pos['unrealized_pnl'] / pos['cost_basis_money'] * 100) if pos['cost_basis_money'] else 0,
            weight_pct=weight,
        )
        synced += 1

    return {
        'status': 'success',
        'positions_synced': synced,
        'total_value': total_value,
        'cash_eur': cash_eur,
        'snapshot_date': snapshot_date,
    }
