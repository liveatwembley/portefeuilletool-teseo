# ─── SINGLE SOURCE OF TRUTH: TICKER CONFIGURATIE ────────────
#
# Alle ticker-data op 1 plek. Nieuw aandeel toevoegen = alleen dit bestand wijzigen.
#
# Structuur per ticker:
#   name      - Display naam
#   currency  - Noteringsvaluta (EUR, USD, GBP, DKK, HKD)
#   sector    - GICS sector
#   country   - ISO 2-letter landcode
#   pence     - True als ticker in sub-units noteert (pence, cents)
#   aliases   - Alternatieve namen voor import-matching (spreadsheets)

TICKERS = {
    # ─── TECHNOLOGY ──────────────────────────────────────────
    'MSFT':      {'name': 'Microsoft',       'currency': 'USD', 'sector': 'Technology',             'country': 'US', 'pence': False, 'aliases': []},
    'AAPL':      {'name': 'Apple',           'currency': 'USD', 'sector': 'Technology',             'country': 'US', 'pence': False, 'aliases': ['Apple (Q)']},
    'GOOG':      {'name': 'Alphabet',        'currency': 'USD', 'sector': 'Technology',             'country': 'US', 'pence': False, 'aliases': []},
    'NVDA':      {'name': 'Nvidia',          'currency': 'USD', 'sector': 'Technology',             'country': 'US', 'pence': False, 'aliases': []},
    'TSM':       {'name': 'TSMC',            'currency': 'USD', 'sector': 'Technology',             'country': 'TW', 'pence': False, 'aliases': []},
    'ASML.AS':   {'name': 'ASML',            'currency': 'EUR', 'sector': 'Technology',             'country': 'NL', 'pence': False, 'aliases': []},
    'ADYEN.AS':  {'name': 'Adyen',           'currency': 'EUR', 'sector': 'Technology',             'country': 'NL', 'pence': False, 'aliases': []},
    'FTNT':      {'name': 'Fortinet',        'currency': 'USD', 'sector': 'Technology',             'country': 'US', 'pence': False, 'aliases': []},
    'MELI':      {'name': 'MercadoLibre',    'currency': 'USD', 'sector': 'Technology',             'country': 'AR', 'pence': False, 'aliases': []},
    '2929.HK':   {'name': 'Lotus',           'currency': 'HKD', 'sector': 'Technology',             'country': 'HK', 'pence': False, 'aliases': []},

    # ─── CONSUMER DISCRETIONARY ──────────────────────────────
    'AMZN':      {'name': 'Amazon',          'currency': 'USD', 'sector': 'Consumer Discretionary', 'country': 'US', 'pence': False, 'aliases': []},
    'RMS.PA':    {'name': 'Hermes',          'currency': 'EUR', 'sector': 'Consumer Discretionary', 'country': 'FR', 'pence': False, 'aliases': ['Hermès']},
    'MC.PA':     {'name': 'LVMH',            'currency': 'EUR', 'sector': 'Consumer Discretionary', 'country': 'FR', 'pence': False, 'aliases': []},
    'BKNG':      {'name': 'Booking',         'currency': 'USD', 'sector': 'Consumer Discretionary', 'country': 'US', 'pence': False, 'aliases': []},
    'DPZ':       {'name': "Domino's",        'currency': 'USD', 'sector': 'Consumer Discretionary', 'country': 'US', 'pence': False, 'aliases': []},
    'MAR':       {'name': 'Marriott',        'currency': 'USD', 'sector': 'Consumer Discretionary', 'country': 'US', 'pence': False, 'aliases': []},
    'GAW.L':     {'name': 'Games Workshop',  'currency': 'GBP', 'sector': 'Consumer Discretionary', 'country': 'GB', 'pence': True,  'aliases': []},

    # ─── FINANCIALS ──────────────────────────────────────────
    'V':         {'name': 'VISA',            'currency': 'USD', 'sector': 'Financials',             'country': 'US', 'pence': False, 'aliases': ['VISA (q)']},
    'MA':        {'name': 'Mastercard',      'currency': 'USD', 'sector': 'Financials',             'country': 'US', 'pence': False, 'aliases': ['Mastercard (q)']},
    'BRK-B':     {'name': 'Berkshire Hathaway', 'currency': 'USD', 'sector': 'Financials',          'country': 'US', 'pence': False, 'aliases': ['Berkshire Hathaway (Q)']},
    'BREB.BR':   {'name': 'Brederode',       'currency': 'EUR', 'sector': 'Financials',             'country': 'BE', 'pence': False, 'aliases': ['Brederode (q)']},
    'SOF.BR':    {'name': 'Sofina',          'currency': 'EUR', 'sector': 'Financials',             'country': 'BE', 'pence': False, 'aliases': ['Sofina (Q)']},
    'SMT.L':     {'name': 'Scottish Mortgage', 'currency': 'GBP', 'sector': 'Financials',           'country': 'GB', 'pence': True,  'aliases': []},

    # ─── HEALTHCARE ──────────────────────────────────────────
    'ZTS':       {'name': 'Zoetis',          'currency': 'USD', 'sector': 'Healthcare',             'country': 'US', 'pence': False, 'aliases': ['Zoetis (Q)']},
    'EW':        {'name': 'Edwards Lifesciences', 'currency': 'USD', 'sector': 'Healthcare',        'country': 'US', 'pence': False, 'aliases': []},
    'LLY':       {'name': 'Eli Lilly',       'currency': 'USD', 'sector': 'Healthcare',             'country': 'US', 'pence': False, 'aliases': []},
    'NOVO-B.CO': {'name': 'Novo Nordisk',    'currency': 'DKK', 'sector': 'Healthcare',             'country': 'DK', 'pence': False, 'aliases': []},
    'MEDP':      {'name': 'Medpace',         'currency': 'USD', 'sector': 'Healthcare',             'country': 'US', 'pence': False, 'aliases': []},
    'WAT':       {'name': 'Waters',          'currency': 'USD', 'sector': 'Healthcare',             'country': 'US', 'pence': False, 'aliases': []},
    'ARGX':      {'name': 'Argenx',          'currency': 'USD', 'sector': 'Healthcare',             'country': 'BE', 'pence': False, 'aliases': ['ARGEN-X', 'Argen-X']},

    # ─── REAL ESTATE ─────────────────────────────────────────
    'VGP.BR':    {'name': 'VGP',             'currency': 'EUR', 'sector': 'Real Estate',            'country': 'BE', 'pence': False, 'aliases': []},
    'WDP.BR':    {'name': 'WDP',             'currency': 'EUR', 'sector': 'Real Estate',            'country': 'BE', 'pence': False, 'aliases': []},
    'MONT.BR':   {'name': 'Montea',          'currency': 'EUR', 'sector': 'Real Estate',            'country': 'BE', 'pence': False, 'aliases': []},

    # ─── INDUSTRIALS ─────────────────────────────────────────
    'TT':        {'name': 'Trane',           'currency': 'USD', 'sector': 'Industrials',            'country': 'US', 'pence': False, 'aliases': []},
}


