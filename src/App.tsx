/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Monitor, 
  Cpu, 
  Globe, 
  Database, 
  Sun, 
  Moon, 
  Download, 
  FileText,
  Table as TableIcon,
  Upload, 
  Settings, 
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Palette
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  CellProps,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';
import { 
  calculateVcpu, 
  calculatePcpu, 
  calculateSubnet, 
  calculateStorage 
} from './utils';
import { VcpuResult, PcpuResult, SubnetResult, StorageResult } from './types';

// --- Components ---

const StatusBadge = ({ status }: { status: { cls: 'ok' | 'hi' | 'ov', label: string } }) => {
  const colors = {
    ok: 'bg-[#e8f5e9] text-[#00b050] border-[#00b050]/20',
    hi: 'bg-[#fff9c4] text-[#f57f17] border-[#f57f17]/20',
    ov: 'bg-[#ffebee] text-[#b71c1c] border-[#b71c1c]/20'
  };
  const dots = {
    ok: 'bg-[#00b050] shadow-[0_0_8px_rgba(0,176,80,0.4)]',
    hi: 'bg-[#ffc000] shadow-[0_0_8px_rgba(255,192,0,0.4)]',
    ov: 'bg-[#ff0000] shadow-[0_0_8px_rgba(255,0,0,0.4)]'
  };

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-sm border px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-wider", colors[status.cls])}>
      <div className={cn("h-2 w-2 rounded-full", dots[status.cls])} />
      {status.label}
    </div>
  );
};

const MetricCard = ({ label, value, unit, status }: { label: string, value: string, unit: string, status?: 'ok' | 'hi' | 'ov' }) => {
  const statusColor = status === 'ok' ? '#00b050' : status === 'hi' ? '#ffc000' : status === 'ov' ? '#ff0000' : '#00b0f0';
  
  return (
    <div className="relative overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm transition-all hover:shadow-md">
      <div className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: statusColor }} />
      <div className="font-sans text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-sans text-2xl font-bold tracking-tight text-[var(--text-primary)]">{value}</span>
        <span className="font-sans text-[10px] font-bold text-[var(--text-sec)] uppercase">{unit}</span>
      </div>
    </div>
  );
};

