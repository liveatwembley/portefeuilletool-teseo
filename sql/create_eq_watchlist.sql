-- Watchtower / Watchlist tabel
CREATE TABLE IF NOT EXISTS eq_watchlist (
    id BIGSERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    owner TEXT,
    bio TEXT,
    comment TEXT,
    trigger_buy NUMERIC,
    trigger_sell NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index op ticker voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_eq_watchlist_ticker ON eq_watchlist(ticker);

-- Trigger voor updated_at
CREATE OR REPLACE FUNCTION update_eq_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_eq_watchlist_updated_at ON eq_watchlist;
CREATE TRIGGER trigger_eq_watchlist_updated_at
    BEFORE UPDATE ON eq_watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_eq_watchlist_updated_at();
