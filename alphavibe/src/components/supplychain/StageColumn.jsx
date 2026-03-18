import { motion } from 'framer-motion';
import CompanyCard from './CompanyCard';

export default function StageColumn({ stage, index, onOpenModal, expandAll }) {
  const { label, subtitle, Icon, color, companies, altData } = stage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col w-[215px] flex-shrink-0"
    >
      {/* Column header */}
      <div
        className="rounded-xl p-3 mb-2.5 flex-shrink-0 relative overflow-hidden"
        style={{
          background: `${color}0d`,
          border: `1px solid ${color}28`,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Accent glow top-left */}
        <div
          className="absolute -top-6 -left-4 w-20 h-20 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: color }}
        />

        {/* Top bar */}
        <div
          className="h-px w-full rounded-full mb-3"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }}
        />

        <div className="relative flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}35` }}
          >
            <Icon size={13} style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#e6edf3] leading-tight">{label}</div>
            <div className="text-[9px] text-[#8b949e] leading-tight truncate">{subtitle}</div>
          </div>
        </div>

        <span
          className="relative text-[9px] font-semibold px-1.5 py-px rounded"
          style={{ background: `${color}18`, color }}
        >
          {companies.length} companies
        </span>
      </div>

      {/* Company cards */}
      <div className="space-y-1.5">
        {companies.map((company, i) => (
          <motion.div
            key={company.ticker}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 + i * 0.05 }}
          >
            <CompanyCard
              company={company}
              stageColor={color}
              altData={company.altData ?? altData}
              onOpenModal={onOpenModal}
              expandAll={expandAll}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
