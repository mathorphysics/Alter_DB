import { useState, useCallback } from 'react';
import './index.css';

import Navbar from './components/Navbar';
import SearchBar from './components/SearchBar';
import MetricCard from './components/MetricCard';
import PriceChart from './components/PriceChart';
import AlternativeDataPanel from './components/AlternativeDataPanel';
import ErrorBanner from './components/ErrorBanner';

import { fetchQuote, fetchProfile, fetchHistoricalPrice, fetchFundamentalMetrics } from './api/openbb';

import {
  DollarSign,
  BarChart2,
  TrendingUp,
  Building2,
  Globe,
  ChevronRight,
} from 'lucide-react';

function ProfileBadge({ profile }) {
  if (!profile) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-[#161b22] border border-[#21262d] rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-bold text-[#e6edf3] font-mono">{profile.symbol}</span>
          <ChevronRight size={14} className="text-[#484f58]" />
          <span className="text-sm text-[#8b949e] truncate">{profile.name}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-[#8b949e]">
          {profile.sector && (
            <span className="flex items-center gap-1">
              <Building2 size={10} className="text-[#467897]" />
              {profile.sector}
            </span>
          )}
          {profile.industry && (
            <span className="flex items-center gap-1">
              <BarChart2 size={10} className="text-[#467897]" />
              {profile.industry}
            </span>
          )}
          {profile.country && (
            <span className="flex items-center gap-1">
              <Globe size={10} className="text-[#467897]" />
              {profile.country}
            </span>
          )}
          {profile.exchange && (
            <span className="px-1.5 py-0.5 bg-[#467897]/10 border border-[#467897]/30 text-[#467897] rounded text-[10px] font-medium">
              {profile.exchange}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const EXAMPLES = ['TSM', 'ON', 'NVDA', 'AMAT', 'ASML'];
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#467897]/10 border border-[#467897]/20 flex items-center justify-center mb-4">
        <TrendingUp size={28} className="text-[#467897]/60" />
      </div>
      <h2 className="text-lg font-semibold text-[#e6edf3] mb-2">Search a ticker to begin</h2>
      <p className="text-sm text-[#8b949e] mb-6 max-w-sm">
        Enter any equity symbol above to load price data, fundamentals, and alternative signals.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((t) => (
          <span
            key={t}
            className="px-2.5 py-1 bg-[#161b22] border border-[#21262d] rounded text-xs text-[#8b949e] font-mono"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const handleSearch = useCallback(async (ticker) => {
    setLoading(true);
    setError(null);
    setSymbol(ticker);
    setQuote(null);
    setProfile(null);
    setPriceHistory([]);
    setMetrics(null);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    try {
      const [q, p, hist, met] = await Promise.allSettled([
        fetchQuote(ticker),
        fetchProfile(ticker),
        fetchHistoricalPrice(ticker, startDate, endDate),
        fetchFundamentalMetrics(ticker),
      ]);

      if (q.status === 'fulfilled') setQuote(q.value);
      if (p.status === 'fulfilled') setProfile(p.value);
      if (hist.status === 'fulfilled') setPriceHistory(hist.value);
      if (met.status === 'fulfilled') setMetrics(met.value);

      // If all failed, surface error
      if ([q, p, hist, met].every((r) => r.status === 'rejected')) {
        throw q.reason || new Error('All requests failed');
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const hasData = quote || profile || priceHistory.length > 0 || metrics;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Search */}
        <section>
          <SearchBar onSearch={handleSearch} loading={loading} />
        </section>

        {/* Error */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => symbol && handleSearch(symbol)}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Empty state */}
        {!hasData && !loading && !error && <EmptyState />}

        {/* Data sections */}
        {hasData && (
          <div className="space-y-5">
            {/* Profile badge */}
            <ProfileBadge profile={profile} />

            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Last Price"
                value={quote?.last_price ?? quote?.price}
                format="price"
                change={quote?.change_percent}
                icon={DollarSign}
                highlight
              />
              <MetricCard
                label="Market Cap"
                value={profile?.market_cap ?? metrics?.market_cap}
                format="marketcap"
                icon={BarChart2}
              />
              <MetricCard
                label="P/E Ratio (TTM)"
                value={metrics?.pe_ratio ?? quote?.pe_ratio}
                format="ratio"
                icon={TrendingUp}
              />
              <MetricCard
                label="EV / EBITDA"
                value={metrics?.ev_to_ebitda}
                format="ratio"
                icon={BarChart2}
              />
            </div>

            {/* Second row of metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Revenue (TTM)"
                value={metrics?.revenue}
                format="marketcap"
                icon={DollarSign}
              />
              <MetricCard
                label="Net Margin"
                value={metrics?.net_profit_margin != null ? metrics.net_profit_margin * 100 : null}
                format="percent"
                icon={TrendingUp}
              />
              <MetricCard
                label="ROE"
                value={metrics?.roe != null ? metrics.roe * 100 : null}
                format="percent"
                icon={BarChart2}
              />
              <MetricCard
                label="Debt / Equity"
                value={metrics?.debt_to_equity}
                format="ratio"
                icon={BarChart2}
              />
            </div>

            {/* Price chart */}
            {priceHistory.length > 0 && (
              <PriceChart data={priceHistory} symbol={symbol} />
            )}

            {/* Alternative data */}
            <AlternativeDataPanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#21262d] mt-16 py-6">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs text-[#484f58]">
            AlphaVibe Research · Powered by OpenBB Platform
          </span>
          <span className="text-xs text-[#484f58]">
            Data: localhost:8000 · Not financial advice
          </span>
        </div>
      </footer>
    </div>
  );
}
