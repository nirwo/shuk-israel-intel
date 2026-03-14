import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Simulator from './Simulator';
import UserProfile from './UserProfile';
import { useAuth } from './useAuth';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Clock,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  PieChart,
  Target,
  Zap,
  ExternalLink,
  Filter,
  Info,
  HelpCircle,
  Building2,
  Layers,
  Globe,
  Briefcase,
  Wallet,
  ShieldCheck,
  Scale,
  Rocket,
  CheckCircle2,
  Loader2,
  Activity,
} from 'lucide-react';

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : 'https://shuk-israel-api.fly.dev/api';

function formatCurrency(agurot) {
  const shekel = agurot / 100;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
  }).format(shekel);
}

function formatLargeNumber(num) {
  if (!num) return 'לא זמין';
  const abs = Math.abs(num);
  if (abs >= 1e9) return `₪${(num / 1e9).toFixed(2)} מיליארד`;
  if (abs >= 1e6) return `₪${(num / 1e6).toFixed(1)} מיליון`;
  if (abs >= 1e3) return `₪${(num / 1e3).toFixed(1)} אלף`;
  return `₪${num.toLocaleString('he-IL')}`;
}

function getPeColor(pe) {
  if (pe === null) return 'text-textMuted';
  if (pe <= 10) return 'text-emerald-400';
  if (pe <= 15) return 'text-green-400';
  if (pe <= 20) return 'text-yellow-400';
  if (pe <= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getPeBadge(pe) {
  if (pe === null) return { label: 'לא זמין', cls: 'bg-gray-500/20 text-gray-400' };
  if (pe <= 10) return { label: 'זול מאוד', cls: 'bg-emerald-500/20 text-emerald-400' };
  if (pe <= 15) return { label: 'זול', cls: 'bg-green-500/20 text-green-400' };
  if (pe <= 20) return { label: 'הוגן', cls: 'bg-yellow-500/20 text-yellow-400' };
  if (pe <= 30) return { label: 'יקר', cls: 'bg-orange-500/20 text-orange-400' };
  return { label: 'יקר מאוד', cls: 'bg-red-500/20 text-red-400' };
}

function getIndexLabel(idx) {
  const map = { 'TA-35': 'ת"א 35', 'TA-90': 'ת"א 90', 'SME': 'יתר' };
  return map[idx] || idx;
}

function getIndexColor(idx) {
  const map = {
    'TA-35': 'bg-blue-500/20 text-blue-400',
    'TA-90': 'bg-purple-500/20 text-purple-400',
    'SME': 'bg-cyan-500/20 text-cyan-400',
  };
  return map[idx] || 'bg-gray-500/20 text-gray-400';
}

function Tooltip({ text }) {
  return (
    <span className="group/tip relative inline-flex cursor-help">
      <HelpCircle className="w-3.5 h-3.5 text-textMuted/60 hover:text-primary transition-colors" />
      <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 border border-white/10 rounded-lg shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none w-56 text-center z-50 leading-relaxed">
        {text}
      </span>
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, tooltip, color = 'text-primary' }) { /* eslint-disable-line */
  return (
    <div className="glass-panel p-5 flex items-center gap-4 group hover:border-white/20 transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color === 'text-primary' ? 'from-primary/20 to-primary/5' : color === 'text-secondary' ? 'from-secondary/20 to-secondary/5' : 'from-amber-500/20 to-amber-500/5'} flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-textMuted truncate flex items-center gap-1.5">
          {label}
          {tooltip && <Tooltip text={tooltip} />}
        </p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-textMuted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectorBreakdown({ sectors }) {
  if (!sectors || Object.keys(sectors).length === 0) return null;
  const sorted = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="glass-panel p-5">
      <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" />
        פילוח לפי סקטור
        <Tooltip text="התפלגות המניות שנותחו לפי ענפי המשק. מאפשר לראות איזה סקטורים מיוצגים בניתוח." />
      </p>
      <div className="flex flex-wrap gap-2">
        {sorted.map(([sector, count]) => (
          <span key={sector} className="text-xs bg-white/5 border border-white/10 text-textMuted px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-white/10 transition-colors">
            <span className="text-white font-medium">{sector}</span>
            <span className="text-primary font-bold">{count}</span>
            <span className="text-textMuted/50">({Math.round((count / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function IndexBreakdown({ indexBreakdown }) {
  if (!indexBreakdown || Object.keys(indexBreakdown).length === 0) return null;
  const total = Object.values(indexBreakdown).reduce((sum, v) => sum + v, 0);

  return (
    <div className="glass-panel p-5">
      <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        פילוח לפי מדד
        <Tooltip text="כמה מניות נותחו בהצלחה מכל מדד. ת״א 35 = 35 הגדולות, ת״א 90 = 90 הבאות, יתר = חברות קטנות ובינוניות." />
      </p>
      <div className="flex flex-wrap gap-3">
        {Object.entries(indexBreakdown).map(([idx, count]) => (
          <div key={idx} className={`px-4 py-2.5 rounded-xl border border-white/10 ${getIndexColor(idx).replace('text-', 'bg-').split(' ')[0]}`}>
            <p className="text-xs text-textMuted">{getIndexLabel(idx)}</p>
            <p className="text-xl font-bold text-white">{count}</p>
            <p className="text-xs text-textMuted/60">{Math.round((count / total) * 100)}% מהניתוח</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockCard({ stock, rank }) {
  const [expanded, setExpanded] = useState(false);
  const peBadge = getPeBadge(stock.peRatio);

  return (
    <div className="premium-card relative group overflow-hidden">
      <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-bold text-white/80 border border-white/10">
        #{rank}
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"></div>

      <div className="mb-4 pl-10">
        <h3 className="text-lg font-bold text-white truncate" title={stock.nameEn || stock.name}>
          {stock.name}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-textMuted font-mono uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded" dir="ltr">
            {stock.symbol}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${peBadge.cls}`}>
            {peBadge.label}
          </span>
          {stock.index && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getIndexColor(stock.index)}`}>
              {getIndexLabel(stock.index)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-white" dir="ltr">{formatCurrency(stock.price)}</span>
        <span className="text-xs text-textMuted">למניה</span>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
          <span className="text-sm text-textMuted flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            מכפיל רווח
            <Tooltip text="מכפיל רווח (P/E) = מחיר המניה חלקי הרווח למניה. ככל שהמספר נמוך יותר, המניה נחשבת זולה יותר ביחס לרווחים שלה." />
          </span>
          <span className={`font-bold ${getPeColor(stock.peRatio)}`} dir="ltr">
            {stock.peRatio !== null ? stock.peRatio.toFixed(2) : 'לא זמין'}
          </span>
        </div>

        <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
          <span className="text-sm text-textMuted flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            רווח נקי
            <Tooltip text="רווח נקי = סך ההכנסות פחות כל ההוצאות, מיסים וריביות. מציג את הרווח האמיתי של החברה. רווח חיובי = החברה מרוויחה כסף." />
          </span>
          <span className={`font-bold ${stock.isProfitable ? 'text-secondary' : 'text-red-400'}`}>
            {stock.isProfitable ? (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span dir="ltr">{formatLargeNumber(stock.netProfit)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                הפסד
              </span>
            )}
          </span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-textMuted hover:text-white transition-colors py-1.5 rounded-lg hover:bg-white/5"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'פחות פרטים' : 'פרטים נוספים'}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-fadeIn">
          <div className="flex justify-between text-sm">
            <span className="text-textMuted">סקטור</span>
            <span className="text-white">{stock.sector}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-textMuted">מדד</span>
            <span className="text-white">{getIndexLabel(stock.index)}</span>
          </div>
          {stock.nameEn && (
            <div className="flex justify-between text-sm">
              <span className="text-textMuted">שם באנגלית</span>
              <span className="text-white font-mono text-xs" dir="ltr">{stock.nameEn}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-textMuted">רווח נקי (מדויק)</span>
            <span className="text-white font-mono text-xs" dir="ltr">₪{stock.netProfit?.toLocaleString('he-IL') || 'לא זמין'}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10 mt-2">
            <p className="text-xs text-blue-300/80 leading-relaxed">
              <Info className="w-3 h-3 inline ml-1" />
              {stock.peRatio !== null && stock.peRatio <= 15
                ? 'מניה זו נחשבת זולה — המכפיל הנמוך מצביע על כך שהשוק מתמחר אותה נמוך ביחס לרווחים. שווה לבדוק האם קיים פוטנציאל צמיחה.'
                : stock.peRatio !== null && stock.peRatio <= 25
                ? 'מכפיל הרווח במתחם הסביר. המניה לא יקרה אבל גם לא מציאה — מומלץ לבדוק גם את מגמת הרווחיות לאורך זמן.'
                : 'המכפיל גבוה יחסית, מה שעלול להצביע על ציפיות צמיחה גבוהות או תמחור יקר. דרוש מחקר מעמיק.'}
            </p>
          </div>
          <a
            href={`https://finance.yahoo.com/quote/${stock.symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 mt-2 text-xs text-primary hover:text-primary/80 transition-colors py-2 rounded-lg bg-primary/5 hover:bg-primary/10"
          >
            <ExternalLink className="w-3 h-3" />
            צפה ב-Yahoo Finance
          </a>
        </div>
      )}
    </div>
  );
}

function AllStocksTable({ stocks, sectorFilter, setSectorFilter, indexFilter, setIndexFilter }) {
  const [sortField, setSortField] = useState('peRatio');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sectors = [...new Set(stocks.map(s => s.sector).filter(Boolean))].sort();
  const indices = [...new Set(stocks.map(s => s.index).filter(Boolean))].sort();

  const filtered = stocks
    .filter((s) => {
      const matchSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.nameEn?.toLowerCase().includes(search.toLowerCase()) ||
        s.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        s.sector?.includes(search);
      const matchSector = !sectorFilter || s.sector === sectorFilter;
      const matchIndex = !indexFilter || s.index === indexFilter;
      return matchSearch && matchSector && matchIndex;
    })
    .sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (va === null || va === undefined) va = Infinity;
      if (vb === null || vb === undefined) vb = Infinity;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
          <input
            type="text"
            placeholder="חפש לפי שם חברה, סימול או סקטור..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={indexFilter || ''}
            onChange={(e) => setIndexFilter(e.target.value || null)}
            className="text-xs bg-white/5 border border-white/10 text-textMuted px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50 appearance-none cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="">כל המדדים</option>
            {indices.map(idx => (
              <option key={idx} value={idx}>{getIndexLabel(idx)}</option>
            ))}
          </select>
          <select
            value={sectorFilter || ''}
            onChange={(e) => setSectorFilter(e.target.value || null)}
            className="text-xs bg-white/5 border border-white/10 text-textMuted px-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/50 appearance-none cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="">כל הסקטורים</option>
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(sectorFilter || indexFilter) && (
            <button
              onClick={() => { setSectorFilter(null); setIndexFilter(null); }}
              className="text-xs text-primary hover:text-primary/80 transition-colors px-2"
            >
              נקה פילטרים ✕
            </button>
          )}
          <span className="text-xs text-textMuted/60 self-center mr-auto">
            {filtered.length} מניות מוצגות
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-textMuted text-xs tracking-wider border-b border-white/10">
              <th className="text-right py-3 px-4 font-medium">מניה</th>
              <th className="text-center py-3 px-3 font-medium">מדד</th>
              <th className="text-center py-3 px-3 font-medium">סקטור</th>
              <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('price')}>
                <span className="flex items-center gap-1">מחיר {renderSortIcon('price')}</span>
              </th>
              <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('peRatio')}>
                <span className="flex items-center gap-1">מכפיל {renderSortIcon('peRatio')}</span>
              </th>
              <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('netProfit')}>
                <span className="flex items-center gap-1">רווח נקי {renderSortIcon('netProfit')}</span>
              </th>
              <th className="text-center py-3 px-4 font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock) => {
              const peBadge = getPeBadge(stock.peRatio);
              return (
                <tr key={stock.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-white">{stock.name}</p>
                      <p className="text-xs text-textMuted font-mono" dir="ltr">{stock.symbol}</p>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getIndexColor(stock.index)}`}>
                      {getIndexLabel(stock.index)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-xs text-textMuted">{stock.sector}</span>
                  </td>
                  <td className="py-3 px-4 text-left font-mono text-white" dir="ltr">
                    {formatCurrency(stock.price)}
                  </td>
                  <td className={`py-3 px-4 text-left font-bold ${getPeColor(stock.peRatio)}`} dir="ltr">
                    {stock.peRatio !== null ? stock.peRatio.toFixed(2) : '—'}
                  </td>
                  <td className={`py-3 px-4 text-left font-mono ${stock.isProfitable ? 'text-secondary' : 'text-red-400'}`} dir="ltr">
                    {formatLargeNumber(stock.netProfit)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${peBadge.cls}`}>
                      {peBadge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-8 text-center text-textMuted">לא נמצאו מניות התואמות את החיפוש.</div>
      )}
    </div>
  );
}

const RISK_PROFILES_META = {
  conservative: { icon: ShieldCheck, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30', bgSolid: 'bg-blue-500/20' },
  balanced: { icon: Scale, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', bgSolid: 'bg-amber-500/20' },
  aggressive: { icon: Rocket, color: 'text-red-400', bg: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30', bgSolid: 'bg-red-500/20' },
};

function formatShekel(num) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function PortfolioBuilder() {
  const [amount, setAmount] = useState('');
  const [risk, setRisk] = useState('balanced');
  const [portfolio, setPortfolio] = useState(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState('');

  const handleBuild = async () => {
    const num = parseFloat(amount.replace(/,/g, ''));
    if (!num || num < 5000) {
      setBuildError('סכום מינימלי להשקעה: ₪5,000');
      return;
    }
    setBuilding(true);
    setBuildError('');
    setPortfolio(null);
    try {
      const res = await axios.post(`${API_BASE}/portfolio/build`, { amount: num, risk });
      setPortfolio(res.data);
    } catch (err) {
      setBuildError(err.response?.data?.error || 'שגיאה בבניית התיק');
    } finally {
      setBuilding(false);
    }
  };

  const presets = [10000, 50000, 100000, 500000];

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <Wallet className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-white">בנה תיק השקעות חכם</h3>
        </div>
        <p className="text-sm text-textMuted mb-6 leading-relaxed">
          הכנס את הסכום שברצונך להשקיע, בחר פרופיל סיכון, והמערכת תבנה עבורך תיק השקעות מותאם אישית
          המבוסס על ניתוח אלגוריתמי של כל המניות בבורסה.
        </p>

        {/* Amount Input */}
        <div className="mb-5">
          <label className="block text-sm text-textMuted mb-2 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            סכום להשקעה (₪)
            <Tooltip text="הסכום הכולל שברצונך להשקיע. המינימום הוא ₪5,000. המערכת תחלק את הסכום בין מניות שונות לפי הפרופיל." />
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="למשל: 100,000"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setAmount(v ? Number(v).toLocaleString('en') : '');
              }}
              className="w-full pr-10 pl-4 py-3 bg-white/5 border border-white/10 rounded-xl text-lg text-white placeholder-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
              dir="ltr"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted text-lg">₪</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {presets.map(p => (
              <button
                key={p}
                onClick={() => setAmount(p.toLocaleString('en'))}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-textMuted hover:text-white hover:bg-white/10 transition-colors"
              >
                {formatShekel(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Profile Selection */}
        <div className="mb-6">
          <label className="block text-sm text-textMuted mb-3 flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            פרופיל סיכון
            <Tooltip text="פרופיל הסיכון קובע את סוג המניות בתיק. שמרני = חברות גדולות ויציבות. מאוזן = שילוב ערך וצמיחה. אגרסיבי = מניות קטנות עם פוטנציאל גבוה." />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(RISK_PROFILES_META).map(([id, meta]) => {
              const ProfileIcon = meta.icon;
              const labels = { conservative: 'שמרני', balanced: 'מאוזן', aggressive: 'אגרסיבי' };
              const descs = {
                conservative: 'חברות גדולות, מכפיל נמוך, יציבות מקסימלית',
                balanced: 'שילוב ערך וצמיחה, פיזור רחב',
                aggressive: 'חברות צמיחה, פוטנציאל תשואה גבוה',
              };
              const returns = { conservative: '6-10%', balanced: '10-18%', aggressive: '15-30%' };
              const isSelected = risk === id;
              return (
                <button
                  key={id}
                  onClick={() => setRisk(id)}
                  className={`p-4 rounded-xl border text-right transition-all duration-300 ${
                    isSelected
                      ? `${meta.border} bg-gradient-to-br ${meta.bg}`
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ProfileIcon className={`w-5 h-5 ${isSelected ? meta.color : 'text-textMuted'}`} />
                    <span className={`font-bold ${isSelected ? 'text-white' : 'text-textMuted'}`}>{labels[id]}</span>
                    {isSelected && <CheckCircle2 className={`w-4 h-4 ${meta.color} mr-auto`} />}
                  </div>
                  <p className="text-xs text-textMuted leading-relaxed mb-2">{descs[id]}</p>
                  <p className={`text-xs font-bold ${isSelected ? meta.color : 'text-textMuted/60'}`}>תשואה צפויה: {returns[id]}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Build Button */}
        <button
          onClick={handleBuild}
          disabled={building || !amount}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {building ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> בונה תיק...</>
          ) : (
            <><Briefcase className="w-5 h-5" /> בנה תיק השקעות</>
          )}
        </button>

        {buildError && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            <AlertCircle className="w-4 h-4 inline ml-1" />
            {buildError}
          </div>
        )}
      </div>

      {/* Portfolio Results */}
      {portfolio && (
        <div className="space-y-6 animate-fadeIn">
          {/* Portfolio Summary */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-5">
              <Briefcase className="w-5 h-5 text-secondary" />
              <h3 className="text-lg font-bold text-white">התיק המומלץ שלך</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium mr-2 ${RISK_PROFILES_META[portfolio.profile.id]?.bgSolid} ${RISK_PROFILES_META[portfolio.profile.id]?.color}`}>
                {portfolio.profile.icon} {portfolio.profile.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <p className="text-xs text-textMuted mb-1">סכום להשקעה</p>
                <p className="text-lg font-bold text-white" dir="ltr">{formatShekel(portfolio.investmentAmount)}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <p className="text-xs text-textMuted mb-1">מושקע בפועל</p>
                <p className="text-lg font-bold text-secondary" dir="ltr">{formatShekel(portfolio.totalInvested)}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <p className="text-xs text-textMuted mb-1">מניות בתיק</p>
                <p className="text-lg font-bold text-primary">{portfolio.stockCount}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <p className="text-xs text-textMuted mb-1">מכפיל ממוצע משוקלל</p>
                <p className={`text-lg font-bold ${getPeColor(portfolio.summary.weightedPE)}`} dir="ltr">{portfolio.summary.weightedPE}</p>
              </div>
            </div>

            {/* Distribution bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-xs text-textMuted mb-2 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> פילוח לפי מדד</p>
                <div className="space-y-1.5">
                  {Object.entries(portfolio.summary.indexDistribution).map(([idx, pct]) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-textMuted w-14 shrink-0">{getIndexLabel(idx)}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-xs text-white font-bold w-10 text-left" dir="ltr">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-textMuted mb-2 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> פילוח לפי סקטור</p>
                <div className="space-y-1.5">
                  {Object.entries(portfolio.summary.sectorDistribution).map(([sector, pct]) => (
                    <div key={sector} className="flex items-center gap-2">
                      <span className="text-xs text-textMuted w-14 shrink-0 truncate" title={sector}>{sector}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-secondary to-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-xs text-white font-bold w-10 text-left" dir="ltr">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {portfolio.cashRemaining > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-300/80">
                <Info className="w-3 h-3 inline ml-1" />
                נותר עודף של <strong dir="ltr">{formatShekel(portfolio.cashRemaining)}</strong> שלא ניתן להשקיע בשל מחירי מניות שלמות.
              </div>
            )}
          </div>

          {/* Allocation Table */}
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                פירוט הקצאת התיק
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-textMuted text-xs tracking-wider border-b border-white/10">
                    <th className="text-right py-3 px-4 font-medium">מניה</th>
                    <th className="text-center py-3 px-3 font-medium">מדד</th>
                    <th className="text-center py-3 px-3 font-medium">סקטור</th>
                    <th className="text-left py-3 px-3 font-medium">הקצאה</th>
                    <th className="text-left py-3 px-3 font-medium">סכום</th>
                    <th className="text-left py-3 px-3 font-medium">מניות</th>
                    <th className="text-left py-3 px-3 font-medium">מחיר</th>
                    <th className="text-left py-3 px-3 font-medium">מכפיל</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.allocations.map((stock) => (
                    <tr key={stock.symbol} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-white">{stock.name}</p>
                          <p className="text-xs text-textMuted font-mono" dir="ltr">{stock.symbol}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getIndexColor(stock.index)}`}>
                          {getIndexLabel(stock.index)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs text-textMuted">{stock.sector}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${stock.allocationPercent}%` }}></div>
                          </div>
                          <span className="text-xs text-primary font-bold" dir="ltr">{stock.allocationPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-white text-xs" dir="ltr">{formatShekel(stock.investmentAmount)}</td>
                      <td className="py-3 px-3 font-bold text-white text-center">{stock.shares}</td>
                      <td className="py-3 px-3 font-mono text-textMuted text-xs" dir="ltr">{formatCurrency(stock.price)}</td>
                      <td className={`py-3 px-3 font-bold ${getPeColor(stock.peRatio)}`} dir="ltr">{stock.peRatio?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reasoning Cards */}
          <div className="glass-panel p-5">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              למה המניות האלה נבחרו?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {portfolio.allocations.map(stock => (
                <div key={stock.symbol} className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
                  <p className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    {stock.name}
                    <span className="text-xs font-mono text-textMuted" dir="ltr">({stock.symbol})</span>
                  </p>
                  <ul className="space-y-1">
                    {stock.reasoning.map((reason, j) => (
                      <li key={j} className="text-xs text-textMuted flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-secondary mt-0.5 shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <p className="text-xs text-amber-300/70 leading-relaxed text-center">
              <AlertCircle className="w-3.5 h-3.5 inline ml-1" />
              התיק המומלץ מבוסס על ניתוח אלגוריתמי ואינו מהווה ייעוץ השקעות. התשואות הצפויות הן הערכה בלבד ואינן מובטחות.
              תמיד התייעץ עם יועץ השקעות מוסמך לפני קבלת החלטות השקעה.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('picks');
  const [sectorFilter, setSectorFilter] = useState(null);
  const [indexFilter, setIndexFilter] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await axios.get(`${API_BASE}/recommendations?index=all`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError(
        err.response?.data?.error ||
        'לא ניתן לטעון את הנתונים. ודא שהשרת פועל על פורט 3001.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-background text-textMain" dir="rtl">
      <div className="h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  שוק ישראל אינטליג׳נס
                </h1>
              </div>
              <p className="text-textMuted max-w-2xl leading-relaxed">
                ניתוח אלגוריתמי מקיף של <strong className="text-white">כל הבורסה הישראלית</strong> — ת&quot;א 35, ת&quot;א 90, וחברות יתר.
                זיהוי חברות רווחיות שנסחרות במחיר נמוך ביחס לרווחים שלהן.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <button
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-textMuted hover:text-white hover:border-white/20 hover:bg-white/10 transition-all disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'מרענן...' : 'רענן נתונים'}
                </button>
              )}
              <UserProfile user={user} />
            </div>
          </div>
        </header>

        {/* How it works explanation */}
        {!loading && !error && data && (
          <div className="glass-panel p-5 mb-8 border-primary/20">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-textMuted leading-relaxed space-y-2">
                <p className="text-white font-medium text-base">איך המערכת עובדת?</p>
                <p>
                  המערכת מנתחת את <strong className="text-white">כל המניות בבורסה הישראלית</strong> — מדד ת&quot;א 35 (35 הגדולות), ת&quot;א 90 (90 הבאות), וחברות יתר. סך הכל <strong className="text-primary">{data.totalAnalyzed} מניות</strong> נותחו ומחפשת מניות שעומדות בשני תנאים:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <p className="text-white font-medium flex items-center gap-1.5 mb-1">
                      <Target className="w-4 h-4 text-primary" />
                      מכפיל רווח נמוך (P/E)
                    </p>
                    <p className="text-xs leading-relaxed">
                      מכפיל הרווח מחלק את מחיר המניה ברווח השנתי למניה.
                      מכפיל נמוך (מתחת ל-25) אומר שהמניה <strong className="text-emerald-400">זולה</strong> ביחס לרווחים.
                      למשל: מכפיל 10 = תוך 10 שנות רווח זהה תחזיר את ההשקעה.
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <p className="text-white font-medium flex items-center gap-1.5 mb-1">
                      <DollarSign className="w-4 h-4 text-secondary" />
                      רווח נקי חיובי
                    </p>
                    <p className="text-xs leading-relaxed">
                      הרווח הנקי הוא מה שנשאר לחברה אחרי כל ההוצאות, מיסים וריביות.
                      רווח <strong className="text-secondary">חיובי</strong> מעיד שהחברה באמת מרוויחה כסף
                      ולא רק מגדילה הכנסות.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-textMuted/70 mt-1">
                  * ככל שהמכפיל נמוך יותר והרווח גבוה יותר — כך המניה נחשבת אטרקטיבית יותר לפי שיטת ניתוח ערך (Value Investing).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col justify-center items-center h-[60vh] space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-primary/20 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg text-white font-medium mb-1">מנתח את כל הבורסה הישראלית</p>
              <p className="text-sm text-textMuted">אוסף נתונים פיננסיים ממאות מניות. הפעולה יכולה לקחת עד דקה...</p>
            </div>
            <div className="w-64 h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full animate-loading-bar"></div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="max-w-lg mx-auto mt-20">
            <div className="glass-panel border-red-500/30 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">שגיאת חיבור</h2>
              <p className="text-red-400/80 mb-6">{error}</p>
              <button
                onClick={() => fetchData()}
                className="px-6 py-2.5 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium text-sm"
              >
                נסה שוב
              </button>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {!loading && !error && data && (
          <div className="space-y-8">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={BarChart3}
                label="מניות שנותחו"
                value={data.totalAnalyzed}
                sub="כל הבורסה הישראלית"
                tooltip="מספר המניות שהמערכת הצליחה לאסוף עליהן נתונים פיננסיים מלאים ולנתח — כולל ת״א 35, ת״א 90, ומניות יתר."
                color="text-primary"
              />
              <StatCard
                icon={Zap}
                label="המלצות"
                value={data.recommendationsCount}
                sub="מכפיל < 25 + רווחיות"
                tooltip="מספר המניות שעומדות בשני הקריטריונים: מכפיל רווח מתחת ל-25 ורווח נקי חיובי."
                color="text-secondary"
              />
              <StatCard
                icon={PieChart}
                label="אחוז התאמה"
                value={data.totalAnalyzed > 0 ? `${Math.round((data.recommendationsCount / data.totalAnalyzed) * 100)}%` : '0%'}
                sub="עומדות בקריטריונים"
                tooltip="איזה אחוז מהמניות שנותחו עומד בקריטריוני ההמלצה. ככל שהאחוז נמוך יותר, הסינון מחמיר יותר."
                color="text-amber-400"
              />
              <StatCard
                icon={Clock}
                label="עדכון אחרון"
                value={new Date(data.lastUpdated).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                sub={new Date(data.lastUpdated).toLocaleDateString('he-IL')}
                tooltip="הנתונים נשמרים במטמון למשך 4 שעות. לחץ על 'רענן נתונים' לקבלת נתונים מעודכנים."
                color="text-primary"
              />
            </div>

            {/* Index + Sector breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <IndexBreakdown indexBreakdown={data.indexBreakdown} />
              <SectorBreakdown sectors={data.sectorBreakdown} />
            </div>

            {/* Tab navigation */}
            <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-xl border border-white/5 w-fit flex-wrap">
              <button
                onClick={() => setActiveTab('portfolio')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'portfolio'
                    ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-sm border border-primary/30'
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  בנה תיק השקעות
                </span>
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'simulator'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white shadow-sm border border-emerald-500/30'
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  סימולטור תיק
                </span>
              </button>
              <button
                onClick={() => setActiveTab('picks')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'picks'
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  מניות מומלצות ({data.topPicks.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="w-4 h-4" />
                  כל המניות ({data.recommendations.length})
                </span>
              </button>
            </div>

            {/* Simulator */}
            {activeTab === 'simulator' && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-7 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full"></span>
                  <h2 className="text-xl font-bold text-white">סימולטור תיק השקעות היסטורי</h2>
                </div>
                <Simulator />
              </div>
            )}

            {/* Portfolio Builder */}
            {activeTab === 'portfolio' && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-7 bg-gradient-to-b from-primary to-secondary rounded-full"></span>
                  <h2 className="text-xl font-bold text-white">בניית תיק השקעות חכם</h2>
                </div>
                <PortfolioBuilder />
              </div>
            )}

            {/* Top Picks Grid */}
            {activeTab === 'picks' && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-7 bg-gradient-to-b from-secondary to-primary rounded-full"></span>
                  <h2 className="text-xl font-bold text-white">
                    מניות מומלצות להשקעה
                  </h2>
                  <span className="text-xs text-textMuted bg-white/5 px-2 py-1 rounded-md mr-2">
                    מכפיל &lt; 25 + רווח נקי חיובי
                  </span>
                </div>

                {data.topPicks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {data.topPicks.map((stock, i) => (
                      <StockCard key={stock.id} stock={stock} rank={i + 1} />
                    ))}
                  </div>
                ) : (
                  <div className="glass-panel p-12 text-center">
                    <Search className="w-12 h-12 text-textMuted mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium text-white mb-1">לא נמצאו המלצות</p>
                    <p className="text-textMuted">
                      אף מניה לא עומדת כרגע בקריטריונים המחמירים של &quot;זולה ורווחית&quot; (מכפיל מתחת ל-25 עם רווח נקי חיובי).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* All stocks table */}
            {activeTab === 'all' && (
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-7 bg-gradient-to-b from-primary to-blue-400 rounded-full"></span>
                  <h2 className="text-xl font-bold text-white">
                    כל המניות שנותחו
                  </h2>
                </div>
                <AllStocksTable
                  stocks={data.recommendations}
                  sectorFilter={sectorFilter}
                  setSectorFilter={setSectorFilter}
                  indexFilter={indexFilter}
                  setIndexFilter={setIndexFilter}
                />
              </div>
            )}

            {/* Legend */}
            <div className="glass-panel p-5">
              <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                מקרא צבעים — מכפיל רווח
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  זול מאוד (עד 10) — מציאה פוטנציאלית
                </span>
                <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  זול (10-15) — מחיר אטרקטיבי
                </span>
                <span className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  הוגן (15-20) — מחיר סביר
                </span>
                <span className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  יקר (20-30) — תמחור גבוה
                </span>
                <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  יקר מאוד (30+) — תמחור מנופח
                </span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 py-4 border-t border-white/5 text-center">
              <p className="text-xs text-textMuted/60 leading-relaxed">
                הנתונים מבוססים על Yahoo Finance. המידע מוצג למטרות מידע בלבד ואינו מהווה ייעוץ השקעות או המלצה לקנות או למכור ניירות ערך.
                תמיד בצע מחקר עצמאי ו/או התייעץ עם יועץ השקעות מוסמך לפני קבלת החלטות השקעה.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
