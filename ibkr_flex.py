"""
IBKR Flex Query API client.

Haalt portefeuilledata op via de Flex Web Service (read-only, geen TWS nodig).
Vereist:
  - IBKR_FLEX_TOKEN: token aangemaakt in Client Portal
  - IBKR_FLEX_QUERY_ID: ID van de Activity Flex Query

Setup instructies:
  1. Log in op https://www.interactivebrokers.com/portal
  2. Ga naar Performance & Reports > Flex Queries
  3. Klik "+" om een nieuwe Activity Flex Query aan te maken
  4. Selecteer: Open Positions, Trades, Cash Report, NAV Summary
  5. Sla op en noteer het Query ID
  6. Ga naar Flex Web Service (onderaan de Flex Queries pagina)
  7. Genereer een token (kies 1 jaar geldigheid)
  8. Vul IBKR_FLEX_TOKEN en IBKR_FLEX_QUERY_ID in .env
"""

import os
import time
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, date
from decimal import Decimal

import requests
import streamlit as st

from utils import safe_float as _safe_float, safe_int as _safe_int

logger = logging.getLogger(__name__)

FLEX_BASE_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService"

# ─── ERROR CODES ────────────────────────────────────────────

FLEX_ERRORS = {
    '1003': 'Token invalid of verlopen. Genereer een nieuw token in Client Portal.',
    '1004': 'Query ID niet gevonden. Controleer het ID in Client Portal.',
    '1005': 'Te veel verzoeken. Wacht 10 minuten.',
    '1006': 'Statement niet beschikbaar. Probeer later opnieuw.',
    '1012': 'Token is verlopen. Genereer een nieuw token.',
    '1018': 'Flex Query is leeg of onjuist geconfigureerd.',
    '1019': 'Service tijdelijk niet beschikbaar.',
}


class FlexQueryError(Exception):
    """Exception voor Flex Query API fouten."""

    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(f"Flex Error {code}: {message}")


# ─── API CLIENT ─────────────────────────────────────────────

def _send_request(token, query_id):
    """Stap 1: Vraag rapport generatie aan. Retourneert reference code."""
    resp = requests.get(
        f"{FLEX_BASE_URL}/SendRequest",
        params={"t": token, "q": query_id, "v": "3"},
        timeout=30,
    )
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    status = root.findtext('Status', '')

    if status != 'Success':
        code = root.findtext('ErrorCode', 'Unknown')
        msg = FLEX_ERRORS.get(code, root.findtext('ErrorMessage', 'Onbekende fout'))
        raise FlexQueryError(code, msg)

    ref_code = root.findtext('ReferenceCode', '')
    if not ref_code:
        raise FlexQueryError('0', 'Geen reference code ontvangen')

    return ref_code


def _get_statement(token, ref_code, max_retries=5, wait_seconds=15):
    """Stap 2: Haal het gegenereerde rapport op. Retourneert XML root element."""
    for attempt in range(max_retries):
        time.sleep(wait_seconds)

        resp = requests.get(
            f"{FLEX_BASE_URL}/GetStatement",
            params={"t": token, "q": ref_code, "v": "3"},
            timeout=60,
        )
        resp.raise_for_status()

        # Check if still generating
        if '<Status>' in resp.text:
            root = ET.fromstring(resp.text)
            status = root.findtext('Status', '')
            if status == 'Warn':
                code = root.findtext('ErrorCode', '')
                if code == '1019':
                    logger.info(f"Statement nog niet klaar, poging {attempt + 1}/{max_retries}...")
                    continue
            if status != 'Success' and status != '':
                code = root.findtext('ErrorCode', 'Unknown')
                msg = FLEX_ERRORS.get(code, root.findtext('ErrorMessage', 'Onbekende fout'))
                raise FlexQueryError(code, msg)

        # Parse the full statement
        root = ET.fromstring(resp.text)
        return root

    raise FlexQueryError('0', f'Statement niet beschikbaar na {max_retries} pogingen')


