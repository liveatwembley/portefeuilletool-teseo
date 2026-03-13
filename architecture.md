# Architecture — Teseo Portefeuilletool

## Systeemoverzicht

```
+--------------------------------------------------------------+
|                      EXTERNE DATA BRONNEN                    |
+-------------+-------------+-------------+--------------------+
| Yahoo Finance| ECB API    | IBKR Flex   | Google Sheets      |
| (prijzen &  | (FX rates) | Query API   | (historisch +      |
|  fundamentals)| Google Fin | (2026+)    |  nieuwe nota's)    |
+------+------+------+------+------+------+------+-------------+
       |             |             |              |
       v             v             v              v
+--------------------------------------------------------------+
|                     DATA INTEGRATIE LAAG                      |
+-------------+-------------+-------------+--------------------+
| market_data | live_refresh| ibkr_flex   | import_sheets      |
|   .py       |   .py       |   .py       |   .py              |
|             |             | ibkr_xml_   | (CLI + app-mode)   |
|             |             |  import.py  |                    |
+------+------+------+------+------+------+------+-------------+
       |             |             |              |
       v             v             v              v
+--------------------------------------------------------------+
|                    SUPABASE (PostgreSQL)                      |
+---------+----------+---------+------------+------------------+
|eq_posi- |eq_snap-  |eq_hold- |eq_transac- |eq_price_cache    |
| tions   | shots    | ings    | tions      |eq_fx_rates       |
+---------+----+-----+---------+------------+------------------+
               |
               v
+--------------------------------------------------------------+
|                   BEREKENINGEN + BUSINESS LOGIC               |
+--------------------------+-----------------------------------+
| calculations.py          | database.py      | utils.py       |
| (enrich, P&L, gewichten, | (CRUD, queries,  | (formatting,   |
|  pence-correctie)        |  data aggregatie) |  HTML helpers, |
|                          |                  |  safe_float)   |
+-----------+--------------+--------+---------+-------+--------+
            |                       |                 |
            v                       v                 v
+--------------------------------------------------------------+
|               TICKER CONFIG (Single Source of Truth)          |
+--------------------------------------------------------------+
| config/tickers.py                                            |
| TICKERS dict + helper functies                               |
+-------------------------------+------------------------------+
                                |
                                v
+--------------------------------------------------------------+
|                    STREAMLIT UI LAAG                          |
+--------------------------------------------------------------+
| app.py (entry point, auth, navigatie, CSS uit assets/)       |
+-------------+-------------+-------------+--------------------+
| dashboard   | posities    | transacties | ibkr_sync          |
|   .py       |   .py       |   .py       |   .py              |
| (coordinator|             |             |                    |
|  75 regels) |             |             | - Google Sheets    |
|     |       | - Stock     | - Buy/Sell  | - Live refresh     |
|     +--+    |   detail    |   form      | - IBKR Flex        |
|     |  |    | - Charts    | - Historiek | - XML upload       |
|     v  v    | - Style Box |             | - Tips             |
| dashboard_  | - Dual      |             |                    |
| overview.py |   notation  |             |                    |
| xray.py     | - 52W range |             |                    |
| performance.|             |             |                    |
|   py        |             |             |                    |
| holdings.py |             |             |                    |
+-------------+-------------+-------------+--------------------+
```

## Datamodel

### Entity Relationship

```
eq_positions (1) ------< (N) eq_holdings
     |                         |
     |                         |
     |                    eq_snapshots (1) ------< (N) eq_holdings
     |
     +------< (N) eq_transactions
```

### Tabelstructuur

**eq_positions** -- Master stock records
- `id`, `ticker`, `name`, `currency`, `sector`, `country`
- Een record per aandeel, hergebruikt over snapshots

**eq_snapshots** -- Portfolio state per datum
- `id`, `snapshot_date`, `cash_eur`, `total_value_eur`, `cash_pct`
- `eur_usd`, `eur_gbp`, `eur_dkk`, `eur_hkd` (FX rates bij snapshot)
- `notes` (bron-info: "Live refresh 14:30" of "Google Sheets import")

**eq_holdings** -- Positiedetails per snapshot
- `id`, `snapshot_id` (FK), `position_id` (FK)
- `shares`, `price_local`, `price_eur`, `avg_cost`, `value_eur`
- `pnl_nominal`, `pnl_pct`, `weight_pct`
- `advice`, `mandate_buy`, `mandate_sell`, `motivation`

