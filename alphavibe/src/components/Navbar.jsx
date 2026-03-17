import { NavLink } from 'react-router-dom';
import { TrendingUp, Bell, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Supply Chain',      to: '/supply-chain' },
  { label: 'Fundamentals',      to: '/fundamentals' },
  { label: 'Alternatives',      to: '/alternatives' },
  { label: 'Financial Analysis',to: '/financial-analysis' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#21262d] bg-[#0d1117]/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/fundamentals" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#467897]/20 border border-[#467897]/40">
            <TrendingUp size={16} className="text-[#467897]" />
          </div>
          <span className="text-[#e6edf3] font-semibold text-sm tracking-wide">
            Semi<span className="text-[#467897]">Research</span>
          </span>
        </NavLink>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors ${
                  isActive
                    ? 'bg-[#467897]/15 text-[#467897]'
                    : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Bell size={16} />
          </button>
          <button className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Settings size={16} />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#467897]/30 border border-[#467897]/50 flex items-center justify-center">
            <span className="text-[10px] text-[#467897] font-semibold">SR</span>
          </div>
        </div>
      </div>
    </header>
  );
}