# ─── HELPER FUNCTIES ────────────────────────────────────────
# Alle andere bestanden gebruiken deze functies i.p.v. eigen dicts.

def _build_name_lookup():
    """Bouw een lookup dict: naam/alias → ticker. Wordt 1x gebouwd bij import."""
    lookup = {}
    for ticker, info in TICKERS.items():
        lookup[info['name']] = ticker
        for alias in info.get('aliases', []):
            lookup[alias] = ticker
    return lookup

_NAME_LOOKUP = _build_name_lookup()


def get_ticker(name):
    """Geef Yahoo Finance ticker voor een aandeel naam of alias."""
    if name in _NAME_LOOKUP:
        return _NAME_LOOKUP[name]
    # Strip (q) / (Q) suffix
    import re
    clean = re.sub(r'\s*\([qQ]\)\s*$', '', name).strip()
    return _NAME_LOOKUP.get(clean)


def get_currency(ticker):
    """Geef valuta voor een ticker (default: EUR)."""
    return TICKERS.get(ticker, {}).get('currency', 'EUR')


def get_sector(ticker):
    """Geef sector voor een ticker (default: Other)."""
    return TICKERS.get(ticker, {}).get('sector', 'Other')


def get_country(ticker):
    """Geef landcode voor een ticker."""
    return TICKERS.get(ticker, {}).get('country', '')


def is_pence_ticker(ticker):
    """True als ticker in sub-units noteert (pence, cents)."""
    return TICKERS.get(ticker, {}).get('pence', False)


def get_pence_tickers():
    """Set van alle tickers die in sub-units noteren."""
    return {t for t, info in TICKERS.items() if info.get('pence', False)}


def get_name_to_ticker_map():
    """Dict van naam → ticker (voor backward compatibility)."""
    return {info['name']: ticker for ticker, info in TICKERS.items()}


def get_ticker_to_name_map():
    """Dict van ticker → naam."""
    return {ticker: info['name'] for ticker, info in TICKERS.items()}


def get_ibkr_symbol_map():
    """
    Mapping van IBKR symbolen naar Yahoo Finance tickers.
    IBKR gebruikt symbolen zonder exchange suffix: 'BREB' i.p.v. 'BREB.BR'.
    """
    mapping = {}
    for ticker in TICKERS:
        ibkr_symbol = ticker.split('.')[0]
        if ticker == 'BRK-B':
            ibkr_symbol = 'BRK B'
        elif ticker == '2929.HK':
            ibkr_symbol = '2929'
        mapping[ibkr_symbol] = ticker
    return mapping


def get_import_sheets_map():
    """
    Mapping voor Google Sheets import: naam → (ticker, currency, sector, country).
    Inclusief aliassen.
    """
    result = {}
    for ticker, info in TICKERS.items():
        entry = (ticker, info['currency'], info['sector'], info['country'])
        result[info['name']] = entry
        for alias in info.get('aliases', []):
            result[alias] = entry
    return result
