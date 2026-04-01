import logging
import streamlit as st
import yfinance as yf
import pandas as pd
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from config.tickers import (
    get_ticker, get_currency, get_sector, is_pence_ticker, get_pence_tickers,
    get_name_to_ticker_map, TICKERS,
)

# ─── BACKWARD COMPATIBILITY ─────────────────────────────────
# Andere modules importeren deze namen uit market_data.py.
# We re-exporteren ze vanuit config.tickers zodat bestaande imports blijven werken
# totdat alle consumers zijn gemigreerd.
TICKER_MAP = get_name_to_ticker_map()
TICKER_CURRENCY = {t: info['currency'] for t, info in TICKERS.items() if info['currency'] != 'EUR'}
TICKER_SECTOR = {t: info['sector'] for t, info in TICKERS.items()}
PENCE_TICKERS = get_pence_tickers()


# ─── PRICE DATA ──────────────────────────────────────────────

def _adjust_pence(ticker, price):
    """Converteer pence naar pounds voor LSE tickers."""
    if is_pence_ticker(ticker):
        return price / 100.0
    return price


@st.cache_data(ttl=300)
def get_current_prices(tickers):
    """Haal huidige koersen op voor een lijst tickers. Cache 5 min."""
    if not tickers:
        return {}
    try:
        data = yf.download(tickers, period='2d', progress=False, threads=True)
        prices = {}
        if data.empty:
            return prices
        for ticker in tickers:
            try:
                close_col = ('Close', ticker) if ('Close', ticker) in data.columns else None
                vol_col = ('Volume', ticker) if ('Volume', ticker) in data.columns else None
                if close_col is None:
                    continue
                close_series = data[close_col].dropna()
                if close_series.empty:
                    continue
                raw_price = float(close_series.iloc[-1])
                raw_prev = float(close_series.iloc[0]) if len(close_series) > 1 else raw_price
                volume = int(data[vol_col].iloc[-1]) if vol_col and not pd.isna(data[vol_col].iloc[-1]) else 0
                prices[ticker] = {
                    'price': _adjust_pence(ticker, raw_price),
                    'prev_close': _adjust_pence(ticker, raw_prev),
                    'volume': volume,
                }
            except Exception as e:
                logger.warning("Koers ophalen mislukt voor %s: %s", ticker, e)
                continue
        return prices
    except Exception as e:
        logger.error("Batch koersen ophalen mislukt: %s", e)
        return {}


