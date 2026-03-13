import streamlit as st
import os
from datetime import date


from utils import section_title_html


def render(supabase):
    st.markdown(section_title_html("Data Bronnen & Synchronisatie"), unsafe_allow_html=True)

    # ─── DATA BRONNEN OVERZICHT ─────────────────────────────
    st.markdown("""
| Periode | Databron | Status |
|---------|----------|--------|
| 2019 – eind 2025 | Google Sheets (historisch) | ✅ Geïmporteerd |
| 1 jan 2026 – heden | Google Sheets (nieuwe nota's) | ⬇️ Importeer hieronder |
| 1 jan 2026 – heden | Live Refresh (Yahoo Finance koersen) | ✅ Actief |
| 1 jan 2026 – heden | IBKR Flex Query API (optioneel) | ⬇️ Configureer hieronder |
| 1 jan 2026 – heden | IBKR XML Import (alternatief) | ⬇️ Upload hieronder |
| Live koersen | Yahoo Finance | ✅ Actief |
| Wisselkoersen | ECB / Google Finance | ✅ Actief |
""")

    st.markdown("---")

    # ─── TABS VOOR VERSCHILLENDE SYNC METHODES ──────────────
    tab_sheets, tab_live, tab_flex, tab_xml, tab_email = st.tabs([
        "📊 Google Sheets",
        "🔄 Live Refresh",
        "🔌 IBKR Flex API",
        "📄 XML Upload",
        "📧 IBKR Login Tips",
    ])

    # ═══════════════════════════════════════════════════════════
    # TAB 0: GOOGLE SHEETS IMPORT
    # ═══════════════════════════════════════════════════════════
    with tab_sheets:
        st.markdown("### Google Sheets Import")
        st.markdown("""
Importeer het **nieuwste portefeuilledocument** vanuit Google Sheets.
De tool zoekt automatisch in alle geconfigureerde spreadsheets naar het
recentste tabblad met een geldige datum.

> **Service account:** `robot-lezer@stock-compare-301906.iam.gserviceaccount.com`
> Deel nieuwe spreadsheets met dit account (Viewer-toegang volstaat).
""")

        col_scan, col_import = st.columns(2)

        with col_scan:
            if st.button("🔍 Scan Spreadsheets", type="secondary", use_container_width=True):
                with st.spinner("Spreadsheets scannen..."):
                    try:
                        from import_sheets import list_available_tabs
                        tabs = list_available_tabs()
                        if tabs:
                            st.session_state['sheets_tabs'] = tabs
                            st.success(f"**{len(tabs)} datum-tabs** gevonden")
                        else:
                            st.warning("Geen datum-tabs gevonden. Is het document gedeeld met het service account?")
                    except Exception as e:
                        st.error(f"Scan mislukt: {str(e)}")

        # Toon gevonden tabs
        if 'sheets_tabs' in st.session_state and st.session_state['sheets_tabs']:
            tabs_found = st.session_state['sheets_tabs']
            st.markdown("**Beschikbare tabs (nieuwste eerst):**")
            for i, t in enumerate(tabs_found[:10]):
                marker = "🟢" if i == 0 else "⚪"
                st.markdown(f"  {marker} **{t['date']}** — {t['tab_name']} ({t['spreadsheet']})")

            with col_import:
                if st.button("📥 Importeer Nieuwste", type="primary", use_container_width=True):
                    with st.spinner("Nieuwste tab importeren..."):
                        try:
                            from import_sheets import import_latest_tab
                            result = import_latest_tab(supabase)
                            if result['status'] == 'success':
                                st.success(
                                    f"**Import succesvol!**\n\n"
                                    f"- 📅 Snapshot: **{result['snapshot_date']}**\n"
                                    f"- 📄 Tab: **{result['tab_name']}** ({result.get('spreadsheet', '')})\n"
                                    f"- 📊 Posities: **{result['holdings_count']}**\n"
                                    f"- 💰 Totale waarde: **€{result['total_value']:,.0f}**\n"
                                    f"- 💵 Cash: **€{result['cash_eur']:,.0f}**"
                                )
                                if result.get('warnings'):
                                    for w in result['warnings']:
                                        st.warning(f"⚠️ {w}")
                            else:
                                st.error(result.get('message', 'Import mislukt'))
                        except Exception as e:
                            st.error(f"Import fout: {str(e)}")

        st.markdown("---")
        st.markdown("""
**Hoe werkt het?**
1. De tool scant alle geconfigureerde Google Spreadsheets
2. Zoekt tabs met een datum-formaat als naam (bv. `14-02-2026`)
3. Importeert posities, cash, FX-koersen en advies uit het tabblad
4. Na import draai je een **Live Refresh** om de koersen te actualiseren
""")

    # ═══════════════════════════════════════════════════════════
    # TAB 1: LIVE REFRESH
    # ═══════════════════════════════════════════════════════════
    with tab_live:
        st.markdown("### Live Refresh")
        st.markdown("""
Herberekent je portefeuillewaarde met **actuele Yahoo Finance koersen**.
De aantallen (posities) komen uit het laatste bekende snapshot.
Ideaal voor dagelijkse updates zonder IBKR API.

> **Let op:** Als je posities veranderd zijn (aankoop/verkoop), moet je
> eerst een IBKR XML uploaden of de Flex API syncen om de aantallen te updaten.
""")

        col1, col2 = st.columns([1, 2])
        with col1:
            if st.button("🔄 Refresh Nu", type="primary", use_container_width=True):
                with st.spinner("Live koersen ophalen en herberekenen..."):
                    try:
                        from live_refresh import refresh_live_snapshot
                        result = refresh_live_snapshot(supabase)
                        if result['status'] == 'success':
                            st.success(
                                f"**Live refresh succesvol!**\n\n"
                                f"- 📅 Snapshot: **{result['snapshot_date']}**\n"
                                f"- 💰 Totale waarde: **€{result['total_value']:,.0f}**\n"
                                f"- 💵 Cash: **€{result['cash_eur']:,.0f}**\n"
                                f"- 📊 Posities: **{result['positions']}** "
                                f"({result['prices_live']} live, {result['prices_stale']} fallback)\n"
                                f"- 🔗 Basis: snapshot {result['basis_snapshot']}"
                            )
                        elif result['status'] == 'skipped':
                            st.info(result['message'])
                        else:
                            st.error(result.get('message', 'Onbekende fout'))
                    except Exception as e:
                        st.error(f"Refresh mislukt: {str(e)}")

    # ═══════════════════════════════════════════════════════════
    # TAB 2: IBKR FLEX API
    # ═══════════════════════════════════════════════════════════
    with tab_flex:
        st.markdown("### IBKR Flex Query API")

        token = os.environ.get('IBKR_FLEX_TOKEN', '')
        query_id = os.environ.get('IBKR_FLEX_QUERY_ID', '')
        has_config = bool(token and query_id)

        if has_config:
            st.success(f"IBKR geconfigureerd (Token: ...{token[-6:]}, Query ID: {query_id})")
        else:
            st.warning("IBKR Flex Query nog niet geconfigureerd — volg de stappen hieronder")

        with st.expander("Setup Instructies (eenmalig, ~2 minuten)", expanded=not has_config):
            st.markdown("""
**Stap 1: Log in op IBKR Client Portal**
- Ga naar [interactivebrokers.com/portal](https://www.interactivebrokers.com/portal)
- Log in met je IBKR account

**Stap 2: Maak een Flex Query aan**
- Ga naar **Performance & Reports** > **Flex Queries**
- Klik op **+** naast "Activity Flex Queries" om een nieuwe te maken
- Geef het een naam (bv. "Teseo Portfolio")
- Selecteer deze secties:
  - **Open Positions** (alle velden)
  - **Trades** (alle velden)
  - **Cash Report** (alle velden)
  - **NAV Summary** (alle velden)
- Periode: **Last Business Day**
- Formaat: **XML**
- Sla op en noteer het **Query ID** (staat naast de naam)

**Stap 3: Genereer een API Token**
- Scroll naar beneden op de Flex Queries pagina
- Klik op **Flex Web Service** (of "Configure")
- Klik **Generate A New Token**
- Kies **1 year** als vervaldatum
- Kopieer het token (je ziet het maar 1x!)

**Stap 4: Vul hieronder in**
""")

        with st.form("ibkr_config_form"):
            new_token = st.text_input(
                "IBKR Flex Token",
                value=token,
                type="password",
                help="Het token dat je hebt gegenereerd in stap 3"
            )
            new_query_id = st.text_input(
                "IBKR Flex Query ID",
                value=query_id,
                help="Het Query ID van je Activity Flex Query (stap 2)"
            )

            if st.form_submit_button("Opslaan", type="primary"):
                if new_token and new_query_id:
                    _update_env('IBKR_FLEX_TOKEN', new_token)
                    _update_env('IBKR_FLEX_QUERY_ID', new_query_id)
                    os.environ['IBKR_FLEX_TOKEN'] = new_token
                    os.environ['IBKR_FLEX_QUERY_ID'] = new_query_id
                    st.success("IBKR configuratie opgeslagen!")
                    st.rerun()
                else:
                    st.error("Vul beide velden in")

        if has_config:
            st.markdown("---")
            col1, col2 = st.columns(2)

            with col1:
                if st.button("Test Verbinding", type="secondary", use_container_width=True):
                    with st.spinner("Verbinding testen..."):
                        from ibkr_flex import check_ibkr_connection
                        result = check_ibkr_connection()
                        if result['connected']:
                            st.success(result['reason'])
                        else:
                            st.error(result['reason'])

            with col2:
                if st.button("Sync Nu (Flex API)", type="primary", use_container_width=True):
                    with st.spinner("IBKR data ophalen... (30-60 sec)"):
                        try:
                            from ibkr_flex import sync_ibkr_to_supabase
                            result = sync_ibkr_to_supabase(supabase)
                            if result['status'] == 'success':
                                st.success(
                                    f"**Sync succesvol!**\n\n"
                                    f"- **{result['positions_synced']}** posities\n"
                                    f"- **{result['trades_synced']}** transacties\n"
                                    f"- Waarde: **€{result['total_value']:,.0f}**\n"
                                    f"- Cash: **€{result['cash_eur']:,.0f}**"
                                )
                            else:
                                st.error(result.get('message', 'Onbekende fout'))
                        except Exception as e:
                            st.error(f"Sync mislukt: {str(e)}")

    # ═══════════════════════════════════════════════════════════
    # TAB 3: XML UPLOAD
    # ═══════════════════════════════════════════════════════════
    with tab_xml:
        st.markdown("### IBKR Activity Statement XML Import")
        st.markdown("""
**Alternatief als de Flex API niet werkt.** Exporteer een Activity Statement als XML
vanuit het IBKR Client Portal of TWS, en upload het hier.

**Hoe te exporteren:**
- **Client Portal:** Performance & Reports → Statements → Activity → Kies periode → Format: XML → Download
- **TWS:** Account → Reports/Tax Reports → Activity Statement → Kies periode → XML
""")

        uploaded_file = st.file_uploader(
            "Upload Activity Statement XML",
            type=['xml'],
            help="Upload een IBKR Activity Statement in XML formaat"
        )

        if uploaded_file is not None:
            snap_date = st.date_input(
                "Snapshot datum",
                value=date.today(),
                help="Datum voor dit snapshot (default: vandaag)"
            )

            if st.button("Importeer XML", type="primary"):
                with st.spinner("XML importeren..."):
                    try:
                        from ibkr_xml_import import import_xml_to_supabase
                        xml_content = uploaded_file.read()
                        result = import_xml_to_supabase(
                            supabase, xml_content,
                            snapshot_date=snap_date.isoformat()
                        )
                        if result['status'] == 'success':
                            st.success(
                                f"**XML import succesvol!**\n\n"
                                f"- **{result['positions_synced']}** posities\n"
                                f"- Waarde: **€{result['total_value']:,.0f}**\n"
                                f"- Cash: **€{result['cash_eur']:,.0f}**\n"
                                f"- Datum: {result['snapshot_date']}"
                            )
                        else:
                            st.error(result.get('message', 'Import mislukt'))
                    except Exception as e:
                        st.error(f"Import fout: {str(e)}")

    # ═══════════════════════════════════════════════════════════
    # TAB 4: IBKR LOGIN TIPS
    # ═══════════════════════════════════════════════════════════
    with tab_email:
        st.markdown("### IBKR Login Problemen Oplossen")

        st.markdown("""
#### Verificatie email komt niet aan?

**Controleer eerst:**
1. 📧 **Spam/Junk folder** — IBKR mails komen soms in spam terecht
2. ⏰ **Wacht 5-10 minuten** — soms is er vertraging
3. 🔄 **Probeer opnieuw** — klik "Resend" op het verificatiescherm
4. 📮 **Controleer welk email adres** — in je IBKR account instellingen staat welk adres gebruikt wordt

#### Alternatieve inlogmethodes:
- **IBKR Mobile app** — installeer de IBKR app, log daar in en gebruik die als authenticator
- **IB Key** — de IBKR authenticatie-app (aparte app, niet TWS)
- **Bel IBKR support** voor een tijdelijke code:
  - 🇧🇪 Belgique: **+32 2 808 33 55**
  - 🇱🇺 Luxembourg: **+352 2030 1750**
  - 🇬🇧 UK: **+44 20 7710 5815**
  - 📧 Email: **help@interactivebrokers.com**

#### Intussen werkt de tool wel!
Zonder IBKR login kan je:
- ✅ **Live Refresh** gebruiken (tab hierboven) — herberekent met Yahoo Finance koersen
- ✅ **Dashboard bekijken** — alle data van 2019-2025 is al geladen
- ✅ **Posities, transacties, grafieken** — alles werkt

De enige beperking: als je aantallen veranderen (aankoop/verkoop), moet
je dat manueel updaten totdat IBKR login werkt.
""")

    # ─── SYNC HISTORY ──────────────────────────────────────
    st.markdown("---")
    st.markdown("### Sync Geschiedenis")

    recent = supabase.table('eq_snapshots').select(
        'snapshot_date, notes, total_value_eur, cash_eur'
    ).order('snapshot_date', desc=True).limit(15).execute()

    if recent.data:
        for s in recent.data:
            notes = s.get('notes', '') or ''
            icon = '📊'
            if 'IBKR' in notes:
                icon = '🔌'
            elif 'Live refresh' in notes:
                icon = '🔄'

            st.markdown(
                f"- {icon} **{s['snapshot_date']}** — "
                f"€{s['total_value_eur']:,.0f} "
                f"(cash: €{s['cash_eur']:,.0f}) "
                f"_{notes}_"
            )
    else:
        st.info("Nog geen snapshots")


def _update_env(key, value):
    """Update een key in het .env bestand."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')

    lines = []
    found = False

    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith(f'{key}='):
            new_lines.append(f'{key}={value}\n')
            found = True
        else:
            new_lines.append(line)

    if not found:
        new_lines.append(f'{key}={value}\n')

    with open(env_path, 'w') as f:
        f.writelines(new_lines)