const ProgressBar = ({ title, pct, status, thresholds }: { title: string, pct: number, status: 'ok' | 'hi' | 'ov', thresholds: string[] }) => {
  const barColor = status === 'ok' ? 'var(--prtg-green)' : status === 'hi' ? 'var(--prtg-yellow)' : 'var(--prtg-red)';
  
  return (
    <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-sans text-[11px] font-bold tracking-[0.05em] uppercase text-[var(--text-sec)]">{title}</span>
        <span className="font-sans text-2xl font-bold text-[var(--text-primary)]">{pct.toFixed(3)}%</span>
      </div>
      <div className="relative h-5 w-full overflow-hidden rounded-sm bg-[#e0e0e0] border border-black/10 shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full relative"
          style={{ backgroundColor: barColor }}
        >
          {/* PRTG Glossy Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent h-[48%]" />
          <div className="absolute inset-x-0 bottom-0 bg-black/5 h-[50%]" />
          
          {/* Vertical segments like PRTG */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-full w-px bg-black/5 flex-1 border-r border-white/10" />
            ))}
          </div>
        </motion.div>
        
        {/* Threshold Markers */}
        <div className="absolute top-0 h-full w-px bg-red-500/30 z-10" style={{ left: '70%' }} />
        <div className="absolute top-0 h-full w-px bg-red-600/40 z-10" style={{ left: '85%' }} />
      </div>
      <div className="mt-3 flex justify-between px-1">
        <span className="font-sans text-[10px] text-[var(--text-sec)]">0%</span>
        <span className="font-sans text-[10px] text-[var(--text-sec)]">Warning 70%</span>
        <span className="font-sans text-[10px] text-[var(--text-sec)]">Critical 85%</span>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'vcpu' | 'pcpu' | 'subnet' | 'storage'>('vcpu');
  const [theme, setTheme] = useState<'light' | 'dark' | 'slate' | 'emerald' | 'amber'>('light');
  const [logo, setLogo] = useState<string | null>(null);

  // vCPU State
  const [vInput, setVInput] = useState({ vcpu: '', freq: '', util: '' });
  const [vResult, setVResult] = useState<VcpuResult | null>(null);
  const [vHistory, setVHistory] = useState<VcpuResult[]>([]);

  // pCPU State
  const [pInput, setPInput] = useState({ sockets: '', cores: '', threads: '', freq: '', util: '', tdp: '' });
  const [pResult, setPResult] = useState<PcpuResult | null>(null);
  const [pHistory, setPHistory] = useState<PcpuResult[]>([]);

  // Subnet State
  const [snInput, setSnInput] = useState({ ip: '', mask: '' });
  const [snResult, setSnResult] = useState<SubnetResult | null>(null);
  const [snHistory, setSnHistory] = useState<SubnetResult[]>([]);

  // Storage State
  const [stInput, setStInput] = useState({ drives: '', cap: '', raid: '5', used: '', overhead: '10' });
  const [stUnit, setStUnit] = useState<'GB' | 'TB'>('TB');
  const [stResult, setStResult] = useState<StorageResult | null>(null);
  const [stHistory, setStHistory] = useState<StorageResult[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-slate', 'theme-emerald', 'theme-amber');
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'slate') root.classList.add('theme-slate');
    else if (theme === 'emerald') root.classList.add('theme-emerald');
    else if (theme === 'amber') root.classList.add('theme-amber');
  }, [theme]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getExportData = () => {
    let data: any[] = [];
    let headers: string[] = [];
    let filename = '';

    if (activeTab === 'vcpu') {
      filename = 'vcpu-utilization';
      headers = ['Capacity GHz', 'Observed GHz', 'Util%', 'Headroom GHz', 'Status'];
      data = vHistory.map(h => [h.capacity, h.observed, h.utilization.toFixed(2), h.headroom.toFixed(2), h.status.label]);
    } else if (activeTab === 'pcpu') {
      filename = 'physical-cpu';
      headers = ['Cores', 'Threads', 'Peak GHz', 'Used GHz', 'Util%', 'Power W', 'Status'];
      data = pHistory.map(h => [h.totalCores, h.totalLogical, h.peakGhz.toFixed(2), h.usedGhz.toFixed(2), h.utilization.toFixed(2), h.estPower ? h.estPower.toFixed(0) : 'N/A', h.status.label]);
    } else if (activeTab === 'subnet') {
      filename = 'subnet-calc';
      headers = ['Network', 'Broadcast', 'Mask', 'CIDR', 'Range', 'Hosts', 'Class', 'Type'];
      data = snHistory.map(h => [h.network, h.broadcast, h.mask, h.cidr, h.range, h.hosts.toLocaleString(), h.ipClass, h.ipType]);
    } else {
      filename = 'storage-capacity';
      headers = [`Raw ${stUnit}`, `Usable ${stUnit}`, `Net ${stUnit}`, `Used ${stUnit}`, `Free ${stUnit}`, 'Util%', 'Status'];
      data = stHistory.map(h => [h.raw.toLocaleString(), h.usable.toLocaleString(), h.netAvail.toLocaleString(), h.used.toLocaleString(), h.free.toLocaleString(), h.utilization.toFixed(2), h.status.label]);
    }

    return { data, headers, filename };
  };

  const exportCSV = () => {
    const { data, headers, filename } = getExportData();
    if (data.length === 0) return;

    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportXLS = () => {
    const { data, headers, filename } = getExportData();
    if (data.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Calculation History");

    // Special case for Subnet Splits
    if (activeTab === 'subnet' && snResult && snResult.splits.length > 0) {
      const splitHeaders = ['CIDR', 'Hosts', 'Network', 'Broadcast', 'First Host', 'Last Host'];
      const splitData = snResult.splits.map(s => [s.cidr, s.hosts, s.network, s.broadcast, s.firstHost, s.lastHost]);
      const splitSheet = XLSX.utils.aoa_to_sheet([splitHeaders, ...splitData]);
      XLSX.utils.book_append_sheet(workbook, splitSheet, "Subnet Detail");
    }

    XLSX.writeFile(workbook, `${filename}-${new Date().getTime()}.xlsx`);
  };

  const exportPDF = () => {
    const { data, headers, filename } = getExportData();
    if (data.length === 0) return;

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    // Add Logo if exists
    const addLogoToPage = (pDoc: any) => {
      if (logo) {
        try {
          const formatMatch = logo.match(/^data:image\/(\w+);base64,/);
          const format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
          pDoc.addImage(logo, format, 14, 10, 30, 15);
        } catch (e) {
          console.error("Error adding logo to PDF", e);
        }
      }
    };

    addLogoToPage(doc);

    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text("IT Infrastructure Capacity Report", 14, logo ? 35 : 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${timestamp}`, 14, logo ? 42 : 27);
    doc.text(`Category: ${filename.replace(/-/g, ' ').toUpperCase()}`, 14, logo ? 47 : 32);

    let startY = logo ? 57 : 42;

    // --- Current Results Summary (Mirroring the UI Cards) ---
    const drawSummarySection = () => {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Current Calculation Results", 14, startY);
      startY += 8;

      const summaryData: string[][] = [];
      let statusMsg = "";
      let statusCls: 'ok' | 'hi' | 'ov' = 'ok';

      if (activeTab === 'vcpu' && vResult) {
        summaryData.push(["TOTAL CAPACITY", `${vResult.capacity} GHz`]);
        summaryData.push(["OBSERVED", `${vResult.observed} GHz`]);
        summaryData.push(["UTILIZATION %", `${vResult.utilization.toFixed(2)}%`]);
        summaryData.push(["HEADROOM", `${vResult.headroom.toFixed(3)} GHz`]);
        statusMsg = vResult.status.msg;
        statusCls = vResult.status.cls;
      } else if (activeTab === 'pcpu' && pResult) {
        summaryData.push(["PEAK GHz", `${pResult.peakGhz} GHz`]);
        summaryData.push(["USED GHz", `${pResult.usedGhz} GHz`]);
        summaryData.push(["UTILIZATION %", `${pResult.utilization.toFixed(2)}%`]);
        summaryData.push(["EST POWER", pResult.estPower ? `${pResult.estPower} W` : "N/A"]);
        statusMsg = pResult.status.msg;
        statusCls = pResult.status.cls;
      } else if (activeTab === 'subnet' && snResult) {
        summaryData.push(["NETWORK", snResult.network]);
        summaryData.push(["BROADCAST", snResult.broadcast]);
        summaryData.push(["MASK", snResult.mask]);
        summaryData.push(["CIDR", snResult.cidr]);
        summaryData.push(["HOSTS", snResult.hosts.toLocaleString()]);
        summaryData.push(["TYPE", snResult.ipType]);
      } else if (activeTab === 'storage' && stResult) {
        summaryData.push(["RAW CAPACITY", `${stResult.raw} ${stUnit}`]);
        summaryData.push(["USABLE", `${stResult.usable} ${stUnit}`]);
        summaryData.push(["UTILIZATION %", `${stResult.utilization.toFixed(2)}%`]);
        summaryData.push(["FREE SPACE", `${stResult.free} ${stUnit}`]);
        statusMsg = stResult.status.msg;
        statusCls = stResult.status.cls;
      }

      if (summaryData.length > 0) {
        autoTable(doc, {
          body: summaryData,
          startY: startY,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { halign: 'right' } },
        });
        startY = (doc as any).lastAutoTable.finalY + 5;

        if (statusMsg) {
          const color = statusCls === 'ok' ? [0, 176, 80] : statusCls === 'hi' ? [255, 192, 0] : [255, 0, 0];
          
          // Draw Progress Bar (Mirroring the UI)
          let utilPct = 0;
          if (activeTab === 'vcpu' && vResult) utilPct = vResult.utilization;
          else if (activeTab === 'pcpu' && pResult) utilPct = pResult.utilization;
          else if (activeTab === 'storage' && stResult) utilPct = stResult.utilization;

          if (utilPct > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("UTILIZATION VS CAPACITY", 14, startY);
            startY += 4;
            
            // Bar Background
            doc.setFillColor(224, 224, 224);
            doc.rect(14, startY, 182, 6, 'F');
            
            // Bar Fill
            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(14, startY, (182 * Math.min(utilPct, 100)) / 100, 6, 'F');
            
            // Threshold markers
            doc.setDrawColor(255, 0, 0);
            doc.setLineWidth(0.2);
            doc.line(14 + (182 * 0.7), startY, 14 + (182 * 0.7), startY + 6); // 70%
            doc.line(14 + (182 * 0.85), startY, 14 + (182 * 0.85), startY + 6); // 85%
            
            doc.setFontSize(7);
            doc.text(`${utilPct.toFixed(3)}%`, 14 + (182 * Math.min(utilPct, 100)) / 100 - 5, startY + 10);
            startY += 12;
          }

          // Status Box
          doc.setFillColor(color[0], color[1], color[2]);
          doc.rect(14, startY, 182, 10, 'F');
          doc.setTextColor(statusCls === 'hi' ? 0 : 255);
          doc.setFontSize(9);
          doc.text(`STATUS: ${statusMsg}`, 18, startY + 6.5);
          startY += 15;
        }
      }
    };

    drawSummarySection();

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Calculation History", 14, startY);

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: startY + 5,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 176, 240] },
    });

    // Special case for Subnet Splits
    if (activeTab === 'subnet' && snResult && snResult.splits.length > 0) {
      const splitHeaders = ['CIDR', 'Hosts', 'Network', 'Broadcast', 'First Host', 'Last Host'];
      const splitData = snResult.splits.map(s => [s.cidr, s.hosts.toLocaleString(), s.network, s.broadcast, s.firstHost, s.lastHost]);

      doc.addPage();
      addLogoToPage(doc);
      doc.setFontSize(14);
      doc.text("Subnet Splits Detail", 14, logo ? 35 : 20);
      autoTable(doc, {
        head: [splitHeaders],
        body: splitData,
        startY: logo ? 40 : 25,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [112, 48, 160] },
      });
    }

    doc.save(`${filename}-${new Date().getTime()}.pdf`);
  };

  // --- Handlers ---

  const handleVcpuCalc = () => {
    const v = parseFloat(vInput.vcpu);
    const f = parseFloat(vInput.freq);
    const u = parseFloat(vInput.util);
    if (isNaN(v) || isNaN(f) || isNaN(u)) return;
    const res = calculateVcpu(v, f, u);
    setVResult(res);
    setVHistory(prev => [res, ...prev].slice(0, 10));
  };

  const handlePcpuCalc = () => {
    const s = parseFloat(pInput.sockets);
    const c = parseFloat(pInput.cores);
    const t = parseFloat(pInput.threads);
    const f = parseFloat(pInput.freq);
    const u = parseFloat(pInput.util);
    const tdp = pInput.tdp ? parseFloat(pInput.tdp) : null;
    if (isNaN(s) || isNaN(c) || isNaN(t) || isNaN(f) || isNaN(u)) return;
    const res = calculatePcpu(s, c, t, f, u, tdp);
    setPResult(res);
    setPHistory(prev => [res, ...prev].slice(0, 10));
  };

  const handleSubnetCalc = () => {
    const res = calculateSubnet(snInput.ip, snInput.mask);
    if (res) {
      setSnResult(res);
      setSnHistory(prev => [res, ...prev].slice(0, 10));
    }
  };

  const handleStorageCalc = () => {
    const d = parseFloat(stInput.drives);
    const c = parseFloat(stInput.cap);
    const u = parseFloat(stInput.used);
    const o = parseFloat(stInput.overhead);
    if (isNaN(d) || isNaN(c) || isNaN(u) || isNaN(o)) return;
    const res = calculateStorage(d, c, stInput.raid, u, o, stUnit);
    setStResult(res);
    setStHistory(prev => [res, ...prev].slice(0, 10));
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-7 py-3.5 backdrop-blur-md transition-all">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            {logo ? (
              <img src={logo} alt="Logo" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)] text-xl font-extrabold text-white">⚙</div>
            )}
            <label className="absolute -right-1 -bottom-1 flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[10px] transition-colors hover:bg-[var(--accent-dim)]">
              📁
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
          <div>
            <div className="text-[0.98rem] font-extrabold tracking-tight text-[var(--text-primary)]">IT Infrastructure Capacity Tools</div>
            <div className="mt-0.5 font-mono text-[0.68rem] text-[var(--text-sec)]">infrastructure planning · v2.0</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-input)]">
            <button 
              onClick={exportCSV}
              title="Export CSV"
              className="flex h-9 items-center gap-1.5 px-3 text-[0.76rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
            >
              <Download size={13} />
              CSV
            </button>
            <div className="h-4 w-[1px] bg-[var(--border)]" />
            <button 
              onClick={exportXLS}
              title="Export Excel"
              className="flex h-9 items-center gap-1.5 px-3 text-[0.76rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
            >
              <TableIcon size={13} />
              XLS
            </button>
            <div className="h-4 w-[1px] bg-[var(--border)]" />
            <button 
              onClick={exportPDF}
              title="Export PDF"
              className="flex h-9 items-center gap-1.5 px-3 text-[0.76rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
            >
              <FileText size={13} />
              PDF
            </button>
          </div>
          
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-1">
            {[
              { id: 'light', icon: <Sun size={14} />, color: '#ffffff', title: 'Light' },
              { id: 'dark', icon: <Moon size={14} />, color: '#1c1c1a', title: 'Dark' },
              { id: 'slate', icon: <Palette size={14} />, color: '#1e293b', title: 'Slate' },
              { id: 'emerald', icon: <Palette size={14} />, color: '#065f46', title: 'Emerald' },
              { id: 'amber', icon: <Palette size={14} />, color: '#78350f', title: 'Amber' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                title={t.title}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                  theme === t.id 
                    ? "bg-[var(--accent)] text-white shadow-sm" 
                    : "text-[var(--text-sec)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
                )}
              >
                {t.icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-0.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] px-7 transition-all">
        {[
          { id: 'vcpu', label: 'vCPU Utilization', icon: <Monitor size={14} /> },
          { id: 'pcpu', label: 'Physical CPU', icon: <Cpu size={14} /> },
          { id: 'subnet', label: 'Subnet Calculator', icon: <Globe size={14} /> },
          { id: 'storage', label: 'Storage Capacity', icon: <Database size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-[2.5px] px-5 py-3 text-[0.8rem] font-bold tracking-wide transition-all",
              activeTab === tab.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text-primary)]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-[960px] px-5 pt-8 pb-16">
        {/* Global SVG Definitions for PRTG-style 3D Effects */}
        <svg width="0" height="0" className="absolute">
          <defs>
            {/* PRTG Glossy Gradients - Refined for "Split" Gloss Look */}
            <linearGradient id="prtgGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#26e686" />
              <stop offset="48%" stopColor="#00b050" />
              <stop offset="50%" stopColor="#009a46" />
              <stop offset="100%" stopColor="#00803a" />
            </linearGradient>
            <linearGradient id="prtgOrange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffdb4d" />
              <stop offset="48%" stopColor="#ffc000" />
              <stop offset="50%" stopColor="#e6ac00" />
              <stop offset="100%" stopColor="#cc9900" />
            </linearGradient>
            <linearGradient id="prtgRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4d4d" />
              <stop offset="48%" stopColor="#ff0000" />
              <stop offset="50%" stopColor="#e60000" />
              <stop offset="100%" stopColor="#cc0000" />
            </linearGradient>
            <linearGradient id="prtgBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4dd2ff" />
              <stop offset="48%" stopColor="#00b0f0" />
              <stop offset="50%" stopColor="#009ed8" />
              <stop offset="100%" stopColor="#008bc0" />
            </linearGradient>
            <linearGradient id="prtgGray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f0f0" />
              <stop offset="48%" stopColor="#d0d0d0" />
              <stop offset="50%" stopColor="#b0b0b0" />
              <stop offset="100%" stopColor="#909090" />
            </linearGradient>

            {/* Glossy Overlay */}
            <linearGradient id="glossOverlay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity={0.4} />
              <stop offset="48%" stopColor="white" stopOpacity={0.1} />
              <stop offset="50%" stopColor="black" stopOpacity={0.05} />
              <stop offset="100%" stopColor="black" stopOpacity={0.15} />
            </linearGradient>

            <filter id="prtgShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
            </filter>
            
            <filter id="prtgBevel">
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
              <feSpecularLighting in="blur" surfaceScale="2" specularConstant="1" specularExponent="20" lightingColor="#ffffff" result="specOut">
                <fePointLight x="-5000" y="-10000" z="20000" />
              </feSpecularLighting>
              <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
              <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litGraphic" />
            </filter>
          </defs>
        </svg>
        
        {/* vCPU Tab */}
        {activeTab === 'vcpu' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-3 font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Configuration Inputs</div>
            <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
              <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">vCPUs Allocated <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">integer</span></label>
                  <input 
                    type="number" 
                    value={vInput.vcpu}
                    onChange={(e) => setVInput({ ...vInput, vcpu: e.target.value })}
                    placeholder="e.g. 72" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">CPU Base Frequency <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">GHz</span></label>
                  <input 
                    type="number" 
                    value={vInput.freq}
                    onChange={(e) => setVInput({ ...vInput, freq: e.target.value })}
                    placeholder="e.g. 3.2" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Observed CPU Utilization <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">GHz</span></label>
                  <input 
                    type="number" 
                    value={vInput.util}
                    onChange={(e) => setVInput({ ...vInput, util: e.target.value })}
                    placeholder="e.g. 227.616" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={handleVcpuCalc} className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-[0.85rem] font-bold tracking-wide text-white transition-all hover:opacity-90 active:scale-95">Calculate</button>
                <button onClick={() => { setVInput({ vcpu: '', freq: '', util: '' }); setVResult(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[0.8rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]">Reset</button>
                <button 
                  onClick={() => { setVInput({ vcpu: '72', freq: '3.2', util: '227.616' }); }} 
                  className="ml-auto rounded-lg border-[1.5px] border-dashed border-[var(--accent)] px-4 py-2.5 font-mono text-[0.72rem] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent-dim)]"
                >
                  Load Sample
                </button>
              </div>
            </div>

            {vResult && (
              <div className="mt-7 space-y-4">
                <div className="font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Results</div>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  <MetricCard label="Total Capacity" value={vResult.capacity.toLocaleString()} unit="GHz" />
                  <MetricCard label="Observed" value={vResult.observed.toLocaleString()} unit="GHz" />
                  <MetricCard label="Utilization %" value={vResult.utilization.toFixed(2)} unit="percent" status={vResult.status.cls} />
                  <MetricCard label="Headroom" value={vResult.headroom.toLocaleString()} unit="GHz remaining" />
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4.5 shadow-[var(--shadow)]">
                  <StatusBadge status={vResult.status} />
                  <p className="flex-1 text-[0.82rem] leading-relaxed text-[var(--text-sec)]">
                    <strong className="text-[var(--text-primary)]">vCPU Status:</strong> {vResult.status.msg}
                  </p>
                </div>

                <ProgressBar 
                  title="Utilization vs Capacity" 
                  pct={vResult.utilization} 
                  status={vResult.status.cls} 
                  thresholds={['0%', 'Normal ≤80%', 'High ≤100%', '↑ Over']} 
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Capacity Breakdown (GHz)</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={[{ name: 'CPU', used: vResult.observed, headroom: Math.max(0, vResult.headroom), overflow: Math.max(0, vResult.observed - vResult.capacity) }]} margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis type="number" fontSize={10} fontFamily="JetBrains Mono" stroke="var(--text-sec)" />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="top" align="left" height={40} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingBottom: '20px' }} />
                          <Bar dataKey="used" name="Used (GHz)" stackId="a" fill="url(#prtgGreen)" filter="url(#prtgBevel)" radius={[2, 0, 0, 2]} barSize={32} isAnimationActive={false} />
                          <Bar dataKey="headroom" name="Headroom (GHz)" stackId="a" fill="url(#prtgGray)" filter="url(#prtgShadow)" barSize={32} isAnimationActive={false} />
                          <Bar dataKey="overflow" name="Overflow (GHz)" stackId="a" fill="url(#prtgRed)" filter="url(#prtgBevel)" radius={[0, 2, 2, 0]} barSize={32} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Utilization Share</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Used', value: vResult.observed },
                              { name: 'Headroom', value: Math.max(0, vResult.headroom) }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="var(--bg-card)"
                            strokeWidth={2}
                            isAnimationActive={false}
                          >
                            <Cell fill="url(#prtgGreen)" filter="url(#prtgBevel)" />
                            <Cell fill="url(#prtgGray)" filter="url(#prtgShadow)" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="bottom" height={40} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* vCPU Trend */}
                {vHistory.length > 1 && (
                  <div className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
                    <div className="mb-3 font-sans text-[10px] font-bold tracking-widest uppercase text-[var(--text-sec)]">Utilization Trend (%)</div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[...vHistory].reverse()}>
                          <defs>
                            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00b0f0" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00b0f0" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                          <XAxis hide />
                          <YAxis domain={[0, 100]} fontSize={10} fontFamily="sans-serif" stroke="var(--text-sec)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'sans-serif' }}
                          />
                          <Area type="monotone" dataKey="utilization" name="Util %" stroke="#00b0f0" strokeWidth={2} fillOpacity={1} fill="url(#trendGradient)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* vCPU History */}
                {vHistory.length > 0 && (
                  <div className="mt-10">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Calculation History</div>
                      <button 
                        onClick={() => setVHistory([])}
                        className="font-mono text-[10px] font-bold uppercase text-[var(--ov)] hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)]">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse font-mono text-[0.74rem]">
                          <thead>
                            <tr className="bg-[var(--bg)]">
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">#</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Capacity</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Observed</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Util%</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Status</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-right text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vHistory.map((h, i) => (
                              <tr key={i} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-dim)]">
                                <td className="px-5 py-3 text-[var(--text-mono)]">{vHistory.length - i}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.capacity.toLocaleString()} GHz</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.observed.toLocaleString()} GHz</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.utilization.toFixed(2)}%</td>
                                <td className="px-5 py-3">
                                  <span className={cn(
                                    "inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase",
                                    h.status.cls === 'ok' ? "bg-[var(--ok-bg)] text-[var(--ok)]" : h.status.cls === 'hi' ? "bg-[var(--hi-bg)] text-[var(--hi)]" : "bg-[var(--ov-bg)] text-[var(--ov)]"
                                  )}>
                                    {h.status.label}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button 
                                    onClick={() => setVHistory(vHistory.filter((_, idx) => idx !== i))}
                                    className="text-[var(--text-sec)] transition-colors hover:text-[var(--ov)]"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* pCPU Tab */}
        {activeTab === 'pcpu' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-3 font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Configuration Inputs</div>
            <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
              <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Physical Sockets <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">integer</span></label>
                  <input 
                    type="number" 
                    value={pInput.sockets}
                    onChange={(e) => setPInput({ ...pInput, sockets: e.target.value })}
                    placeholder="e.g. 2" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Cores per Socket <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">integer</span></label>
                  <input 
                    type="number" 
                    value={pInput.cores}
                    onChange={(e) => setPInput({ ...pInput, cores: e.target.value })}
                    placeholder="e.g. 16" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Threads per Core <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">integer (HT)</span></label>
                  <input 
                    type="number" 
                    value={pInput.threads}
                    onChange={(e) => setPInput({ ...pInput, threads: e.target.value })}
                    placeholder="e.g. 2" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">CPU Base Frequency <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">GHz</span></label>
                  <input 
                    type="number" 
                    value={pInput.freq}
                    onChange={(e) => setPInput({ ...pInput, freq: e.target.value })}
                    placeholder="e.g. 2.9" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Observed Utilization <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">%</span></label>
                  <input 
                    type="number" 
                    value={pInput.util}
                    onChange={(e) => setPInput({ ...pInput, util: e.target.value })}
                    placeholder="e.g. 75" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">TDP per Socket <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">Watts (optional)</span></label>
                  <input 
                    type="number" 
                    value={pInput.tdp}
                    onChange={(e) => setPInput({ ...pInput, tdp: e.target.value })}
                    placeholder="e.g. 205" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={handlePcpuCalc} className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-[0.85rem] font-bold tracking-wide text-white transition-all hover:opacity-90 active:scale-95">Calculate</button>
                <button onClick={() => { setPInput({ sockets: '', cores: '', threads: '', freq: '', util: '', tdp: '' }); setPResult(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[0.8rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]">Reset</button>
                <button 
                  onClick={() => { setPInput({ sockets: '2', cores: '16', threads: '2', freq: '2.9', util: '75', tdp: '205' }); }} 
                  className="ml-auto rounded-lg border-[1.5px] border-dashed border-[var(--accent)] px-4 py-2.5 font-mono text-[0.72rem] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent-dim)]"
                >
                  Load Sample
                </button>
              </div>
            </div>

            {pResult && (
              <div className="mt-7 space-y-4">
                <div className="font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Results</div>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                  <MetricCard label="Total Physical Cores" value={pResult.totalCores.toString()} unit="cores" />
                  <MetricCard label="Total Logical CPUs" value={pResult.totalLogical.toString()} unit="threads" />
                  <MetricCard label="Peak Throughput" value={pResult.peakGhz.toFixed(2)} unit="GHz total" />
                  <MetricCard label="Used Throughput" value={pResult.usedGhz.toFixed(2)} unit="GHz @ util" />
                  <MetricCard label="Utilization" value={pResult.utilization.toFixed(2)} unit="percent" status={pResult.status.cls} />
                  <MetricCard label="Est. Power Draw" value={pResult.estPower ? `${pResult.estPower.toFixed(0)} W` : 'N/A'} unit="Watts" />
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4.5 shadow-[var(--shadow)]">
                  <StatusBadge status={pResult.status} />
                  <p className="flex-1 text-[0.82rem] leading-relaxed text-[var(--text-sec)]">
                    <strong className="text-[var(--text-primary)]">Physical CPU Status:</strong> {pResult.status.msg}
                  </p>
                </div>

                <ProgressBar 
                  title="CPU Utilization" 
                  pct={pResult.utilization} 
                  status={pResult.status.cls} 
                  thresholds={['0%', 'Normal ≤80%', 'High ≤100%', '↑ Over']} 
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Throughput Breakdown (GHz)</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={[{ name: 'Throughput', used: pResult.usedGhz, headroom: Math.max(0, pResult.peakGhz - pResult.usedGhz) }]} margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis type="number" fontSize={10} fontFamily="JetBrains Mono" stroke="var(--text-sec)" />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="top" align="left" height={40} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingBottom: '20px' }} />
                          <Bar dataKey="used" name="Used (GHz)" stackId="a" fill="url(#prtgGreen)" filter="url(#prtgBevel)" radius={[2, 0, 0, 2]} barSize={32} isAnimationActive={false} />
                          <Bar dataKey="headroom" name="Headroom (GHz)" stackId="a" fill="url(#prtgGray)" filter="url(#prtgShadow)" radius={[0, 2, 2, 0]} barSize={32} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Core Topology</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Physical Cores', value: pResult.totalCores },
                              { name: 'Logical Threads', value: pResult.totalLogical - pResult.totalCores }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="var(--bg-card)"
                            strokeWidth={2}
                            isAnimationActive={false}
                          >
                            <Cell fill="url(#prtgBlue)" filter="url(#prtgBevel)" />
                            <Cell fill="url(#prtgGray)" filter="url(#prtgShadow)" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="bottom" height={40} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* pCPU Trend */}
                {pHistory.length > 1 && (
                  <div className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
                    <div className="mb-3 font-sans text-[10px] font-bold tracking-widest uppercase text-[var(--text-sec)]">Utilization Trend (%)</div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[...pHistory].reverse()}>
                          <defs>
                            <linearGradient id="pTrendGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7030a0" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#7030a0" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                          <XAxis hide />
                          <YAxis domain={[0, 100]} fontSize={10} fontFamily="sans-serif" stroke="var(--text-sec)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'sans-serif' }}
                          />
                          <Area type="monotone" dataKey="utilization" name="Util %" stroke="#7030a0" strokeWidth={2} fillOpacity={1} fill="url(#pTrendGradient)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* pCPU History */}
                {pHistory.length > 0 && (
                  <div className="mt-10">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Calculation History</div>
                      <button 
                        onClick={() => setPHistory([])}
                        className="font-mono text-[10px] font-bold uppercase text-[var(--ov)] hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)]">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse font-mono text-[0.74rem]">
                          <thead>
                            <tr className="bg-[var(--bg)]">
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">#</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Peak GHz</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Used GHz</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Util%</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Power</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Status</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-right text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pHistory.map((h, i) => (
                              <tr key={i} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-dim)]">
                                <td className="px-5 py-3 text-[var(--text-mono)]">{pHistory.length - i}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.peakGhz.toFixed(2)} GHz</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.usedGhz.toFixed(2)} GHz</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.utilization.toFixed(2)}%</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.estPower ? `${h.estPower.toFixed(0)} W` : 'N/A'}</td>
                                <td className="px-5 py-3">
                                  <span className={cn(
                                    "inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase",
                                    h.status.cls === 'ok' ? "bg-[var(--ok-bg)] text-[var(--ok)]" : h.status.cls === 'hi' ? "bg-[var(--hi-bg)] text-[var(--hi)]" : "bg-[var(--ov-bg)] text-[var(--ov)]"
                                  )}>
                                    {h.status.label}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button 
                                    onClick={() => setPHistory(pHistory.filter((_, idx) => idx !== i))}
                                    className="text-[var(--text-sec)] transition-colors hover:text-[var(--ov)]"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Subnet Tab */}
        {activeTab === 'subnet' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-3 font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Network Input</div>
            <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
              <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">IP Address <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">IPv4</span></label>
                  <input 
                    type="text" 
                    value={snInput.ip}
                    onChange={(e) => setSnInput({ ...snInput, ip: e.target.value })}
                    placeholder="e.g. 192.168.1.0" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Subnet Mask / CIDR <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">prefix or mask</span></label>
                  <input 
                    type="text" 
                    value={snInput.mask}
                    onChange={(e) => setSnInput({ ...snInput, mask: e.target.value })}
                    placeholder="e.g. /24 or 255.255.255.0" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={handleSubnetCalc} className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-[0.85rem] font-bold tracking-wide text-white transition-all hover:opacity-90 active:scale-95">Calculate</button>
                <button onClick={() => { setSnInput({ ip: '', mask: '' }); setSnResult(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[0.8rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]">Reset</button>
                <button 
                  onClick={() => { setSnInput({ ip: '10.10.0.0', mask: '/22' }); }} 
                  className="ml-auto rounded-lg border-[1.5px] border-dashed border-[var(--accent)] px-4 py-2.5 font-mono text-[0.72rem] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent-dim)]"
                >
                  Load Sample
                </button>
              </div>
            </div>

            {snResult && (
              <div className="mt-7 space-y-4">
                <div className="font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Subnet Details</div>
                <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: 'Network Address', value: snResult.network },
                      { label: 'Broadcast Address', value: snResult.broadcast },
                      { label: 'Subnet Mask', value: snResult.mask },
                      { label: 'Wildcard Mask', value: snResult.wildcard },
                      { label: 'CIDR Prefix', value: snResult.cidr },
                      { label: 'Host Range', value: snResult.range },
                      { label: 'Usable Hosts', value: snResult.hosts.toLocaleString() },
                      { label: 'IP Class', value: snResult.ipClass },
                      { label: 'IP Type', value: snResult.ipType },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="font-mono text-[0.63rem] font-bold tracking-[0.1em] uppercase text-[var(--text-sec)]">{item.label}</div>
                        <div className="font-mono text-[0.95rem] font-medium text-[var(--text-primary)]">{item.value}</div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                      <div className="font-mono text-[0.63rem] font-bold tracking-[0.1em] uppercase text-[var(--text-sec)]">Binary Mask</div>
                      <div className="break-all font-mono text-[0.75rem] font-medium text-[var(--text-primary)]">{snResult.binMask}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Subnet Splits (/24 or smaller)</div>
                <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)]">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-mono text-[0.74rem]">
                      <thead>
                        <tr className="bg-[var(--bg)]">
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">CIDR</th>
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">Hosts</th>
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">Network</th>
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">Broadcast</th>
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">First Host</th>
                          <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[0.62rem] font-bold tracking-wider uppercase text-[var(--text-sec)]">Last Host</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snResult.splits.map((split, i) => (
                          <tr key={i} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-dim)]">
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.cidr}</td>
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.hosts.toLocaleString()}</td>
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.network}</td>
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.broadcast}</td>
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.firstHost}</td>
                            <td className="px-4 py-2 text-[var(--text-mono)]">{split.lastHost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Storage Configuration</div>
              <div className="flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-input)]">
                <button 
                  onClick={() => setStUnit('GB')}
                  className={cn(
                    "px-3 py-1 font-mono text-[0.65rem] font-bold transition-all",
                    stUnit === 'GB' ? "bg-[var(--accent)] text-white" : "text-[var(--text-sec)] hover:bg-[var(--accent-dim)]"
                  )}
                >
                  GB
                </button>
                <button 
                  onClick={() => setStUnit('TB')}
                  className={cn(
                    "px-3 py-1 font-mono text-[0.65rem] font-bold transition-all",
                    stUnit === 'TB' ? "bg-[var(--accent)] text-white" : "text-[var(--text-sec)] hover:bg-[var(--accent-dim)]"
                  )}
                >
                  TB
                </button>
              </div>
            </div>
            <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
              <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Number of Drives <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">integer</span></label>
                  <input 
                    type="number" 
                    value={stInput.drives}
                    onChange={(e) => setStInput({ ...stInput, drives: e.target.value })}
                    placeholder="e.g. 12" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Drive Capacity <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">{stUnit}</span></label>
                  <input 
                    type="number" 
                    value={stInput.cap}
                    onChange={(e) => setStInput({ ...stInput, cap: e.target.value })}
                    placeholder={stUnit === 'TB' ? "e.g. 4" : "e.g. 4096"} 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">RAID Level</label>
                  <select 
                    value={stInput.raid}
                    onChange={(e) => setStInput({ ...stInput, raid: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]"
                  >
                    <option value="0">RAID 0 (Striping)</option>
                    <option value="1">RAID 1 (Mirroring)</option>
                    <option value="5">RAID 5 (Distributed Parity)</option>
                    <option value="6">RAID 6 (Dual Parity)</option>
                    <option value="10">RAID 10 (Stripe + Mirror)</option>
                    <option value="none">No RAID (JBOD)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Used Capacity <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">{stUnit}</span></label>
                  <input 
                    type="number" 
                    value={stInput.used}
                    onChange={(e) => setStInput({ ...stInput, used: e.target.value })}
                    placeholder={stUnit === 'TB' ? "e.g. 18" : "e.g. 18432"} 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.76rem] font-semibold text-[var(--text-sec)]">Overhead / Reserve <span className="font-mono text-[0.68rem] font-medium text-[var(--accent)]">%</span></label>
                  <input 
                    type="number" 
                    value={stInput.overhead}
                    onChange={(e) => setStInput({ ...stInput, overhead: e.target.value })}
                    placeholder="e.g. 10" 
                    className="w-full rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-base text-[var(--text-mono)] outline-none transition-all focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-dim)]" 
                  />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={handleStorageCalc} className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-[0.85rem] font-bold tracking-wide text-white transition-all hover:opacity-90 active:scale-95">Calculate</button>
                <button onClick={() => { setStInput({ drives: '', cap: '', raid: '5', used: '', overhead: '10' }); setStResult(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[0.8rem] font-semibold text-[var(--text-sec)] transition-all hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]">Reset</button>
                <button 
                  onClick={() => { 
                    if (stUnit === 'TB') {
                      setStInput({ drives: '12', cap: '4', raid: '5', used: '18', overhead: '10' }); 
                    } else {
                      setStInput({ drives: '12', cap: '4096', raid: '5', used: '18432', overhead: '10' }); 
                    }
                  }} 
                  className="ml-auto rounded-lg border-[1.5px] border-dashed border-[var(--accent)] px-4 py-2.5 font-mono text-[0.72rem] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent-dim)]"
                >
                  Load Sample
                </button>
              </div>
            </div>

            {stResult && (
              <div className="mt-7 space-y-4">
                <div className="font-mono text-[0.67rem] font-bold tracking-[0.12em] uppercase text-[var(--text-sec)]">Results</div>
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                  <MetricCard label="Raw Capacity" value={stResult.raw.toLocaleString()} unit={stUnit} />
                  <MetricCard label="Usable Capacity" value={stResult.usable.toLocaleString()} unit={stUnit} />
                  <MetricCard label="Net Available" value={stResult.netAvail.toLocaleString()} unit={`${stUnit} (after reserve)`} />
                  <MetricCard label="Used" value={stResult.used.toLocaleString()} unit={stUnit} />
                  <MetricCard label="Free" value={stResult.free.toLocaleString()} unit={stUnit} />
                  <MetricCard label="Utilization %" value={stResult.utilization.toFixed(2)} unit="percent" status={stResult.status.cls} />
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4.5 shadow-[var(--shadow)]">
                  <StatusBadge status={stResult.status} />
                  <p className="flex-1 text-[0.82rem] leading-relaxed text-[var(--text-sec)]">
                    <strong className="text-[var(--text-primary)]">Storage Status:</strong> {stResult.status.msg}
                  </p>
                </div>

                <ProgressBar 
                  title="Storage Utilization" 
                  pct={stResult.utilization} 
                  status={stResult.status.cls} 
                  thresholds={['0%', 'Good ≤70%', 'Warning ≤85%', '↑ Critical']} 
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Storage Breakdown ({stUnit})</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={[{ name: 'Storage', used: stResult.used, free: stResult.free, reserve: stResult.usable - stResult.netAvail, parity: stResult.raw - stResult.usable }]} margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.4} />
                          <XAxis type="number" fontSize={10} fontFamily="JetBrains Mono" stroke="var(--text-sec)" />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="top" align="left" height={60} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingBottom: '20px' }} />
                          <Bar dataKey="used" name={`Used (${stUnit})`} stackId="a" fill="url(#prtgGreen)" filter="url(#prtgBevel)" radius={[2, 0, 0, 2]} barSize={32} isAnimationActive={false} />
                          <Bar dataKey="free" name={`Free (${stUnit})`} stackId="a" fill="url(#prtgGray)" filter="url(#prtgShadow)" barSize={32} isAnimationActive={false} />
                          <Bar dataKey="reserve" name={`Reserve (${stUnit})`} stackId="a" fill="url(#prtgOrange)" filter="url(#prtgBevel)" barSize={32} isAnimationActive={false} />
                          <Bar dataKey="parity" name={`RAID Parity (${stUnit})`} stackId="a" fill="#d1d1d1" filter="url(#prtgShadow)" radius={[0, 2, 2, 0]} barSize={32} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow)]">
                    <div className="mb-6 font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Capacity Share</div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Used', value: stResult.used },
                              { name: 'Free', value: stResult.free },
                              { name: 'Reserve', value: stResult.usable - stResult.netAvail },
                              { name: 'RAID Parity', value: stResult.raw - stResult.usable }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="var(--bg-card)"
                            strokeWidth={2}
                            isAnimationActive={false}
                          >
                            <Cell fill="url(#prtgGreen)" filter="url(#prtgBevel)" />
                            <Cell fill="url(#prtgGray)" filter="url(#prtgShadow)" />
                            <Cell fill="url(#prtgOrange)" filter="url(#prtgBevel)" />
                            <Cell fill="#d1d1d1" filter="url(#prtgShadow)" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                          />
                          <Legend verticalAlign="bottom" height={60} iconType="rect" wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Storage Trend */}
                {stHistory.length > 1 && (
                  <div className="mt-4 rounded-sm border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
                    <div className="mb-3 font-sans text-[10px] font-bold tracking-widest uppercase text-[var(--text-sec)]">Used Capacity Trend ({stUnit})</div>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[...stHistory].reverse()}>
                          <defs>
                            <linearGradient id="stTrendGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00b050" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00b050" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                          <XAxis hide />
                          <YAxis fontSize={10} fontFamily="sans-serif" stroke="var(--text-sec)" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '4px', fontSize: '12px', fontFamily: 'sans-serif' }}
                          />
                          <Area type="monotone" dataKey="used" name={`Used (${stUnit})`} stroke="#00b050" strokeWidth={2} fillOpacity={1} fill="url(#stTrendGradient)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Storage History */}
                {stHistory.length > 0 && (
                  <div className="mt-10">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--text-sec)]">Calculation History</div>
                      <button 
                        onClick={() => setStHistory([])}
                        className="font-mono text-[10px] font-bold uppercase text-[var(--ov)] hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow)]">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse font-mono text-[0.74rem]">
                          <thead>
                            <tr className="bg-[var(--bg)]">
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">#</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Usable</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Used</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Free</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Util%</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Status</th>
                              <th className="border-b border-[var(--border)] px-5 py-3 text-right text-[10px] font-bold tracking-wider uppercase text-[var(--text-sec)]">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stHistory.map((h, i) => (
                              <tr key={i} className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--accent-dim)]">
                                <td className="px-5 py-3 text-[var(--text-mono)]">{stHistory.length - i}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.usable.toLocaleString()} {stUnit}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.used.toLocaleString()} {stUnit}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.free.toLocaleString()} {stUnit}</td>
                                <td className="px-5 py-3 text-[var(--text-mono)]">{h.utilization.toFixed(2)}%</td>
                                <td className="px-5 py-3">
                                  <span className={cn(
                                    "inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase",
                                    h.status.cls === 'ok' ? "bg-[var(--ok-bg)] text-[var(--ok)]" : h.status.cls === 'hi' ? "bg-[var(--hi-bg)] text-[var(--hi)]" : "bg-[var(--ov-bg)] text-[var(--ov)]"
                                  )}>
                                    {h.status.label}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button 
                                    onClick={() => setStHistory(stHistory.filter((_, idx) => idx !== i))}
                                    className="text-[var(--text-sec)] transition-colors hover:text-[var(--ov)]"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
