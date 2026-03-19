import { useState } from 'react';
import { Search, Command } from 'lucide-react';

export default function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('');

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      onSearch(value.trim().toUpperCase());
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="text-xs text-[var(--sub)] text-center mb-3 tracking-widest uppercase font-medium">
        Equity Research Terminal
      </p>
      <div className="relative group">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#467897] pointer-events-none"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker — TSM, ON, NVDA, AAPL..."
          disabled={loading}
          className="
            w-full pl-11 pr-24 py-3.5
            bg-[var(--surface)] border border-[var(--border)]
            rounded-lg text-sm text-[var(--fg)]
            placeholder:text-[var(--muted)]
            focus:outline-none focus:border-[#467897] focus:ring-1 focus:ring-[#467897]/30
            group-hover:border-[var(--border2)]
            transition-all duration-200
            disabled:opacity-50
          "
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--muted)]">
          {loading ? (
            <div className="w-4 h-4 border-2 border-[#467897]/30 border-t-[#467897] rounded-full animate-spin" />
          ) : (
            <>
              <Command size={10} />
              <span className="text-[10px] font-mono">Enter</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
