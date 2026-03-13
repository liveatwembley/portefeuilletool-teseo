"""
Import module: laad portefeuillenota's van Google Sheets naar Supabase.

Twee modi:
  - CLI: python import_sheets.py  →  importeert ALLE tabs van alle spreadsheets
  - App: import_latest_tab(supabase)  →  importeert alleen het nieuwste tabblad
"""
import json
import logging
import os
import re
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

from utils import safe_float, safe_int

logger = logging.getLogger(__name__)

# ─── CONFIG ──────────────────────────────────────────────────

GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS', '')
SHEETS_FOLDER_ID = '1ixfRjf2u-9o00f6iymIVYjIewoj6jluc'

# Ticker mapping uit centrale config (single source of truth)
from config.tickers import get_import_sheets_map
TICKER_MAP = get_import_sheets_map()


def clean_name(name):
    """Strip (q)/(Q) suffix from name."""
    return re.sub(r'\s*\([qQ]\)\s*$', '', name).strip()



def parse_date_from_tab(tab_name):
    """Parse date from tab name like '24-01-2026', '6-01-2024', '2026-03-14 - tekst'."""
    # Format: DD-MM-YYYY (aan het begin)
    match = re.match(r'(\d{1,2})-(\d{1,2})-(\d{4})', tab_name)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    # Format: YYYY-MM-DD (aan het begin, eventueel gevolgd door tekst)
    match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', tab_name)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return None


def clamp_future_date(date_str):
    """Als datum in de toekomst ligt, gebruik vandaag.
    Gebruiker labelt soms tabs met datum van volgende meeting."""
    from datetime import date
    try:
        snap_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        today = date.today()
        if snap_date > today:
            print(f"  ⚠️ Toekomstige datum {date_str} → herleid naar vandaag ({today.isoformat()})")
            return today.isoformat()
    except ValueError:
        pass
    return date_str


def _get_gspread_client():
    """Maak gspread client met Google service account credentials."""
    creds_json = os.environ.get('GOOGLE_CREDENTIALS', '')
    if creds_json:
        creds_dict = json.loads(creds_json)
    else:
        creds_path = os.path.join(os.path.dirname(__file__), 'google_credentials.json')
        with open(creds_path) as f:
            creds_dict = json.load(f)

    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=[
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
        ]
    )
    return gspread.authorize(creds)


def list_spreadsheets():
    """
    Scan spreadsheets in de portefeuillenota's Drive folder.

    Returns: list van dicts met spreadsheet info, gesorteerd op naam.
    """
    gc = _get_gspread_client()
    sheets = []
    for s in gc.list_spreadsheet_files():
        if s.get('parents') and SHEETS_FOLDER_ID in s['parents']:
            sheets.append({'id': s['id'], 'name': s['name']})
    if not sheets:
        # Fallback: gspread list_spreadsheet_files geeft niet altijd parents mee.
        # Gebruik Drive API rechtstreeks.
        try:
            from googleapiclient.discovery import build
            creds = gc.http_client.auth
            drive = build('drive', 'v3', credentials=creds, cache_discovery=False)
            query = (
                f"'{SHEETS_FOLDER_ID}' in parents"
                f" and mimeType='application/vnd.google-apps.spreadsheet'"
                f" and trashed=false"
            )
            result = drive.files().list(q=query, fields='files(id, name)').execute()
            sheets = [{'id': f['id'], 'name': f['name']} for f in result.get('files', [])]
        except Exception as e:
            logger.warning("Drive API fallback mislukt: %s", e)
    sheets.sort(key=lambda x: x['name'])
    return sheets


def _ensure_position_ids(supabase):
    """Zorg dat alle posities uit TICKER_MAP bestaan in Supabase. Return name→id mapping."""
    position_ids = {}
    for name, (ticker, currency, sector, country) in TICKER_MAP.items():
        existing = supabase.table('eq_positions').select('id').eq('ticker', ticker).limit(1).execute()
        if existing.data:
            pos_id = existing.data[0]['id']
        else:
            result = supabase.table('eq_positions').insert({
                'ticker': ticker,
                'name': name,
                'currency': currency,
                'sector': sector,
                'country': country,
            }).execute()
            pos_id = result.data[0]['id']
        position_ids[name] = pos_id
    return position_ids


