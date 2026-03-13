import streamlit as st
import pandas as pd
from datetime import date
from database import get_all_positions, get_all_transactions, add_transaction
from market_data import get_live_fx_rates, get_currency
from utils import format_euro, pnl_color, section_title_html


def render(supabase):
    tab_invoer, tab_historie = st.tabs(["Nieuwe Transactie", "Transactiehistorie"])

    positions = get_all_positions(supabase)
    fx_rates = get_live_fx_rates()

    with tab_invoer:
        st.markdown(section_title_html("Transactie Registreren"), unsafe_allow_html=True)

        if not positions:
            st.warning("Geen posities gevonden. Importeer eerst data via het import script.")
            return

        with st.form("transaction_form", clear_on_submit=True):
            col1, col2 = st.columns(2)

            with col1:
                pos_names = [f"{p['name']} ({p['ticker']})" for p in positions]
                selected_pos_idx = st.selectbox("Positie", range(len(pos_names)),
                                                format_func=lambda i: pos_names[i])
                tx_type = st.selectbox("Type", ["BUY", "SELL"])
                tx_date = st.date_input("Datum", value=date.today())
                shares = st.number_input("Aantal aandelen", min_value=1, value=1, step=1)

            with col2:
                selected_pos = positions[selected_pos_idx]
                currency = selected_pos.get('currency', 'EUR')
                st.info(f"Valuta: **{currency}**")

                price_local = st.number_input(f"Prijs ({currency})", min_value=0.01, value=100.0, step=0.01)

                # Auto-calculate EUR price
                if currency != 'EUR':
                    pair = f'EUR/{currency}'
                    rate = fx_rates.get(pair, 1.0)
                    price_eur_calc = price_local / rate if rate else price_local
                    st.caption(f"Wisselkoers {pair}: {rate:.4f}")
                    price_eur = st.number_input("Prijs (EUR)", value=round(price_eur_calc, 2), step=0.01)
                    fx_rate_val = rate
                else:
                    price_eur = price_local
                    fx_rate_val = 1.0

                fees = st.number_input("Transactiekosten (€)", min_value=0.0, value=0.0, step=0.01)

            notes = st.text_input("Notities", placeholder="Optioneel...")

            total_value = shares * price_eur
            total_with_fees = total_value + fees if tx_type == "BUY" else total_value - fees
            st.markdown(f"**Totaal:** {format_euro(total_with_fees)}")

            submitted = st.form_submit_button("Transactie Vastleggen", type="primary", use_container_width=True)

            if submitted:
                add_transaction(
                    supabase,
                    position_id=selected_pos['id'],
                    transaction_date=str(tx_date),
                    tx_type=tx_type,
                    shares=shares,
                    price_local=price_local,
                    price_eur=price_eur,
                    fx_rate=fx_rate_val,
                    fees=fees,
                    notes=notes if notes else None,
                )
                st.success(f"Transactie geregistreerd: {tx_type} {shares}x {selected_pos['name']} @ {format_euro(price_eur)}")
                st.cache_resource.clear()
                st.rerun()

    with tab_historie:
        st.markdown(section_title_html("Alle Transacties"), unsafe_allow_html=True)

        transactions = get_all_transactions(supabase)
        if not transactions:
            st.info("Nog geen transacties geregistreerd.")
            return

        rows = []
        for tx in transactions:
            pos = tx.get('eq_positions', {})
            rows.append({
                'Datum': tx.get('transaction_date', ''),
                'Type': tx.get('type', ''),
                'Aandeel': pos.get('name', ''),
                'Ticker': pos.get('ticker', ''),
                'Aantal': tx.get('shares', 0),
                'Prijs (€)': float(tx.get('price_eur', 0) or 0),
                'Totaal (€)': float(tx.get('shares', 0) or 0) * float(tx.get('price_eur', 0) or 0),
                'Kosten (€)': float(tx.get('fees', 0) or 0),
                'Notities': tx.get('notes', ''),
            })

        tx_df = pd.DataFrame(rows)
        tx_df = tx_df.sort_values('Datum', ascending=False)

        # Filter
        filter_col1, filter_col2 = st.columns(2)
        with filter_col1:
            type_filter = st.multiselect("Filter type", ['BUY', 'SELL'], default=['BUY', 'SELL'])
        with filter_col2:
            stock_filter = st.multiselect("Filter aandeel", sorted(tx_df['Aandeel'].unique().tolist()))

        if type_filter:
            tx_df = tx_df[tx_df['Type'].isin(type_filter)]
        if stock_filter:
            tx_df = tx_df[tx_df['Aandeel'].isin(stock_filter)]

        st.dataframe(
            tx_df.style.format({
                'Prijs (€)': '€{:,.2f}',
                'Totaal (€)': '€{:,.0f}',
                'Kosten (€)': '€{:,.2f}',
            }),
            use_container_width=True,
            height=min(600, len(tx_df) * 38 + 50),
            hide_index=True,
        )

        # Summary
        st.markdown("---")
        sum_cols = st.columns(3)
        with sum_cols[0]:
            st.metric("Totaal transacties", len(tx_df))
        with sum_cols[1]:
            buys = tx_df[tx_df['Type'] == 'BUY']['Totaal (€)'].sum()
            st.metric("Totaal gekocht", format_euro(buys))
        with sum_cols[2]:
            sells = tx_df[tx_df['Type'] == 'SELL']['Totaal (€)'].sum()
            st.metric("Totaal verkocht", format_euro(sells))
