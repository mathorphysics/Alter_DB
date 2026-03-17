import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function formatValue(value, format) {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'price':
      return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'marketcap': {
      const n = Number(value);
      if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
      if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
      return `$${n.toLocaleString()}`;
    }
    case 'ratio':
      return Number(value).toFixed(2) + 'x';
    case 'percent':
      return Number(value).toFixed(2) + '%';
    default:
      return String(value);
  }
}

export default function MetricCard({ label, value, format, change, icon: Icon, highlight }) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className={`
      relative p-4 rounded-lg border transition-all duration-200
      bg-[#161b22] hover:bg-[#1c2128]
      ${highlight
        ? 'border-[#467897]/40 shadow-[0_0_0_1px_rgba(70,120,151,0.15)]'
        : 'border-[#21262d] hover:border-[#30363d]'
      }
    `}>
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg bg-gradient-to-r from-[#467897]/0 via-[#467897] to-[#467897]/0" />
      )}

      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-[#8b949e] uppercase tracking-widest font-medium">{label}</span>
        {Icon && <Icon size={12} className="text-[#467897]/60" />}
      </div>

      <div className="text-xl font-semibold text-[#e6edf3] font-mono tracking-tight mb-1">
        {formatValue(value, format)}
      </div>

      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-[#8b949e]'
        }`}>
          {isPositive ? <TrendingUp size={11} /> : isNegative ? <TrendingDown size={11} /> : <Minus size={11} />}
          <span>{isPositive ? '+' : ''}{formatValue(change, 'percent')} today</span>
        </div>
      )}
    </div>
  );
}