def _parse_tab_header(all_values):
    """Parse header data (cash, total value, FX rates) uit een spreadsheet tab."""
    cash_eur = 0
    total_value = 0
    cash_pct = 0
    eur_usd = None
    eur_gbp = None
    eur_dkk = None

    for i, row in enumerate(all_values[:11]):
        row_text = ' '.join(str(c) for c in row).lower()
        if 'cashpositie' in row_text or 'cash positie' in row_text:
            for j, cell in enumerate(row):
                val = safe_float(cell)
                if val > 500:
                    cash_eur = val
                    break
        if 'portefeuillewaarde' in row_text:
            for j, cell in enumerate(row):
                val = safe_float(cell)
                if val > 50000:
                    total_value = val
                    break
        if 'cashpercentage' in row_text or 'cash %' in row_text or 'cash%' in row_text:
            for j, cell in enumerate(row):
                val = safe_float(cell)
                if 0 < val < 100:
                    cash_pct = val
                    break
            if cash_pct == 0:
                for j, cell in enumerate(row):
                    val = safe_float(cell)
                    if 0 < val < 1:
                        cash_pct = val * 100
                        break

    for row in all_values[:11]:
        for j, cell in enumerate(row):
            cell_str = str(cell).upper().strip()
            if 'EUR/USD' in cell_str or 'EURUSD' in cell_str:
                rate = safe_float(cell_str.split(':')[-1]) if ':' in cell_str else 0
                if rate == 0 and j + 1 < len(row):
                    rate = safe_float(row[j + 1])
                if 0.5 < rate < 2.0:
                    eur_usd = rate
            elif 'EUR/GBP' in cell_str or 'EURGBP' in cell_str:
                rate = safe_float(cell_str.split(':')[-1]) if ':' in cell_str else 0
                if rate == 0 and j + 1 < len(row):
                    rate = safe_float(row[j + 1])
                if 0.5 < rate < 2.0:
                    eur_gbp = rate
            elif 'EUR/DKK' in cell_str or 'EURDKK' in cell_str:
                rate = safe_float(cell_str.split(':')[-1]) if ':' in cell_str else 0
                if rate == 0 and j + 1 < len(row):
                    rate = safe_float(row[j + 1])
                if 5.0 < rate < 10.0:
                    eur_dkk = rate

    # Fallback 1: totaalrij zoeken
    if total_value == 0:
        for row_idx in range(max(30, len(all_values) - 15), min(len(all_values), 55)):
            row = all_values[row_idx]
            row_text = str(row[0]).strip().lower() if row else ''
            if row_text in ['totaal', 'total', ''] and len(row) > 9:
                for col_idx in [9, 18, 8, 7]:
                    if col_idx < len(row):
                        val = safe_float(row[col_idx])
                        if val > 50000:
                            total_value = val
                            break
                if total_value > 0:
                    break

    # Fallback 2: som van holdings
    if total_value == 0:
        holdings_sum = 0
        for row_idx in range(12, min(len(all_values), 50)):
            row = all_values[row_idx]
            if len(row) > 9:
                name_raw = str(row[0]).strip()
                if name_raw and name_raw.lower() not in ['', 'totaal', 'total']:
                    val = safe_float(row[9])
                    holdings_sum += val
        if holdings_sum > 0:
            total_value = holdings_sum
            if cash_pct > 0:
                total_value = holdings_sum / (1 - cash_pct / 100)
                cash_eur = total_value - holdings_sum

    # Fallback 3: cash uit percentage
    if cash_eur == 0 and cash_pct > 0 and total_value > 0:
        cash_eur = total_value * (cash_pct / 100)

    return {
        'cash_eur': cash_eur, 'total_value': total_value, 'cash_pct': cash_pct,
        'eur_usd': eur_usd, 'eur_gbp': eur_gbp, 'eur_dkk': eur_dkk,
    }


