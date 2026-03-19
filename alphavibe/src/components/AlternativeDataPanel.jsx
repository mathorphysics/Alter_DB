import { Satellite, Activity, Database, ArrowRight } from 'lucide-react';

const PLACEHOLDERS = [
  {
    id: 'satellite',
    icon: Satellite,
    title: 'Satellite Factory Activity',
    desc: 'Fab utilization rate inferred from SAR imagery — Taiwan, Korea, US nodes',
    badge: 'Coming Soon',
    color: '#467897',
    mockValue: '82.4%',
    mockDelta: '+3.1pp MoM',
    mockUp: true,
    tags: ['TSMC', 'Samsung', 'Intel'],
  },
  {
    id: 'shipping',
    icon: Activity,
    title: 'Shipping Chokepoint Volume',
    desc: 'Real-time vessel traffic through Taiwan Strait, Malacca, Suez',
    badge: 'Coming Soon',
    color: '#467897',
    mockValue: '1,847',
    mockDelta: 'vessels / 7d',
    mockUp: true,
    tags: ['TSMC', 'Logistics'],
  },
];

function MockSparkline({ up }) {
  const points = up
    ? [30, 28, 32, 35, 33, 38, 40, 37, 42, 45]
    : [45, 43, 40, 38, 42, 36, 33, 35, 30, 28];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 80, h = 32;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    h - ((p - min) / (max - min || 1)) * h,
  ]);
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <path d={d} fill="none" stroke={up ? '#467897' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AlternativeDataPanel({ filterTag }) {
  const items = filterTag
    ? PLACEHOLDERS.filter((p) => p.tags.includes(filterTag))
    : PLACEHOLDERS;

  if (items.length === 0) return null;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[#467897]" />
          <h3 className="text-sm font-semibold text-[var(--fg)]">Coming Soon</h3>
          <span className="px-1.5 py-0.5 text-[10px] bg-[#e7cd79]/10 border border-[#e7cd79]/30 text-[#e7cd79] rounded font-medium">
            ALPHA
          </span>
        </div>
        <button className="text-[10px] text-[#467897] hover:text-[var(--fg)] transition-colors flex items-center gap-1">
          Configure <ArrowRight size={10} />
        </button>
      </div>

      <p className="text-xs text-[var(--sub)] mb-4 leading-relaxed">
        Proprietary signal feeds will appear here once connected. Below are previews of planned integrations.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="group relative p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 hover:border-[var(--border2)] transition-all duration-200 overflow-hidden"
            >
              {/* Decorative glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 0% 0%, ${item.color}08 0%, transparent 60%)`,
                }}
              />

              <div className="relative">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: `${item.color}20`, border: `1px solid ${item.color}40` }}
                    >
                      <Icon size={12} style={{ color: item.color }} />
                    </div>
                    <span className="text-xs font-medium text-[var(--fg)] leading-tight">{item.title}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-px text-[9px] rounded font-medium"
                      style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-[var(--sub)] leading-relaxed mb-3">{item.desc}</p>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-base font-semibold font-mono text-[var(--fg)]/40">{item.mockValue}</div>
                    <div className={`text-[10px] font-medium ${item.mockUp ? 'text-[#467897]/60' : 'text-red-400/60'}`}>
                      {item.mockDelta}
                    </div>
                  </div>
                  <MockSparkline up={item.mockUp} />
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-[10px] text-[var(--muted)] italic">{item.badge}</span>
                  <button
                    className="text-[10px] px-2 py-0.5 rounded border transition-all"
                    style={{
                      borderColor: `${item.color}40`,
                      color: item.color,
                    }}
                  >
                    Request Access
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
