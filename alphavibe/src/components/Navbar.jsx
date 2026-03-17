import { TrendingUp, Bell, Settings, BarChart2 } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#21262d] bg-[#0d1117]/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#467897]/20 border border-[#467897]/40">
            <TrendingUp size={16} className="text-[#467897]" />
          </div>
          <span className="text-[#e6edf3] font-semibold text-sm tracking-wide">
            AlphaVibe <span className="text-[#467897]">Research</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6">
          {['Markets', 'Equities', 'Alternatives', 'Macro'].map((item) => (
            <button
              key={item}
              className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors font-medium tracking-wide"
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <BarChart2 size={16} />
          </button>
          <button className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Bell size={16} />
          </button>
          <button className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Settings size={16} />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#467897]/30 border border-[#467897]/50 flex items-center justify-center">
            <span className="text-[10px] text-[#467897] font-semibold">AV</span>
          </div>
        </div>
      </div>
    </header>
  );
}