**eq_transactions** -- Handelshistorie
- `id`, `position_id` (FK), `transaction_date`, `type` (BUY/SELL)
- `shares`, `price_eur`, `currency`, `fx_rate`, `fees`, `total_eur`, `notes`

**eq_price_cache** -- Yahoo Finance cache (TTL: 5 min)
**eq_fx_rates** -- Wisselkoerscache (TTL: 15 min)

## Data Flow -- Temporeel Model

```
Tijdlijn:
================================================================
2019          2024         2025    |    2026              ->
                                  |
  <-- Google Sheets import ------>|<-- IBKR + Live Refresh --->
      (import_sheets.py)          |    (ibkr_flex.py)
      Historisch + nieuwe nota's  |    (live_refresh.py)
      via CLI of via UI           |    Doorlopend
================================================================
```

### Google Sheets Import (historisch + doorlopend)
1. **CLI mode** (`python import_sheets.py`): importeert ALLE tabs uit alle spreadsheets (bulk)
2. **App mode** (via Data Sync -> Google Sheets tab): importeert nieuwste tab in 1 klik
3. Matcht namen via aliassen uit `config/tickers.py` -> `eq_positions`
4. Maakt snapshot + holdings per datum
5. Na import: Live Refresh draaien voor actuele EUR-conversie

### IBKR Flex Query (2026+)
1. `SendRequest` -> krijgt referentie-code
2. Wacht 15s, `GetStatement` -> XML data
3. Parseert Open Positions, Trades, Cash, NAV
4. Maakt snapshot + holdings + transactions

### Live Refresh (dagelijks)
1. Pakt laatste snapshot als basis (aantallen)
2. Haalt huidige prijzen op via Yahoo Finance
3. Verrijkt via `calculations.enrich_all_holdings()` (FX, pence, P&L)
4. Maakt nieuw snapshot voor vandaag

## Berekeningen (calculations.py)

Centrale module die door dashboard.py en live_refresh.py wordt gebruikt:

```
enrich_holding(holding, live_prices, fx_rates)
  |
  +-- Koers: live prijs of fallback naar laatst bekende
  +-- Pence-correctie: als IBKR price_local > 500 voor pence-ticker
  +-- FX conversie: price_local -> price_eur via convert_to_eur()
  +-- avg_cost correctie: _correct_pence_avg_cost() (ratio > 10x = pence)
  +-- P&L berekening: value - (shares * avg_cost_eur)
  +-- Dagverandering: price_eur - prev_close_eur
  |
  v
enrich_all_holdings(holdings, live_prices, fx_rates)
  |
  +-- Verrijkt alle holdings
  +-- Berekent gewichten (value / total_value * 100)
  |
  v
calculate_portfolio_meta(enriched_holdings, cash, fx_rates)
  |
  +-- Portfolio totalen (equity + cash)
  +-- Dagverandering portfolio
  +-- Herberekent gewichten inclusief cash
```

## Multi-Currency Architectuur

```
                    +---------+
                    |   EUR   | <-- Basisvaluta
                    | (base)  |
                    +----+----+
           +---------+---+---+---------+----------+
           v         v       v         v          v
        +-----+  +-----+ +-----+  +-----+   +-----+
        | USD |  | GBP | | DKK |  | HKD |   | SEK |
        +-----+  +--+--+ +-----+  +-----+   +-----+
                    |
              +-----+-----+
              | Pence (GBp)|
              | GAW.L      |
              | SMT.L      |
              +------------+

FX Rate Fallback Keten:
  1. ECB Statistical Data Warehouse API (meest betrouwbaar)
  2. Google Finance (via URL scraping)
  3. yfinance (als backup)
  4. Hardcoded fallbacks (absolute noodgeval)

Pence-correctie (LSE-tickers):
  - Live prijzen: _adjust_pence() in get_current_prices()
  - Historische data: get_historical_prices() deelt door 100
  - 52W range: w52h/w52l corrigeren in dashboard_holdings + posities
  - avg_cost: _correct_pence_avg_cost() vergelijkt met price_local

Dual Notation (UI):
  - Non-EUR posities tonen: "EUR338.32" + "$401.32" eronder
  - Op dashboard (overzicht + holdings) en posities-pagina
  - Geen impact op berekeningen (altijd in EUR)
```

## Caching Strategie

