import { GitBranch, Package, Truck, Factory } from 'lucide-react';

const PLACEHOLDERS = [
  {
    icon: Factory,
    title: 'Fab Capacity Tracker',
    desc: 'Wafer capacity by node (3nm, 5nm, 7nm) across TSMC, Samsung, Intel Foundry.',
    color: '#467897',
  },
  {
    icon: Package,
    title: 'Component Lead Times',
    desc: 'Real-time lead time data for passive components, MCUs, and power devices.',
    color: '#e7cd79',
  },
  {
    icon: Truck,
    title: 'Logistics & Freight Index',
    desc: 'Drewry WCI, air freight rates, and key lane spot pricing trends.',
    color: '#467897',
  },
  {
    icon: GitBranch,
    title: 'Supplier Dependency Map',
    desc: 'Single-source exposure and geographic concentration risk by tier.',
    color: '#e7cd79',
  },
];

export default function SupplyChainPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#e6edf3] mb-1">Supply Chain Intelligence</h2>
        <p className="text-sm text-[#8b949e]">
          Semiconductor supply chain visibility — capacity, lead times, logistics, and risk exposure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLACEHOLDERS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="p-5 bg-[#161b22] border border-[#21262d] rounded-lg hover:border-[#30363d] transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}18`, border: `1px solid ${item.color}35` }}
                >
                  <Icon size={15} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#e6edf3]">{item.title}</p>
                </div>
              </div>
              <p className="text-xs text-[#8b949e] leading-relaxed mb-4">{item.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#484f58] italic">Coming Soon</span>
                <button
                  className="text-[10px] px-2.5 py-1 rounded border transition-all hover:opacity-80"
                  style={{ borderColor: `${item.color}40`, color: item.color }}
                >
                  Request Access
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
