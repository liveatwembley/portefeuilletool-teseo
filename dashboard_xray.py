import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from utils import (
    format_euro_compact, pnl_color,
    kpi_card_html, section_title_html, concentration_metrics,
    SECTOR_COLORS, CURRENCY_COLORS, H_BAR_COLORS,
    COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_BRAND, COLOR_ACCENT,
)


def render(df, meta):
    st.markdown(section_title_html("Portfolio X-Ray — Morningstar-stijl Analyse"), unsafe_allow_html=True)

    if df.empty:
        st.info("Geen data beschikbaar.")
        return

    # ─── CONCENTRATION METRICS ─────────────────────────────
    weights = df['weight'].tolist()
    conc = concentration_metrics(weights)

    # Determine concentration level
    hhi = conc['hhi']
    if hhi < 400:
        conc_label, conc_color = "Goed gespreid", "#15803d"
    elif hhi < 800:
        conc_label, conc_color = "Matig geconcentreerd", "#E8B34A"
    else:
        conc_label, conc_color = "Sterk geconcentreerd", "#dc2626"

    mc1, mc2, mc3, mc4 = st.columns(4)
    with mc1:
        st.markdown(kpi_card_html(
            "Top 5 Gewicht", f"{conc['top5_weight']:.1f}%",
            sublabel="van totale portefeuille",
        ), unsafe_allow_html=True)
    with mc2:
        st.markdown(kpi_card_html(
            "HHI Index", f"{hhi:.0f}",
            sublabel=f'<span style="color:{conc_color}">{conc_label}</span>',
        ), unsafe_allow_html=True)
    with mc3:
        st.markdown(kpi_card_html(
            "Posities", str(conc['n_positions']),
            sublabel="actieve aandelen",
        ), unsafe_allow_html=True)
    with mc4:
        # Largest single position
        largest = df.nlargest(1, 'weight').iloc[0]
        st.markdown(kpi_card_html(
            "Grootste Positie", f"{largest['weight']:.1f}%",
            sublabel=largest['name'],
        ), unsafe_allow_html=True)

    st.markdown("")

    # ─── SECTOR ANALYSIS (horizontal bar chart — professional) ──
    col_sector, col_geo = st.columns(2)

    with col_sector:
        st.markdown(section_title_html("Sectorverdeling"), unsafe_allow_html=True)
        sector_agg = df.groupby('sector').agg(
            value=('value', 'sum'),
            count=('name', 'count'),
            pnl=('pnl_nominal', 'sum'),
        ).sort_values('value', ascending=True).reset_index()
        total_val = sector_agg['value'].sum()
        sector_agg['pct'] = sector_agg['value'] / total_val * 100

        fig_sec = go.Figure()
        fig_sec.add_trace(go.Bar(
            y=sector_agg['sector'], x=sector_agg['pct'],
            orientation='h',
            marker=dict(color=SECTOR_COLORS[:len(sector_agg)]),
            text=[f"{p:.1f}% · {c} pos" for p, c in zip(sector_agg['pct'], sector_agg['count'])],
            textposition='outside', textfont=dict(size=10),
            hovertemplate=(
                "<b>%{y}</b><br>Gewicht: %{x:.1f}%<br>"
                "Waarde: €%{customdata[0]:,.0f}<br>"
                "P&L: €%{customdata[1]:,.0f}<br>"
                "Posities: %{customdata[2]}"
                "<extra></extra>"
            ),
            customdata=list(zip(sector_agg['value'], sector_agg['pnl'], sector_agg['count'])),
        ))
        fig_sec.update_layout(
            margin=dict(t=5, l=5, r=80, b=5), height=max(280, len(sector_agg) * 35),
            font=dict(family="Inter", size=11), plot_bgcolor='white',
            xaxis=dict(title="% van portefeuille", gridcolor='#f3f4f6', range=[0, max(sector_agg['pct']) * 1.4]),
            yaxis=dict(tickfont=dict(size=11)),
        )
        st.plotly_chart(fig_sec, use_container_width=True)

    with col_geo:
        st.markdown(section_title_html("Geografische Verdeling"), unsafe_allow_html=True)
        geo_agg = df.groupby('geo').agg(
            value=('value', 'sum'),
            count=('name', 'count'),
        ).sort_values('value', ascending=True).reset_index()
        total_val = geo_agg['value'].sum()
        geo_agg['pct'] = geo_agg['value'] / total_val * 100

        # Map country names to flag emojis
        flag_map = {
            'United States': '🇺🇸', 'Belgium': '🇧🇪', 'France': '🇫🇷',
            'Netherlands': '🇳🇱', 'United Kingdom': '🇬🇧', 'Hong Kong': '🇭🇰',
            'Denmark': '🇩🇰', 'Other': '🌍',
        }
        geo_agg['label'] = geo_agg['geo'].apply(lambda g: f"{flag_map.get(g, '🌍')} {g}")

        fig_geo = go.Figure()
        fig_geo.add_trace(go.Bar(
            y=geo_agg['label'], x=geo_agg['pct'],
            orientation='h',
            marker=dict(color=H_BAR_COLORS[:len(geo_agg)]),
            text=[f"{p:.1f}% · {c} pos" for p, c in zip(geo_agg['pct'], geo_agg['count'])],
            textposition='outside', textfont=dict(size=10),
            hovertemplate=(
                "<b>%{y}</b><br>Gewicht: %{x:.1f}%<br>"
                "Waarde: €%{customdata[0]:,.0f}<br>"
                "Posities: %{customdata[1]}"
                "<extra></extra>"
            ),
            customdata=list(zip(geo_agg['value'], geo_agg['count'])),
        ))
        fig_geo.update_layout(
            margin=dict(t=5, l=5, r=80, b=5), height=max(280, len(geo_agg) * 40),
            font=dict(family="Inter", size=11), plot_bgcolor='white',
            xaxis=dict(title="% van portefeuille", gridcolor='#f3f4f6', range=[0, max(geo_agg['pct']) * 1.4]),
            yaxis=dict(tickfont=dict(size=11)),
        )
        st.plotly_chart(fig_geo, use_container_width=True)

    # ─── CURRENCY EXPOSURE (donut + detail) ──────────────
    col_curr, col_advice = st.columns(2)

    with col_curr:
        st.markdown(section_title_html("Valutablootstelling"), unsafe_allow_html=True)
        curr_agg = df.groupby('currency').agg(
            value=('value', 'sum'),
            count=('name', 'count'),
        ).sort_values('value', ascending=False).reset_index()
        total_val = curr_agg['value'].sum()

        # Detailed currency table
        for _, cr in curr_agg.iterrows():
            pct = cr['value'] / total_val * 100
            bar_width = min(pct * 2.5, 100)
            color = CURRENCY_COLORS[_ % len(CURRENCY_COLORS)]
            st.markdown(f"""<div style="margin-bottom:0.5rem">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:2px">
                    <span><b>{cr['currency']}</b> · {cr['count']} posities</span>
                    <span style="font-weight:600">{pct:.1f}% — {format_euro_compact(cr['value'])}</span>
                </div>
                <div style="width:100%;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden">
                    <div style="width:{bar_width}%;height:100%;background:{color};border-radius:4px"></div>
                </div>
            </div>""", unsafe_allow_html=True)

    with col_advice:
        st.markdown(section_title_html("Adviesspreiding"), unsafe_allow_html=True)
        if 'advice' in df.columns:
            advice_agg = df.groupby('advice').agg(
                value=('value', 'sum'),
                count=('name', 'count'),
            ).reset_index()
            advice_agg = advice_agg[advice_agg['advice'] != '']

            if not advice_agg.empty:
                total_val = advice_agg['value'].sum()
                advice_colors = {
                    'houden': '#6b7280', 'koopman': '#15803d',
                    'kopen': '#E8B34A', 'verkopen': '#dc2626',
                }

                fig_adv = go.Figure(go.Pie(
                    labels=advice_agg['advice'].str.upper(), values=advice_agg['value'],
                    hole=0.55,
                    marker=dict(
                        colors=[advice_colors.get(a.lower(), '#6b7280') for a in advice_agg['advice']],
                        line=dict(color='#ffffff', width=2),
                    ),
                    textinfo='label+percent', textposition='inside',
                    textfont=dict(size=10),
                    hovertemplate="<b>%{label}</b><br>€%{value:,.0f}<br>%{percent}<br>%{customdata} posities<extra></extra>",
                    customdata=advice_agg['count'],
                ))
                fig_adv.update_layout(
                    margin=dict(t=10, l=10, r=10, b=10), height=280,
                    font=dict(family="Inter", size=11), showlegend=False,
                    annotations=[dict(
                        text=f"<b>{len(advice_agg)}</b><br><span style='font-size:10px;color:#6b7280'>adviezen</span>",
                        x=0.5, y=0.5, font_size=14, showarrow=False,
                    )],
                )
                st.plotly_chart(fig_adv, use_container_width=True)
            else:
                st.info("Geen adviezen ingesteld.")

    # ─── POSITION SIZE DISTRIBUTION (risk view) ──────────
    st.markdown(section_title_html("Positiegrootte Verdeling — Risico-overzicht"), unsafe_allow_html=True)

    if not df.empty:
        df_risk = df.sort_values('weight', ascending=False).copy()
        cumulative = df_risk['weight'].cumsum().tolist()

        fig_risk = make_subplots(specs=[[{"secondary_y": True}]])

        # Bar chart of weights
        fig_risk.add_trace(go.Bar(
            x=df_risk['name'], y=df_risk['weight'],
            name='Gewicht %',
            marker=dict(
                color=[pnl_color(p) for p in df_risk['pnl_nominal']],
                line=dict(width=0),
            ),
            text=[f"{w:.1f}%" for w in df_risk['weight']],
            textposition='outside', textfont=dict(size=9),
            hovertemplate="<b>%{x}</b><br>Gewicht: %{y:.1f}%<br><extra></extra>",
        ), secondary_y=False)

        # Cumulative line
        fig_risk.add_trace(go.Scatter(
            x=df_risk['name'].tolist(), y=cumulative,
            name='Cumulatief %',
            mode='lines+markers',
            line=dict(color=COLOR_ACCENT, width=2),
            marker=dict(size=4, color=COLOR_ACCENT),
            hovertemplate="Cumulatief: %{y:.1f}%<extra></extra>",
        ), secondary_y=True)

        # 50% and 80% reference lines on secondary y axis
        fig_risk.add_hline(y=50, line_dash="dot", line_color="#d1d5db", line_width=1,
                           annotation_text="50%", annotation_position="left",
                           annotation=dict(font=dict(size=9, color="#9ca3af")),
                           secondary_y=True)
        fig_risk.add_hline(y=80, line_dash="dot", line_color="#d1d5db", line_width=1,
                           annotation_text="80%", annotation_position="left",
                           annotation=dict(font=dict(size=9, color="#9ca3af")),
                           secondary_y=True)

        fig_risk.update_layout(
            margin=dict(t=10, l=10, r=50, b=10), height=380,
            font=dict(family="Inter", size=11), plot_bgcolor='white',
            xaxis=dict(tickangle=-45, tickfont=dict(size=9)),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            bargap=0.15,
        )
        fig_risk.update_yaxes(title_text="Gewicht %", gridcolor='#f3f4f6', secondary_y=False)
        fig_risk.update_yaxes(title_text="Cumulatief %", range=[0, 105], gridcolor='#f3f4f6',
                              showgrid=False, secondary_y=True)

        st.plotly_chart(fig_risk, use_container_width=True)
