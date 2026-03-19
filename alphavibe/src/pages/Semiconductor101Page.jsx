import { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

function P({ children }) {
  return <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--sub)' }}>{children}</p>;
}
function H({ children }) {
  return <h4 className="text-[13px] font-semibold mt-5 mb-2" style={{ color: 'var(--fg)' }}>{children}</h4>;
}
function Ul({ items }) {
  return (
    <ul className="space-y-1.5 mb-3 pl-4">
      {items.map((item, i) => (
        <li key={i} className="text-[13px] leading-relaxed list-disc" style={{ color: 'var(--sub)' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}
function Note({ children }) {
  return (
    <div className="mt-4 px-4 py-3 rounded-md border-l-2 border-[#467897] text-[12px] leading-relaxed"
         style={{ background: '#46789710', color: 'var(--muted)' }}>
      {children}
    </div>
  );
}

// ── Chapters ─────────────────────────────────────────────────────────────────

const CHAPTERS = [
  {
    id: 1,
    title: 'Semiconductor Basics',
    content: (
      <>
        <P>At its core, the foundation of electronics relies on the flow of electricity, where a charge difference creates voltage.</P>
        <H>What is a Semiconductor?</H>
        <P>A semiconductor is a material with electrical conductivity that falls between a conductor and an insulator. The magic of electronic technology lies in our ability to control when a semiconductor conducts electricity and when it acts as an insulator.</P>
        <H>The Transistor</H>
        <P>Think of a transistor as a microscopic switch that can either block or allow electrical current to pass. By arranging billions of these tiny switches into complex patterns, we can guide the current along specific paths to perform a series of useful computations.</P>
        <H>The PPAC Metric</H>
        <P>In the semiconductor industry, progress is driven by four key metrics known as PPAC:</P>
        <Ul items={[
          'Power (W) — achieving the lowest power consumption',
          'Area (nm) — the smallest possible chip footprint',
          'Performance (Hz) — the highest operating frequency',
          'Cost — the lowest manufacturing cost per chip',
        ]} />
        <H>Evolution of Transistors</H>
        <Ul items={[
          'MOSFET: consists of a Source, Drain, and Gate. Operates using n-type (electrons) and p-type (holes) configurations.',
          'FinFET: the Source and Drain are raised into a "fin" shape, allowing the Gate to surround the channel on three sides. Better control, less leakage.',
          'GAA (Gate-All-Around): the Gate completely surrounds the channel on all sides, providing even stronger control and higher power efficiency.',
        ]} />
        <H>Logic Gates</H>
        <P>The fundamental building blocks of digital circuits, composed of at least two transistors working together. By combining millions of logic gates, a chip can execute complex instructions.</P>
        <Note>Silicon (Si) is the most widely used semiconductor material because it is abundant, has a useful bandgap, and forms a stable oxide (SiO₂) that is essential for transistor fabrication.</Note>
      </>
    ),
  },
  {
    id: 2,
    title: 'Building the System',
    content: (
      <>
        <P>A single chip doesn't work alone. It goes through a hierarchy to become a functional product: IC (Integrated Circuit) → Packaging → PCB (Printed Circuit Board) → Final System.</P>
        <H>System Architecture</H>
        <P>Everything starts from the demand side. Architects evaluate market and customer needs to define what the chip must do.</P>
        <H>Front-End Design</H>
        <P>Engineers write the logical code for the chip using Hardware Description Languages (HDL) such as Verilog or VHDL (RTL level).</P>
        <H>Design Verification</H>
        <P>A massive undertaking, often consuming up to 56% of total labor time.</P>
        <Ul items={[
          'Functional Verification: using methodologies like UVM to build a model for each part, comparing output with the design to ensure correct behavior.',
          'Supplemental Verification: using FPGAs to download the RTL code onto actual hardware to see how it runs in reality.',
          'Formal Verification: a mathematical proof of the design. Usually reserved for high-end applications due to complexity.',
        ]} />
        <H>Physical Design</H>
        <P>Converts the HDL code into actual physical transistors and wires. Involves generating a Netlist, floorplanning, placement, and routing. Also includes CTS (Clock Tree Synthesis) and STA (Static Timing Analysis) to ensure all logic paths meet timing constraints.</P>
        <H>Back-End Verification & Tapeout</H>
        <P>Ensuring the design is ready for manufacturing. The final output is a GDSII file (RTL-to-GDS), which contains all the geometric data needed by the foundry to physically print the chip.</P>
        <Note>Design verification is so critical that hardware emulators — essentially giant boxes of FPGAs — are used to test ASIC designs before spending millions on actual manufacturing.</Note>
      </>
    ),
  },
  {
    id: 3,
    title: 'Semiconductor Manufacturing',
    content: (
      <>
        <P>This is where the GDS file becomes physical reality. Foundries continuously push the limits, moving from 5nm nodes down to 2nm and beyond.</P>
        <H>Front-End Manufacturing (FEOL)</H>
        <P>The foundation is a silicon wafer — a thin slice of semiconductor material upon which countless chips are built. Starting from Silicon Dioxide (SiO₂) and Carbon, purified into a Silicon Ingot, then sliced into wafers. Four steps cycle repeatedly:</P>
        <Ul items={[
          'Deposition: adding thin films of material to the wafer surface (ALD, MBE, PVD, ECD)',
          'Lithography: applying photoresist, aligning a photomask, and projecting light to pattern the surface. Requires EUV light (13.5nm wavelength) for advanced nodes.',
          'Etching/Removal: removing specific material to create physical structures (Wet Etching, Dry Etching, CMP)',
          'Property Modification: changing electrical properties of silicon (Doping, RTA, UV processing)',
        ]} />
        <H>Back End of Line (BEOL)</H>
        <P>Once transistors are formed, BEOL processes use dielectric materials to insulate metal interconnect layers, wiring all logic gates and circuits together with copper.</P>
        <H>Wafer Inspection & Testing</H>
        <Ul items={[
          'Wafer Inspectors: optical and electron beam machines scan for defects at nm scale',
          'Parametric Testing: test structures in the scribe lines between chips measure process baseline',
          'Wafer Sort: measure actual performance of each die on the wafer',
        ]} />
        <H>Back-End Manufacturing (OSAT)</H>
        <P>Outsourced Semiconductor Assembly and Test: Wafer Bumping → Wafer Dicing → Die Attach → Flip Chip/Wire Bonding → Packaging → Final Testing.</P>
        <Note>A modern chip may require over 75 different photomasks and hundreds of process steps. Front-end manufacturing equipment accounts for roughly 80% of all capital equipment spending in the industry.</Note>
      </>
    ),
  },
  {
    id: 4,
    title: 'Connecting the System Together',
    content: (
      <>
        <P>Connecting different components together to communicate is known as I/O (Input/Output). How chips are packaged and wired together determines the final system's performance, power, and cost.</P>
        <H>IC Packaging Types</H>
        <Ul items={[
          'Wire Bonding: connects the chip to the package frame using tiny gold or copper wires. Simple but limits total I/O count.',
          'Flip Chip & BGA: the chip is flipped upside down; solder bumps connect directly to the substrate, enabling massively increased I/O density.',
          'Multi-Chip Integration (MCM, SiP): packs multiple chips into one package, mixing cheap older processes for analog with advanced nodes for critical logic.',
        ]} />
        <H>Advanced Packaging</H>
        <Ul items={[
          '3D Memory Stacking: uses TSV (Through-Silicon Vias) to stack dies vertically — the basis of HBM.',
          '2.5D Integration (CoWoS): chips sit side-by-side on a silicon interposer for ultra-dense die-to-die interconnects.',
          'Copper-to-Copper hybrid bonding: new innovation enabling both horizontal and vertical integration at fine pitch.',
          'WLCSP (Wafer-Level Chip Scale Packaging): packaging before dicing — ideal for very small chips like RF and sensors.',
        ]} />
        <H>Bus Interfaces</H>
        <P>A bus is the physical set of wires responsible for data transmission between parts of a system. Modern buses transmit 8 to 64 bits simultaneously.</P>
        <Ul items={[
          'Parallel: transmits multiple bits at once (D0–D7). Fast in concept but suffers signal integrity issues over distance.',
          'Serial: transmits one bit at a time at very high speed (PCIe, USB, SATA). Has largely won out in modern architecture due to reliability.',
        ]} />
        <H>Power Delivery Network (PDN)</H>
        <P>How electronics receive power: Battery → DC Power Converter → PDN → CPU and other processors. Tight component packing can cause parasitic interference between power domains.</P>
        <Note>TSMC's CoWoS platform is used in NVIDIA H100/H200, AMD MI300, and Apple M-series chips. It enables the extreme memory bandwidth required for modern AI workloads.</Note>
      </>
    ),
  },
  {
    id: 5,
    title: 'Common Circuit and System Components',
    content: (
      <>
        <P>Electronic systems are divided into two primary domains: Digital (1s and 0s) for storage and computation, and Analog (continuous signals) for receiving real-world information. ADC and DAC converters bridge the two worlds.</P>
        <P>These components serve six major end-markets: Communication, Computing, Consumer, Automotive, Government, and Industrial Electronics.</P>
        <H>Digital — Microcomponents</H>
        <Ul items={[
          'Microprocessor (MPU): highly complex digital circuits — your computer\'s CPU.',
          'Microcontroller (MCU): simpler, plug-and-play compute for dedicated tasks.',
          'DSP (Digital Signal Processor): ultra-fast processing of ADC-converted analog data before sending back through a DAC.',
        ]} />
        <H>Digital — Logic & Compute</H>
        <Ul items={[
          'ASSP: designed for a specific market but sold to many product manufacturers.',
          'ASIC: custom-designed for one single use-case in a single system (e.g., Google\'s TPU).',
          'CPU: the generalist main processor; excels at executing a wide variety of tasks serially.',
          'GPU: built for massive parallel calculations — autonomous driving, HPC, machine learning, AI.',
          'FPGA: programmable hardware that can be reconfigured in minutes. Hardware emulators are giant boxes of FPGAs.',
          'SoC (System on Chip): integrates MPU, MCU, DSP, Memory, and accelerators all in one die.',
        ]} />
        <H>Digital — Memory</H>
        <Ul items={[
          'Volatile (RAM): requires power to hold data; very fast. Includes DRAM (main memory) and SRAM (CPU cache).',
          'Non-Volatile (Storage): retains data without power. Includes NAND Flash (SSDs, smartphones) and NOR Flash (firmware).',
        ]} />
        <H>Analog & Mixed-Signal (OSD)</H>
        <P>OSD stands for Optoelectronics, Sensors, and Discrete components.</P>
        <Ul items={[
          'Sensors: convert physical phenomena into electrical signals.',
          'Actuators: convert electrical signals back into physical movement or output.',
          'MEMS: microscopic physical structures (gears, levers, cantilevers) operating at the micron scale.',
          'PMICs (Power Management ICs): ensure every component receives the exact right voltage.',
        ]} />
        <Note>Discrete components account for a large share of semiconductor unit volume even though they are low in value. PMICs are found in virtually every electronic device.</Note>
      </>
    ),
  },
  {
    id: 6,
    title: 'Radio Frequency (RF) and Wireless Technology',
    content: (
      <>
        <P>RF signals are analog "wave" signals. Wireless signals exist across a vast spectrum of intensities and frequencies known as the Electromagnetic Spectrum. Regulatory bodies set strict standards on which frequency ranges specific technologies can use to avoid interference.</P>
        <H>The RF Signal Chain</H>
        <P>Power Source → Oscillator → Modulator → Amplifier → Antenna → Filter</P>
        <H>The OSI Model</H>
        <P>Describes the system layers connecting physical hardware to the software interface you interact with. Designed to facilitate communication between entirely different devices across seven layers from Physical up to Application.</P>
        <H>DSP in Telecom</H>
        <P>DSPs use limited frequency bandwidth to pack and send maximum information from point A to point B. Two key multiple-access techniques:</P>
        <Ul items={[
          'TDMA (Time Division Multiple Access): chops data into "conversation blocks" quickly, even with slight gaps in reception.',
          'CDMA (Code Division Multiple Access): sends data from many senders to many receivers simultaneously across the same frequency, using complex DSP algorithms to ensure integrity.',
        ]} />
        <H>Evolution from 1G to 5G</H>
        <Ul items={[
          '1G: analog voice only',
          '2G: digital voice, SMS (GSM/CDMA)',
          '3G: mobile data, early internet (~2 Mbps)',
          '4G LTE: broadband mobile internet (~100 Mbps), enabled smartphones as we know them',
          '5G: ultra-low latency, massive IoT, mmWave for >1 Gbps speeds',
        ]} />
        <Note>The evolution from 1G to 5G yielded exponential improvements in data transmission speeds — which is what made modern Cloud Computing (AWS, Google Cloud, Azure) possible.</Note>
      </>
    ),
  },
  {
    id: 7,
    title: 'System Architecture and Integration',
    content: (
      <>
        <P>System architecture describes how a computer system is organized and how its components interact. At the heart of this is the Instruction Set Architecture (ISA).</P>
        <H>What is an ISA?</H>
        <P>An ISA defines the "grammar" — the specific set of operations a CPU can execute and how they are encoded. By having a standard ISA (like Intel x86 or ARM), hardware designers maintain cross-system compatibility, allowing software to run on different devices.</P>
        <H>Microarchitecture</H>
        <P>Describes the specific hardware implementation of a given ISA. Two CPUs can share the same ISA but have completely different microarchitectures with different performance and power profiles.</P>
        <H>CISC vs. RISC</H>
        <Ul items={[
          'CISC (Complex Instruction Set Computer): instructions may take multiple clock cycles. Makes software coding lighter but hardware very complex (e.g., x86 / Intel, AMD).',
          'RISC (Reduced Instruction Set Computer): breaks instructions into smaller pieces that execute one per clock cycle. Better power efficiency, easier for compilers (e.g., ARM, RISC-V).',
        ]} />
        <H>The Future: Moving Beyond Moore\'s Law</H>
        <P>Geometric scaling (making transistors smaller) is hitting three fundamental walls:</P>
        <Ul items={[
          'Power Management: denser logic generates heat that can burn out circuits.',
          'Lithography Limits: finding shorter wavelengths of light to etch finer features is increasingly difficult.',
          'Physical Limits: materials are now just a few atoms thick; quantum tunneling causes electrons to leak.',
        ]} />
        <H>Heterogeneous Integration</H>
        <P>The industry has shifted from purely geometric scaling to functional scaling — optimizing application-specific designs and embracing heterogeneous integration (chiplets, advanced packaging) to continue driving performance forward.</P>
        <Note>Intel's 1971 4004 processor had 2,300 transistors at 10µm. Apple's M4 has approximately 28 billion transistors at 3nm — a 12-million-fold increase in transistor count over five decades.</Note>
      </>
    ),
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function Semiconductor101Page() {
  const [activeIdx, setActiveIdx] = useState(0);

  const chapter = CHAPTERS[activeIdx];
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < CHAPTERS.length - 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="text-[#467897]" />
        <h2 className="text-base font-semibold text-[var(--fg)]">Semiconductor 101</h2>
        <span className="text-[11px] text-[var(--muted)] ml-1">
          {activeIdx + 1} / {CHAPTERS.length}
        </span>
      </div>

      {/* Body */}
      <div className="flex gap-0 border border-[var(--border)] rounded-lg overflow-hidden"
           style={{ minHeight: 520 }}>

        {/* ── Tab list (left) ── */}
        <div className="w-56 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto"
             style={{ background: 'var(--surface)' }}>
          {CHAPTERS.map((ch, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveIdx(i)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-[var(--border)] last:border-b-0"
                style={
                  isActive
                    ? { background: '#46789715', borderLeft: '2px solid #467897' }
                    : { background: 'transparent', borderLeft: '2px solid transparent' }
                }
              >
                <span
                  className="text-[10px] font-mono font-bold mt-px flex-shrink-0"
                  style={{ color: isActive ? '#467897' : 'var(--muted)' }}
                >
                  {String(ch.id).padStart(2, '0')}
                </span>
                <span
                  className="text-[12px] leading-snug"
                  style={{ color: isActive ? 'var(--fg)' : 'var(--sub)' }}
                >
                  {ch.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Content area (right) ── */}
        <div className="flex-1 flex flex-col" style={{ background: 'var(--bg)' }}>
          {/* Chapter heading */}
          <div className="px-8 py-6 border-b border-[var(--border)]">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">
              Chapter {chapter.id}
            </div>
            <h3 className="text-xl font-bold text-[var(--fg)]">{chapter.title}</h3>
          </div>

          {/* Chapter content */}
          <div className="flex-1 px-8 py-6 overflow-y-auto" style={{ maxHeight: 420 }}>
            {chapter.content}
          </div>

          {/* Prev / Next */}
          <div className="px-8 py-4 border-t border-[var(--border)] flex items-center justify-between">
            <button
              onClick={() => hasPrev && setActiveIdx(activeIdx - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-30"
              style={hasPrev
                ? { background: 'var(--surface)', color: 'var(--sub)', border: '1px solid var(--border)' }
                : { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' }}
            >
              <ChevronLeft size={13} />
              {hasPrev ? CHAPTERS[activeIdx - 1].title : 'Previous'}
            </button>

            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {CHAPTERS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className="rounded-full transition-all"
                  style={{
                    width:  i === activeIdx ? 16 : 6,
                    height: 6,
                    background: i === activeIdx ? '#467897' : 'var(--border)',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => hasNext && setActiveIdx(activeIdx + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-30"
              style={hasNext
                ? { background: 'var(--surface)', color: 'var(--sub)', border: '1px solid var(--border)' }
                : { background: 'transparent', color: 'var(--muted)', border: '1px solid transparent' }}
            >
              {hasNext ? CHAPTERS[activeIdx + 1].title : 'Next'}
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