def _import_single_tab(supabase, ws, snapshot_date, position_ids):
    """
    Importeer een enkele spreadsheet tab naar Supabase.

    Returns: dict met status info.
    """
    try:
        all_values = ws.get_all_values()
    except Exception as e:
        return {'status': 'error', 'message': f'Kan tab niet lezen: {e}'}

    if len(all_values) < 13:
        return {'status': 'error', 'message': f'Te weinig rijen ({len(all_values)})'}

    header = _parse_tab_header(all_values)

    # Create/update snapshot
    existing_snap = supabase.table('eq_snapshots').select('id').eq('snapshot_date', snapshot_date).limit(1).execute()
    if existing_snap.data:
        snap_id = existing_snap.data[0]['id']
        supabase.table('eq_snapshots').update({
            'cash_eur': header['cash_eur'],
            'total_value_eur': header['total_value'],
            'cash_pct': header['cash_pct'],
            'eur_usd': header['eur_usd'],
            'eur_gbp': header['eur_gbp'],
            'eur_dkk': header['eur_dkk'],
            'notes': f'Google Sheets import {datetime.now().strftime("%H:%M")} ({ws.title})',
        }).eq('id', snap_id).execute()
        supabase.table('eq_holdings').delete().eq('snapshot_id', snap_id).execute()
    else:
        result = supabase.table('eq_snapshots').insert({
            'snapshot_date': snapshot_date,
            'cash_eur': header['cash_eur'],
            'total_value_eur': header['total_value'],
            'cash_pct': header['cash_pct'],
            'eur_usd': header['eur_usd'],
            'eur_gbp': header['eur_gbp'],
            'eur_dkk': header['eur_dkk'],
            'notes': f'Google Sheets import ({ws.title})',
        }).execute()
        snap_id = result.data[0]['id']

    # Parse positions (starting from row 13, index 12)
    holdings_count = 0
    warnings = []
    for row_idx in range(12, min(len(all_values), 50)):
        row = all_values[row_idx]
        if len(row) < 2:
            continue

        name_raw = str(row[0]).strip()
        if not name_raw or name_raw.lower() in ['', 'totaal', 'total']:
            continue

        name = clean_name(name_raw)
        shares = safe_int(row[1]) if len(row) > 1 else 0

        if shares == 0 and name not in TICKER_MAP:
            continue

        pos_id = position_ids.get(name)
        if not pos_id:
            for known_name in position_ids:
                if known_name.lower() in name.lower() or name.lower() in known_name.lower():
                    pos_id = position_ids[known_name]
                    break

        if not pos_id:
            warnings.append(f"Positie '{name}' niet gevonden in mapping")
            continue

        price = safe_float(row[4]) if len(row) > 4 else 0
        value = safe_float(row[9]) if len(row) > 9 else 0
        avg_cost = safe_float(row[10]) if len(row) > 10 else 0
        pnl_nom = safe_float(row[11]) if len(row) > 11 else 0
        pnl_pct = safe_float(row[12]) if len(row) > 12 else 0
        advice = str(row[13]).strip() if len(row) > 13 else ''
        motivation = str(row[14]).strip() if len(row) > 14 else ''
        mandate_buy = safe_int(row[15]) if len(row) > 15 else 0
        mandate_sell = safe_int(row[16]) if len(row) > 16 else 0
        weight = safe_float(row[17]) if len(row) > 17 else 0

        if 0 < abs(pnl_pct) < 1 and pnl_pct != 0:
            pnl_pct = pnl_pct * 100
        if 0 < weight < 1:
            weight = weight * 100

        supabase.table('eq_holdings').insert({
            'snapshot_id': snap_id,
            'position_id': pos_id,
            'shares': shares,
            'price_local': price,
            'price_eur': price,
            'avg_cost': avg_cost,
            'value_eur': value,
            'pnl_nominal': pnl_nom,
            'pnl_pct': pnl_pct,
            'weight_pct': weight,
            'advice': advice if advice else None,
            'mandate_buy': mandate_buy,
            'mandate_sell': mandate_sell,
            'motivation': motivation if motivation else None,
        }).execute()
        holdings_count += 1

    return {
        'status': 'success',
        'snapshot_date': snapshot_date,
        'tab_name': ws.title,
        'holdings_count': holdings_count,
        'total_value': header['total_value'],
        'cash_eur': header['cash_eur'],
        'cash_pct': header['cash_pct'],
        'warnings': warnings,
    }


