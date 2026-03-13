"""Tests voor config/tickers.py — single source of truth validatie."""

import pytest
from config.tickers import (
    TICKERS, get_ticker, get_currency, get_sector, get_country,
    is_pence_ticker, get_pence_tickers, get_name_to_ticker_map,
    get_ticker_to_name_map, get_ibkr_symbol_map, get_import_sheets_map,
)


# --- TICKERS DICT INTEGRITEIT ---

def test_tickers_not_empty():
    assert len(TICKERS) > 0


def test_all_tickers_have_required_fields():
    required = {'name', 'currency', 'sector', 'country', 'pence', 'aliases'}
    for ticker, info in TICKERS.items():
        missing = required - set(info.keys())
        assert not missing, f"{ticker} mist velden: {missing}"


def test_all_currencies_valid():
    valid = {'EUR', 'USD', 'GBP', 'DKK', 'HKD'}
    for ticker, info in TICKERS.items():
        assert info['currency'] in valid, f"{ticker} heeft onbekende valuta: {info['currency']}"


def test_all_countries_two_letter():
    for ticker, info in TICKERS.items():
        assert len(info['country']) == 2, f"{ticker} heeft ongeldige landcode: {info['country']}"


def test_aliases_is_list():
    for ticker, info in TICKERS.items():
        assert isinstance(info['aliases'], list), f"{ticker} aliases moet een list zijn"


def test_pence_is_bool():
    for ticker, info in TICKERS.items():
        assert isinstance(info['pence'], bool), f"{ticker} pence moet bool zijn"


def test_no_duplicate_names():
    names = [info['name'] for info in TICKERS.values()]
    assert len(names) == len(set(names)), "Dubbele namen gevonden"


def test_no_duplicate_aliases():
    all_aliases = []
    for info in TICKERS.values():
        all_aliases.extend(info['aliases'])
    assert len(all_aliases) == len(set(all_aliases)), "Dubbele aliassen gevonden"


# --- HELPER FUNCTIES ---

def test_get_ticker_by_name():
    assert get_ticker('Microsoft') == 'MSFT'
    assert get_ticker('ASML') == 'ASML.AS'
    assert get_ticker('Games Workshop') == 'GAW.L'


def test_get_ticker_by_alias():
    assert get_ticker('Apple (Q)') == 'AAPL'
    assert get_ticker('Hermès') == 'RMS.PA'
    assert get_ticker('VISA (q)') == 'V'


def test_get_ticker_strips_q_suffix():
    assert get_ticker('Berkshire Hathaway (Q)') == 'BRK-B'
    assert get_ticker('Sofina (Q)') == 'SOF.BR'


def test_get_ticker_unknown():
    assert get_ticker('Onbekend Bedrijf') is None


def test_get_currency_known():
    assert get_currency('MSFT') == 'USD'
    assert get_currency('ASML.AS') == 'EUR'
    assert get_currency('GAW.L') == 'GBP'
    assert get_currency('NOVO-B.CO') == 'DKK'
    assert get_currency('2929.HK') == 'HKD'


def test_get_currency_unknown_defaults_eur():
    assert get_currency('FAKE') == 'EUR'


def test_get_sector():
    assert get_sector('MSFT') == 'Technology'
    assert get_sector('AMZN') == 'Consumer Discretionary'
    assert get_sector('V') == 'Financials'


def test_get_sector_unknown_defaults_other():
    assert get_sector('FAKE') == 'Other'


def test_get_country():
    assert get_country('MSFT') == 'US'
    assert get_country('ASML.AS') == 'NL'
    assert get_country('BREB.BR') == 'BE'


def test_is_pence_ticker():
    assert is_pence_ticker('GAW.L') is True
    assert is_pence_ticker('SMT.L') is True
    assert is_pence_ticker('MSFT') is False
    assert is_pence_ticker('ASML.AS') is False


def test_get_pence_tickers():
    pence = get_pence_tickers()
    assert 'GAW.L' in pence
    assert 'SMT.L' in pence
    assert 'MSFT' not in pence
    assert len(pence) == 2


def test_name_to_ticker_map():
    m = get_name_to_ticker_map()
    assert m['Microsoft'] == 'MSFT'
    assert m['Hermes'] == 'RMS.PA'
    assert len(m) == len(TICKERS)


def test_ticker_to_name_map():
    m = get_ticker_to_name_map()
    assert m['MSFT'] == 'Microsoft'
    assert m['GAW.L'] == 'Games Workshop'
    assert len(m) == len(TICKERS)


def test_ibkr_symbol_map():
    m = get_ibkr_symbol_map()
    assert m['MSFT'] == 'MSFT'
    assert m['ASML'] == 'ASML.AS'
    assert m['BREB'] == 'BREB.BR'
    assert m['BRK B'] == 'BRK-B'
    assert m['2929'] == '2929.HK'
    assert m['GAW'] == 'GAW.L'


def test_import_sheets_map():
    m = get_import_sheets_map()
    ticker, currency, sector, country = m['Microsoft']
    assert ticker == 'MSFT'
    assert currency == 'USD'
    assert sector == 'Technology'
    assert country == 'US'


def test_import_sheets_map_includes_aliases():
    m = get_import_sheets_map()
    assert 'Apple (Q)' in m
    assert 'Hermès' in m
    assert m['Apple (Q)'][0] == 'AAPL'
