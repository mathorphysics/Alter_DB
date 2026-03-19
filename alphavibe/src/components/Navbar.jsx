import { NavLink } from 'react-router-dom';
import { TrendingUp, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { label: 'Supply Chain',      to: '/supply-chain' },
  { label: 'Fundamentals',      to: '/fundamentals' },
  { label: 'Alternatives',      to: '/alternatives' },
  { label: 'Financial Analysis',to: '/financial-analysis' },
];

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';

  return (
    <header
      className="sticky top-0 z-50 border-b border-[var(--border)] backdrop-blur-sm"
      style={{ backgroundColor: isLight ? 'rgba(246,248,250,0.95)' : 'rgba(13,17,23,0.95)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/fundamentals" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#467897]/20 border border-[#467897]/40">
            <TrendingUp size={16} className="text-[#467897]" />
          </div>
          <span className="text-[var(--fg)] font-semibold text-sm tracking-wide">
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
                    : 'text-[var(--sub)] hover:text-[var(--fg)] hover:bg-[var(--border)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-md transition-all hover:bg-[var(--border)]"
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{ color: 'var(--sub)' }}
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>
    </header>
  );
}