@st.cache_data(ttl=3600)
def get_historical_prices(ticker, period='1y'):
    """Haal historische koersen op voor een ticker."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        if is_pence_ticker(ticker) and not hist.empty:
            for col in ['Open', 'High', 'Low', 'Close']:
                if col in hist.columns:
                    hist[col] = hist[col] / 100.0
        return hist
    except Exception as e:
        logger.warning("Historische data ophalen mislukt voor %s: %s", ticker, e)
        return pd.DataFrame()


# ─── FX RATES ────────────────────────────────────────────────

def _fetch_ecb_rates():
    """Haal wisselkoersen op van ECB (European Central Bank) - meest betrouwbare bron."""
    rates = {}
    try:
        resp = requests.get(
            'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+DKK.EUR.SP00.A',
            headers={'Accept': 'application/json'},
            params={'lastNObservations': '1'},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            series_list = data.get('dataSets', [{}])[0].get('series', {})
            dims = data.get('structure', {}).get('dimensions', {}).get('series', [])
            # Find currency dimension
            curr_dim = next((d for d in dims if d.get('id') == 'CURRENCY'), None)
            if curr_dim:
                for key, series in series_list.items():
                    idx = int(key.split(':')[1])
                    currency_code = curr_dim['values'][idx]['id']
                    obs = series.get('observations', {})
                    if obs:
                        last_key = max(obs.keys())
                        rate = float(obs[last_key][0])
                        rates[f'EUR/{currency_code}'] = rate
    except Exception as e:
        logger.warning("ECB wisselkoersen ophalen mislukt: %s", e)
    return rates


def _fetch_google_finance_rate(from_curr, to_curr):
    """Haal wisselkoers op via Google Finance."""
    try:
        url = f'https://www.google.com/finance/quote/{from_curr}-{to_curr}'
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            import re
            # Google Finance has the rate in a data attribute
            match = re.search(r'data-last-price="([0-9.]+)"', resp.text)
            if match:
                return float(match.group(1))
    except Exception as e:
        logger.warning("Google Finance rate ophalen mislukt voor %s/%s: %s", from_curr, to_curr, e)
    return None


@st.cache_data(ttl=900)
def get_live_fx_rates():
    """Haal actuele wisselkoersen op. Volgorde: ECB → Google Finance → yfinance fallback. Cache 15 min."""
    rates = {'EUR/EUR': 1.0}
    needed_pairs = ['EUR/USD', 'EUR/GBP', 'EUR/DKK']

    # 1) ECB API (meest betrouwbaar)
    ecb_rates = _fetch_ecb_rates()
    rates.update(ecb_rates)

    # 2) Google Finance voor missende paren
    for pair in needed_pairs:
        if pair not in rates:
            currency = pair.split('/')[1]
            rate = _fetch_google_finance_rate('EUR', currency)
            if rate:
                rates[pair] = rate

    # 3) yfinance als laatste fallback
    missing = [p for p in needed_pairs if p not in rates]
    if missing:
        yf_map = {'EUR/USD': 'EURUSD=X', 'EUR/GBP': 'EURGBP=X', 'EUR/DKK': 'EURDKK=X'}
        try:
            yf_tickers = [yf_map[p] for p in missing if p in yf_map]
            if yf_tickers:
                data = yf.download(yf_tickers, period='5d', progress=False, threads=True)
                for pair_name in missing:
                    try:
                        yf_ticker = yf_map.get(pair_name)
                        if yf_ticker and ('Close', yf_ticker) in data.columns:
                            close_series = data[('Close', yf_ticker)].dropna()
                            if not close_series.empty:
                                rates[pair_name] = float(close_series.iloc[-1])
                    except Exception as e:
                        logger.warning("yfinance FX fallback mislukt voor %s: %s", pair_name, e)
        except Exception as e:
            logger.warning("yfinance FX batch ophalen mislukt: %s", e)

    # 4) Absolute fallback (nooit stale data tonen)
    rates.setdefault('EUR/USD', 1.18)
    rates.setdefault('EUR/GBP', 0.84)
    rates.setdefault('EUR/DKK', 7.46)
    return rates


def convert_to_eur(amount, currency, fx_rates):
    """Converteer bedrag naar EUR."""
    if currency == 'EUR':
        return amount
    pair = f'EUR/{currency}'
    rate = fx_rates.get(pair, 1.0)
    return amount / rate if rate != 0 else amount


# ─── FUNDAMENTAL DATA ────────────────────────────────────────

@st.cache_data(ttl=3600)
def get_fundamental_data(ticker):
    """Haal fundamentele data op via yfinance .info. Cache 1 uur."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        return {
            'pe_trailing': info.get('trailingPE'),
            'pe_forward': info.get('forwardPE'),
            'pb': info.get('priceToBook'),
            'dividend_yield': info.get('dividendYield'),
            'market_cap': info.get('marketCap'),
            'beta': info.get('beta'),
            'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
            'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
            'avg_volume': info.get('averageVolume'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'short_name': info.get('shortName'),
        }
    except Exception as e:
        logger.warning("Fundamentele data ophalen mislukt voor %s: %s", ticker, e)
        return {
            'pe_trailing': None, 'pe_forward': None, 'pb': None,
            'dividend_yield': None, 'market_cap': None, 'beta': None,
            'fifty_two_week_high': None, 'fifty_two_week_low': None,
            'avg_volume': None, 'sector': None, 'industry': None,
            'short_name': None,
        }


@st.cache_data(ttl=3600)
def get_fundamental_data_batch(tickers):
    """Haal fundamentele data op voor meerdere tickers. Cache 1 uur."""
    result = {}
    for ticker in tickers:
        result[ticker] = get_fundamental_data(ticker)
    return result


@st.cache_data(ttl=3600)
def get_benchmark_history(period='1y'):
    """Haal benchmark indices op voor vergelijking. Cache 1 uur."""
    benchmarks = {'^GSPC': 'S&P 500', 'URTH': 'MSCI World'}
    result = {}
    for ticker, name in benchmarks.items():
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            if not hist.empty:
                result[name] = hist
        except Exception as e:
            logger.warning("Benchmark data ophalen mislukt voor %s: %s", ticker, e)
            continue
    return result


def classify_style(market_cap, pb_ratio):
    """
    Morningstar Style Box classificatie.
    Returns: (row, col) waar:
        row: 0=Large, 1=Mid, 2=Small
        col: 0=Value, 1=Blend, 2=Growth
    """
    # Size classification
    if market_cap is None:
        row = 1  # Default Mid
    elif market_cap >= 50e9:
        row = 0  # Large
    elif market_cap >= 5e9:
        row = 1  # Mid
    else:
        row = 2  # Small

    # Style classification (simplified: P/B based)
    if pb_ratio is None:
        col = 1  # Default Blend
    elif pb_ratio < 2.0:
        col = 0  # Value
    elif pb_ratio < 5.0:
        col = 1  # Blend
    else:
        col = 2  # Growth

    return row, col
