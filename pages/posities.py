import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from database import get_latest_snapshot, get_holdings_for_snapshot, get_transactions_for_position
from market_data import (
    get_historical_prices, get_live_fx_rates, convert_to_eur,
    get_fundamental_data, get_benchmark_history, classify_style,
)
from config.tickers import is_pence_ticker
from utils import (
    format_euro, format_pct, format_market_cap, pnl_color, advice_badge_html,
    format_52w_range_bar, style_box_html, kpi_card_html, kpi_card_pnl_html,
    section_title_html, COLOR_BRAND, COLOR_NEUTRAL,
)


def render(supabase):
    snapshot = get_latest_snapshot(supabase)
    if not snapshot:
        st.warning("Geen portefeuilledata gevonden.")
        return

    holdings = get_holdings_for_snapshot(supabase, snapshot['id'])
    if not holdings:
        st.warning("Geen posities gevonden.")
        return

    # Build position list
    positions = []
    for h in holdings:
        pos = h.get('eq_positions', {})
        if pos:
            positions.append({
                'id': pos.get('id'),
                'name': pos.get('name', ''),
                'ticker': pos.get('ticker', ''),
                'currency': pos.get('currency', 'EUR'),
                'holding': h,
            })

    positions.sort(key=lambda x: float(x['holding'].get('value_eur', 0) or 0), reverse=True)
    position_names = [f"{p['name']} ({p['ticker']})" for p in positions]

    selected_idx = st.selectbox("Selecteer positie", range(len(position_names)),
                                format_func=lambda i: position_names[i], label_visibility="collapsed")

    if selected_idx is not None:
        pos = positions[selected_idx]
        h = pos['holding']
        ticker = pos['ticker']
        name = pos['name']
        currency = pos['currency']

        st.markdown(f"### {name}")
        st.caption(f"{ticker} · {currency}")

        # ─── KPI ROW (flat, Morningstar style) ────────────
        fx_rates = get_live_fx_rates()
        shares = int(h.get('shares', 0) or 0)
        price_local = float(h.get('price_local', 0) or 0)
        price_eur = float(h.get('price_eur', 0) or 0)
        avg_cost = float(h.get('avg_cost', 0) or 0)

        # Slimme pence-correctie via vergelijking met koers
        from calculations import _correct_pence_avg_cost
        avg_cost = _correct_pence_avg_cost(ticker, avg_cost, price_local)

        # avg_cost → EUR voor weergave
        avg_cost_eur = convert_to_eur(avg_cost, currency, fx_rates) if avg_cost > 0 else 0

        value = float(h.get('value_eur', 0) or 0)
        pnl_nom = float(h.get('pnl_nominal', 0) or 0)
        pnl_pct_val = float(h.get('pnl_pct', 0) or 0)
        weight = float(h.get('weight_pct', 0) or 0)
        advice = h.get('advice', '')

        # Valuta-symbool voor lokale weergave
        currency_symbols = {'EUR': '€', 'USD': '$', 'GBP': '£', 'DKK': 'kr', 'HKD': 'HK$'}
        curr_sym = currency_symbols.get(currency, currency)

        kpi_cols = st.columns(6)
        with kpi_cols[0]:
            st.markdown(kpi_card_html("Aantal", f"{shares:,}"), unsafe_allow_html=True)
        with kpi_cols[1]:
            # Dual notation: EUR koers + lokale valuta indien non-EUR
            koers_html = f"€{price_eur:,.2f}"
            if currency != 'EUR':
                koers_html += f"<br><span style='font-size:0.75rem;color:#6b7280'>{curr_sym}{price_local:,.2f}</span>"
            st.markdown(kpi_card_html("Koers", koers_html), unsafe_allow_html=True)
        with kpi_cols[2]:
            st.markdown(kpi_card_html("Waarde", format_euro(value)), unsafe_allow_html=True)
        with kpi_cols[3]:
            # Gem. Kost: toon EUR + lokale valuta voor non-EUR
            kost_html = f"€{avg_cost_eur:,.2f}"
            if currency != 'EUR' and avg_cost > 0:
                kost_html += f"<br><span style='font-size:0.75rem;color:#6b7280'>{curr_sym}{avg_cost:,.2f}</span>"
            st.markdown(kpi_card_html("Gem. Kost", kost_html), unsafe_allow_html=True)
        with kpi_cols[4]:
            ps = "+" if pnl_pct_val >= 0 else ""
            st.markdown(kpi_card_pnl_html(
                "P&L", format_euro(pnl_nom),
                delta=f"{ps}{pnl_pct_val:.1f}%", amount=pnl_nom,
            ), unsafe_allow_html=True)
        with kpi_cols[5]:
            st.markdown(kpi_card_html("Gewicht", f"{weight:.1f}%"), unsafe_allow_html=True)

        if advice:
            st.markdown(f"**Advies:** {advice_badge_html(advice)}", unsafe_allow_html=True)

        motivation = h.get('motivation', '')
        if motivation:
            st.markdown(f"**Motivatie:** {motivation}")

        st.markdown("---")

        # ─── TWO COLUMN: CHART + FUNDAMENTALS ─────────────
        chart_col, fund_col = st.columns([3, 1])

        with chart_col:
            # ─── PRICE CHART ──────────────────────────────
            tab_6m, tab_1y, tab_3y, tab_5y, tab_max = st.tabs(["6M", "1Y", "3Y", "5Y", "MAX"])
            periods = {'6M': '6mo', '1Y': '1y', '3Y': '3y', '5Y': '5y', 'MAX': 'max'}
            for tab, (label, period) in zip([tab_6m, tab_1y, tab_3y, tab_5y, tab_max], periods.items()):
                with tab:
                    hist = get_historical_prices(ticker, period)
                    if not hist.empty:
                        fig = go.Figure()
                        fig.add_trace(go.Scatter(
                            x=hist.index, y=hist['Close'],
                            mode='lines', line=dict(color=COLOR_BRAND, width=1.5),
                            fill='tozeroy', fillcolor='rgba(27,58,92,0.04)',
                            hovertemplate="%{x|%d-%m-%Y}<br>%{y:,.2f} " + currency + "<extra></extra>",
                        ))
                        if avg_cost > 0:
                            # avg_cost is al in lokale valuta (na pence-correctie)
                            # hist['Close'] is ook in lokale valuta (na pence-correctie)
                            fig.add_hline(
                                y=avg_cost, line_dash="dash", line_color="#E8B34A",
                                annotation_text=f"Gem. kost: {curr_sym}{avg_cost:,.2f}",
                                annotation_position="top left",
                                annotation=dict(font=dict(size=10, color="#E8B34A")),
                            )
                        fig.update_layout(
                            margin=dict(t=10, l=10, r=10, b=10), height=350,
                            font=dict(family="Inter", size=11), plot_bgcolor='white',
                            xaxis=dict(gridcolor='#f3f4f6'),
                            yaxis=dict(gridcolor='#f3f4f6', title=currency),
                        )
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        st.info(f"Geen historische data beschikbaar voor {ticker}")

        with fund_col:
            # ─── FUNDAMENTALS PANEL ───────────────────────
            st.markdown(section_title_html("Key Statistics"), unsafe_allow_html=True)

            fd = get_fundamental_data(ticker)

            pe = fd.get('pe_trailing')
            pe_fwd = fd.get('pe_forward')
            pb = fd.get('pb')
            dy = fd.get('dividend_yield')
            mc = fd.get('market_cap')
            beta = fd.get('beta')
            w52h = fd.get('fifty_two_week_high')
            w52l = fd.get('fifty_two_week_low')
            industry = fd.get('industry')

            # Style Box
            if mc and pb:
                sb_row, sb_col = classify_style(mc, pb)
                st.markdown(style_box_html(sb_row, sb_col), unsafe_allow_html=True)
                style_labels_r = ['Large', 'Mid', 'Small']
                style_labels_c = ['Value', 'Blend', 'Growth']
                st.caption(f"{style_labels_r[sb_row]} {style_labels_c[sb_col]}")

            # Key stats table
            stats = [
                ('P/E (TTM)', f'{pe:.1f}' if pe else '—'),
                ('P/E (Fwd)', f'{pe_fwd:.1f}' if pe_fwd else '—'),
                ('P/B', f'{pb:.1f}' if pb else '—'),
                ('Div Yield', f'{dy:.2f}%' if dy else '—'),
                ('Market Cap', format_market_cap(mc)),
                ('Beta', f'{beta:.2f}' if beta else '—'),
                ('52W High', f'{w52h:,.2f}' if w52h else '—'),
                ('52W Low', f'{w52l:,.2f}' if w52l else '—'),
            ]

            stats_html = '<table style="width:100%;font-size:0.8rem;border-collapse:collapse">'
            for label, val in stats:
                stats_html += (
                    f'<tr>'
                    f'<td style="padding:0.3rem 0;color:#6b7280;border-bottom:1px solid #f3f4f6">{label}</td>'
                    f'<td style="padding:0.3rem 0;text-align:right;font-weight:500;border-bottom:1px solid #f3f4f6">{val}</td>'
                    f'</tr>'
                )
            stats_html += '</table>'
            st.markdown(stats_html, unsafe_allow_html=True)

            # 52W Range bar
            # yfinance .info geeft w52h/w52l in de ruwe eenheid (pence voor LSE tickers)
            # price_local is al pence-gecorrigeerd, dus corrigeer w52 ook
            w52h_adj = w52h / 100.0 if w52h and is_pence_ticker(ticker) else w52h
            w52l_adj = w52l / 100.0 if w52l and is_pence_ticker(ticker) else w52l
            if w52l_adj and w52h_adj and price_local:
                st.markdown("<div style='margin-top:0.5rem'>", unsafe_allow_html=True)
                st.caption("52-Week Range")
                st.markdown(format_52w_range_bar(w52l_adj, w52h_adj, price_local), unsafe_allow_html=True)
                st.markdown(
                    f"<span style='font-size:0.7rem;color:#6b7280'>{curr_sym}{w52l_adj:,.2f} — {curr_sym}{w52h_adj:,.2f}</span>",
                    unsafe_allow_html=True,
                )
                st.markdown("</div>", unsafe_allow_html=True)

            if industry:
                st.caption(f"Industrie: {industry}")

        # ─── ADVICE EDIT ──────────────────────────────────
        st.markdown("---")
        st.markdown(section_title_html("Intern Advies Bijwerken"), unsafe_allow_html=True)

        with st.form(f"advice_form_{pos['id']}"):
            new_advice = st.selectbox(
                "Advies", ['houden', 'koopman', 'kopen', 'verkopen'],
                index=['houden', 'koopman', 'kopen', 'verkopen'].index(advice.lower()) if advice.lower() in ['houden', 'koopman', 'kopen', 'verkopen'] else 0,
            )
            new_motivation = st.text_area("Motivatie", value=motivation or '')

            if st.form_submit_button("Opslaan", type="primary"):
                supabase.table('eq_holdings').update({
                    'advice': new_advice,
                    'motivation': new_motivation,
                }).eq('id', h['id']).execute()
                st.success("Advies bijgewerkt")
                st.rerun()

        # ─── TRANSACTION HISTORY ──────────────────────────
        transactions = get_transactions_for_position(supabase, pos['id'])
        if transactions:
            st.markdown(section_title_html("Transactiehistorie"), unsafe_allow_html=True)
            tx_df = pd.DataFrame(transactions)
            display_cols = ['transaction_date', 'type', 'shares', 'price_eur', 'fees', 'notes']
            existing_cols = [c for c in display_cols if c in tx_df.columns]
            st.dataframe(tx_df[existing_cols], use_container_width=True, hide_index=True)
