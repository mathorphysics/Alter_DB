import { Cpu, Wrench, Factory, ScanSearch, Package } from 'lucide-react';

export const STAGES = [
  {
    id: 'designer',
    label: 'Designer',
    subtitle: '芯片设计 · IDM · IP',
    Icon: Cpu,
    color: '#e7cd79',
    companies: [
      { name: 'Nvidia',      ticker: 'NVDA',     desc: 'GPU 设计龙头',           flag: '🇺🇸', role: 'Fabless GPU' },
      { name: 'AMD',         ticker: 'AMD',      desc: 'CPU / GPU 设计',         flag: '🇺🇸', role: 'Fabless' },
      { name: 'onsemi',      ticker: 'ON',       desc: '汽车电源功率 IDM',        flag: '🇺🇸', role: 'Power IDM' },
      { name: 'Weebit Nano', ticker: 'WBT.AX',   desc: '先进 ReRAM 存储 IP',     flag: '🇦🇺', role: 'Memory IP' },
      { name: 'ARM',         ticker: 'ARM',      desc: '架构 IP 授权垄断',        flag: '🇬🇧', role: 'Arch IP' },
    ],
    altData: [
      { label: 'Tape-out Lead Time',  value: '18–24 mo',    delta: null },
      { label: 'EUV Dependency',      value: 'Critical',    delta: 'risk' },
      { label: 'AI Chip Rev Mix',     value: '~65% NVDA',   delta: 'up' },
    ],
  },
  {
    id: 'supplier',
    label: 'Supplier',
    subtitle: '设备 · 材料 · EDA',
    Icon: Wrench,
    color: '#467897',
    companies: [
      { name: 'ASML',             ticker: 'ASML',  desc: '光刻机垄断供应商',     flag: '🇳🇱', role: 'Lithography' },
      { name: 'Applied Materials', ticker: 'AMAT',  desc: '沉积与刻蚀设备',       flag: '🇺🇸', role: 'Deposition' },
      { name: 'Lam Research',     ticker: 'LRCX',  desc: '刻蚀设备巨头',         flag: '🇺🇸', role: 'Etch' },
      { name: 'Shin-Etsu',        ticker: 'SHECY', desc: '硅片材料领导者',        flag: '🇯🇵', role: 'Materials' },
      { name: 'Synopsys',         ticker: 'SNPS',  desc: 'EDA 软件领导者',       flag: '🇺🇸', role: 'EDA' },
    ],
    altData: [
      { label: 'EUV Tool Backlog',   value: '2+ years', delta: 'risk' },
      { label: 'Si Wafer Lead Time', value: '14–16 wks', delta: null },
      { label: 'Export Control Risk',value: 'High',     delta: 'risk' },
    ],
  },
  {
    id: 'frontend',
    label: 'Frontend Mfg',
    subtitle: '晶圆代工 · 前端制造',
    Icon: Factory,
    color: '#34d399',
    companies: [
      {
        name: 'TSMC', ticker: 'TSM', desc: '纯代工龙头，2nm 领先', flag: '🇹🇼', role: 'Pure-Play',
        altData: [
          { label: 'Monthly Revenue',          value: 'View Chart →', delta: null, link: '/alternatives?tag=TSMC#tsmc-revenue' },
          { label: 'Equipment Imports (TW)',   value: 'View Chart →', delta: null, link: '/alternatives?tag=TSMC#customs-trade' },
          { label: 'Fabless Inventory Index',  value: 'View Chart →', delta: null, link: '/alternatives?tag=TSMC#fabless-inventory' },
        ],
      },
      {
        name: 'Samsung Foundry', ticker: '005930.KS', desc: '2nm GAA 竞争者', flag: '🇰🇷', role: 'IDM Foundry',
        altData: [
          { label: 'Equipment Inflow (KR)',  value: 'View Chart →', delta: null, link: '/alternatives?tag=Samsung#korea-equipment-inflow' },
          { label: 'JP Materials Flow (KR)', value: 'View Chart →', delta: null, link: '/alternatives?tag=Samsung#japan-korea-materials' },
          { label: 'Patent Filing Trend',    value: 'View Chart →', delta: null, link: '/alternatives?tag=Samsung#samsung-patents' },
        ],
      },
      {
        name: 'Intel IFS', ticker: 'INTC', desc: '英特尔代工服务', flag: '🇺🇸', role: 'IDM Foundry',
        altData: [
          { label: 'ASML Equipment Inflow (OR)', value: 'View Chart →', delta: null, link: '/alternatives?tag=Intel#intel-oregon-equipment' },
          { label: 'CHIPS Act Funding',          value: 'View Chart →', delta: null, link: '/alternatives?tag=Intel#intel-chips-funding' },
        ],
      },
      {
        name: 'SMIC', ticker: '0981.HK', desc: '中国最先进代工厂', flag: '🇨🇳', role: 'Mature Node',
        altData: [
          { label: 'US/JP Equipment → CN', value: 'View Chart →', delta: null, link: '/alternatives?tag=SMIC#smic-trade' },
        ],
      },
      { name: 'GlobalFoundries', ticker: 'GFS',      desc: '特色工艺代工',          flag: '🇺🇸', role: 'Specialty' },
    ],
    altData: [
      { label: 'Taiwan Strait Vessels', value: 'Live →',       delta: null },
      { label: 'Fab Utilization (est)', value: '82%',          delta: 'up' },
      { label: 'CoWoS Capacity',        value: 'Constrained',  delta: 'risk' },
    ],
  },
  {
    id: 'inspection',
    label: 'Wafer Inspection',
    subtitle: '量测 · 缺陷检测 · ATE',
    Icon: ScanSearch,
    color: '#a78bfa',
    companies: [
      { name: 'KLA',            ticker: 'KLAC',  desc: '光学检测绝对龙头',   flag: '🇺🇸', role: 'Process Ctrl' },
      { name: 'Onto Innovation',ticker: 'ONTO',  desc: '缺陷检测专家',       flag: '🇺🇸', role: 'Defect' },
      { name: 'Nova',           ticker: 'NVMI',  desc: '薄膜量测设备',       flag: '🇮🇱', role: 'Metrology' },
      { name: 'Advantest',      ticker: 'ATEYY', desc: '自动测试设备 ATE',    flag: '🇯🇵', role: 'ATE' },
      { name: 'Teradyne',       ticker: 'TER',   desc: 'ATE 及协作机器人',   flag: '🇺🇸', role: 'ATE' },
    ],
    altData: [
      { label: 'Process Ctrl % WFE', value: '~15%',      delta: 'up' },
      { label: 'AI Chip Test Demand',value: 'Surging',   delta: 'up' },
      { label: 'Yield Improvement',  value: '+3.2pp YoY',delta: 'up' },
    ],
  },
  {
    id: 'osat',
    label: 'OSAT',
    subtitle: '后端封测 · 先进封装',
    Icon: Package,
    color: '#fb923c',
    companies: [
      { name: 'ASE Group', ticker: 'ASX',   desc: '封测全球龙头',     flag: '🇹🇼', role: 'OSAT #1' },
      { name: 'Amkor',     ticker: 'AMKR',  desc: '美系封测巨头',     flag: '🇺🇸', role: 'OSAT' },
      { name: 'JCET',      ticker: 'JEVTY', desc: '中国最大封测商',   flag: '🇨🇳', role: 'OSAT' },
      { name: 'PTI',       ticker: 'PIIMF', desc: '存储封测专家',     flag: '🇹🇼', role: 'Memory OSAT' },
    ],
    altData: [
      { label: 'HBM Demand YoY',      value: '+156%',       delta: 'up' },
      { label: 'Busan Port Containers',value: 'Live →',      delta: null },
      { label: 'Adv Pkg Rev Mix',      value: '~30%',        delta: 'up' },
    ],
  },
];
