import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  Search, TrendingUp, Calendar, DollarSign, Target,
  BarChart3, AlertCircle, Loader2, Info, ArrowUpRight, ArrowDownRight,
  Clock, Activity, ChevronDown, Zap, HelpCircle, Plus, X, PieChart,
} from 'lucide-react';

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api';

const STOCK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

function formatShekel(num) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatShekelExact(num) { // eslint-disable-line no-unused-vars
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function Tip({ text }) {
  return (
    <span className="group/tip relative inline-flex cursor-help">
      <HelpCircle className="w-3.5 h-3.5 text-textMuted/60 hover:text-primary transition-colors" />
      <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 border border-white/10 rounded-lg shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none w-56 text-center z-50 leading-relaxed">
        {text}
      </span>
    </span>
  );
}

function getIndexColor(idx) {
  const map = {
    'TA-35': 'bg-blue-500/20 text-blue-400',
    'TA-90': 'bg-purple-500/20 text-purple-400',
    'SME': 'bg-cyan-500/20 text-cyan-400',
  };
  return map[idx] || 'bg-gray-500/20 text-gray-400';
}

function getIndexLabel(idx) {
  const map = { 'TA-35': 'ת"א 35', 'TA-90': 'ת"א 90', 'SME': 'יתר' };
  return map[idx] || idx;
}

const PERIOD_PRESETS = [
  { label: 'שנה', months: 12 },
  { label: '3 שנים', months: 36 },
  { label: '5 שנים', months: 60 },
  { label: '10 שנים', months: 120 },
];

function PortfolioChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl text-xs" dir="rtl">
      <p className="text-textMuted mb-1.5">{data.date}</p>
      <p className="text-white font-bold mb-1">שווי תיק: {formatShekel(data.value)}</p>
      <p className={data.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        תשואה: {data.returnPct >= 0 ? '+' : ''}{data.returnPct}%
      </p>
      {payload.filter(p => p.dataKey !== 'value' && p.dataKey !== 'returnPct' && p.dataKey !== 'date').map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="mt-0.5">
          {p.name}: {formatShekel(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function Simulator() {
  // Portfolio holdings
  const [holdings, setHoldings] = useState([]);
  const [stockQuery, setStockQuery] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState('50,000');
  const [periodMonths, setPeriodMonths] = useState(36);
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState('');
  const dropdownRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchStocks = useCallback(async (q) => {
    if (!q || q.length < 1) { setStockResults([]); return; }
    try {
      const res = await axios.get(`${API_BASE}/simulator/stocks?q=${encodeURIComponent(q)}`);
      setStockResults(res.data);
      setShowDropdown(true);
    } catch { setStockResults([]); }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setStockQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchStocks(val), 200);
  };

  const addStock = (stock) => {
    if (holdings.find(h => h.symbol === stock.symbol)) return;
    const remaining = 100 - holdings.reduce((s, h) => s + h.weight, 0);
    const defaultWeight = Math.max(5, Math.min(remaining, Math.round(100 / (holdings.length + 1))));
    setHoldings([...holdings, { ...stock, weight: defaultWeight }]);
    setStockQuery('');
    setStockResults([]);
    setShowDropdown(false);
  };

  const removeStock = (symbol) => {
    setHoldings(holdings.filter(h => h.symbol !== symbol));
  };

  const updateWeight = (symbol, newWeight) => {
    setHoldings(holdings.map(h => h.symbol === symbol ? { ...h, weight: Math.max(0, Math.min(100, newWeight)) } : h));
  };

  const equalizeWeights = () => {
    if (!holdings.length) return;
    const w = parseFloat((100 / holdings.length).toFixed(1));
    setHoldings(holdings.map((h, i) =>
      ({ ...h, weight: i === holdings.length - 1 ? parseFloat((100 - w * (holdings.length - 1)).toFixed(1)) : w })
    ));
  };

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);

  const runSimulation = async () => {
    if (holdings.length === 0) {
      setSimError('יש להוסיף לפחות מניה אחת לתיק');
      return;
    }
    if (Math.abs(totalWeight - 100) > 1) {
      setSimError(`סך המשקלים חייב להיות 100%. כרגע: ${totalWeight.toFixed(1)}%`);
      return;
    }
    const num = parseFloat(amount.replace(/,/g, ''));
    if (!num || num < 100) {
      setSimError('סכום מינימלי: ₪100');
      return;
    }

    setSimulating(true);
    setSimError('');
    setSimulation(null);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    try {
      const res = await axios.post(`${API_BASE}/simulator/portfolio`, {
        holdings: holdings.map(h => ({ symbol: h.symbol, weight: h.weight })),
        amount: num,
        startDate: startDate.toISOString().split('T')[0],
        endDate,
      });
      setSimulation(res.data);
    } catch (err) {
      setSimError(err.response?.data?.error || 'שגיאה בהרצת הסימולציה');
    } finally {
      setSimulating(false);
    }
  };

  const sim = simulation;
  const isProfit = sim?.summary?.returnPct >= 0;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-white">סימולטור תיק השקעות היסטורי</h3>
        </div>
        <p className="text-sm text-textMuted mb-6 leading-relaxed">
          בנה תיק השקעות וירטואלי מכמה מניות, קבע משקל לכל מניה — וגלה מה היה קורה
          <strong className="text-white"> אילו השקעת בפועל</strong>. הנתונים מבוססים על מחירים היסטוריים אמיתיים.
        </p>

        {/* Stock Search + Add */}
        <div className="mb-4">
          <label className="block text-xs text-textMuted mb-1.5 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף מניה לתיק
          </label>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
              <input
                type="text"
                value={stockQuery}
                onChange={handleSearchChange}
                onFocus={() => { if (stockResults.length) setShowDropdown(true); }}
                placeholder="חפש מניה להוספה... (לדוגמה: לאומי, טבע, אלביט)"
                className="w-full pr-9 pl-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-textMuted focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>
            {showDropdown && stockResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto bg-gray-900 border border-white/10 rounded-xl shadow-2xl">
                {stockResults.map(stock => {
                  const alreadyAdded = holdings.find(h => h.symbol === stock.symbol);
                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => !alreadyAdded && addStock(stock)}
                      disabled={!!alreadyAdded}
                      className={`w-full text-right px-3 py-2.5 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}`}
                    >
                      <div>
                        <p className="text-sm text-white font-medium">{stock.name} {alreadyAdded ? '(כבר בתיק)' : ''}</p>
                        <p className="text-xs text-textMuted font-mono" dir="ltr">{stock.symbol}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-textMuted">{stock.sector}</span>
                        {stock.index && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${getIndexColor(stock.index)}`}>
                            {getIndexLabel(stock.index)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Holdings List */}
        {holdings.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-textMuted flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5" />
                מניות בתיק ({holdings.length})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={equalizeWeights} className="text-xs text-primary hover:text-white transition-colors">חלק שווה</button>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${Math.abs(totalWeight - 100) <= 1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {totalWeight.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {holdings.map((h, idx) => (
                <div key={h.symbol} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5 group">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{h.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-textMuted font-mono" dir="ltr">{h.symbol}</span>
                      {h.index && <span className={`text-xs px-1 py-0 rounded ${getIndexColor(h.index)}`}>{getIndexLabel(h.index)}</span>}
                      <span className="text-xs text-textMuted">{h.sector}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={h.weight}
                      onChange={(e) => updateWeight(h.symbol, parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white text-center font-mono focus:outline-none focus:border-primary/50"
                      dir="ltr"
                    />
                    <span className="text-xs text-textMuted">%</span>
                    <button onClick={() => removeStock(h.symbol)} className="p-1 rounded hover:bg-red-500/20 transition-colors opacity-60 hover:opacity-100">
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Weight bar */}
            <div className="mt-3 h-3 bg-white/5 rounded-full overflow-hidden flex">
              {holdings.map((h, idx) => (
                <div key={h.symbol} style={{ width: `${h.weight}%`, backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }} className="h-full opacity-60 first:rounded-r-full last:rounded-l-full transition-all duration-300" title={`${h.name}: ${h.weight}%`}></div>
              ))}
            </div>
          </div>
        )}

        {/* Amount + Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs text-textMuted mb-1.5 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> סכום השקעה כולל (₪)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setAmount(v ? Number(v).toLocaleString('en') : '');
              }}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-textMuted focus:outline-none focus:border-primary/50 transition-all font-mono"
              dir="ltr"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[10000, 50000, 100000, 500000].map(p => (
                <button key={p} onClick={() => setAmount(p.toLocaleString('en'))}
                  className="text-xs px-2 py-0.5 rounded bg-white/5 text-textMuted hover:text-white hover:bg-white/10 transition-colors">
                  {p >= 1000000 ? `${p / 1000000}M` : `${p / 1000}K`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-textMuted mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> תקופה
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PERIOD_PRESETS.map(p => (
                <button key={p.months} onClick={() => setPeriodMonths(p.months)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${periodMonths === p.months ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-textMuted border border-white/10 hover:bg-white/10'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={simulating || holdings.length === 0}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {simulating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> מריץ סימולציה לתיק...</>
          ) : (
            <><Activity className="w-5 h-5" /> הרץ סימולציית תיק ({holdings.length} מניות)</>
          )}
        </button>

        {simError && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            <AlertCircle className="w-4 h-4 inline ml-1" />{simError}
          </div>
        )}
      </div>

      {/* Simulation Results */}
      {sim && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Header */}
          <div className={`glass-panel p-6 border ${isProfit ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold text-white">תוצאות סימולציית התיק</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-textMuted">{sim.summary.stockCount} מניות</span>
                  <span className="text-xs text-textMuted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {sim.startDate} → {sim.endDate}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className={`text-3xl font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : ''}{sim.summary.returnPct.toFixed(1)}%
                </p>
                <p className="text-xs text-textMuted">תשואה כוללת לתיק</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/5">
                <p className="text-xs text-textMuted mb-1">השקעה כוללת</p>
                <p className="text-lg font-bold text-white" dir="ltr">{formatShekel(sim.summary.totalInvested)}</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${isProfit ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                <p className="text-xs text-textMuted mb-1">שווי נוכחי</p>
                <p className={`text-lg font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">{formatShekel(sim.summary.currentValue)}</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${isProfit ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                <p className="text-xs text-textMuted mb-1 flex items-center justify-center gap-0.5">
                  {isProfit ? <><ArrowUpRight className="w-3 h-3 text-emerald-400" /> רווח</> : <><ArrowDownRight className="w-3 h-3 text-red-400" /> הפסד</>}
                </p>
                <p className={`text-lg font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                  {isProfit ? '+' : ''}{formatShekel(sim.summary.profitLoss)}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/5">
                <p className="text-xs text-textMuted mb-1">תשואה שנתית</p>
                <p className={`text-lg font-bold ${sim.summary.annualizedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                  {sim.summary.annualizedReturn >= 0 ? '+' : ''}{sim.summary.annualizedReturn}%
                </p>
              </div>
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="glass-panel p-5">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              גרף שווי התיק לאורך זמן
            </h4>
            <div className="h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sim.timeline} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                    {sim.holdings.map((h, i) => (
                      <linearGradient key={h.symbol} id={`grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={STOCK_COLORS[i % STOCK_COLORS.length]} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={STOCK_COLORS[i % STOCK_COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(d) => { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getFullYear().toString().slice(2)}`; }}
                    interval={Math.max(1, Math.floor(sim.timeline.length / 12))} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} width={55} />
                  <RTooltip content={<PortfolioChartTooltip />} />
                  <ReferenceLine y={sim.summary.totalInvested} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1}
                    label={{ value: 'השקעה', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }} />
                  <Area type="monotone" dataKey="value" name="סה״כ תיק" stroke={isProfit ? '#10b981' : '#ef4444'}
                    strokeWidth={2.5} fill="url(#portfolioGradient)" animationDuration={1500} />
                  {sim.holdings.map((h, i) => (
                    <Area key={h.symbol} type="monotone" dataKey={h.symbol} name={h.name}
                      stroke={STOCK_COLORS[i % STOCK_COLORS.length]} strokeWidth={1} strokeDasharray="4 4"
                      fill={`url(#grad_${i})`} animationDuration={1500} />
                  ))}
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-Stock Breakdown */}
          <div className="glass-panel p-5">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              ביצועים לפי מניה
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-right text-xs text-textMuted py-2 px-2">מניה</th>
                    <th className="text-center text-xs text-textMuted py-2 px-2">משקל</th>
                    <th className="text-center text-xs text-textMuted py-2 px-2">הושקע</th>
                    <th className="text-center text-xs text-textMuted py-2 px-2">שווי נוכחי</th>
                    <th className="text-center text-xs text-textMuted py-2 px-2">רווח/הפסד</th>
                    <th className="text-center text-xs text-textMuted py-2 px-2">תשואה</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.holdings.map((h, idx) => (
                    <tr key={h.symbol} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }}></div>
                          <div>
                            <p className="text-white font-medium">{h.name}</p>
                            <p className="text-xs text-textMuted font-mono" dir="ltr">{h.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center text-textMuted py-2.5 px-2">{h.weight}%</td>
                      <td className="text-center text-white py-2.5 px-2 font-mono" dir="ltr">{formatShekel(h.amount)}</td>
                      <td className="text-center text-white py-2.5 px-2 font-mono" dir="ltr">{formatShekel(h.currentValue)}</td>
                      <td className={`text-center py-2.5 px-2 font-mono ${h.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                        {h.profitLoss >= 0 ? '+' : ''}{formatShekel(h.profitLoss)}
                      </td>
                      <td className={`text-center py-2.5 px-2 font-bold ${h.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                        {h.returnPct >= 0 ? '+' : ''}{h.returnPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced Stats */}
          <div className="glass-panel p-5">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              נתונים מתקדמים לתיק
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-1 flex items-center gap-1">
                  תנודתיות שנתית
                  <Tip text="מדד לתנודתיות התיק. תיק מפוזר צפוי להיות פחות תנודתי ממניה בודדת. מעל 30% = תנודתיות גבוהה." />
                </p>
                <p className={`text-base font-bold ${sim.summary.annualVolatility > 30 ? 'text-red-400' : sim.summary.annualVolatility > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {sim.summary.annualVolatility}%
                </p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-1 flex items-center gap-1">
                  ירידה מקסימלית
                  <Tip text="הירידה הגדולה ביותר מהשיא של התיק. פיזור טוב אמור להקטין מספר זה." />
                </p>
                <p className="text-base font-bold text-red-400">-{sim.summary.maxDrawdown}%</p>
                <p className="text-xs text-textMuted/60">{sim.summary.maxDrawdownDate}</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-1">שווי מקסימלי</p>
                <p className="text-base font-bold text-emerald-400" dir="ltr">{formatShekel(sim.summary.maxValue)}</p>
                <p className="text-xs text-textMuted/60">{sim.summary.maxValueDate}</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-1">שווי מינימלי</p>
                <p className="text-base font-bold text-red-400" dir="ltr">{formatShekel(sim.summary.minValue)}</p>
                <p className="text-xs text-textMuted/60">{sim.summary.minValueDate}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-1">תקופה</p>
                <p className="text-base font-bold text-white">{sim.summary.periodYears} שנים <span className="text-textMuted font-normal text-xs">({sim.summary.periodDays} ימים)</span></p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <p className="text-xs text-textMuted mb-2">פיזור סקטוריאלי</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(sim.summary.sectorDistribution).sort((a, b) => b[1] - a[1]).map(([sector, weight]) => (
                    <span key={sector} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-textMuted">
                      {sector} {weight.toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Insight */}
          <div className={`p-4 rounded-xl border ${isProfit ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
            <p className={`text-sm leading-relaxed ${isProfit ? 'text-emerald-300/80' : 'text-red-300/80'}`}>
              <Info className="w-4 h-4 inline ml-1" />
              {isProfit ? (
                <>
                  אילו השקעת <strong>{formatShekel(sim.summary.totalInvested)}</strong> בתיק של {sim.summary.stockCount} מניות ב-{sim.startDate},
                  התיק שלך היה שווה היום <strong>{formatShekel(sim.summary.currentValue)}</strong> — רווח
                  של <strong>{formatShekel(sim.summary.profitLoss)}</strong> ({'+' + sim.summary.returnPct}%).
                  {sim.summary.annualizedReturn > 15 ? ' ביצוע מעולה!' : sim.summary.annualizedReturn > 8 ? ' תשואה טובה.' : ' תשואה חיובית.'}
                  {' '}המניה החזקה ביותר: <strong>{sim.holdings.reduce((best, h) => h.returnPct > best.returnPct ? h : best).name}</strong> ({'+' + sim.holdings.reduce((best, h) => h.returnPct > best.returnPct ? h : best).returnPct}%).
                </>
              ) : (
                <>
                  אילו השקעת <strong>{formatShekel(sim.summary.totalInvested)}</strong> בתיק של {sim.summary.stockCount} מניות ב-{sim.startDate},
                  התיק שלך היה שווה היום <strong>{formatShekel(sim.summary.currentValue)}</strong> — הפסד
                  של <strong>{formatShekel(Math.abs(sim.summary.profitLoss))}</strong> ({sim.summary.returnPct}%).
                  שים לב שפיזור רחב יותר עשוי לצמצם סיכון.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* P/E Ratio Educational Section */}
      <PeEducation />
    </div>
  );
}

function PeEducation() {
  const [expanded, setExpanded] = useState(false);

  const examples = [
    { name: 'חברה A', price: 100, eps: 20, pe: 5, verdict: 'זולה מאוד', color: 'emerald', desc: 'תוך 5 שנות רווח זהה — תחזיר את ההשקעה. מציאה פוטנציאלית!' },
    { name: 'חברה B', price: 100, eps: 10, pe: 10, verdict: 'זולה', color: 'green', desc: 'תוך 10 שנים תחזיר את ההשקעה. עדיין אטרקטיבית.' },
    { name: 'חברה C', price: 100, eps: 5, pe: 20, verdict: 'הוגנת', color: 'amber', desc: 'תוך 20 שנה תחזיר את ההשקעה. מחיר סביר.' },
    { name: 'חברה D', price: 100, eps: 2, pe: 50, verdict: 'יקרה', color: 'red', desc: 'תוך 50 שנה... השוק מצפה לצמיחה אדירה, או שהמניה מנופחת.' },
  ];

  return (
    <div className="glass-panel p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold text-white">מהו מכפיל רווח (P/E) ומה הוא אומר על ההשקעה?</h3>
            <p className="text-xs text-textMuted">המדריך המלא להבנת המדד הפיננסי החשוב ביותר</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-textMuted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-6 space-y-6 animate-fadeIn">
          {/* What is P/E */}
          <div>
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">1</span>
              מה זה מכפיל רווח?
            </h4>
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5 space-y-3">
              <p className="text-sm text-textMuted leading-relaxed">
                מכפיל הרווח (Price to Earnings ratio, בקיצור <strong className="text-white">P/E</strong>) הוא המדד הפופולרי ביותר להערכת שווי מניה.
                הוא עונה על שאלה פשוטה: <strong className="text-primary">כמה שנים ייקח לחברה &quot;להחזיר&quot; את מחיר המניה מתוך הרווחים שלה?</strong>
              </p>
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/10 text-center">
                <p className="text-xs text-textMuted mb-2">הנוסחה:</p>
                <p className="text-xl font-bold text-white font-mono" dir="ltr">
                  P/E = <span className="text-primary">מחיר המניה</span> ÷ <span className="text-secondary">רווח למניה (EPS)</span>
                </p>
              </div>
              <p className="text-sm text-textMuted leading-relaxed">
                לדוגמה: אם מניה נסחרת ב-<strong className="text-white">₪100</strong> והחברה מרוויחה <strong className="text-white">₪10 למניה</strong> בשנה,
                אז המכפיל הוא <strong className="text-primary">10</strong>. כלומר, תוך 10 שנות רווח זהה — ההשקעה &quot;תחזיר את עצמה&quot;.
              </p>
            </div>
          </div>

          {/* Visual Examples */}
          <div>
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">2</span>
              דוגמאות חיות — 4 חברות באותו מחיר, רווח שונה
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {examples.map((ex) => (
                <div key={ex.name} className={`rounded-xl p-4 border bg-${ex.color}-500/5 border-${ex.color}-500/10`}>
                  <p className="text-sm font-bold text-white mb-2">{ex.name}</p>
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between">
                      <span className="text-textMuted">מחיר מניה:</span>
                      <span className="text-white font-mono" dir="ltr">₪{ex.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">רווח למניה:</span>
                      <span className="text-white font-mono" dir="ltr">₪{ex.eps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">מכפיל:</span>
                      <span className={`font-bold text-${ex.color}-400`}>{ex.pe}</span>
                    </div>
                  </div>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full bg-${ex.color}-500/20 text-${ex.color}-400 font-medium mb-2`}>
                    {ex.verdict}
                  </span>
                  <p className="text-xs text-textMuted leading-relaxed">{ex.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What does it tell us */}
          <div>
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">3</span>
              מה מכפיל נמוך או גבוה אומר על ההשקעה?
            </h4>
            <div className="space-y-3">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                <p className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4" />
                  מכפיל נמוך (מתחת ל-15)
                </p>
                <ul className="text-xs text-textMuted space-y-1.5 leading-relaxed mr-5">
                  <li>• המניה נחשבת <strong className="text-emerald-400">זולה</strong> ביחס לרווחים — פוטנציאל למציאה</li>
                  <li>• ייתכן שהשוק לא מאמין שהרווחים ימשיכו (חברה בירידה)</li>
                  <li>• ייתכן שהשוק פשוט לא שם לב — הזדמנות למשקיע ערך!</li>
                  <li>• דוגמאות: בנקים, חברות נדל&quot;ן, חברות תעשייה מסורתיות</li>
                </ul>
              </div>
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <p className="text-sm font-bold text-red-400 mb-1 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4" />
                  מכפיל גבוה (מעל 25)
                </p>
                <ul className="text-xs text-textMuted space-y-1.5 leading-relaxed mr-5">
                  <li>• המניה <strong className="text-red-400">יקרה</strong> ביחס לרווחים הנוכחיים</li>
                  <li>• השוק מצפה ל<strong className="text-white">צמיחה משמעותית</strong> ברווחים העתידיים</li>
                  <li>• סיכון גבוה יותר — אם הצמיחה לא תגיע, המניה תיפול</li>
                  <li>• דוגמאות: חברות טכנולוגיה, סטארטאפים, חברות הייטק</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Scale reference */}
          <div>
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">4</span>
              סולם מכפילים — מדריך מהיר
            </h4>
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
              <div className="space-y-2">
                {[
                  { range: '0-10', label: 'זול מאוד', color: 'emerald', bar: 20, desc: 'מציאה פוטנציאלית — בדוק למה המכפיל כל כך נמוך' },
                  { range: '10-15', label: 'זול', color: 'green', bar: 35, desc: 'מחיר אטרקטיבי — שווה בדיקה מעמיקה' },
                  { range: '15-20', label: 'הוגן', color: 'amber', bar: 55, desc: 'מחיר סביר — לא זול ולא יקר' },
                  { range: '20-30', label: 'יקר', color: 'orange', bar: 75, desc: 'תמחור גבוה — צפייה לצמיחה' },
                  { range: '30+', label: 'יקר מאוד', color: 'red', bar: 95, desc: 'תמחור מנופח — סיכון גבוה, צפייה לצמיחה אדירה' },
                ].map(item => (
                  <div key={item.range} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-textMuted w-12 text-left shrink-0" dir="ltr">{item.range}</span>
                    <div className="flex-1">
                      <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full bg-${item.color}-500/40 rounded-full`} style={{ width: `${item.bar}%` }}></div>
                      </div>
                    </div>
                    <span className={`text-xs font-bold text-${item.color}-400 w-16 shrink-0`}>{item.label}</span>
                    <span className="text-xs text-textMuted hidden sm:block">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div>
            <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">5</span>
              מה חשוב לזכור?
            </h4>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
              <ul className="text-xs text-amber-200/70 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /> <strong className="text-amber-300">מכפיל לבד לא מספיק</strong> — תמיד בדוק גם מגמת הרווחים, חוב, ותחרות בענף.</li>
                <li className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /> <strong className="text-amber-300">השוואה נכונה</strong> — השווה מכפילים בין חברות באותו ענף. מכפיל 20 בטכנולוגיה שונה ממכפיל 20 בבנקאות.</li>
                <li className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /> <strong className="text-amber-300">מכפיל שלילי</strong> — אם החברה מפסידה (רווח שלילי), אין מכפיל. זה לא בהכרח רע — חברות צמיחה לפעמים מפסידות בהתחלה.</li>
                <li className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /> <strong className="text-amber-300">עבר ≠ עתיד</strong> — המכפיל מבוסס על רווחי העבר. הרווחים העתידיים עשויים להיות שונים לחלוטין.</li>
              </ul>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-center">
            <p className="text-xs text-textMuted/50">
              מדריך זה הוא למטרות חינוכיות בלבד ואינו מהווה ייעוץ השקעות.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
