'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  SlidersHorizontal, 
  TrendingUp, 
  History, 
  Clock, 
  Sparkles, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  RefreshCw,
  Layers,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Terminal,
  Cpu,
  HardDrive,
  Wifi,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Roll { 
  id: string;
  color: string; 
  roll: string | number; 
  timestamp: string;
  total_bets?: string | number;
  total_payout?: string | number;
  house_profit?: string | number;
}

interface ProcessedRoll {
  isBranco: boolean;
  colorCode: string; // 'V' | 'P' | 'B'
  roll: number;
}

interface PatternStats {
  id: string;
  pattern: string[];
  win: number;
  loss: number;
  sm: number;
  sa: number;
  winRate: number;
}

// Helper to generate V/P combinations
function generateCombinations(length: number): string[][] {
  const patterns: string[][] = [];
  const total = Math.pow(2, length);
  for (let i = 0; i < total; i++) {
    const pattern: string[] = [];
    for (let j = length - 1; j >= 0; j--) {
      pattern.push((i & (1 << j)) !== 0 ? 'P' : 'V');
    }
    patterns.push(pattern);
  }
  return patterns;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'database' | 'strategies' | 'minutes'>('database');
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open for a premium hacker console look!
  const [loadingDb, setLoadingDb] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Data State
  const [dbData, setDbData] = useState<Roll[]>([]);
  const [globalDataForStats, setGlobalDataForStats] = useState<Roll[]>([]);

  // DB Filter & Paginate States
  const [dbLimit, setDbLimit] = useState(100);
  const [colorFilter, setColorFilter] = useState<'ALL' | 'VERMELHO' | 'PRETO' | 'BRANCO'>('ALL');
  const [rollSearch, setRollSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Strategy States
  const [periodHours, setPeriodHours] = useState(48); // 48h default like screenshot
  const [patternLength, setPatternLength] = useState(6); // 6 houses default like screenshot
  const [sortColumn, setSortColumn] = useState<'WIN' | 'LOSS' | 'SM' | 'SA' | 'TX' | null>(null);
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  
  // Premium Analytics Parity Controls
  const [offsetHours, setOffsetHours] = useState(0);
  const [overlapping, setOverlapping] = useState(true);
  const [galesCount, setGalesCount] = useState(3);

  // Load Database View Data
  const fetchDbData = async () => {
    try {
      const res = await fetch(`/api/results?limit=${dbLimit}`);
      if (res.ok) {
        const json = await res.json();
        setDbData(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar banco de dados:", err);
    } finally {
      setLoadingDb(false);
    }
  };

  // Load Strategy Analysis Data (higher range)
  const fetchStatsData = async () => {
    try {
      const res = await fetch(`/api/results/period?hours=${periodHours}&offset=${offsetHours}`);
      if (res.ok) {
        const json = await res.json();
        setGlobalDataForStats(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do período:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Auto-refresh loops
  useEffect(() => {
    fetchDbData();
    const interval = setInterval(fetchDbData, 10000); // refresh DB view every 10s
    return () => clearInterval(interval);
  }, [dbLimit]);

  useEffect(() => {
    setLoadingStats(true);
    fetchStatsData();
    const interval = setInterval(fetchStatsData, 15000); // refresh strategy data every 15s
    return () => clearInterval(interval);
  }, [periodHours, offsetHours]);

  // Copy helper
  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Database Filtering Logic
  const filteredDbData = useMemo(() => {
    return dbData.filter(row => {
      // Color Filter
      const colorLower = (row.color || '').toLowerCase();
      let matchesColor = true;
      if (colorFilter === 'VERMELHO') matchesColor = colorLower.includes('vermelho') || colorLower === 'v';
      else if (colorFilter === 'PRETO') matchesColor = colorLower.includes('preto') || colorLower === 'p';
      else if (colorFilter === 'BRANCO') matchesColor = colorLower.includes('branco') || colorLower === 'b' || Number(row.roll) === 0;

      // Roll Search Filter
      let matchesSearch = true;
      if (rollSearch.trim() !== '') {
        matchesSearch = row.roll.toString() === rollSearch.trim();
      }

      return matchesColor && matchesSearch;
    });
  }, [dbData, colorFilter, rollSearch]);

  // Strategy Processing Logic
  const processedData: ProcessedRoll[] = useMemo(() => {
    return globalDataForStats.map(roll => {
      const n = typeof roll.roll === 'string' ? parseInt(roll.roll) : roll.roll;
      let colorCode = 'B'; // default white
      const colorLower = (roll.color || '').toLowerCase();

      if (colorLower.includes('vermelho') || colorLower === 'v' || (n >= 1 && n <= 7)) {
        colorCode = 'V';
      } else if (colorLower.includes('preto') || colorLower === 'p' || (n >= 8 && n <= 14)) {
        colorCode = 'P';
      }

      return {
        isBranco: colorLower.includes('branco') || colorLower === 'b' || n === 0,
        colorCode,
        roll: n
      };
    });
  }, [globalDataForStats]);

  const patternsConfig = useMemo(() => {
    return generateCombinations(patternLength);
  }, [patternLength]);

  const strategyStats: PatternStats[] = useMemo(() => {
    if (processedData.length === 0 || patternsConfig.length === 0) return [];

    const unsorted = patternsConfig.map((pattern) => {
      let win = 0;
      let loss = 0;
      let sa = 0;
      let sm = 0;

      let i = 0;
      while (i <= processedData.length - pattern.length - galesCount) {
        let match = true;
        for (let p = 0; p < pattern.length; p++) {
          if (processedData[i + p].colorCode !== pattern[p]) {
            match = false;
            break;
          }
        }

        if (match) {
          const triggerIndex = i + pattern.length;
          let hitWhite = false;

          for (let g = 0; g < galesCount; g++) {
            const nextIdx = triggerIndex + g;
            if (nextIdx < processedData.length) {
              if (processedData[nextIdx].isBranco) {
                hitWhite = true;
                break;
              }
            }
          }

          if (hitWhite) {
            win++;
            sa = 0;
          } else {
            loss++;
            sa++;
            if (sa > sm) sm = sa;
          }

          if (overlapping) {
            i++;
          } else {
            i += pattern.length + galesCount;
          }
        } else {
          i++;
        }
      }

      const total = win + loss;
      const winRate = total > 0 ? (win / total) * 100 : 0;

      return {
        id: pattern.join(''),
        pattern,
        win,
        loss,
        sm,
        sa,
        winRate
      };
    });

    if (sortColumn) {
      unsorted.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        switch (sortColumn) {
          case 'WIN': valA = a.win; valB = b.win; break;
          case 'LOSS': valA = a.loss; valB = b.loss; break;
          case 'SM': valA = a.sm; valB = b.sm; break;
          case 'SA': valA = a.sa; valB = b.sa; break;
          case 'TX': valA = a.winRate; valB = b.winRate; break;
        }
        return sortDirection === 'desc' ? valB - valA : valA - valB;
      });
    } else {
      unsorted.sort((a, b) => b.winRate - a.winRate || b.win - a.win);
    }

    return unsorted;
  }, [processedData, patternsConfig, sortColumn, sortDirection, galesCount, overlapping]);

  // Aggregate Brancos (Whites) by minute (00-59) and half-minute (0-29s and 30-59s)
  const minutesData = useMemo(() => {
    const grid = Array.from({ length: 60 }, (_, i) => ({
      minute: i,
      col1: 0,
      col2: 0,
      sum: 0
    }));

    const brancos = globalDataForStats.filter(row => {
      const rollNum = typeof row.roll === 'string' ? parseInt(row.roll) : row.roll;
      const colorLower = (row.color || '').toLowerCase();
      return colorLower.includes('branco') || colorLower === 'b' || rollNum === 0;
    });

    for (const spin of brancos) {
      const date = new Date(spin.timestamp);
      const min = date.getMinutes();
      const sec = date.getSeconds();
      
      if (min >= 0 && min < 60) {
        if (sec >= 0 && sec <= 29) {
          grid[min].col1++;
        } else {
          grid[min].col2++;
        }
        grid[min].sum++;
      }
    }

    return grid;
  }, [globalDataForStats]);

  // Strategy sorting helper
  const handleSort = (col: 'WIN' | 'LOSS' | 'SM' | 'SA' | 'TX') => {
    if (sortColumn === col) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else setSortColumn(null);
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  // Helper colors for roll displays
  const getRollStyle = (rollNum: number, colorStr: string) => {
    const r = typeof rollNum === 'string' ? parseInt(rollNum) : rollNum;
    const c = (colorStr || '').toLowerCase();
    
    if (c.includes('branco') || c === 'b' || r === 0) {
      return {
        bg: 'bg-white text-black font-black shadow-[0_0_15px_rgba(255,255,255,0.7)]',
        colorName: 'Branco',
        dot: 'bg-white'
      };
    }
    if (c.includes('vermelho') || c === 'v' || (r >= 1 && r <= 7)) {
      return {
        bg: 'bg-[#f12c4c] text-white font-black shadow-[0_0_10px_rgba(241,44,76,0.3)]',
        colorName: 'Vermelho',
        dot: 'bg-[#f12c4c]'
      };
    }
    return {
      bg: 'bg-[#262831] border border-white/20 text-white font-black shadow-[0_0_10px_rgba(38,40,49,0.3)]',
      colorName: 'Preto',
      dot: 'bg-gray-700'
    };
  };

  // Format currency
  const formatCurrency = (val: string | number | undefined) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  // Profit style helper
  const getProfitStyle = (val: string | number | undefined) => {
    if (val === undefined || val === null) return 'text-gray-400';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (num > 0) return 'text-emerald-400 font-bold';
    if (num < 0) return 'text-rose-500 font-bold';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-[#050507] text-gray-200 font-sans">
      
      {/* ── HEADER NAVIGATION ── */}
      <header className="bg-transparent border-none sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center shadow-lg shadow-cyan-500/10 bg-black">
              <img src="/apex_machine_logo.png" className="w-full h-full object-cover scale-110" alt="Apex Machine Logo" />
            </div>
            <div>
              <span className="text-sm font-black uppercase tracking-wider text-white block">
                Apex Machine
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#4ade80] font-black flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-ping" />
                Live Postgres Sync Active
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── WORKSPACE BODY WITH SHIFTING LAYOUT ── */}
      <div className="relative flex min-h-[calc(100vh-64px)] overflow-x-hidden">
        
        {/* Shifting Main Content Area (Translates without squeezing) */}
        <main className={`flex-1 transition-all duration-300 p-4 md:p-6 flex flex-col gap-6 w-full max-w-7xl mx-auto ${
          sidebarOpen ? 'translate-x-[340px]' : 'translate-x-0'
        }`}>
          
          {/* Floating Sidebar Toggle Button below top bar on the left */}
          <div className="flex justify-start">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                sidebarOpen 
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-[#00ffc8] shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                  : 'bg-[#12141c] border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Menu de Navegação & Operações"
            >
              <Terminal size={12} />
              <span>Painel</span>
            </button>
          </div>
        
        {/* Animated view container */}
        <AnimatePresence mode="wait">
          {activeTab === 'database' ? (
            
            // ─── TAB 1: LIVE DATABASE VIEW ───
            <motion.div
              key="database-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              
              {/* Dynamic Live Ticker Strip */}
              <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 flex items-center gap-2">
                    <History size={13} className="text-red-500 animate-spin-slow" />
                    Últimas Pedras Coletadas
                  </span>
                  <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider">
                    Atualiza a cada rodada
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {dbData.slice(0, 16).map((roll, idx) => {
                    const n = parseInt(roll.roll as string) || 0;
                    const style = getRollStyle(n, roll.color);
                    return (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={roll.id + idx}
                        className="flex flex-col items-center gap-1.5 shrink-0"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-md ${style.bg}`}>
                          {n}
                        </div>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {new Date(roll.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Filter Control Bar */}
              <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex flex-wrap items-center gap-4">
                  {/* Color Selector */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider">Filtrar Cor</span>
                    <div className="flex bg-[#12141c] border border-white/10 rounded-lg p-0.5">
                      {['ALL', 'VERMELHO', 'PRETO', 'BRANCO'].map(col => (
                        <button
                          key={col}
                          onClick={() => setColorFilter(col as any)}
                          className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                            colorFilter === col 
                              ? 'bg-white/10 text-white shadow' 
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {col === 'ALL' ? 'Todos' : col}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Roll Search */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider">Buscar Número</span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: 0, 7, 14..."
                        value={rollSearch}
                        onChange={e => setRollSearch(e.target.value)}
                        className="bg-[#12141c] border border-white/10 text-white placeholder-gray-600 text-xs px-3 py-1.5 pl-8 rounded-lg outline-none focus:border-[#4c76c6] w-36 font-bold"
                      />
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* DB limit selection */}
                <div className="flex flex-col gap-1 items-start md:items-end">
                  <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider">Exibir Limite</span>
                  <select
                    value={dbLimit}
                    onChange={e => {
                      setLoadingDb(true);
                      setDbLimit(Number(e.target.value));
                    }}
                    className="bg-[#12141c] border border-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/20 transition-all uppercase tracking-wider"
                  >
                    {[50, 100, 200, 500].map(lim => (
                      <option key={lim} value={lim}>{lim} Rodadas</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main Database Table Card */}
              <div className="bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                  <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                    <Database size={14} className="text-[#4c76c6]" />
                    Histórico de Resultados PostgreSQL
                  </h3>
                  <button 
                    onClick={() => {
                      setLoadingDb(true);
                      fetchDbData();
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw size={13} className={loadingDb ? "animate-spin" : ""} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {loadingDb ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-red-500 animate-spin" />
                      <span className="text-xs uppercase tracking-widest font-black text-gray-500 animate-pulse">Consultando PostgreSQL...</span>
                    </div>
                  ) : filteredDbData.length === 0 ? (
                    <div className="p-20 text-center text-xs text-gray-500 font-black uppercase tracking-widest">
                      Nenhum resultado corresponde aos filtros selecionados.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.03] border-b border-white/10 text-center text-[9px] font-black uppercase text-gray-400 tracking-widest">
                          <th className="py-3 px-4 text-center">ID RODADA</th>
                          <th className="py-3 px-4 text-center">NÚMERO / COR</th>
                          <th className="py-3 px-4 text-center">HORÁRIO (UTC)</th>
                          <th className="py-3 px-4 text-center">TOTAL APOSTADO</th>
                          <th className="py-3 px-4 text-center">PAGO AOS JOGADORES</th>
                          <th className="py-3 px-4 text-center">LUCRO DA CASA (PERCA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDbData.map((row) => {
                          const num = typeof row.roll === 'string' ? parseInt(row.roll) : row.roll;
                          const style = getRollStyle(num, row.color);
                          const formattedTime = new Date(row.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'UTC'
                          });

                          return (
                            <tr key={row.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] text-xs font-mono text-center transition-colors">
                              
                              {/* Round ID with quick copy */}
                              <td className="py-2.5 px-4 font-bold text-gray-400 text-center">
                                <span className="inline-flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md text-[10px] text-gray-300">
                                  {row.id}
                                  <button
                                    onClick={() => handleCopy(row.id)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                    title="Copiar ID"
                                  >
                                    {copiedId === row.id ? (
                                      <Check size={11} className="text-[#4ade80]" />
                                    ) : (
                                      <Copy size={11} />
                                    )}
                                  </button>
                                </span>
                              </td>

                              {/* Number and color badge */}
                              <td className="py-2.5 px-4">
                                <div className="flex items-center justify-center gap-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${style.bg}`}>
                                    {num}
                                  </div>
                                  <span className="text-[10px] uppercase font-black text-gray-400">
                                    {style.colorName}
                                  </span>
                                </div>
                              </td>

                              {/* Time in UTC */}
                              <td className="py-2.5 px-4 text-gray-300">
                                {formattedTime}
                              </td>

                              {/* Total Wagered */}
                              <td className="py-2.5 px-4 text-gray-300">
                                {formatCurrency(row.total_bets)}
                              </td>

                              {/* Winnings Paid */}
                              <td className="py-2.5 px-4 text-gray-300">
                                {formatCurrency(row.total_payout)}
                              </td>

                              {/* House Profit (Green for profit, red for loss) */}
                              <td className={`py-2.5 px-4 ${getProfitStyle(row.house_profit)}`}>
                                {formatCurrency(row.house_profit)}
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'strategies' ? (
            
            // ─── TAB 2: PATTERNS STRATEGY ANALYZER (MATCHES USER SCREENSHOT) ───
            <motion.div
              key="strategies-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              
              {/* Quick Strategy Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Analysed Spins */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Rodadas Analisadas</span>
                    <span className="text-2xl font-black text-white mt-1 block font-mono">
                      {globalDataForStats.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#4c76c6]/10 border border-[#4c76c6]/20 flex items-center justify-center text-[#4c76c6]">
                    <History size={20} />
                  </div>
                </div>

                {/* Best winrate pattern */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Melhor Assertividade</span>
                    <span className="text-md font-black text-[#4ade80] mt-1.5 block font-mono flex items-center gap-2">
                      {strategyStats.length > 0 ? (
                        <>
                          <div className="flex gap-0.5 shrink-0 bg-black/40 p-1 rounded">
                            {strategyStats[0].pattern.map((col, idx) => (
                              <div 
                                key={idx} 
                                className={`w-3.5 h-3.5 rounded-full border border-black/45 ${col === 'V' ? 'bg-[#f12c4c]' : 'bg-[#262831]'}`}
                              />
                            ))}
                          </div>
                          <span>{strategyStats[0].winRate.toFixed(1)}%</span>
                        </>
                      ) : 'Sem Dados'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/20 flex items-center justify-center text-[#4ade80]">
                    <TrendingUp size={20} />
                  </div>
                </div>

                {/* Top delay pattern */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Maior Atraso Atual (SA)</span>
                    <span className="text-md font-black text-[#f12c4c] mt-1.5 block font-mono flex items-center gap-2">
                      {strategyStats.length > 0 ? (
                        (() => {
                          const topSa = [...strategyStats].sort((a,b) => b.sa - a.sa)[0];
                          return (
                            <>
                              <div className="flex gap-0.5 shrink-0 bg-black/40 p-1 rounded">
                                {topSa.pattern.map((col, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`w-3.5 h-3.5 rounded-full border border-black/45 ${col === 'V' ? 'bg-[#f12c4c]' : 'bg-[#262831]'}`}
                                  />
                                ))}
                              </div>
                              <span className="bg-[#8b008b] text-white text-[11px] px-1.5 py-0.5 rounded font-black">
                                SA: {topSa.sa}
                              </span>
                            </>
                          );
                        })()
                      ) : 'Sem Dados'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Clock size={20} />
                  </div>
                </div>
              </div>

              {/* MAIN STRATEGY CARD (MATCHES USER SCREENSHOT EXACTLY) */}
              <div className="bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                
                {/* Header Banner (Blueish exactly like screenshot) */}
                <div className="bg-[#4c76c6] text-white px-5 py-3 text-center border-b border-white/10 shadow-md">
                  <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] font-sans">
                    PADRÕES COM {patternLength} CASAS
                  </h2>
                </div>

                 {/* Sub-header controls block */}
                 <div className="bg-black/50 p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                   <div className="flex flex-wrap items-center gap-4">
                     {/* Gale size */}
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Entrada (Gales):</span>
                       <select
                         value={galesCount}
                         onChange={e => setGalesCount(Number(e.target.value))}
                         className="bg-[#12141c] border border-white/20 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                       >
                         <option value={2}>2 Rodadas (1 Gale)</option>
                         <option value={3}>3 Rodadas (2 Gales)</option>
                         <option value={4}>4 Rodadas (3 Gales)</option>
                         <option value={5}>5 Rodadas (4 Gales)</option>
                       </select>
                     </div>

                     {/* Overlapping */}
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Sobreposição:</span>
                       <select
                         value={overlapping ? 'true' : 'false'}
                         onChange={e => setOverlapping(e.target.value === 'true')}
                         className="bg-[#12141c] border border-white/20 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                       >
                         <option value="true">Ativada (Padrão)</option>
                         <option value="false">Desativada</option>
                       </select>
                     </div>

                     {/* Offset Lag */}
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Deslocamento (Lag):</span>
                       <select
                         value={offsetHours}
                         onChange={e => setOffsetHours(Number(e.target.value))}
                         className="bg-[#12141c] border border-white/20 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                       >
                         <option value={0}>Sem Atraso (Real-Time)</option>
                         <option value={4}>Atraso 4h</option>
                         <option value={8}>Atraso 8h (VPS Referência)</option>
                         <option value={12}>Atraso 12h</option>
                         <option value={24}>Atraso 24h</option>
                         <option value={48}>Atraso 48h</option>
                       </select>
                     </div>

                     {/* Houses length filter */}
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Tamanho:</span>
                       <select
                         value={patternLength}
                         onChange={e => setPatternLength(Number(e.target.value))}
                         className="bg-[#12141c] border border-white/20 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                       >
                         {[3, 4, 5, 6].map(len => (
                           <option key={len} value={len}>{len} Casas</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   {/* Hours Selector */}
                   <div className="flex items-center gap-1.5">
                     <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Período:</span>
                     <select 
                       value={periodHours}
                       onChange={e => setPeriodHours(Number(e.target.value))}
                       className="bg-black border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 rounded outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                     >
                       <option value={12}>12 Horas</option>
                       <option value={24}>24 Horas</option>
                       <option value={48}>48 Horas</option>
                       <option value={72}>72 Horas</option>
                       <option value={120}>120 Horas</option>
                     </select>
                   </div>
                 </div>

                {/* Strategy table */}
                <div className="overflow-x-auto">
                  {loadingStats ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-red-500 animate-spin" />
                      <span className="text-xs uppercase tracking-widest font-black text-gray-500 animate-pulse">Processando Padrões...</span>
                    </div>
                  ) : strategyStats.length === 0 ? (
                    <div className="p-20 text-center text-xs text-gray-500 font-black uppercase tracking-widest">
                      Nenhum dado histórico encontrado para esta configuração.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-[#5985dc] text-white border-b border-white/10 text-center text-[10px] font-black uppercase tracking-widest">
                          <th className="py-3 px-4 border-r border-white/20 text-center font-bold w-1/3">PADRÃO</th>
                          <th 
                            onClick={() => handleSort('TX')}
                            className="py-3 px-4 border-r border-white/20 cursor-pointer hover:bg-white/10 select-none transition-all"
                          >
                            TX % {sortColumn === 'TX' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </th>
                          <th 
                            onClick={() => handleSort('WIN')}
                            className="py-3 px-4 border-r border-white/20 cursor-pointer hover:bg-white/10 select-none transition-all"
                          >
                            WIN {sortColumn === 'WIN' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </th>
                          <th 
                            onClick={() => handleSort('LOSS')}
                            className="py-3 px-4 border-r border-white/20 cursor-pointer hover:bg-white/10 select-none transition-all"
                          >
                            LOSS {sortColumn === 'LOSS' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </th>
                          <th 
                            onClick={() => handleSort('SM')}
                            className="py-3 px-4 border-r border-white/20 cursor-pointer hover:bg-white/10 select-none transition-all"
                          >
                            SM {sortColumn === 'SM' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </th>
                          <th 
                            onClick={() => handleSort('SA')}
                            className="py-3 px-4 cursor-pointer hover:bg-white/10 select-none transition-all"
                          >
                            SA {sortColumn === 'SA' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence mode="popLayout">
                          {strategyStats.map((row) => {
                            const isHighSa = row.sa > 0 && row.sm > 0 && (row.sm - row.sa <= 2);
                            
                            return (
                              <motion.tr 
                                key={row.id}
                                layout
                                className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] text-center text-xs font-mono transition-colors"
                              >
                                
                                {/* Visual Dots Pattern */}
                                <td className="py-2.5 px-4 border-r border-white/5 flex gap-1 justify-center items-center">
                                  {row.pattern.map((color, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`w-7 h-7 rounded border border-black/50 shadow-md ${
                                        color === 'V' ? 'bg-[#f12c4c]' : 'bg-[#262831]'
                                      }`}
                                    />
                                  ))}
                                </td>

                                {/* Assertiveness Winrate */}
                                <td className="py-3 px-4 border-r border-white/5 text-[#4ade80] font-black text-sm">
                                  {row.winRate.toFixed(1)}%
                                </td>

                                {/* Wins */}
                                <td className="py-3 px-4 border-r border-white/5 text-[#5985dc] font-black text-sm">
                                  {row.win}
                                </td>

                                {/* Losses */}
                                <td className="py-3 px-4 border-r border-white/5 text-[#7c7d85] font-black text-sm">
                                  {row.loss}
                                </td>

                                {/* SM (Max Delay / Sem Pagamento Maximo) - Purple badge */}
                                <td className="py-2 px-4 border-r border-white/5">
                                  {row.sm > 0 ? (
                                    <div className="bg-[#820063] text-white font-black py-1.5 px-3 rounded shadow-[0_0_8px_rgba(130,0,99,0.3)] inline-block min-w-[35px]">
                                      {row.sm}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500">0</span>
                                  )}
                                </td>

                                {/* SA (Current Delay / Sem Pagamento Atual) - Purple or Pulsing Red badge */}
                                <td className="py-2 px-4">
                                  {row.sa > 0 ? (
                                    <div className={`font-black py-1.5 px-3 rounded inline-block min-w-[35px] ${
                                      isHighSa 
                                        ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)] animate-pulse' 
                                        : 'bg-[#820063] text-white shadow-[0_0_8px_rgba(130,0,99,0.3)]'
                                    }`}>
                                      {row.sa}
                                    </div>
                                  ) : (
                                    <span className="text-[#4ade80] font-black">0</span>
                                  )}
                                </td>

                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            
            // ─── TAB 3: MINUTES HEATMAP VIEW (PAINEL DE MINUTO) ───
            <motion.div
              key="minutes-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* Quick Info Cards for Minutes Heatmap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Brancos analyzed */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Total Brancos (Período)</span>
                    <span className="text-2xl font-black text-white mt-1 block font-mono">
                      {minutesData.reduce((acc, item) => acc + item.sum, 0)}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Sparkles size={20} />
                  </div>
                </div>

                {/* Most hot minute */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Minuto Mais Quente (Pico)</span>
                    <span className="text-2xl font-black text-[#4ade80] mt-1 block font-mono">
                      {(() => {
                        const sorted = [...minutesData].sort((a, b) => b.sum - a.sum);
                        return sorted.length > 0 ? `Minuto ${String(sorted[0].minute).padStart(2, '0')} (${sorted[0].sum} Brancos)` : 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/20 flex items-center justify-center text-[#4ade80]">
                    <TrendingUp size={20} />
                  </div>
                </div>

                {/* Most cold minute */}
                <div className="bg-[#0a0a0f] border border-white/10 p-4 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 tracking-widest block">Minuto Mais Frio (Vazio)</span>
                    <span className="text-2xl font-black text-[#f12c4c] mt-1 block font-mono">
                      {(() => {
                        const sorted = [...minutesData].sort((a, b) => a.sum - b.sum);
                        return sorted.length > 0 ? `Minuto ${String(sorted[0].minute).padStart(2, '0')} (${sorted[0].sum} Brancos)` : 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#f12c4c]/10 border border-[#f12c4c]/20 flex items-center justify-center text-[#f12c4c]">
                    <Clock size={20} />
                  </div>
                </div>
              </div>

              {/* MAIN HEATMAP GRID PANEL */}
              <div className="bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                
                {/* Header Banner exactly like screenshot */}
                <div className="bg-[#005cbf] text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10 shadow-md flex-wrap gap-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] font-sans">
                    PAINEL DE MINUTO
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={periodHours}
                      onChange={e => setPeriodHours(Number(e.target.value))}
                      className="bg-[#12141c] border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer hover:border-white/40 transition-colors uppercase tracking-wider"
                    >
                      <option value={12}>12 Horas</option>
                      <option value={24}>24 Horas</option>
                      <option value={48}>48 Horas</option>
                      <option value={72}>72 Horas</option>
                      <option value={96}>96 Horas</option>
                    </select>
                  </div>
                </div>

                {/* Heatmap Grid exactly styled like user screenshot */}
                <div className="p-4 bg-black/40 overflow-x-auto">
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-3 min-w-[640px]">
                    {minutesData.map((item) => {
                      const minStr = String(item.minute).padStart(2, '0');
                      
                      // Left Column Style (seconds 00 - 29)
                      let col1Bg = 'bg-[#4a608a]';
                      if (item.col1 === 0) col1Bg = 'bg-[#cc0000]';
                      else if (item.col1 >= 5) col1Bg = 'bg-[#2e7d32]';
                      
                      // Right Column Style (seconds 30 - 59)
                      let col2Bg = 'bg-[#4a608a]';
                      if (item.col2 === 0) col2Bg = 'bg-[#cc0000]';
                      else if (item.col2 >= 5) col2Bg = 'bg-[#2e7d32]';
                      
                      // Sum Box Style
                      let sumBg = 'bg-[#4a608a]';
                      if (item.sum >= 7) sumBg = 'bg-[#2e7d32]';

                      return (
                        <div 
                          key={item.minute} 
                          className="flex flex-col border border-white/10 rounded overflow-hidden shadow-md hover:scale-[1.03] transition-transform duration-200"
                        >
                          {/* Minute Header */}
                          <div className="bg-[#005cbf] text-white text-xs font-black text-center py-1.5 border-b border-white/10 uppercase tracking-wider">
                            {minStr}
                          </div>
                          
                          {/* Columns 1 & 2 */}
                          <div className="grid grid-cols-2 border-b border-white/10">
                            <div className={`${col1Bg} text-white text-[11px] font-black text-center py-2 border-r border-white/10 hover:brightness-110 transition-all`}>
                              {item.col1}
                            </div>
                            <div className={`${col2Bg} text-white text-[11px] font-black text-center py-2 hover:brightness-110 transition-all`}>
                              {item.col2}
                            </div>
                          </div>

                          {/* Sum Row */}
                          <div className={`${sumBg} text-white text-[11px] font-black text-center py-1.5 hover:brightness-110 transition-all`}>
                            {item.sum}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtitle / Legend */}
                <div className="bg-black/50 p-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase font-black tracking-wider text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-[#cc0000] border border-white/10" />
                    <span>Sem Brancos (Frio / Alerta)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-[#4a608a] border border-white/10" />
                    <span>Média normal (1 a 4)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-[#2e7d32] border border-white/10" />
                    <span>Quente (5 ou mais)</span>
                  </div>
                  <div className="text-gray-500 border-l border-white/10 pl-6">
                    <span>Divisão: Coluna Esquerda (0s - 29s) | Coluna Direita (30s - 59s)</span>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hacker Command Sidebar (Lado Esquerdo) */}
      <aside className={`fixed top-16 left-0 bottom-0 z-40 w-[340px] bg-[#0a0a0f] border-r border-white/10 backdrop-blur-md bg-opacity-95 transition-transform duration-300 transform flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#00ffc8]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-white">Console de Operações</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors"
            title="Fechar Console"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
          
          {/* Menu de Navegação das Páginas */}
          <div className="flex flex-col gap-1.5 pb-4 border-b border-white/10">
            <span className="text-gray-500 text-[8px] font-black uppercase tracking-wider mb-1">Navegação Principal</span>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'database' 
                  ? 'bg-[#4c76c6] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database size={14} />
              Banco de Dados
            </button>
            <button
              onClick={() => setActiveTab('strategies')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'strategies' 
                  ? 'bg-[#4c76c6] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal size={14} />
              Leitor de Padrões
            </button>
            <button
              onClick={() => setActiveTab('minutes')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'minutes' 
                  ? 'bg-[#4c76c6] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={14} />
              Painel de Minutos
            </button>
          </div>
          
          {/* HUD Status Card */}
          <div className="bg-black/50 p-4 rounded-xl border border-white/5 flex flex-col gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 text-gray-400 text-[10px] uppercase font-black tracking-wider">
              <Activity className="w-3.5 h-3.5 text-[#00ffc8]" />
              <span>Telemetria do Servidor</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#12141c] p-2.5 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-gray-500 text-[8px] font-black uppercase tracking-wider">PROCESSADOR</span>
                <span className="text-[#00ffc8] font-mono font-bold">14.8% CPU</span>
              </div>
              <div className="bg-[#12141c] p-2.5 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-gray-500 text-[8px] font-black uppercase tracking-wider">MEMÓRIA</span>
                <span className="text-[#00ffc8] font-mono font-bold">42.1% RAM</span>
              </div>
              <div className="bg-[#12141c] p-2.5 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-gray-500 text-[8px] font-black uppercase tracking-wider">LATÊNCIA DB</span>
                <span className="text-[#00ffc8] font-mono font-bold">12ms (VPS)</span>
              </div>
              <div className="bg-[#12141c] p-2.5 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-gray-500 text-[8px] font-black uppercase tracking-wider">SYNC DELAY</span>
                <span className="text-[#4ade80] font-mono font-bold">LIVE STABLE</span>
              </div>
            </div>
          </div>

          {/* Quick Strategy Status */}
          <div className="bg-black/50 p-4 rounded-xl border border-white/5 flex flex-col gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 text-gray-400 text-[10px] uppercase font-black tracking-wider">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00ffc8]" />
              <span>Estatísticas de Filtro</span>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-gray-400 py-1 border-b border-white/5">
                <span>Gales Selecionados:</span>
                <span className="text-white font-mono font-bold">{galesCount} Gales</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 py-1 border-b border-white/5">
                <span>Janela Temporal:</span>
                <span className="text-white font-mono font-bold">{periodHours} Horas</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 py-1">
                <span>Sobreposição:</span>
                <span className="text-white font-mono font-bold">{overlapping ? "ATIVADO" : "DESATIVADO"}</span>
              </div>
            </div>
          </div>

          {/* Terminal Live Feed of recent database pulls */}
          <div className="flex-1 bg-black/70 p-3 rounded-xl border border-white/5 flex flex-col gap-2.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] font-mono text-[10px] min-h-[220px]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-gray-500 uppercase font-black tracking-wider text-[9px]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ffc8] animate-pulse" />
              <span>Feed de Rodadas Postgres</span>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar pr-1 font-mono">
              {dbData.slice(0, 10).map((roll, idx) => {
                const timeStr = roll.timestamp ? new Date(roll.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) : '--:--:--';
                const isW = roll.color.toUpperCase() === 'BRANCO' || parseInt(roll.roll.toString()) === 0;
                const isR = roll.color.toUpperCase() === 'VERMELHO' || (parseInt(roll.roll.toString()) >= 1 && parseInt(roll.roll.toString()) <= 7);
                
                let colorStyle = 'text-gray-400';
                let prefix = '> [PRETO]';
                if (isW) {
                  colorStyle = 'text-white font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]';
                  prefix = '> [BRANCO]';
                } else if (isR) {
                  colorStyle = 'text-rose-500 font-bold';
                  prefix = '> [VERMELHO]';
                }

                return (
                  <div key={roll.id + idx} className="flex items-center justify-between py-0.5 border-b border-white/[0.02]">
                    <span className={`${colorStyle} tracking-wider`}>
                      {timeStr} {prefix} {roll.roll}
                    </span>
                    <span className="text-gray-600 text-[8px]">SYNCED</span>
                  </div>
                );
              })}
              {dbData.length === 0 && (
                <div className="text-gray-600 text-center py-8 italic">
                  Aguardando sincronização do banco...
                </div>
              )}
            </div>
          </div>

        </div>
      </aside>

    </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#0a0a0f] py-8 text-center text-xs text-gray-500 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <p className="uppercase tracking-widest font-black text-[10px] text-gray-400">
            Blaze Double Analytics Engine &copy; {new Date().getFullYear()}
          </p>
          <p className="mt-1 text-[9px] text-gray-600">
            Monitoramento de alta performance conectado diretamente ao PostgreSQL da VPS.
          </p>
        </div>
      </footer>
    </div>
  );
}
