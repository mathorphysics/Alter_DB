import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function FlowConnector({ fromColor, toColor }) {
  return (
    <div className="flex-shrink-0 w-7 flex flex-col items-center justify-start pt-[38px]">
      <div className="flex flex-col items-center gap-0.5">
        {/* top line */}
        <div
          className="w-px h-4 rounded-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${fromColor}60)` }}
        />

        {/* animated arrow */}
        <motion.div
          animate={{ y: [0, 2, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronRight size={13} style={{ color: `${toColor}90` }} />
        </motion.div>

        {/* bottom line */}
        <div
          className="w-px h-4 rounded-full"
          style={{ background: `linear-gradient(to bottom, ${toColor}60, transparent)` }}
        />
      </div>
    </div>
  );
}
