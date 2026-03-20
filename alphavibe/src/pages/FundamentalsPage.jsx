import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DollarSign, BarChart2, TrendingUp, ArrowRight } from 'lucide-react';

import SearchBar from '../components/SearchBar';
import MetricCard from '../components/MetricCard';
import PriceChart from '../components/PriceChart';
import ErrorBanner from '../components/ErrorBanner';
import ProfileBadge from '../components/ProfileBadge';

import { fetchQuote, fetchProfile, fetchHistoricalPrice, fetchFundamentalMetrics } from '../api/openbb';

function EmptyState() {
  const EXAMPLES = ['TSM', 'ON', 'NVDA', 'AMAT', 'ASML'];
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-[#467897]/10 border border-[#467897]/20 flex items-center justify-center mb-4">
        <TrendingUp size={28} className="text-[#467897]/60" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--fg)] mb-2">Search a ticker to begin</h2>
      <p className="text-sm text-[var(--sub)] mb-6 max-w-sm">
        Enter any equity symbol to load price data, fundamentals, and key ratios.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((t) => (
          <span key={t} className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--sub)] font-mono">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function TsmcAltDataTeaser() {
  const navigate = useNavigate();
  const goToChart = () => {
    navigate('/alternatives');
    setTimeout(() => {
      document.getElementById('customs-trade')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };
  return (
    <button
      onClick={goToChart}
      className="flex items-center gap-1 text-xs text-[#467897] hover:text-[var(--fg)] transition-colors"
    >
      View Chart <ArrowRight size={11} />
    </button>
  );
}

export default function FundamentalsPage() {
  const [searchParams] = useSearchParams();
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

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const startDate = fiveYearsAgo.toISOString().split('T')[0];
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

      if ([q, p, hist, met].every((r) => r.status === 'rejected')) {
        throw q.reason || new Error('All requests failed');
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search when arriving from Supply Chain via ?ticker=NVDA
  useEffect(() => {
    const ticker = searchParams.get('ticker');
    if (ticker) handleSearch(ticker.toUpperCase());
  }, [handleSearch]);

  const hasData = quote || profile || priceHistory.length > 0 || metrics;

  const currency = symbol.toUpperCase().endsWith('.KS')
    ? { symbol: '₩', decimals: 0 }
    : { symbol: '$', decimals: 2 };

  return (
    <div className="space-y-6">
      <SearchBar onSearch={handleSearch} loading={loading} />

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => symbol && handleSearch(symbol)}
          onDismiss={() => setError(null)}
        />
      )}

      {!hasData && !loading && !error && <EmptyState />}

      {hasData && (
        <div className="space-y-5">
          <ProfileBadge profile={profile} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Last Price"
              value={quote?.last_price}
              format="price"
              change={quote?.prev_close != null && quote?.last_price != null
                ? ((quote.last_price - quote.prev_close) / quote.prev_close) * 100
                : undefined}
              icon={DollarSign}
              highlight
              currency={currency}
            />
            <MetricCard label="Market Cap" value={metrics?.market_cap} format="marketcap" icon={BarChart2} currency={currency} />
            <MetricCard label="P/E Ratio" value={metrics?.pe_ratio} format="ratio" icon={TrendingUp} />
            <MetricCard label="EV / EBITDA" value={metrics?.enterprise_to_ebitda} format="ratio" icon={BarChart2} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Revenue Growth"
              value={metrics?.revenue_growth != null ? metrics.revenue_growth * 100 : null}
              format="percent"
              icon={DollarSign}
            />
            <MetricCard
              label="Net Margin"
              value={metrics?.profit_margin != null ? metrics.profit_margin * 100 : null}
              format="percent"
              icon={TrendingUp}
            />
            <MetricCard
              label="ROE"
              value={metrics?.return_on_equity != null ? metrics.return_on_equity * 100 : null}
              format="percent"
              icon={BarChart2}
            />
            <MetricCard label="Debt / Equity" value={metrics?.debt_to_equity} format="ratio" icon={BarChart2} />
          </div>

          {priceHistory.length > 0 && <PriceChart data={priceHistory} symbol={symbol} currency={currency} />}

          {/* Alt Data teaser — only for TSMC */}
          {symbol.toUpperCase() === 'TSM' && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-[var(--sub)]">ALT DATA</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <TsmcAltDataTeaser />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
