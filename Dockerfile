FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Restructure flat repo into expected directory layout
RUN mkdir -p pages assets config .streamlit \
    && mv dashboard.py dashboard_holdings.py dashboard_overview.py \
       dashboard_performance.py dashboard_xray.py ibkr_sync.py \
       posities.py transacties.py pages/ \
    && cp __init__.py pages/__init__.py \
    && mv style.css assets/ \
    && mv logo_b64.txt assets/ \
    && mv tickers.py config/ \
    && cp __init__.py config/__init__.py \
    && printf '[server]\nheadless = true\naddress = "0.0.0.0"\nport = 8501\nenableCORS = false\nenableXsrfProtection = false\n\n[theme]\nprimaryColor = "#1B3A5C"\nbackgroundColor = "#ffffff"\nsecondaryBackgroundColor = "#f9fafb"\ntextColor = "#1a1a1a"\nfont = "sans serif"\n\n[browser]\ngatherUsageStats = false\n' > .streamlit/config.toml

EXPOSE ${PORT:-8501}

HEALTHCHECK CMD curl --fail http://localhost:${PORT:-8501}/_stcore/health || exit 1

CMD streamlit run app.py --server.port=${PORT:-8501} --server.address=0.0.0.0
