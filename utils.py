from datetime import datetime


# ─── MORNINGSTAR COLOR CONSTANTS ─────────────────────────────

COLOR_POSITIVE = '#15803d'
COLOR_NEGATIVE = '#dc2626'
COLOR_NEUTRAL = '#6b7280'
COLOR_BRAND = '#1B3A5C'
COLOR_ACCENT = '#E8B34A'

# Professional chart color palettes
SECTOR_COLORS = [
    '#1B3A5C', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e',
    '#14b8a6', '#06b6d4',
]

CURRENCY_COLORS = ['#1B3A5C', '#E8B34A', '#6b7280', '#3b82f6', '#22c55e']

H_BAR_COLORS = [
    '#1B3A5C', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
    '#dbeafe', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8',
    '#6366f1', '#4f46e5',
]


def format_euro(amount):
    """Format bedrag als € 1.234,56 (Europese notatie)."""
    if amount is None or amount == 0:
        return "€ 0,00"
    formatted = f"{abs(amount):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    sign = "-" if amount < 0 else ""
    return f"{sign}€ {formatted}"


def format_euro_compact(amount):
    """Compacte weergave: €1.1M, €234K, etc."""
    if amount is None:
        return "€ 0"
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""
    if abs_amount >= 1_000_000:
        return f"{sign}€{abs_amount / 1_000_000:.1f}M"
    elif abs_amount >= 1_000:
        return f"{sign}€{abs_amount / 1_000:.0f}K"
    else:
        return f"{sign}€{abs_amount:.0f}"


def format_pct(value, decimals=2):
    """Format percentage: 12.34%."""
    if value is None:
        return "0.00%"
    return f"{value:,.{decimals}f}%"


def format_number(value, decimals=0):
    """Format getal met duizendtallen."""
    if value is None:
        return "0"
    return f"{value:,.{decimals}f}".replace(",", ".")


def format_market_cap(value):
    """Format marktkapitalisatie: $1.2T, $450B, $12.3B."""
    if value is None or value == 0:
        return "—"
    abs_val = abs(value)
    if abs_val >= 1e12:
        return f"${abs_val / 1e12:.1f}T"
    elif abs_val >= 1e9:
        return f"${abs_val / 1e9:.1f}B"
    elif abs_val >= 1e6:
        return f"${abs_val / 1e6:.0f}M"
    else:
        return f"${abs_val:,.0f}"


def pnl_color(value):
    """Return CSS kleur op basis van winst/verlies."""
    if value is None or value == 0:
        return COLOR_NEUTRAL
    return COLOR_POSITIVE if value > 0 else COLOR_NEGATIVE


def pnl_class(value):
    """Return CSS class voor tabel cellen."""
    if value is None or value == 0:
        return ''
    return 'pos' if value > 0 else 'neg'


def advice_badge_html(advice):
    """Return HTML badge voor advies (Morningstar-stijl, compact)."""
    if not advice:
        return ""
    colors = {
        'houden': ('#f3f4f6', '#4b5563'),
        'koopman': ('#dcfce7', '#15803d'),
        'kopen': ('#fef9c3', '#854d0e'),
        'verkopen': ('#fee2e2', '#dc2626'),
    }
    bg, fg = colors.get(advice.lower(), ('#f3f4f6', '#4b5563'))
    return (
        f'<span style="background:{bg};color:{fg};padding:1px 6px;'
        f'border-radius:2px;font-size:0.7rem;font-weight:500;'
        f'letter-spacing:0.03em;text-transform:uppercase">{advice}</span>'
    )


def format_52w_range_bar(low, high, current):
    """Return HTML voor 52-week range indicator (Morningstar-stijl)."""
    if not low or not high or not current or high <= low:
        return "—"
    pct = max(0, min(100, (current - low) / (high - low) * 100))
    left_px = int(pct * 0.7)  # 70px bar width
    return (
        f'<span class="range-bar">'
        f'<span class="range-dot" style="left:{left_px}px"></span>'
        f'</span>'
    )


def style_box_html(row, col):
    """
    Return HTML voor Morningstar 3x3 Style Box.
    row: 0=Large, 1=Mid, 2=Small
    col: 0=Value, 1=Blend, 2=Growth
    """
    cells = []
    for r in range(3):
        for c in range(3):
            active = 'active' if (r == row and c == col) else ''
            cells.append(f'<div class="cell {active}"></div>')
    return f'<div class="style-box">{"".join(cells)}</div>'


def horizontal_bar_html(segments, total=None):
    """
    Return HTML voor horizontale stacked bar.
    segments: list of (label, value, color)
    """
    if not segments:
        return ""
    if total is None:
        total = sum(s[1] for s in segments if s[1])
    if total <= 0:
        return ""

    bars = []
    for label, value, color in segments:
        pct = (value / total * 100) if value else 0
        if pct < 0.5:
            continue
        bars.append(
            f'<div class="h-bar-segment" style="width:{pct:.1f}%;background:{color}" '
            f'title="{label}: {pct:.1f}%"></div>'
        )
    return f'<div class="h-bar-container">{"".join(bars)}</div>'