# ─── APP-CALLABLE FUNCTIONS ─────────────────────────────────

def list_available_tabs(sheet_id=None, min_year=2026):
    """
    Scan spreadsheet(s) en retourneer lijst van beschikbare datum-tabs.

    Args:
        sheet_id: specifiek spreadsheet ID om te scannen. Als None, scan folder.
        min_year: alleen tabs vanaf dit jaar (default 2026, historische data zit al in DB).

    Returns: list van dicts met tab info, gesorteerd op datum (nieuwste eerst).
    """
    gc = _get_gspread_client()
    tabs = []

    if sheet_id:
        sheet_ids = [sheet_id]
    else:
        sheet_ids = [s['id'] for s in list_spreadsheets()]

    for sid in sheet_ids:
        try:
            spreadsheet = gc.open_by_key(sid)
            for ws in spreadsheet.worksheets():
                parsed_date = parse_date_from_tab(ws.title)
                if not parsed_date:
                    continue
                if min_year and int(parsed_date[:4]) < min_year:
                    continue
                clamped = clamp_future_date(parsed_date)
                tabs.append({
                    'worksheet': ws,
                    'tab_name': ws.title,
                    'date': clamped,
                    'spreadsheet': spreadsheet.title,
                    'sheet_id': sid,
                })
        except Exception as e:
            logger.warning("Kan spreadsheet %s niet openen: %s", sid, e)

    # Sorteer op datum, nieuwste eerst
    tabs.sort(key=lambda x: x['date'], reverse=True)
    return tabs


def import_latest_tab(supabase):
    """
    Importeer het nieuwste tabblad van de Google Sheets.

    Returns: dict met resultaat info.
    """
    tabs = list_available_tabs()
    if not tabs:
        return {'status': 'error', 'message': 'Geen datum-tabs gevonden in de spreadsheets.'}

    latest = tabs[0]
    position_ids = _ensure_position_ids(supabase)
    result = _import_single_tab(supabase, latest['worksheet'], latest['date'], position_ids)

    if result['status'] == 'success':
        result['spreadsheet'] = latest['spreadsheet']
    return result


def import_specific_tab(supabase, tab_info):
    """
    Importeer een specifiek tabblad.

    Args:
        tab_info: dict uit list_available_tabs()
    Returns: dict met resultaat info.
    """
    position_ids = _ensure_position_ids(supabase)
    result = _import_single_tab(supabase, tab_info['worksheet'], tab_info['date'], position_ids)
    if result['status'] == 'success':
        result['spreadsheet'] = tab_info['spreadsheet']
    return result


# ─── CLI ENTRY POINT ────────────────────────────────────────

def main():
    """CLI: importeer ALLE tabs van alle spreadsheets (eenmalig/bulk)."""
    from supabase import create_client

    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

    print("=== Teseo Portefeuilletool - Google Sheets Import ===\n")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    tabs = list_available_tabs(min_year=None)
    print(f"Totaal gevonden datum-tabs: {len(tabs)}")

    position_ids = _ensure_position_ids(supabase)
    for name, pid in position_ids.items():
        print(f"  {name} → {pid[:8]}...")

    # Importeer van oud naar nieuw
    for tab in reversed(tabs):
        print(f"\n--- Importeer {tab['tab_name']} ({tab['date']}) [{tab['spreadsheet']}] ---")
        result = _import_single_tab(supabase, tab['worksheet'], tab['date'], position_ids)
        if result['status'] == 'success':
            print(f"  {result['holdings_count']} posities, total={result['total_value']:.0f}")
        else:
            print(f"  FOUT: {result['message']}")
        for w in result.get('warnings', []):
            print(f"  ⚠️ {w}")

    print("\n=== Import voltooid! ===")


if __name__ == '__main__':
    main()
