"""Tests voor calculations.py — portfolio berekeningen."""

import pytest
from unittest.mock import patch
from calculations import (
    _correct_pence_avg_cost,
    enrich_holding,
    enrich_all_holdings,
    calculate_portfolio_meta,
)


# --- PENCE CORRECTIE ---

def test_pence_correction_converts_when_ratio_high():
    # avg_cost 12000 pence vs price 120 pounds -> ratio > 10x -> corrigeer
    result = _correct_pence_avg_cost('GAW.L', 12000, 120)
    assert result == 120.0


def test_pence_correction_no_change_when_already_pounds():
    # avg_cost 115 pounds vs price 120 pounds -> ratio < 10x -> geen correctie
    result = _correct_pence_avg_cost('GAW.L', 115, 120)
    assert result == 115


def test_pence_correction_no_change_for_non_pence_ticker():
    result = _correct_pence_avg_cost('MSFT', 300, 310)
    assert result == 300


def test_pence_correction_zero_avg_cost():
    result = _correct_pence_avg_cost('GAW.L', 0, 120)
    assert result == 0


def test_pence_correction_zero_price():
    result = _correct_pence_avg_cost('GAW.L', 12000, 0)
    assert result == 12000


def test_pence_correction_smt():
    result = _correct_pence_avg_cost('SMT.L', 85000, 850)
    assert result == 850.0


# --- ENRICH HOLDING ---

def _make_holding(ticker='MSFT', name='Microsoft', currency='USD', shares=100,
                  price_local=300, avg_cost=250, pnl_nominal=None, pnl_pct=None):
    return {
        'eq_positions': {
            'id': 1,
            'ticker': ticker,
            'name': name,
            'currency': currency,
        },
        'position_id': 1,
        'shares': shares,
        'price_local': price_local,
        'avg_cost': avg_cost,
        'pnl_nominal': pnl_nominal,
        'pnl_pct': pnl_pct,
        'advice': 'Hold',
        'mandate_buy': 0,
        'mandate_sell': 0,
        'motivation': None,
    }


def _mock_convert_to_eur(amount, currency, fx_rates):
    """Simpele mock: USD/EUR = 1.10, GBP/EUR = 0.85."""
    if currency == 'EUR':
        return amount
    rate = fx_rates.get(f'EUR/{currency}', 1.0)
    return amount / rate if rate else amount


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_basic(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holding = _make_holding()

    result = enrich_holding(holding, live, fx)

    assert result is not None
    assert result['ticker'] == 'MSFT'
    assert result['name'] == 'Microsoft'
    assert result['shares'] == 100
    assert result['price_local'] == 330.0
    assert result['price_eur'] == 300.0  # 330 / 1.10
    assert result['currency'] == 'USD'
    assert result['sector'] == 'Technology'


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_pnl_calculation(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holding = _make_holding(avg_cost=250)

    result = enrich_holding(holding, live, fx)

    # avg_cost_eur = 250 / 1.10 = 227.27
    # price_eur = 330 / 1.10 = 300
    # pnl = (300 - 227.27) * 100 = 7272.72
    assert result['pnl_nominal'] > 0
    assert result['pnl_pct'] > 0


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_day_change(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holding = _make_holding()

    result = enrich_holding(holding, live, fx)

    assert result['day_change'] > 0
    assert result['day_change_pct'] > 0


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_eur_ticker(mock_fx):
    fx = {}
    live = {'ASML.AS': {'price': 800.0, 'prev_close': 790.0}}
    holding = _make_holding(ticker='ASML.AS', name='ASML', currency='EUR', avg_cost=600)

    result = enrich_holding(holding, live, fx)

    assert result['price_eur'] == 800.0
    assert result['fx_rate'] == 1.0


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_no_live_price_uses_stored(mock_fx):
    fx = {'EUR/USD': 1.10}
    holding = _make_holding(price_local=300)

    result = enrich_holding(holding, {}, fx)

    assert result['price_local'] == 300


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_zero_shares_returns_none(mock_fx):
    holding = _make_holding(shares=0)
    result = enrich_holding(holding, {}, {})
    assert result is None


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_empty_ticker_returns_none(mock_fx):
    holding = _make_holding(ticker='')
    result = enrich_holding(holding, {}, {})
    assert result is None


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_holding_pence_ticker(mock_fx):
    fx = {'EUR/GBP': 0.85}
    live = {'GAW.L': {'price': 120.0, 'prev_close': 118.0}}
    holding = _make_holding(ticker='GAW.L', name='Games Workshop', currency='GBP',
                            shares=50, avg_cost=11500)  # avg_cost in pence

    result = enrich_holding(holding, live, fx)

    # avg_cost should be corrected: 11500 / 100 = 115
    assert result['avg_cost'] == 115.0


# --- ENRICH ALL HOLDINGS ---

@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_all_holdings_weights(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {
        'MSFT': {'price': 330.0, 'prev_close': 325.0},
        'AAPL': {'price': 220.0, 'prev_close': 218.0},
    }
    holdings = [
        _make_holding(ticker='MSFT', name='Microsoft', shares=100),
        _make_holding(ticker='AAPL', name='Apple', shares=100),
    ]

    result = enrich_all_holdings(holdings, live, fx)

    assert len(result) == 2
    total_weight = sum(r['weight'] for r in result)
    assert abs(total_weight - 100.0) < 0.01


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_enrich_all_holdings_filters_invalid(mock_fx):
    holdings = [
        _make_holding(shares=0),
        _make_holding(ticker='AAPL', name='Apple', shares=50),
    ]
    live = {'AAPL': {'price': 220.0, 'prev_close': 218.0}}

    result = enrich_all_holdings(holdings, live, {'EUR/USD': 1.10})

    assert len(result) == 1
    assert result[0]['ticker'] == 'AAPL'


# --- PORTFOLIO META ---

@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_calculate_portfolio_meta(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holdings = [_make_holding(shares=100)]

    enriched = enrich_all_holdings(holdings, live, fx)
    meta = calculate_portfolio_meta(enriched, cash=5000, fx_rates=fx, snapshot_date='2026-03-13')

    assert meta['cash'] == 5000
    assert meta['portfolio_total'] > 0
    assert meta['portfolio_total'] == meta['total_value'] + 5000
    assert meta['cash_pct'] > 0
    assert meta['snapshot_date'] == '2026-03-13'


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_portfolio_meta_weights_include_cash(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holdings = [_make_holding(shares=100)]

    enriched = enrich_all_holdings(holdings, live, fx)
    meta = calculate_portfolio_meta(enriched, cash=5000, fx_rates=fx)

    # Gewichten moeten herberekend zijn inclusief cash
    total_weight = sum(r['weight'] for r in enriched)
    assert total_weight < 100.0  # want cash neemt een deel in


@patch('calculations.convert_to_eur', side_effect=_mock_convert_to_eur)
def test_portfolio_meta_zero_cash(mock_fx):
    fx = {'EUR/USD': 1.10}
    live = {'MSFT': {'price': 330.0, 'prev_close': 325.0}}
    holdings = [_make_holding(shares=100)]

    enriched = enrich_all_holdings(holdings, live, fx)
    meta = calculate_portfolio_meta(enriched, cash=0, fx_rates=fx)

    assert meta['cash_pct'] == 0
    assert meta['portfolio_total'] == meta['total_value']