def fetch_flex_report(token=None, query_id=None):
    """
    Haal een compleet Flex Query rapport op.

    Returns: XML ElementTree root met alle data.
    """
    token = token or os.environ.get('IBKR_FLEX_TOKEN', '')
    query_id = query_id or os.environ.get('IBKR_FLEX_QUERY_ID', '')

    if not token or not query_id:
        raise FlexQueryError('0', 'IBKR_FLEX_TOKEN en IBKR_FLEX_QUERY_ID moeten ingesteld zijn in .env')

    logger.info("Flex Query rapport aanvragen...")
    ref_code = _send_request(token, query_id)
    logger.info(f"Reference code: {ref_code}, wachten op generatie...")
    root = _get_statement(token, ref_code)
    logger.info("Flex Query rapport ontvangen.")
    return root


# ─── DATA PARSING ───────────────────────────────────────────


# _safe_float en _safe_int worden geimporteerd uit utils.py (single source of truth).
# De aliassen _safe_float / _safe_int blijven bestaan voor backward compatibility
# (ibkr_xml_import.py importeert ze via `from ibkr_flex import _safe_float, _safe_int`).


def parse_open_positions(root):
    """
    Parse open posities uit Flex rapport.

    Returns: list of dicts met positie-informatie.
    """
    positions = []

    for pos_elem in root.iter('OpenPosition'):
        # Filter alleen aandelen (STK = Stock)
        asset_class = pos_elem.get('assetCategory', '')
        if asset_class not in ('STK', ''):
            continue

        symbol = pos_elem.get('symbol', '')
        if not symbol:
            continue

        positions.append({
            'symbol': symbol,
            'description': pos_elem.get('description', ''),
            'currency': pos_elem.get('currency', 'EUR'),
            'shares': _safe_int(pos_elem.get('position')),
            'mark_price': _safe_float(pos_elem.get('markPrice')),
            'cost_basis_price': _safe_float(pos_elem.get('costBasisPrice')),
            'cost_basis_money': _safe_float(pos_elem.get('costBasisMoney')),
            'market_value': _safe_float(pos_elem.get('fifoPnlUnrealized')) + _safe_float(pos_elem.get('costBasisMoney')),
            'unrealized_pnl': _safe_float(pos_elem.get('fifoPnlUnrealized')),
            'realized_pnl': _safe_float(pos_elem.get('fifoPnlRealized')),
            'percent_of_nav': _safe_float(pos_elem.get('percentOfNAV')),
            'listing_exchange': pos_elem.get('listingExchange', ''),
            'report_date': pos_elem.get('reportDate', ''),
        })

    return positions


def parse_cash_report(root):
    """
    Parse cash positie uit Flex rapport.

    Returns: dict met cash informatie per valuta en totaal.
    """
    cash = {'total_eur': 0.0, 'by_currency': {}}

    for cash_elem in root.iter('CashReportCurrency'):
        currency = cash_elem.get('currency', '')
        if not currency:
            continue

        end_cash = _safe_float(cash_elem.get('endingCash'))
        end_cash_settled = _safe_float(cash_elem.get('endingSettledCash'))

        cash['by_currency'][currency] = {
            'ending_cash': end_cash,
            'ending_settled': end_cash_settled,
        }

    # Totaal in base currency
    for cash_elem in root.iter('CashReportCurrency'):
        if cash_elem.get('currency') == 'BASE_SUMMARY':
            cash['total_eur'] = _safe_float(cash_elem.get('endingCash'))
            break

    return cash


def parse_nav(root):
    """
    Parse NAV (Net Asset Value) uit Flex rapport.

    Returns: dict met NAV informatie.
    """
    nav = {'total': 0.0, 'stock': 0.0, 'cash': 0.0}

    for nav_elem in root.iter('EquitySummaryByReportDateInBase'):
        nav['total'] = _safe_float(nav_elem.get('total'))
        nav['stock'] = _safe_float(nav_elem.get('stock'))
        nav['cash'] = _safe_float(nav_elem.get('cash'))
        break

    # Fallback: ChangeInNAV
    if nav['total'] == 0:
        for nav_elem in root.iter('ChangeInNAV'):
            nav['total'] = _safe_float(nav_elem.get('endingValue'))
            break

    return nav


