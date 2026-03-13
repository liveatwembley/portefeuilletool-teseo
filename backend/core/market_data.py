import logging
import yfinance as yf
import pandas as pd
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from core.config.tickers import (
    get_ticker, get_currency, get_sector, is_pence_ticker, get_pence_tickers,
    get_name_to_ticker_map, TICKERS,
)
from app.cache import cache_prices, cache_fx, cache_fundamental, cache_historical, cache_benchmark

# ─── BACKWARD COMPATIBILITY ─────────────────────────────────
TICKER_MAP = get_name_to_ticker_map()
TICKER_CURRENCY = {t: info['currency'] for t, info in TICKERS.items() if info['currency'] != 'EUR'}
TICKER_SECTOR = {t: info['sector'] for t, info in TICKERS.items()}
PENCE_TICKERS = get_pence_tickers()


# ─── PRICE DATA ──────────────────────────────────────────────

def _adjust_pence(ticker, price):
    if is_pence_ticker(ticker):
        return price / 100.0
    return price


@cache_prices
def get_current_prices(tickers):
    if not tickers:
        return {}
    if isinstance(tickers, list):
        tickers = tuple(tickers)
    tickers = list(tickers)
    try:
        data = yf.download(tickers, period='2d', group_by='ticker', progress=False, threads=True)
        prices = {}
        if len(tickers) == 1:
            ticker = tickers[0]
            if not data.empty:
                raw_price = float(data['Close'].iloc[-1])
                raw_prev = float(data['Close'].iloc[0]) if len(data) > 1 else raw_price
                prices[ticker] = {
                    'price': _adjust_pence(ticker, raw_price),
                    'prev_close': _adjust_pence(ticker, raw_prev),
                    'volume': int(data['Volume'].iloc[-1]) if 'Volume' in data else 0,
                }
        else:
            for ticker in tickers:
                try:
                    if ticker in data.columns.get_level_values(0):
                        ticker_data = data[ticker]
                        if not ticker_data.empty and not pd.isna(ticker_data['Close'].iloc[-1]):
                            raw_price = float(ticker_data['Close'].iloc[-1])
                            raw_prev = float(ticker_data['Close'].iloc[0]) if len(ticker_data) > 1 else raw_price
                            prices[ticker] = {
                                'price': _adjust_pence(ticker, raw_price),
                                'prev_close': _adjust_pence(ticker, raw_prev),
                                'volume': int(ticker_data['Volume'].iloc[-1]) if 'Volume' in ticker_data else 0,
                            }
                except Exception as e:
                    logger.warning("Koers ophalen mislukt voor %s: %s", ticker, e)
                    continue
        return prices
    except Exception as e:
        logger.error("Batch koersen ophalen mislukt: %s", e)
        return {}


@cache_historical
def get_historical_prices(ticker, period='1y'):
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
    rates = {}
    try:
        resp = requests.get(
            'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+DKK+HKD.EUR.SP00.A',
            headers={'Accept': 'application/json'},
            params={'lastNObservations': '1'},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            series_list = data.get('dataSets', [{}])[0].get('series', {})
            dims = data.get('structure', {}).get('dimensions', {}).get('series', [])
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
    try:
        url = f'https://www.google.com/finance/quote/{from_curr}-{to_curr}'
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            import re
            match = re.search(r'data-last-price="([0-9.]+)"', resp.text)
            if match:
                return float(match.group(1))
    except Exception as e:
        logger.warning("Google Finance rate ophalen mislukt voor %s/%s: %s", from_curr, to_curr, e)
    return None


@cache_fx
def get_live_fx_rates():
    rates = {'EUR/EUR': 1.0}
    needed_pairs = ['EUR/USD', 'EUR/GBP', 'EUR/DKK', 'EUR/HKD']

    ecb_rates = _fetch_ecb_rates()
    rates.update(ecb_rates)

    for pair in needed_pairs:
        if pair not in rates:
            currency = pair.split('/')[1]
            rate = _fetch_google_finance_rate('EUR', currency)
            if rate:
                rates[pair] = rate

    missing = [p for p in needed_pairs if p not in rates]
    if missing:
        yf_map = {'EUR/USD': 'EURUSD=X', 'EUR/GBP': 'EURGBP=X', 'EUR/DKK': 'EURDKK=X', 'EUR/HKD': 'EURHKD=X'}
        try:
            yf_tickers = [yf_map[p] for p in missing if p in yf_map]
            if yf_tickers:
                data = yf.download(yf_tickers, period='5d', progress=False, threads=True)
                for pair_name in missing:
                    try:
                        yf_ticker = yf_map.get(pair_name)
                        if yf_ticker:
                            if len(yf_tickers) == 1:
                                rate = float(data['Close'].dropna().iloc[-1])
                            else:
                                rate = float(data[yf_ticker]['Close'].dropna().iloc[-1])
                            rates[pair_name] = rate
                    except Exception as e:
                        logger.warning("yfinance FX fallback mislukt voor %s: %s", pair_name, e)
        except Exception as e:
            logger.warning("yfinance FX batch ophalen mislukt: %s", e)

    rates.setdefault('EUR/USD', 1.18)
    rates.setdefault('EUR/GBP', 0.84)
    rates.setdefault('EUR/DKK', 7.46)
    rates.setdefault('EUR/HKD', 9.20)
    return rates


def convert_to_eur(amount, currency, fx_rates):
    if currency == 'EUR':
        return amount
    pair = f'EUR/{currency}'
    rate = fx_rates.get(pair, 1.0)
    return amount / rate if rate != 0 else amount


# ─── FUNDAMENTAL DATA ────────────────────────────────────────

@cache_fundamental
def get_fundamental_data(ticker):
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


@cache_fundamental
def get_fundamental_data_batch(tickers):
    if isinstance(tickers, list):
        tickers = tuple(tickers)
    result = {}
    for ticker in tickers:
        result[ticker] = get_fundamental_data(ticker)
    return result


@cache_benchmark
def get_benchmark_history(period='1y'):
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
    if market_cap is None:
        row = 1
    elif market_cap >= 50e9:
        row = 0
    elif market_cap >= 5e9:
        row = 1
    else:
        row = 2

    if pb_ratio is None:
        col = 1
    elif pb_ratio < 2.0:
        col = 0
    elif pb_ratio < 5.0:
        col = 1
    else:
        col = 2

    return row, col
