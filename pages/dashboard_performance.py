import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from database import get_all_snapshots
from market_data import get_benchmark_history
from utils import (
    format_euro_compact,
    kpi_card_html, kpi_card_pnl_html, section_title_html,
    COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_BRAND, COLOR_ACCENT,
)


def render(supabase, df, meta):

    # ─── PORTFOLIO VALUE OVER TIME ─────────────────────────
    snapshots = get_all_snapshots(supabase)
    if snapshots and len(snapshots) > 1:
        snap_df = pd.DataFrame(snapshots)
        snap_df['snapshot_date'] = pd.to_datetime(snap_df['snapshot_date'])
        snap_df = snap_df.sort_values('snapshot_date')
        snap_df = snap_df[snap_df['total_value_eur'] > 0]

        if len(snap_df) > 1:
            # Performance KPIs
            first_val = snap_df['total_value_eur'].iloc[0]
            last_val = snap_df['total_value_eur'].iloc[-1]
            total_return = (last_val - first_val) / first_val * 100
            peak_val = snap_df['total_value_eur'].max()
            drawdown = (last_val - peak_val) / peak_val * 100 if peak_val > 0 else 0
            first_date = snap_df['snapshot_date'].iloc[0].strftime('%d-%m-%Y')

            perf_cols = st.columns(4)
            with perf_cols[0]:
                rs = "+" if total_return >= 0 else ""
                st.markdown(kpi_card_pnl_html(
                    "Totaal Rendement", f"{rs}{total_return:.1f}%",
                    sublabel=f"sinds {first_date}", amount=total_return,
                ), unsafe_allow_html=True)
            with perf_cols[1]:
                st.markdown(kpi_card_html(
                    "Piekwaarde", format_euro_compact(peak_val),
                ), unsafe_allow_html=True)
            with perf_cols[2]:
                st.markdown(kpi_card_pnl_html(
                    "Drawdown van Piek", f"{drawdown:.1f}%",
                    amount=drawdown,
                ), unsafe_allow_html=True)
            with perf_cols[3]:
                n_snapshots = len(snap_df)
                st.markdown(kpi_card_html(
                    "Datapunten", str(n_snapshots),
                    sublabel="snapshots",
                ), unsafe_allow_html=True)

            st.markdown("")

            # ─── MAIN PORTFOLIO CHART (area + markers) ────────
            st.markdown(section_title_html("Portefeuillewaarde over Tijd"), unsafe_allow_html=True)

            fig_line = go.Figure()

            # Fill between first value and current (green if up, red if down)
            fill_color = 'rgba(21,128,61,0.06)' if total_return >= 0 else 'rgba(220,38,38,0.06)'
            line_color = COLOR_POSITIVE if total_return >= 0 else COLOR_NEGATIVE

            fig_line.add_trace(go.Scatter(
                x=snap_df['snapshot_date'], y=snap_df['total_value_eur'],
                mode='lines+markers',
                line=dict(color=COLOR_BRAND, width=2.5),
                marker=dict(size=5, color=COLOR_BRAND, line=dict(width=1, color='white')),
                fill='tozeroy', fillcolor=fill_color,
                hovertemplate="<b>%{x|%d-%m-%Y}</b><br>Waarde: €%{y:,.0f}<extra></extra>",
                name='Portefeuille',
            ))

            # Peak line
            fig_line.add_hline(y=peak_val, line_dash="dot", line_color=COLOR_ACCENT, line_width=1,
                               annotation_text=f"Piek: {format_euro_compact(peak_val)}",
                               annotation_position="top left",
                               annotation=dict(font=dict(size=10, color=COLOR_ACCENT)))

            fig_line.update_layout(
                margin=dict(t=20, l=10, r=10, b=10), height=400,
                font=dict(family="Inter", size=11), plot_bgcolor='white',
                xaxis=dict(gridcolor='#f3f4f6', dtick='M3', tickformat='%b %Y'),
                yaxis=dict(gridcolor='#f3f4f6', tickformat='€,.0f'),
                showlegend=False,
            )
            st.plotly_chart(fig_line, use_container_width=True)

            # ─── MONTHLY/PERIODIC CHANGES (bar chart) ─────────
            if len(snap_df) > 2:
                st.markdown(section_title_html("Verandering per Snapshot"), unsafe_allow_html=True)

                snap_df_changes = snap_df.copy()
                snap_df_changes['change'] = snap_df_changes['total_value_eur'].diff()
                snap_df_changes['change_pct'] = snap_df_changes['total_value_eur'].pct_change() * 100
                snap_df_changes = snap_df_changes.dropna(subset=['change'])

                fig_changes = go.Figure()
                fig_changes.add_trace(go.Bar(
                    x=snap_df_changes['snapshot_date'],
                    y=snap_df_changes['change'],
                    marker=dict(
                        color=[COLOR_POSITIVE if c >= 0 else COLOR_NEGATIVE for c in snap_df_changes['change']],
                    ),
                    text=[f"{p:+.1f}%" for p in snap_df_changes['change_pct']],
                    textposition='outside', textfont=dict(size=9),
                    hovertemplate="<b>%{x|%d-%m-%Y}</b><br>Δ: €%{y:,.0f}<br><extra></extra>",
                ))
                fig_changes.update_layout(
                    margin=dict(t=10, l=10, r=10, b=10), height=250,
                    font=dict(family="Inter", size=11), plot_bgcolor='white',
                    xaxis=dict(gridcolor='#f3f4f6'),
                    yaxis=dict(gridcolor='#f3f4f6', zerolinecolor='#e5e7eb', tickformat='€,.0f'),
                    showlegend=False,
                )
                st.plotly_chart(fig_changes, use_container_width=True)

    # ─── BENCHMARK COMPARISON ──────────────────────────────
    st.markdown(section_title_html("Benchmark Vergelijking"), unsafe_allow_html=True)
    st.caption("Performance van S&P 500 en MSCI World ETF (geïndexeerd op 100, 1 jaar)")

    try:
        benchmarks = get_benchmark_history('1y')
        if benchmarks:
            fig_bench = go.Figure()
            bench_colors = {'S&P 500': '#6b7280', 'MSCI World': '#9ca3af'}
            bench_dashes = {'S&P 500': 'solid', 'MSCI World': 'dot'}

            for bname, hist in benchmarks.items():
                if not hist.empty:
                    normalized = hist['Close'] / hist['Close'].iloc[0] * 100
                    fig_bench.add_trace(go.Scatter(
                        x=hist.index, y=normalized,
                        mode='lines', name=bname,
                        line=dict(color=bench_colors.get(bname, '#9ca3af'), width=2,
                                  dash=bench_dashes.get(bname, 'solid')),
                        hovertemplate=f"<b>{bname}</b><br>%{{x|%d-%m-%Y}}<br>%{{y:.1f}}<extra></extra>",
                    ))

            fig_bench.add_hline(y=100, line_dash="dash", line_color="#e5e7eb", line_width=1)
            fig_bench.update_layout(
                margin=dict(t=10, l=10, r=10, b=10), height=320,
                font=dict(family="Inter", size=11), plot_bgcolor='white',
                xaxis=dict(gridcolor='#f3f4f6'),
                yaxis=dict(gridcolor='#f3f4f6', title='Index (100)'),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            )
            st.plotly_chart(fig_bench, use_container_width=True)
        else:
            st.info("Benchmark data niet beschikbaar.")
    except Exception as e:
        st.info(f"Benchmark data kan niet worden opgehaald: {str(e)}")