def parse_trades(root):
    """
    Parse transacties uit Flex rapport.

    Returns: list of dicts met transactie-informatie.
    """
    trades = []

    for trade_elem in root.iter('Trade'):
        asset_class = trade_elem.get('assetCategory', '')
        if asset_class not in ('STK', ''):
            continue

        symbol = trade_elem.get('symbol', '')
        if not symbol:
            continue

        buy_sell = trade_elem.get('buySell', '')
        trades.append({
            'symbol': symbol,
            'description': trade_elem.get('description', ''),
            'currency': trade_elem.get('currency', 'EUR'),
            'trade_date': trade_elem.get('tradeDate', ''),
            'settle_date': trade_elem.get('settleDateTarget', ''),
            'type': 'BUY' if buy_sell == 'BUY' else 'SELL',
            'shares': abs(_safe_int(trade_elem.get('quantity'))),
            'price': _safe_float(trade_elem.get('tradePrice')),
            'proceeds': _safe_float(trade_elem.get('proceeds')),
            'commission': _safe_float(trade_elem.get('ibCommission')),
            'net_cash': _safe_float(trade_elem.get('netCash')),
            'fx_rate': _safe_float(trade_elem.get('fxRateToBase', 1.0)),
        })

    return trades


def parse_fx_rates_from_report(root):
    """
    Parse wisselkoersen uit Flex rapport.

    Returns: dict met currency pairs en rates.
    """
    rates = {'EUR/EUR': 1.0}

    for pos_elem in root.iter('OpenPosition'):
        currency = pos_elem.get('currency', '')
        fx_rate = _safe_float(pos_elem.get('fxRateToBase', 0))
        if currency and fx_rate > 0 and currency != 'EUR':
            # IBKR geeft fxRateToBase = 1/EUR_rate voor die currency
            rates[f'EUR/{currency}'] = 1.0 / fx_rate if fx_rate != 0 else 0

    return rates


# ─── SYNC MET SUPABASE ──────────────────────────────────────

