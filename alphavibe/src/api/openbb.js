// Uses Vite dev proxy (/api → http://localhost:8000) to avoid CORS issues
const BASE_URL = '/api/v1';

// Default provider — yfinance requires no API key and works for most tickers
const DEFAULT_PROVIDER = 'yfinance';

async function request(path, params = {}) {
  const url = new URL(BASE_URL + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg).join('; ')
      : typeof detail === 'string'
      ? detail
      : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json();
}

export async function fetchQuote(symbol) {
  const data = await request('/equity/price/quote', { symbol, provider: DEFAULT_PROVIDER });
  return data.results?.[0] ?? null;
}

export async function fetchProfile(symbol) {
  const data = await request('/equity/profile', { symbol, provider: DEFAULT_PROVIDER });
  return data.results?.[0] ?? null;
}

export async function fetchHistoricalPrice(symbol, startDate, endDate) {
  const data = await request('/equity/price/historical', {
    symbol,
    provider: DEFAULT_PROVIDER,
    start_date: startDate,
    end_date: endDate,
    interval: '1d',
  });
  return data.results ?? [];
}

export async function fetchFundamentalMetrics(symbol) {
  const data = await request('/equity/fundamental/metrics', {
    symbol,
    provider: DEFAULT_PROVIDER,
    period: 'annual',
    limit: 1,
  });
  return data.results?.[0] ?? null;
}
