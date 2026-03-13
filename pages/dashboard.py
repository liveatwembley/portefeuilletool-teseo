"""
Dashboard coordinator.

Bouwt portfolio data op en delegeert rendering naar sub-modules:
  - dashboard_overview: Overzicht (KPIs, treemap, donut, waterfall, top10, tabel)
  - dashboard_xray: X-Ray (concentratie, sector/geo/valuta/advies analyse)
  - dashboard_performance: Rendement (historisch, benchmarks)
  - dashboard_holdings: Holdings (fundamentele data tabel)
"""

import streamlit as st
import pandas as pd
from database import get_latest_snapshot, get_holdings_for_snapshot
from market_data import get_current_prices, get_live_fx_rates
from calculations import enrich_all_holdings, calculate_portfolio_meta


def _build_portfolio_data(supabase):
    """Build complete portfolio dataframe with live prices."""
    snapshot = get_latest_snapshot(supabase)
    if not snapshot:
        return None, None, None

    holdings = get_holdings_for_snapshot(supabase, snapshot['id'])
    if not holdings:
        return snapshot, None, None

    tickers = [h.get('eq_positions', {}).get('ticker', '') for h in holdings]
    tickers = [t for t in tickers if t]

    live_prices = get_current_prices(tickers) if tickers else {}
    fx_rates = get_live_fx_rates()

    rows = enrich_all_holdings(holdings, live_prices, fx_rates)
    cash = float(snapshot.get('cash_eur', 0) or 0)
    meta = calculate_portfolio_meta(rows, cash, fx_rates, snapshot.get('snapshot_date', ''))

    # avg_cost in rows is in EUR (avg_cost_eur), map voor backward compat
    for r in rows:
        r['avg_cost'] = r['avg_cost_eur']

    df = pd.DataFrame(rows)
    return snapshot, df, meta


def render(supabase):
    snapshot, df, meta = _build_portfolio_data(supabase)

    if not snapshot:
        st.warning("Geen portefeuilledata gevonden. Voer eerst het import script uit.")
        return
    if df is None or df.empty:
        st.warning("Geen posities gevonden voor deze snapshot.")
        return

    # ─── DASHBOARD SUB-TABS ─────────────────────────────────
    sub_overview, sub_xray, sub_perf, sub_holdings = st.tabs([
        "Overzicht", "X-Ray", "Rendement", "Holdings"
    ])

    with sub_overview:
        from pages import dashboard_overview
        dashboard_overview.render(supabase, df, meta)

    with sub_xray:
        from pages import dashboard_xray
        dashboard_xray.render(df, meta)

    with sub_perf:
        from pages import dashboard_performance
        dashboard_performance.render(supabase, df, meta)

    with sub_holdings:
        from pages import dashboard_holdings
        dashboard_holdings.render(df, meta)
