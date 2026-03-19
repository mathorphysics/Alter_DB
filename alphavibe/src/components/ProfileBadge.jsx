import { Building2, BarChart2, Globe, ChevronRight } from 'lucide-react';

export default function ProfileBadge({ profile }) {
  if (!profile) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-bold text-[var(--fg)] font-mono">{profile.symbol}</span>
          <ChevronRight size={14} className="text-[var(--muted)]" />
          <span className="text-sm text-[var(--sub)] truncate">{profile.name}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-[var(--sub)]">
          {profile.sector && (
            <span className="flex items-center gap-1">
              <Building2 size={10} className="text-[#467897]" />
              {profile.sector}
            </span>
          )}
          {profile.industry_category && (
            <span className="flex items-center gap-1">
              <BarChart2 size={10} className="text-[#467897]" />
              {profile.industry_category}
            </span>
          )}
          {profile.hq_country && (
            <span className="flex items-center gap-1">
              <Globe size={10} className="text-[#467897]" />
              {profile.hq_country}
            </span>
          )}
          {profile.stock_exchange && (
            <span className="px-1.5 py-0.5 bg-[#467897]/10 border border-[#467897]/30 text-[#467897] rounded text-[10px] font-medium">
              {profile.stock_exchange}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