def concentration_metrics(weights):
    """
    Bereken portfolio concentratie metrics.
    weights: list van gewichten (percentages)
    Returns: dict met top5_weight, hhi, gini
    """
    if not weights:
        return {'top5_weight': 0, 'hhi': 0, 'n_positions': 0}

    sorted_w = sorted(weights, reverse=True)
    top5 = sum(sorted_w[:5])
    hhi = sum(w ** 2 for w in sorted_w)  # Herfindahl-Hirschman Index

    return {
        'top5_weight': top5,
        'hhi': hhi,
        'n_positions': len(sorted_w),
    }


def safe_float(value, default=0.0):
    """
    Universele safe float parser.
    Handelt af: None, lege strings, sentinel waarden ('-', '--'),
    valuta symbolen (€), procent-tekens (%), Europese komma-notatie (1.234,56).
    """
    if value is None or value == '' or value == '-' or value == '--':
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned = str(value).replace('€', '').replace('%', '').replace(' ', '').strip()
        # Europese notatie: 1.234,56 → strip duizendtal-punten, vervang komma door punt
        if ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace('.', '').replace(',', '.')
        elif ',' in cleaned:
            cleaned = cleaned.replace(',', '.')
        return float(cleaned)
    except (ValueError, TypeError):
        return default


def safe_int(value, default=0):
    """Universele safe int parser. Delegeert naar safe_float."""
    try:
        return int(safe_float(value, default=default))
    except (ValueError, TypeError):
        return default


def geo_from_ticker(ticker):
    """Bepaal regio op basis van ticker suffix."""
    if not ticker:
        return 'Other'
    if ticker.endswith('.BR'):
        return 'Belgium'
    elif ticker.endswith('.AS'):
        return 'Netherlands'
    elif ticker.endswith('.PA'):
        return 'France'
    elif ticker.endswith('.L'):
        return 'United Kingdom'
    elif ticker.endswith('.HK'):
        return 'Hong Kong'
    elif ticker.endswith('.CO'):
        return 'Denmark'
    elif '.' not in ticker or ticker.endswith('.US'):
        return 'United States'
    else:
        return 'Other'


# ─── HTML COMPONENT HELPERS ──────────────────────────────────
# Herbruikbare Morningstar-stijl componenten voor Streamlit pages.
# CSS classes zijn gedefinieerd in assets/style.css.


def kpi_card_html(label, value, delta=None, sublabel=None, hero=False):
    """
    Return HTML voor een KPI card (Morningstar-stijl).

    Args:
        label: Korte label boven de waarde (bv. "Portefeuillewaarde")
        value: Hoofdwaarde (string, al geformateerd)
        delta: Optionele delta-regel onder de waarde (bv. "+3.2%")
        sublabel: Optionele sublabel (bv. "Snapshot 2026-01-15")
        hero: Grotere variant met brand-kleur border
    """
    hero_cls = ' kpi-hero' if hero else ''
    value_style = ' style="font-size:2rem"' if hero else ''

    parts = [
        f'<div class="kpi-card{hero_cls}">',
        f'  <div class="kpi-label">{label}</div>',
        f'  <div class="kpi-value"{value_style}>{value}</div>',
    ]
    if delta:
        parts.append(f'  <div class="kpi-delta">{delta}</div>')
    if sublabel:
        parts.append(f'  <div class="kpi-sublabel">{sublabel}</div>')
    parts.append('</div>')
    return '\n'.join(parts)


def kpi_card_pnl_html(label, value, delta=None, sublabel=None, amount=0):
    """
    KPI card met automatische P&L kleuring.

    Args:
        label, value, delta, sublabel: Zie kpi_card_html.
        amount: Numerieke waarde voor kleur-bepaling (positief=groen, negatief=rood).
    """
    css_cls = 'kpi-positive' if amount >= 0 else 'kpi-negative'

    parts = [
        '<div class="kpi-card">',
        f'  <div class="kpi-label">{label}</div>',
        f'  <div class="kpi-value {css_cls}">{value}</div>',
    ]
    if delta:
        parts.append(f'  <div class="kpi-delta {css_cls}">{delta}</div>')
    if sublabel:
        parts.append(f'  <div class="kpi-sublabel">{sublabel}</div>')
    parts.append('</div>')
    return '\n'.join(parts)


def section_title_html(text):
    """Return HTML voor een sectie-titel (Morningstar dense caps)."""
    return f'<div class="section-title">{text}</div>'


def insight_pill_html(label, value):
    """
    Return HTML voor een insight pill (compacte metric badge).

    Args:
        label: Korte label (bv. "FX", "Score")
        value: HTML-inhoud van de pill (kan styled spans bevatten)
    """
    return (
        f'<div class="insight-pill">'
        f'<span class="insight-label">{label}</span>'
        f'{value}'
        f'</div>'
    )
