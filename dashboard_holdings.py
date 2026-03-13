import streamlit as st
from market_data import get_fundamental_data_batch, classify_style
from config.tickers import is_pence_ticker
from utils import (
    format_market_cap, pnl_class, format_52w_range_bar,
    style_box_html, section_title_html,
)


def render(df, meta):
    st.markdown(section_title_html("Portfolio Holdings — Fundamentele Data"), unsafe_allow_html=True)

    if df.empty:
        st.info("Geen holdings data.")
        return

    # Fetch fundamental data
    tickers = df['ticker'].tolist()
    with st.spinner("Fundamentele data ophalen..."):
        fund_data = get_fundamental_data_batch(tickers)

    # Build enhanced table
    rows_html = []
    totals = {'value': 0, 'weight': 0, 'pe_sum': 0, 'pe_count': 0, 'pb_sum': 0, 'pb_count': 0, 'dy_sum': 0, 'dy_count': 0}

    for _, r in df.sort_values('value', ascending=False).iterrows():
        fd = fund_data.get(r['ticker'], {})
        pe = fd.get('pe_trailing')
        pb = fd.get('pb')
        dy = fd.get('dividend_yield')
        mc = fd.get('market_cap')
        beta = fd.get('beta')
        w52h = fd.get('fifty_two_week_high')
        w52l = fd.get('fifty_two_week_low')

        # Style box
        sb_row, sb_col = classify_style(mc, pb)
        sb_html = style_box_html(sb_row, sb_col)

        # 52w range — corrigeer pence-tickers (yfinance .info geeft ruwe pence waarden)
        w52h_adj = w52h / 100.0 if w52h and is_pence_ticker(r['ticker']) else w52h
        w52l_adj = w52l / 100.0 if w52l and is_pence_ticker(r['ticker']) else w52l
        range_html = format_52w_range_bar(w52l_adj, w52h_adj, r['price_local'])

        # P&L colors
        pnl_cls = pnl_class(r['pnl_pct'])

        # Weighted averages
        totals['value'] += r['value']
        totals['weight'] += r['weight']
        if pe and pe > 0:
            totals['pe_sum'] += pe * r['weight']
            totals['pe_count'] += r['weight']
        if pb and pb > 0:
            totals['pb_sum'] += pb * r['weight']
            totals['pb_count'] += r['weight']
        if dy and dy > 0:
            totals['dy_sum'] += dy * r['weight']
            totals['dy_count'] += r['weight']

        # Dual notation: toon lokale valuta voor non-EUR posities
        currency_symbols = {'EUR': '€', 'USD': '$', 'GBP': '£', 'DKK': 'kr', 'HKD': 'HK$'}
        curr = r.get('currency', 'EUR')
        curr_sym = currency_symbols.get(curr, curr)
        price_dual = f"€{r['price_eur']:,.2f}"
        if curr != 'EUR':
            price_dual += f"<br><span class='muted' style='font-size:0.7rem'>{curr_sym}{r['price_local']:,.2f}</span>"

        rows_html.append(f"""<tr>
            <td><strong>{r['name']}</strong><br><span class="muted">{r['ticker']}</span></td>
            <td class="muted">{r['sector']}</td>
            <td class="num">{r['shares']:,}</td>
            <td class="num">{price_dual}</td>
            <td class="num">€{r['value']:,.0f}</td>
            <td class="num">{r['weight']:.1f}%</td>
            <td class="num {pnl_cls}">€{r['pnl_nominal']:,.0f}</td>
            <td class="num {pnl_cls}">{r['pnl_pct']:,.1f}%</td>
            <td class="num">{f'{pe:.1f}' if pe else '—'}</td>
            <td class="num">{f'{pb:.1f}' if pb else '—'}</td>
            <td class="num">{f'{dy:.2f}%' if dy else '—'}</td>
            <td class="num">{format_market_cap(mc)}</td>
            <td class="num">{f'{beta:.2f}' if beta else '—'}</td>
            <td>{range_html}</td>
            <td>{sb_html}</td>
        </tr>""")

    # Footer with weighted averages
    avg_pe = (totals['pe_sum'] / totals['pe_count']) if totals['pe_count'] else 0
    avg_pb = (totals['pb_sum'] / totals['pb_count']) if totals['pb_count'] else 0
    avg_dy = (totals['dy_sum'] / totals['dy_count']) if totals['dy_count'] else 0

    footer_html = f"""<tr style="font-weight:600;border-top:2px solid #e5e7eb">
        <td>Portfolio Totaal</td>
        <td></td>
        <td></td>
        <td></td>
        <td class="num">€{totals['value']:,.0f}</td>
        <td class="num">{totals['weight']:.1f}%</td>
        <td></td><td></td>
        <td class="num">{avg_pe:.1f}</td>
        <td class="num">{avg_pb:.1f}</td>
        <td class="num">{avg_dy:.2f}%</td>
        <td></td><td></td><td></td><td></td>
    </tr>"""

    table_html = f"""<div style="overflow-x:auto">
    <table class="ms-table">
        <thead><tr>
            <th>Aandeel</th><th>Sector</th><th class="num">Aantal</th>
            <th class="num">Koers €</th><th class="num">Waarde €</th>
            <th class="num">Gewicht</th><th class="num">P&L €</th>
            <th class="num">P&L %</th><th class="num">P/E</th>
            <th class="num">P/B</th><th class="num">Div Yield</th>
            <th class="num">Mkt Cap</th><th class="num">Beta</th>
            <th>52W Range</th><th>Style</th>
        </tr></thead>
        <tbody>{"".join(rows_html)}{footer_html}</tbody>
    </table>
    </div>"""

    st.markdown(table_html, unsafe_allow_html=True)
