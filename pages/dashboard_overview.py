import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
from utils import (
    format_euro, format_euro_compact, format_pct, pnl_color,
    kpi_card_html, kpi_card_pnl_html, section_title_html, insight_pill_html,
    SECTOR_COLORS, CURRENCY_COLORS, COLOR_POSITIVE, COLOR_NEGATIVE,
    COLOR_BRAND, COLOR_ACCENT,
)


def render(supabase, df, meta):
    fx_rates = meta['fx_rates']

    # Compute total P&L
    total_pnl = df['pnl_nominal'].sum() if not df.empty else 0
    total_invested = (df['avg_cost'] * df['shares']).sum() if not df.empty else 0
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0
    best_stock = df.loc[df['pnl_pct'].idxmax()] if not df.empty else None
    worst_stock = df.loc[df['pnl_pct'].idxmin()] if not df.empty else None

    # ─── HERO KPI BAR (prominent, large) ─────────────────
    hero_cols = st.columns([2, 1, 1, 1, 1])
    with hero_cols[0]:
        st.markdown(kpi_card_html(
            "Portefeuillewaarde", format_euro(meta['portfolio_total']),
            sublabel=f"Snapshot {meta['snapshot_date']}", hero=True,
        ), unsafe_allow_html=True)
    with hero_cols[1]:
        ps = "+" if total_pnl >= 0 else ""
        st.markdown(kpi_card_pnl_html(
            "Totale P&L", f"{ps}{format_euro_compact(total_pnl)}",
            delta=f"{ps}{total_pnl_pct:.1f}%", amount=total_pnl,
        ), unsafe_allow_html=True)
    with hero_cols[2]:
        ds = "+" if meta['day_delta'] >= 0 else ""
        st.markdown(kpi_card_pnl_html(
            "Dagverandering", f"{ds}{format_euro_compact(meta['day_delta'])}",
            delta=f"{ds}{meta['day_delta_pct']:.2f}%", amount=meta['day_delta'],
        ), unsafe_allow_html=True)
    with hero_cols[3]:
        st.markdown(kpi_card_html(
            "Cash", format_euro_compact(meta['cash']),
            delta=f"{format_pct(meta['cash_pct'], 1)} van portefeuille",
        ), unsafe_allow_html=True)
    with hero_cols[4]:
        st.markdown(kpi_card_html(
            "Posities", str(len(df)),
            sublabel="actieve aandelen",
        ), unsafe_allow_html=True)

    # ─── QUICK INSIGHT ROW ────────────────────────────────
    if best_stock is not None and worst_stock is not None:
        ins_cols = st.columns(4)
        with ins_cols[0]:
            fx_usd = fx_rates.get('EUR/USD', 0)
            fx_gbp = fx_rates.get('EUR/GBP', 0)
            fx_dkk = fx_rates.get('EUR/DKK', 0)
            st.markdown(insight_pill_html(
                "FX",
                f'<span class="insight-val">EUR/USD {fx_usd:.4f}</span>'
                f'<span class="insight-val">EUR/GBP {fx_gbp:.4f}</span>'
                f'<span class="insight-val">EUR/DKK {fx_dkk:.2f}</span>',
            ), unsafe_allow_html=True)
        with ins_cols[1]:
            n_pos = len(df[df['pnl_nominal'] > 0])
            n_neg = len(df[df['pnl_nominal'] < 0])
            st.markdown(insight_pill_html(
                "Score",
                f'<span style="color:{COLOR_POSITIVE};font-weight:600">{n_pos} ▲</span>'
                f'<span style="color:{COLOR_NEGATIVE};font-weight:600">{n_neg} ▼</span>',
            ), unsafe_allow_html=True)
        with ins_cols[2]:
            st.markdown(insight_pill_html(
                "Beste",
                f'<span style="color:{COLOR_POSITIVE};font-weight:500">'
                f'{best_stock["name"]} +{best_stock["pnl_pct"]:.0f}%</span>',
            ), unsafe_allow_html=True)
        with ins_cols[3]:
            st.markdown(insight_pill_html(
                "Slechtste",
                f'<span style="color:{COLOR_NEGATIVE};font-weight:500">'
                f'{worst_stock["name"]} {worst_stock["pnl_pct"]:.0f}%</span>',
            ), unsafe_allow_html=True)

    st.markdown("")

    # ─── TREEMAP (larger, more visual impact) ─────────────
    st.markdown(section_title_html("Portefeuille Overzicht — Gewicht & Performance"), unsafe_allow_html=True)

    if not df.empty:
        df_tree = df[df['value'] > 0].copy()
        df_tree['pnl_pct_capped'] = df_tree['pnl_pct'].clip(-50, 100)

        fig_tree = px.treemap(
            df_tree, path=['sector', 'name'], values='value',
            color='pnl_pct_capped',
            color_continuous_scale=[
                [0, '#dc2626'], [0.15, '#fca5a5'], [0.33, '#fde8e8'],
                [0.5, '#f9fafb'],
                [0.67, '#dcfce7'], [0.85, '#86efac'], [1, '#15803d']
            ],
            color_continuous_midpoint=0,
        )
        fig_tree.update_layout(
            margin=dict(t=5, l=5, r=5, b=5), height=520,
            coloraxis_colorbar=dict(
                title=dict(text="P&L %", font=dict(size=11)),
                ticksuffix="%", len=0.6, thickness=12,
                tickfont=dict(size=10),
            ),
            font=dict(family="Inter", size=12),
        )

        # Build portfolio-weight text per cell: positions get "X.X%", sectors get sector totals
        portfolio_total = meta['portfolio_total']
        labels = fig_tree.data[0].labels
        values = fig_tree.data[0].values
        parents = fig_tree.data[0].parents
        weight_texts = []
        for lbl, val, par in zip(labels, values, parents):
            if par == '':
                # Sector-level: show sector weight
                pct = val / portfolio_total * 100 if portfolio_total else 0
                weight_texts.append(f"{pct:.1f}%")
            else:
                # Position-level: show position weight
                pct = val / portfolio_total * 100 if portfolio_total else 0
                weight_texts.append(f"{pct:.1f}%")

        fig_tree.data[0].customdata = np.array(weight_texts).reshape(-1, 1)
        fig_tree.update_traces(
            textinfo="label+text",
            texttemplate="<b>%{label}</b><br>%{customdata[0]}",
            hovertemplate=(
                "<b>%{label}</b><br>"
                "Waarde: €%{value:,.0f}<br>"
                "Gewicht: %{customdata[0]}<br>"
                "P&L: %{color:+.1f}%"
                "<extra></extra>"
            ),
            marker=dict(cornerradius=3),
        )
        st.plotly_chart(fig_tree, use_container_width=True)

    # ─── SECTOR + CURRENCY DONUTS (with center annotation) ──
    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:
        st.markdown(section_title_html("Sectorverdeling"), unsafe_allow_html=True)
        if not df.empty:
            sector_df = df.groupby('sector').agg(
                value=('value', 'sum'),
                count=('name', 'count'),
            ).reset_index().sort_values('value', ascending=False)
            n_sectors = len(sector_df)

            fig_sector = go.Figure(go.Pie(
                labels=sector_df['sector'], values=sector_df['value'],
                hole=0.55,
                marker=dict(colors=SECTOR_COLORS[:n_sectors], line=dict(color='#ffffff', width=2)),
                textinfo='percent', textposition='inside',
                textfont=dict(size=11),
                hovertemplate="<b>%{label}</b><br>€%{value:,.0f}<br>%{percent}<br>%{customdata} posities<extra></extra>",
                customdata=sector_df['count'],
                sort=False,
            ))
            fig_sector.update_layout(
                margin=dict(t=10, l=10, r=10, b=10), height=340,
                font=dict(family="Inter", size=11), showlegend=True,
                legend=dict(orientation="v", yanchor="middle", y=0.5, font=dict(size=10), itemsizing='constant'),
                annotations=[dict(
                    text=f"<b>{n_sectors}</b><br><span style='font-size:10px;color:#6b7280'>sectoren</span>",
                    x=0.5, y=0.5, font_size=16, showarrow=False,
                )],
            )
            st.plotly_chart(fig_sector, use_container_width=True)

    with chart_col2:
        st.markdown(section_title_html("Valutaverdeling"), unsafe_allow_html=True)
        if not df.empty:
            curr_df = df.groupby('currency').agg(
                value=('value', 'sum'),
                count=('name', 'count'),
            ).reset_index().sort_values('value', ascending=False)
            n_curr = len(curr_df)

            # Compute USD exposure
            usd_pct = 0
            for _, cr in curr_df.iterrows():
                if cr['currency'] == 'USD':
                    usd_pct = cr['value'] / curr_df['value'].sum() * 100

            fig_curr = go.Figure(go.Pie(
                labels=curr_df['currency'], values=curr_df['value'],
                hole=0.55,
                marker=dict(colors=CURRENCY_COLORS[:n_curr], line=dict(color='#ffffff', width=2)),
                textinfo='percent+label', textposition='inside',
                textfont=dict(size=11),
                hovertemplate="<b>%{label}</b><br>€%{value:,.0f}<br>%{percent}<br>%{customdata} posities<extra></extra>",
                customdata=curr_df['count'],
                sort=False,
            ))
            fig_curr.update_layout(
                margin=dict(t=10, l=10, r=10, b=10), height=340,
                font=dict(family="Inter", size=11), showlegend=True,
                legend=dict(orientation="v", yanchor="middle", y=0.5, font=dict(size=10)),
                annotations=[dict(
                    text=f"<b>{n_curr}</b><br><span style='font-size:10px;color:#6b7280'>valuta's</span>",
                    x=0.5, y=0.5, font_size=16, showarrow=False,
                )],
            )
            st.plotly_chart(fig_curr, use_container_width=True)

    # ─── P&L WATERFALL (where is money made/lost) ────────
    st.markdown(section_title_html("P&L per Positie — Waterval"), unsafe_allow_html=True)

    if not df.empty:
        df_pnl = df[['name', 'pnl_nominal']].copy().sort_values('pnl_nominal', ascending=False)
        # Top 8 winners + Top 7 losers + Rest bucket
        top_winners = df_pnl.head(8)
        top_losers = df_pnl.tail(7)
        middle = df_pnl.iloc[8:-7] if len(df_pnl) > 15 else pd.DataFrame()

        waterfall_names = list(top_winners['name'])
        waterfall_vals = list(top_winners['pnl_nominal'])

        if not middle.empty:
            waterfall_names.append(f"Overige ({len(middle)})")
            waterfall_vals.append(middle['pnl_nominal'].sum())

        waterfall_names += list(top_losers['name'])
        waterfall_vals += list(top_losers['pnl_nominal'])

        waterfall_names.append("TOTAAL P&L")
        waterfall_vals.append(0)  # placeholder for total

        measures = ['relative'] * (len(waterfall_names) - 1) + ['total']

        fig_waterfall = go.Figure(go.Waterfall(
            name="P&L", orientation="v",
            measure=measures,
            x=waterfall_names,
            y=waterfall_vals[:-1] + [total_pnl],
            textposition="outside",
            text=[format_euro_compact(v) for v in waterfall_vals[:-1]] + [format_euro_compact(total_pnl)],
            connector=dict(line=dict(color="#e5e7eb", width=1)),
            increasing=dict(marker=dict(color="#86efac", line=dict(color=COLOR_POSITIVE, width=1))),
            decreasing=dict(marker=dict(color="#fca5a5", line=dict(color=COLOR_NEGATIVE, width=1))),
            totals=dict(marker=dict(color=COLOR_BRAND, line=dict(color=COLOR_BRAND, width=1))),
            hovertemplate="<b>%{x}</b><br>P&L: €%{y:,.0f}<extra></extra>",
        ))
        fig_waterfall.update_layout(
            margin=dict(t=20, l=10, r=10, b=10), height=380,
            font=dict(family="Inter", size=11), plot_bgcolor='white',
            xaxis=dict(tickangle=-45, tickfont=dict(size=10)),
            yaxis=dict(gridcolor='#f3f4f6', zerolinecolor='#e5e7eb'),
            showlegend=False,
        )
        st.plotly_chart(fig_waterfall, use_container_width=True)

    # ─── TOP 10 POSITIONS BAR (horizontal, with value labels) ──
    st.markdown(section_title_html("Top 10 Posities — Gewicht"), unsafe_allow_html=True)

    if not df.empty:
        top10 = df.nlargest(10, 'weight').copy()
        top10 = top10.sort_values('weight', ascending=True)  # ascending for horizontal bar

        fig_top = go.Figure()
        fig_top.add_trace(go.Bar(
            x=top10['weight'], y=top10['name'],
            orientation='h',
            marker=dict(
                color=[COLOR_BRAND if i < 7 else COLOR_ACCENT for i in range(len(top10))],
                line=dict(width=0),
            ),
            text=[f"  {w:.1f}% — {format_euro_compact(v)}" for w, v in zip(top10['weight'], top10['value'])],
            textposition='outside', textfont=dict(size=11),
            hovertemplate="<b>%{y}</b><br>Gewicht: %{x:.1f}%<br>P&L: %{customdata}<extra></extra>",
            customdata=[f"{p:+.1f}%" for p in top10['pnl_pct']],
        ))

        # Add rest of portfolio
        top10_weight = top10['weight'].sum()
        rest_weight = 100 - top10_weight - meta['cash_pct']

        fig_top.update_layout(
            margin=dict(t=10, l=10, r=120, b=10), height=max(320, len(top10) * 32),
            font=dict(family="Inter", size=11), plot_bgcolor='white',
            xaxis=dict(title="Gewicht %", gridcolor='#f3f4f6', range=[0, max(top10['weight']) * 1.35]),
            yaxis=dict(tickfont=dict(size=11)),
        )
        st.plotly_chart(fig_top, use_container_width=True)

        # Summary below
        st.markdown(
            f"<div style='text-align:center;font-size:0.8rem;color:#6b7280;margin-top:-0.5rem'>"
            f"Top 10 = <b>{top10_weight:.1f}%</b> · "
            f"Overige ({len(df) - 10}) = <b>{rest_weight:.1f}%</b> · "
            f"Cash = <b>{meta['cash_pct']:.1f}%</b></div>",
            unsafe_allow_html=True,
        )

    # ─── POSITIONS TABLE (enhanced) ───────────────────────
    st.markdown(section_title_html("Alle Posities"), unsafe_allow_html=True)

    if not df.empty:
        # Dual notation kolom: EUR koers + lokale valuta voor non-EUR
        currency_symbols = {'EUR': '€', 'USD': '$', 'GBP': '£', 'DKK': 'kr', 'HKD': 'HK$'}

        display_df = df[['name', 'ticker', 'sector', 'currency', 'shares',
                         'price_eur', 'price_local', 'value',
                         'pnl_nominal', 'pnl_pct', 'day_change_pct', 'weight', 'advice']].copy()

        # Bouw dual koers string: "€123.45 ($134.56)" voor non-EUR
        def _dual_price(row):
            eur_str = f"€{row['price_eur']:,.2f}"
            if row['currency'] != 'EUR':
                sym = currency_symbols.get(row['currency'], row['currency'])
                return f"{eur_str} ({sym}{row['price_local']:,.2f})"
            return eur_str

        display_df['Koers'] = display_df.apply(_dual_price, axis=1)
        display_df = display_df.drop(columns=['currency', 'price_eur', 'price_local'])
        display_df.columns = ['Aandeel', 'Ticker', 'Sector', 'Aantal', 'Waarde €',
                              'P&L €', 'P&L %', 'Dag %', 'Gewicht %', 'Advies', 'Koers']

        # Herrangschik kolommen
        display_df = display_df[['Aandeel', 'Ticker', 'Sector', 'Aantal', 'Koers', 'Waarde €',
                                  'P&L €', 'P&L %', 'Dag %', 'Gewicht %', 'Advies']]
        display_df = display_df.sort_values('Waarde €', ascending=False)

        st.dataframe(
            display_df.style
                .format({
                    'Waarde €': '€{:,.0f}',
                    'P&L €': '€{:,.0f}', 'P&L %': '{:,.1f}%',
                    'Dag %': '{:+,.2f}%', 'Gewicht %': '{:.1f}%',
                })
                .map(lambda v: f'color: {pnl_color(v)}' if isinstance(v, (int, float)) else '',
                     subset=['P&L €', 'P&L %', 'Dag %']),
            use_container_width=True,
            height=min(800, len(display_df) * 36 + 50),
            hide_index=True,
        )
