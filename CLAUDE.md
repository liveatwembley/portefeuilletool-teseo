# CLAUDE.md — Teseo Portefeuilletool

## Project Overview

Professionele portefeuillemanagementtool voor het **AICB Equity Fund** (Teseo BV). Gebouwd met Streamlit, met een Morningstar-geïnspireerde UI, live marktdata en multi-broker integratie.

## Quick Start

```bash
# Install dependencies (gebruik conda env blackbird311 of vergelijkbaar)
conda activate blackbird311
pip install -r requirements.txt

# Set environment variables (see .env)
# SUPABASE_URL, SUPABASE_KEY, IBKR_TOKEN, IBKR_QUERY_ID, GOOGLE_CREDENTIALS
# APP_USERNAME, APP_PASSWORD_HASH (sha256)

# Run the app
streamlit run app.py
```

## Tech Stack

- **Frontend**: Streamlit + Plotly (charts) + extern CSS (`assets/style.css`)
- **Backend**: Supabase (PostgreSQL)
- **Market Data**: Yahoo Finance (yfinance), ECB API (FX rates), Google Finance (fallback)
- **Brokers**: Interactive Brokers (Flex Query API + XML import)
- **Historical Data**: Google Sheets API (2019-2025, ook voor nieuwe nota's)

## Project Structure

```
app.py                  -> Entry point, auth, navigatie, CSS loading
calculations.py         -> Centrale portfolio berekeningen (enrich, P&L, gewichten)
database.py             -> Supabase CRUD (snapshots, holdings, transactions, FX)
market_data.py          -> Yahoo Finance prijzen, ECB FX rates, fundamentals
utils.py                -> Formatting, HTML components, safe_float/safe_int, kleuren
live_refresh.py         -> Dagelijkse herberekening met live koersen
ibkr_flex.py            -> IBKR Flex Query API client (2026+)
ibkr_xml_import.py      -> IBKR XML Activity Statement parser
import_sheets.py        -> Google Sheets import (CLI bulk + app single-tab)
config/
  __init__.py
  tickers.py            -> SINGLE SOURCE OF TRUTH voor alle ticker data
assets/
  style.css             -> Alle CSS (extern, niet inline)
  logo_b64.txt          -> Teseo logo als base64
pages/
  dashboard.py          -> Coordinator: laadt data, dispatcht naar sub-modules
  dashboard_overview.py -> Overzicht sub-tab (KPIs, treemap, posities tabel)
  dashboard_xray.py     -> X-Ray sub-tab (sector, geo, risico)
  dashboard_performance.py -> Rendement sub-tab (historiek, benchmark)
  dashboard_holdings.py -> Holdings sub-tab (fundamentele data tabel)
  posities.py           -> Individueel aandeeldetail (chart, KPIs, fundamentals)
  transacties.py        -> Buy/sell transacties invoer & historie
  ibkr_sync.py          -> Data Sync UI (Google Sheets, Live Refresh, IBKR, XML)
.streamlit/
  config.toml           -> Theme & layout config
```

## Key Architecture Decisions

- **Single Source of Truth**: `config/tickers.py` bevat ALLE ticker-informatie. Nieuw aandeel = 1 bestand wijzigen.
- **Centrale berekeningen**: `calculations.py` is de enige plek voor P&L, waarde en gewichtberekeningen. Dashboard en live_refresh delen dezelfde logica.
- **Temporeel datasourcesysteem**: Google Sheets (2019-2025) -> Live/IBKR (2026+). Google Sheets ook voor nieuwe nota's via UI.
- **Snapshot-model**: Portfolio state wordt per datum opgeslagen als snapshot + holdings
- **Multi-currency**: Alles wordt naar EUR geconverteerd. FX fallback: ECB -> Google Finance -> yfinance -> hardcoded
- **Dual notation**: Non-EUR posities tonen zowel EUR als lokale valuta (bv. EUR338.32 / $401.32)
- **Pence-correctie**: LSE-tickers (GAW.L, SMT.L) worden automatisch van pence naar pounds gecorrigeerd. Slimme detectie: vergelijkt avg_cost met price_local (ratio > 10x = pence).
- **CSS extern**: Alle styling in `assets/style.css`, niet inline in Python
- **Dashboard gesplitst**: `dashboard.py` (75 regels coordinator) + 4 sub-modules (elk ~100-200 regels)

## Database Tables (Supabase)

| Table | Doel |
|-------|------|
| `eq_positions` | Master stock records (ticker, naam, valuta, sector, land) |
| `eq_snapshots` | Portfolio state per datum (cash, totaalwaarde, FX rates incl. EUR/HKD) |
| `eq_holdings` | Positie-details per snapshot (shares, prijs, P&L, gewicht, advies, mandaat) |
| `eq_transactions` | Buy/sell trades met datum, prijs, FX, kosten |
| `eq_price_cache` | Yahoo Finance prijscache |
| `eq_fx_rates` | Wisselkoerscache |

## Ticker Config

**`config/tickers.py`** is de single source of truth. Bevat:
- `TICKERS` dict: ticker -> {name, currency, sector, country, aliases, pence, ibkr_symbol}
- Helper functies: `get_ticker()`, `get_currency()`, `get_sector()`, `is_pence_ticker()`
- Import-specifieke mappers: `get_import_sheets_map()`, `get_ibkr_symbol_map()`, `get_name_to_ticker_map()`

### Nieuw aandeel toevoegen

1. Voeg entry toe aan `TICKERS` dict in `config/tickers.py`
2. Klaar. Alle andere modules (market_data, import_sheets, ibkr_flex, dashboard) pikken het automatisch op.

## Coding Conventions

- **Taal**: Code in Engels, UI-teksten in het Nederlands
- **Formatting**: Europees getal-formaat via `utils.py`
- **Kleuren**: Navy (#1B3A5C), groen (#15803d), rood (#dc2626), goud (#E8B34A) -- constanten in `utils.py`
- **Styling**: Extern CSS in `assets/style.css`, HTML component-helpers in `utils.py`
- **Error handling**: Logging via `logging.getLogger(__name__)` + stille fallbacks (geen crashes)
- **Caching**: `@st.cache_data(ttl=...)` voor data, `@st.cache_resource` voor singletons
- **Safe parsing**: Altijd `safe_float()`/`safe_int()` uit `utils.py` voor user/sheet data
- **FX conversie**: Altijd via `convert_to_eur()` uit `market_data.py`
- **Berekeningen**: Altijd via `calculations.py`, nooit P&L/waarde inline berekenen

### Code Style

- snake_case voor functies en variabelen
- `_prefix` voor private/helper functies
- Geen type hints (project gebruikt ze niet)
- Geen classes -- puur functioneel/procedureel
- f-strings voor alle string formatting
- `.get()` met fallback defaults voor dict-access
- Secties scheiden met: `# --- SECTIENAAM ---`

## Operational Rules

Regels voor Claude bij het werken aan dit project:

### Communicatie
- **Altijd in het Nederlands antwoorden.** Dit is een Nederlandstalig project en team.
- **Beknopt en professioneel.** Geen overbodige uitleg, geen filler-tekst. Kom direct ter zake.
- **Geen emoji's** tenzij expliciet gevraagd.

### Code-aanpak
- **Altijd bestaande code controleren voor je nieuwe bestanden aanmaakt.** Lees en begrijp de huidige structuur.
- **Volg de bestaande patronen in de codebase** (zie Code Style hierboven).
- **UI-teksten in het Nederlands**, code/variabelen in het Engels.
- **Geen over-engineering.** Alleen wijzigen wat gevraagd wordt.
- **Ticker-wijzigingen alleen in `config/tickers.py`** -- nooit ticker-data hardcoden in andere bestanden.
- **Berekeningslogica alleen in `calculations.py`** -- nooit P&L/waarde dupliceren in UI-code.
- **FX-conversie altijd via `convert_to_eur()`** -- nooit handmatig delen/vermenigvuldigen.

### Workflow
- Lees altijd eerst de relevante bestanden voordat je wijzigingen voorstelt.
- Check `config/tickers.py` bij ticker-gerelateerde vragen (niet market_data.py!).
- Check `database.py` voor beschikbare Supabase-functies voordat je nieuwe queries schrijft.
- Check `calculations.py` voor bestaande berekeningslogica voordat je iets berekent.
- Bij twijfel: vraag. Liever een keer bevestigen dan verkeerd implementeren.

## Environment Variables

```
SUPABASE_URL        -> Supabase project URL
SUPABASE_KEY        -> Supabase anon/service key
IBKR_TOKEN          -> Interactive Brokers Flex Query token
IBKR_QUERY_ID       -> IBKR Flex Query ID
GOOGLE_CREDENTIALS  -> Google Sheets service account JSON
APP_USERNAME        -> Login gebruikersnaam (sha256-gehashed in code)
APP_PASSWORD_HASH   -> Login wachtwoord SHA256 hash
```

## Geleerde Lessen

### Pence-correctie is subtiel
LSE-tickers (GAW.L, SMT.L) noteren in pence (GBp). Yahoo Finance returnt prijzen in pence, maar `yfinance.info` (52W range, etc.) ook. **Alle pence-waarden moeten consistent gecorrigeerd worden**: live prijzen, historische data, 52W range, avg_cost. Gebruik `is_pence_ticker()` uit config en vergelijk avg_cost met price_local (ratio > 10x = nog in pence) in plaats van hardcoded drempelwaarden.

### FX-conversie moet centraal
Nooit handmatig `price * rate` of `price / rate` doen. Gebruik altijd `convert_to_eur()`. De conventie is EUR/XXX (hoeveel XXX per EUR), dus de conversie is `amount / rate`. Fout hierin is moeilijk te spotten omdat de waarden "ongeveer kloppen".

### Dual source-of-truth vermijden
Voor de refactoring stond ticker-info in 6 bestanden (market_data.py, import_sheets.py, ibkr_flex.py, ibkr_xml_import.py, etc.). Een nieuw aandeel toevoegen vergde 6 bestanden wijzigen. Nu: 1 bestand (`config/tickers.py`).

### Berekeningslogica niet dupliceren
Dashboard en live_refresh hadden elk hun eigen P&L-berekening met subtiele verschillen. Nu: 1 `calculations.py` die door beiden wordt gebruikt.

### safe_float/safe_int centraliseren
Er waren 3 versies van `safe_float` (import_sheets, ibkr_flex, ibkr_xml_import) met elk net andere edge cases. Nu: 1 versie in `utils.py` die alle gevallen dekt.

### EUR/HKD niet vergeten
Bij het toevoegen van nieuwe valuta's (HKD voor 2929.HK): check dat de FX rate ook wordt opgeslagen in snapshots en opgehaald in `get_live_fx_rates()`.

### CSS uit Python halen
238 regels inline CSS in app.py maakte elke styling-wijziging lastig. Extern CSS-bestand (`assets/style.css`) + HTML component helpers in utils.py is veel beter onderhoudbaar.

## Gotchas & Known Issues

- Auth credentials staan als SHA256 hash in code -- beter naar env vars verplaatsen
- yfinance `.info` retourneert 52W high/low in ruwe pence voor LSE-tickers -- altijd corrigeren met `is_pence_ticker()`
- Google Sheets import zet `price_eur = price_local` -- na import altijd een Live Refresh draaien voor correcte EUR-conversie
- FX rates hebben fallback-keten: ECB -> Google Finance -> yfinance -> hardcoded. De hardcoded waarden kunnen verouderen.
- Streamlit cache kan stale data tonen na import -- gebruiker moet pagina herladen
