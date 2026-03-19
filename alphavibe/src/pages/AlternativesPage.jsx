import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import AlternativeDataPanel from '../components/AlternativeDataPanel';
import CustomsTradeChart from '../components/CustomsTradeChart';
import TsmcRevenueChart from '../components/TsmcRevenueChart';
import FablessInventoryChart from '../components/FablessInventoryChart';
import KoreaEquipmentChart from '../components/KoreaEquipmentChart';
import JapanMaterialsChart from '../components/JapanMaterialsChart';
import SamsungPatentChart from '../components/SamsungPatentChart';
import IntelEquipmentChart from '../components/IntelEquipmentChart';
import IntelChipsChart from '../components/IntelChipsChart';

const TAG_META = {
  TSMC:      { color: '#34d399' },
  Samsung:   { color: '#467897' },
  Intel:     { color: '#a78bfa' },
  Logistics: { color: '#fb923c' },
};

const LIVE_BLOCKS = [
  { id: 'tsmc-revenue',          tags: ['TSMC'],    Component: TsmcRevenueChart },
  { id: 'fabless-inventory',     tags: ['TSMC'],    Component: FablessInventoryChart },
  { id: 'customs-trade',         tags: ['TSMC'],    Component: CustomsTradeChart },
  { id: 'korea-equipment-inflow',   tags: ['Samsung'], Component: KoreaEquipmentChart },
  { id: 'japan-korea-materials',    tags: ['Samsung'], Component: JapanMaterialsChart },
  { id: 'samsung-patents',          tags: ['Samsung'], Component: SamsungPatentChart },
  { id: 'intel-oregon-equipment',   tags: ['Intel'],   Component: IntelEquipmentChart },
  { id: 'intel-chips-funding',      tags: ['Intel'],   Component: IntelChipsChart },
];

export default function AlternativesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get('tag');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [activeTag]);

  const visibleBlocks = activeTag
    ? LIVE_BLOCKS.filter((b) => b.tags.includes(activeTag))
    : LIVE_BLOCKS;

  const activeColor = activeTag ? (TAG_META[activeTag]?.color ?? '#467897') : null;

  return (
    <div className="space-y-6">
      {/* Header + tag filter pills */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-[#e6edf3] mb-1">Alternative Data</h2>
          <p className="text-sm text-[#8b949e]">
            Proprietary signal feeds — satellite imagery, customs flow, shipping chokepoints.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(TAG_META).map(([name, { color }]) => {
            const isActive = activeTag === name;
            return (
              <button
                key={name}
                onClick={() => setSearchParams(isActive ? {} : { tag: name })}
                className="px-2 py-0.5 text-[10px] rounded font-medium transition-all border"
                style={
                  isActive
                    ? { background: `${color}20`, color, borderColor: `${color}60` }
                    : { background: 'transparent', color: '#484f58', borderColor: '#21262d' }
                }
              >
                {name}
              </button>
            );
          })}
          {activeTag && (
            <button
              onClick={() => setSearchParams({})}
              className="px-2 py-0.5 text-[10px] rounded font-medium text-[#484f58] hover:text-[#8b949e] transition-colors border border-transparent"
            >
              × Clear
            </button>
          )}
        </div>
      </div>

      {/* Section header when a tag filter is active */}
      {activeTag && activeColor && (
        <div className="flex items-center gap-2 pb-2 border-b border-[#21262d]">
          <span
            className="px-2 py-0.5 text-[11px] rounded font-semibold border"
            style={{
              background: `${activeColor}15`,
              color: activeColor,
              borderColor: `${activeColor}40`,
            }}
          >
            {activeTag}
          </span>
          <span className="text-xs text-[#484f58]">
            {visibleBlocks.length} live signal{visibleBlocks.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Live chart blocks */}
      {visibleBlocks.map(({ id, Component }) => (
        <div key={id} id={id}>
          <Component />
        </div>
      ))}

      {/* Placeholder blocks — only show when not filtered */}
      {!activeTag && <AlternativeDataPanel />}
    </div>
  );
}
