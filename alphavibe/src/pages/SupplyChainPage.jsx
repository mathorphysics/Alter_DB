import { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Info } from 'lucide-react';
import { STAGES } from '../components/supplychain/data';
import StageColumn from '../components/supplychain/StageColumn';
import FlowConnector from '../components/supplychain/FlowConnector';
import AlternativeDataModal from '../components/supplychain/AlternativeDataModal';

export default function SupplyChainPage() {
  const [modalKey, setModalKey] = useState(null);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network size={15} className="text-[#467897]" />
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              Semiconductor Supply Chain
            </h2>
          </div>
          <p className="text-xs text-[#8b949e] max-w-xl leading-relaxed">
            End-to-end ecosystem — IP design to final package.
            Click any company card to load live fundamentals and alternative signals.
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-[10px] text-[#484f58] flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live pricing via OpenBB
        </div>
      </motion.div>

      {/* Flow legend strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22]/60 border border-[#21262d] overflow-x-auto"
      >
        {STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: stage.color }}
              />
              <span className="text-[10px] font-medium" style={{ color: stage.color }}>
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <span className="text-[#30363d] text-xs">→</span>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-[#484f58]">
          <Info size={9} />
          <span>Expand cards for Fundamental + Alt Data</span>
        </div>
      </motion.div>

      {/* Main flow — horizontal scroll */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex items-start min-w-max gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-start">
              <StageColumn stage={stage} index={i} onOpenModal={setModalKey} />
              {i < STAGES.length - 1 && (
                <FlowConnector
                  fromColor={stage.color}
                  toColor={STAGES[i + 1].color}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Alt Data modal — rendered at page level to avoid z-index issues */}
      <AlternativeDataModal
        open={modalKey === 'taiwan-equipment-imports'}
        onClose={() => setModalKey(null)}
      />
    </div>
  );
}
