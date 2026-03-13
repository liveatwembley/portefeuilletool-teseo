import hashlib
import os
import streamlit as st
from dotenv import load_dotenv
load_dotenv()

from database import get_supabase_client


def _verify_credentials(username, password):
    """
    Verifieer login credentials tegen gehashte env vars.

    Vereist APP_USERNAME_HASH en APP_PASSWORD_HASH in .env (SHA-256 hex).
    Genereer met: python3 -c "import hashlib; print(hashlib.sha256(b'<waarde>').hexdigest())"
    """
    expected_user = os.environ.get('APP_USERNAME_HASH', '')
    expected_pass = os.environ.get('APP_PASSWORD_HASH', '')
    if not expected_user or not expected_pass:
        return False
    return (
        hashlib.sha256(username.encode()).hexdigest() == expected_user
        and hashlib.sha256(password.encode()).hexdigest() == expected_pass
    )

st.set_page_config(
    page_title="Teseo Portefeuilletool",
    page_icon="◼",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ─── LOAD EXTERNAL CSS + LOGO ─────────────────────────────────
_ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')


def _load_asset(filename):
    """Read an asset file relative to app root."""
    path = os.path.join(_ASSETS_DIR, filename)
    with open(path, 'r') as f:
        return f.read()


_CSS = _load_asset('style.css')
_LOGO_B64 = _load_asset('logo_b64.txt').strip()

st.markdown(
    f'<style>{_CSS}</style>'
    f'<div class="teseo-logo-corner">'
    f'<img src="data:image/jpeg;base64,{_LOGO_B64}" alt="Teseo">'
    f'</div>',
    unsafe_allow_html=True,
)

# ─── AUTHENTICATION ──────────────────────────────────────────

if 'authentication_status' not in st.session_state:
    st.session_state['authentication_status'] = False

if not st.session_state['authentication_status']:
    col1, col2, col3 = st.columns([1, 1, 1])
    with col2:
        st.markdown("")
        st.markdown("")
        st.markdown("")
        st.markdown("<p class='login-title'>Portefeuille Login</p>", unsafe_allow_html=True)

        with st.container(border=True):
            username = st.text_input("Gebruikersnaam", key="login_user", label_visibility="collapsed", placeholder="Gebruikersnaam")
            password = st.text_input("Wachtwoord", type="password", key="login_pass", label_visibility="collapsed", placeholder="Wachtwoord")

            if st.button("Inloggen", type="primary", use_container_width=True):
                if _verify_credentials(username, password):
                    st.session_state['authentication_status'] = True
                    st.rerun()
                else:
                    st.error("Foutieve gegevens")
    st.stop()

# ─── MAIN APP ────────────────────────────────────────────────

supabase = get_supabase_client()

# Header bar
header_col, logout_col = st.columns([5, 1])
with header_col:
    st.markdown("<div class='main-header'>Teseo Portefeuilletool</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-subheader'>AICB Equity Fund Management</div>", unsafe_allow_html=True)
with logout_col:
    st.markdown("")
    if st.button("Uitloggen", type="secondary"):
        st.session_state['authentication_status'] = False
        st.rerun()

# ─── HORIZONTAL TAB NAVIGATION (Morningstar-style) ──────────

tab_dash, tab_pos, tab_tx, tab_sync = st.tabs([
    "Overzicht",
    "Posities",
    "Transacties",
    "Data Sync",
])

with tab_dash:
    from pages import dashboard
    dashboard.render(supabase)

with tab_pos:
    from pages import posities
    posities.render(supabase)

with tab_tx:
    from pages import transacties
    transacties.render(supabase)

with tab_sync:
    from pages import ibkr_sync
    ibkr_sync.render(supabase)