def sync_ibkr_to_supabase(supabase, token=None, query_id=None):
    """
    Synchroniseer IBKR Flex data naar Supabase.

    Maakt een nieuwe snapshot aan met de actuele IBKR posities.
    Returns: dict met sync resultaten.
    """
    from database import upsert_position, upsert_snapshot, save_holding, add_transaction
    from config.tickers import get_currency, get_sector, get_ibkr_symbol_map, TICKERS

    root = fetch_flex_report(token, query_id)

    positions = parse_open_positions(root)
    cash = parse_cash_report(root)
    nav = parse_nav(root)
    trades = parse_trades(root)
    fx_rates = parse_fx_rates_from_report(root)

    if not positions:
        return {'status': 'error', 'message': 'Geen posities gevonden in IBKR rapport'}

    # IBKR data alleen gebruiken vanaf 2026 (migratie in 2024/2025, Sheets dekt 2019-2025)
    IBKR_START_DATE = date(2026, 1, 1)
    today = date.today()
    if today < IBKR_START_DATE:
        return {'status': 'error', 'message': f'IBKR sync pas actief vanaf {IBKR_START_DATE}. Historische data komt uit Google Sheets.'}

    today_str = today.isoformat()
    total_value = nav['total'] if nav['total'] > 0 else sum(p['market_value'] for p in positions) + cash['total_eur']
    cash_eur = cash['total_eur']
    cash_pct = (cash_eur / total_value * 100) if total_value > 0 else 0

    # Maak/update snapshot
    snapshot_id = upsert_snapshot(
        supabase,
        snapshot_date=today_str,
        cash_eur=cash_eur,
        total_value_eur=total_value,
        cash_pct=cash_pct,
        notes=f'IBKR Flex sync {datetime.now().strftime("%H:%M")}',
        eur_usd=fx_rates.get('EUR/USD'),
        eur_gbp=fx_rates.get('EUR/GBP'),
        eur_dkk=fx_rates.get('EUR/DKK'),
        eur_hkd=fx_rates.get('EUR/HKD'),
    )

    # Verwijder oude holdings voor deze snapshot (bij re-sync)
    supabase.table('eq_holdings').delete().eq('snapshot_id', snapshot_id).execute()

    # IBKR symbol → onze ticker mapping (uit centrale config)
    ibkr_to_ticker = get_ibkr_symbol_map()

    synced = 0
    skipped = []

    for pos in positions:
        symbol = pos['symbol']
        ticker = ibkr_to_ticker.get(symbol, None)

        if not ticker:
            # Probeer direct als ticker met exchange suffix
            ticker = symbol
            for suffix in ['.BR', '.AS', '.PA']:
                if f"{symbol}{suffix}" in TICKERS:
                    ticker = f"{symbol}{suffix}"
                    break

        currency = pos['currency']
        name = pos['description'] or symbol

        # Upsert position
        position_id = upsert_position(
            supabase, ticker=ticker, name=name, currency=currency,
            sector=get_sector(ticker),
        )

        # Convert market value naar EUR
        market_value_eur = pos['market_value']
        if currency != 'EUR':
            pair = f'EUR/{currency}'
            rate = fx_rates.get(pair, 1.0)
            if rate > 0:
                market_value_eur = pos['market_value'] / rate

        shares = pos['shares']
        price_eur = market_value_eur / shares if shares else 0
        avg_cost = pos['cost_basis_price']
        pnl_nom = pos['unrealized_pnl']
        pnl_pct = (pnl_nom / pos['cost_basis_money'] * 100) if pos['cost_basis_money'] else 0
        weight = (market_value_eur / total_value * 100) if total_value else 0

        save_holding(
            supabase,
            snapshot_id=snapshot_id,
            position_id=position_id,
            shares=shares,
            price_local=pos['mark_price'],
            price_eur=price_eur,
            avg_cost=avg_cost,
            value_eur=market_value_eur,
            pnl_nominal=pnl_nom,
            pnl_pct=pnl_pct,
            weight_pct=weight,
        )
        synced += 1

    # Sync trades
    trades_synced = 0
    for trade in trades:
        symbol = trade['symbol']
        ticker = ibkr_to_ticker.get(symbol, symbol)

        from database import get_position_by_ticker
        pos_db = get_position_by_ticker(supabase, ticker)
        if pos_db:
            # Check of trade al bestaat (voorkom duplicaten)
            existing = supabase.table('eq_transactions').select('id').eq(
                'position_id', pos_db['id']
            ).eq('transaction_date', trade['trade_date']).eq(
                'shares', trade['shares']
            ).execute()

            if not existing.data:
                price_eur = trade['price']
                if trade['currency'] != 'EUR' and trade['fx_rate'] > 0:
                    price_eur = trade['price'] * trade['fx_rate']

                add_transaction(
                    supabase,
                    position_id=pos_db['id'],
                    transaction_date=trade['trade_date'],
                    tx_type=trade['type'],
                    shares=trade['shares'],
                    price_local=trade['price'],
                    price_eur=price_eur,
                    fx_rate=trade['fx_rate'],
                    fees=abs(trade['commission']),
                    notes=f"IBKR import",
                )
                trades_synced += 1

    return {
        'status': 'success',
        'positions_synced': synced,
        'trades_synced': trades_synced,
        'total_value': total_value,
        'cash_eur': cash_eur,
        'snapshot_date': today_str,
    }


# ─── STATUS CHECK ───────────────────────────────────────────

def check_ibkr_connection():
    """
    Test of de IBKR Flex verbinding werkt.

    Returns: dict met status info.
    """
    token = os.environ.get('IBKR_FLEX_TOKEN', '')
    query_id = os.environ.get('IBKR_FLEX_QUERY_ID', '')

    if not token:
        return {'connected': False, 'reason': 'IBKR_FLEX_TOKEN niet ingesteld'}
    if not query_id:
        return {'connected': False, 'reason': 'IBKR_FLEX_QUERY_ID niet ingesteld'}

    try:
        ref_code = _send_request(token, query_id)
        return {'connected': True, 'reason': f'Verbinding OK (ref: {ref_code})'}
    except FlexQueryError as e:
        return {'connected': False, 'reason': str(e)}
    except Exception as e:
        return {'connected': False, 'reason': f'Verbindingsfout: {str(e)}'}