| Laag | TTL | Bron | Opslag |
|------|-----|------|--------|
| Live prijzen | 5 min | Yahoo Finance | `@st.cache_data` + Supabase |
| Historische prijzen | 1 uur | Yahoo Finance | `@st.cache_data` |
| Fundamentals | 1 uur | Yahoo Finance | `@st.cache_data` |
| FX Rates | 15 min | ECB/Google/yfinance | `@st.cache_data` + Supabase |
| Page data | Session | Supabase | `@st.cache_data` |

## UI Architectuur

### Navigatie
```
app.py
  +-- Login screen (session-based auth, SHA256 hash)
  +-- Main app (na login)
       +-- Tab 1: Overzicht    -> dashboard.py (coordinator)
       |    +-- Sub-tab: Overzicht     -> dashboard_overview.py
       |    +-- Sub-tab: X-Ray         -> dashboard_xray.py
       |    +-- Sub-tab: Rendement     -> dashboard_performance.py
       |    +-- Sub-tab: Holdings      -> dashboard_holdings.py
       +-- Tab 2: Posities     -> posities.py
       +-- Tab 3: Transacties  -> transacties.py
       +-- Tab 4: Data Sync    -> ibkr_sync.py
            +-- Sub-tab: Google Sheets (scan + import)
            +-- Sub-tab: Live Refresh
            +-- Sub-tab: IBKR Flex API
            +-- Sub-tab: XML Upload
            +-- Sub-tab: IBKR Login Tips
```

### Design System
- **Font**: Inter (sans-serif)
- **Layout**: Max 1400px, centered
- **CSS**: Extern in `assets/style.css`, geladen door `app.py`
- **HTML Components**: `utils.py` helpers (`kpi_card_html`, `section_title_html`, `insight_pill_html`, etc.)
- **Kleuren**:
  - Primary: `#1B3A5C` (navy) -- `COLOR_BRAND`
  - Positive: `#15803d` (groen) -- `COLOR_POSITIVE`
  - Negative: `#dc2626` (rood) -- `COLOR_NEGATIVE`
  - Accent: `#E8B34A` (goud) -- `COLOR_ACCENT`
  - Background: `#ffffff` / `#f9fafb`
- **Stijl**: Morningstar-geinspireerd, professionele financiele UI
- **Logo**: Teseo logo als base64 in `assets/logo_b64.txt`

### Dashboard Data Flow
```
dashboard.py (coordinator)
  |
  +-- get_latest_snapshot() -> snapshot + metadata
  +-- get_holdings_for_snapshot() -> raw holdings
  +-- get_current_prices() -> live prijzen (Yahoo)
  +-- get_live_fx_rates() -> wisselkoersen
  +-- enrich_all_holdings() -> verrijkte holdings (calculations.py)
  +-- calculate_portfolio_meta() -> portfolio totalen
  |
  +-- DataFrame opbouwen
  |
  +-- dispatch naar sub-tab:
       dashboard_overview.render(df, meta)
       dashboard_xray.render(df, meta)
       dashboard_performance.render(df, meta, supabase)
       dashboard_holdings.render(df, meta)
```

## Security & Auth

- **Login**: SHA256-gehashte credentials, vergeleken met `APP_USERNAME`/`APP_PASSWORD_HASH` env vars
- **Session**: `st.session_state["authenticated"]`
- **Secrets**: Environment variables met `.env` file (dotenv) + Streamlit Cloud fallback
- **API Keys**: Nooit in code, altijd via env vars
- **Google Service Account**: `robot-lezer@stock-compare-301906.iam.gserviceaccount.com` (readonly)

## Deployment

### Lokaal
```bash
conda activate blackbird311
pip install -r requirements.txt
cp .env.example .env  # Vul credentials in
streamlit run app.py --server.port 8502
```

### Streamlit Cloud
- Secrets via Streamlit Cloud dashboard
- `config.toml` in `.streamlit/` voor thema
- Headless mode enabled

## Bekende Beperkingen

1. **Auth**: SHA256 hash in code -- beter naar env vars of OAuth/SSO
2. **Concurrency**: Geen multi-user ondersteuning (session state conflicts)
3. **Rate limits**: Yahoo Finance kan throttlen bij veel requests
4. **IBKR**: Flex Query heeft 15s delay, token verloopt periodiek
5. **Sheets import**: `price_eur = price_local` -- Live Refresh nodig na import
6. **Pence**: yfinance `.info` (52W, etc.) retourneert ruwe pence -- moet altijd gecorrigeerd
7. **FX hardcoded fallbacks**: EUR/USD 1.18, EUR/GBP 0.84 etc. kunnen verouderen
