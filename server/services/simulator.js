/**
 * Investment Simulator Service
 * 
 * Simulates historical investment performance using real Yahoo Finance data.
 * Given a stock symbol, investment amount, and date range, calculates what
 * the investment would be worth today including price history for charting.
 */

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { getAllStocks } = require('../data/tase_stocks');
const cache = require('./cache');

const CACHE_TTL = 3600; // 1 hour for historical data

/**
 * Get historical price data for a stock
 */
async function getHistoricalData(symbol, period1, period2) {
  const cacheKey = `hist_${symbol}_${period1}_${period2}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await yf.chart(symbol, {
      period1,
      period2,
      interval: '1wk',
    });

    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error('לא נמצאו נתונים היסטוריים');
    }

    // TASE stocks return prices in agorot (1/100 shekel) — convert to shekels
    const isTASE = symbol.endsWith('.TA');
    const divisor = isTASE ? 100 : 1;

    const data = result.quotes
      .filter(q => q.close !== null && q.close !== undefined)
      .map(q => ({
        date: new Date(q.date).toISOString().split('T')[0],
        close: parseFloat((q.close / divisor).toFixed(2)),
        high: q.high ? parseFloat((q.high / divisor).toFixed(2)) : null,
        low: q.low ? parseFloat((q.low / divisor).toFixed(2)) : null,
        volume: q.volume || 0,
      }));

    cache.set(cacheKey, data, CACHE_TTL);
    return data;
  } catch (err) {
    console.error(`Historical data error for ${symbol}:`, err.message);
    throw new Error(`לא ניתן לטעון נתונים היסטוריים עבור ${symbol}: ${err.message}`);
  }
}

/**
 * Simulate an investment over a historical period
 */
async function simulateInvestment({ symbol, amount, startDate, endDate }) {
  const yfSymbol = symbol.endsWith('.TA') ? symbol : `${symbol}.TA`;

  // Validate inputs
  if (!amount || amount < 100) {
    throw new Error('סכום ההשקעה המינימלי הוא ₪100');
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  if (isNaN(start.getTime())) {
    throw new Error('תאריך התחלה לא תקין');
  }

  if (start >= end) {
    throw new Error('תאריך ההתחלה חייב להיות לפני תאריך הסיום');
  }

  // Fetch historical data
  const history = await getHistoricalData(yfSymbol, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);

  if (history.length < 2) {
    throw new Error('אין מספיק נתונים היסטוריים לתקופה שנבחרה');
  }

  const entryPrice = history[0].close;
  const exitPrice = history[history.length - 1].close;
  const shares = amount / entryPrice;
  const currentValue = shares * exitPrice;
  const profitLoss = currentValue - amount;
  const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

  // Calculate max drawdown and peak
  let peak = history[0].close;
  let maxDrawdown = 0;
  let maxDrawdownDate = history[0].date;
  let peakValue = amount;
  let maxValue = amount;
  let maxValueDate = history[0].date;
  let minValue = amount;
  let minValueDate = history[0].date;

  // Build portfolio value timeline
  const timeline = history.map(point => {
    const value = parseFloat((shares * point.close).toFixed(2));

    if (point.close > peak) peak = point.close;
    const drawdown = ((peak - point.close) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownDate = point.date;
    }
    if (value > maxValue) {
      maxValue = value;
      maxValueDate = point.date;
    }
    if (value < minValue) {
      minValue = value;
      minValueDate = point.date;
    }

    return {
      date: point.date,
      price: point.close,
      value,
      returnPct: parseFloat((((point.close - entryPrice) / entryPrice) * 100).toFixed(2)),
    };
  });

  // Calculate annualized return
  const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
  const years = daysDiff / 365.25;
  const annualizedReturn = years > 0
    ? (Math.pow(currentValue / amount, 1 / years) - 1) * 100
    : returnPct;

  // Calculate volatility (std dev of weekly returns)
  const weeklyReturns = [];
  for (let i = 1; i < history.length; i++) {
    const ret = (history[i].close - history[i - 1].close) / history[i - 1].close;
    weeklyReturns.push(ret);
  }
  const avgReturn = weeklyReturns.reduce((s, r) => s + r, 0) / weeklyReturns.length;
  const variance = weeklyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / weeklyReturns.length;
  const weeklyVolatility = Math.sqrt(variance);
  const annualVolatility = weeklyVolatility * Math.sqrt(52); // annualize

  // Find stock info
  const allStocks = getAllStocks();
  const stockInfo = allStocks.find(s => `${s.symbol}.TA` === yfSymbol) || null;

  return {
    symbol: yfSymbol,
    stockName: stockInfo?.name || yfSymbol.replace('.TA', ''),
    stockNameEn: stockInfo?.nameEn || '',
    sector: stockInfo?.sector || '',
    index: stockInfo?.index || '',
    investment: {
      amount,
      startDate: history[0].date,
      endDate: history[history.length - 1].date,
      entryPrice,
      exitPrice,
      shares: parseFloat(shares.toFixed(2)),
    },
    performance: {
      currentValue: parseFloat(currentValue.toFixed(2)),
      profitLoss: parseFloat(profitLoss.toFixed(2)),
      returnPct: parseFloat(returnPct.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      annualVolatility: parseFloat((annualVolatility * 100).toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      maxDrawdownDate,
      maxValue: parseFloat(maxValue.toFixed(2)),
      maxValueDate,
      minValue: parseFloat(minValue.toFixed(2)),
      minValueDate,
      periodDays: Math.round(daysDiff),
      periodYears: parseFloat(years.toFixed(2)),
    },
    timeline,
    dataPoints: timeline.length,
  };
}

/**
 * Get available stocks for simulation (with search)
 */
function getSimulatableStocks(query = '') {
  const allStocks = getAllStocks();
  const q = query.toLowerCase();

  return allStocks
    .filter(s => {
      if (!q) return true;
      return (
        s.name.includes(q) ||
        s.nameEn?.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.sector?.includes(q)
      );
    })
    .map(s => ({
      symbol: `${s.symbol}.TA`,
      name: s.name,
      nameEn: s.nameEn,
      sector: s.sector,
      index: s.index,
    }))
    .slice(0, 30);
}

/**
 * Simulate a portfolio of multiple stocks over a historical period
 * @param {Object} params
 * @param {Array} params.holdings - Array of { symbol, weight } where weight is 0-100 (%)
 * @param {number} params.amount - Total investment amount
 * @param {string} params.startDate
 * @param {string} params.endDate
 */
async function simulatePortfolio({ holdings, amount, startDate, endDate }) {
  if (!holdings || holdings.length === 0) {
    throw new Error('יש להוסיף לפחות מניה אחת לתיק');
  }
  if (!amount || amount < 100) {
    throw new Error('סכום ההשקעה המינימלי הוא ₪100');
  }

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  if (Math.abs(totalWeight - 100) > 1) {
    throw new Error(`סך המשקלים חייב להיות 100%. כרגע: ${totalWeight.toFixed(1)}%`);
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (isNaN(start.getTime())) throw new Error('תאריך התחלה לא תקין');
  if (start >= end) throw new Error('תאריך ההתחלה חייב להיות לפני תאריך הסיום');

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Fetch historical data for all holdings in parallel
  const allStocks = getAllStocks();
  const holdingData = await Promise.all(
    holdings.map(async (h) => {
      const yfSymbol = h.symbol.endsWith('.TA') ? h.symbol : `${h.symbol}.TA`;
      const history = await getHistoricalData(yfSymbol, startStr, endStr);
      const stockInfo = allStocks.find(s => `${s.symbol}.TA` === yfSymbol) || null;
      const holdingAmount = amount * (h.weight / 100);
      const entryPrice = history[0].close;
      const exitPrice = history[history.length - 1].close;
      const shares = holdingAmount / entryPrice;
      const currentValue = shares * exitPrice;
      const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      // Build a date->price map for merging
      const dateMap = {};
      for (const point of history) {
        dateMap[point.date] = point.close;
      }

      return {
        symbol: yfSymbol,
        name: stockInfo?.name || yfSymbol.replace('.TA', ''),
        nameEn: stockInfo?.nameEn || '',
        sector: stockInfo?.sector || '',
        index: stockInfo?.index || '',
        weight: h.weight,
        amount: holdingAmount,
        entryPrice,
        exitPrice,
        shares: parseFloat(shares.toFixed(2)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        profitLoss: parseFloat((currentValue - holdingAmount).toFixed(2)),
        returnPct: parseFloat(returnPct.toFixed(2)),
        dateMap,
        dates: history.map(p => p.date),
      };
    })
  );

  // Build unified date set (intersection of all stock date ranges)
  let commonDates = holdingData[0].dates;
  for (let i = 1; i < holdingData.length; i++) {
    const dateSet = new Set(holdingData[i].dates);
    commonDates = commonDates.filter(d => dateSet.has(d));
  }

  if (commonDates.length < 2) {
    throw new Error('אין מספיק נתונים היסטוריים משותפים לכל המניות בתיק');
  }

  // Build combined portfolio timeline
  let peakValue = amount;
  let maxDrawdown = 0;
  let maxDrawdownDate = commonDates[0];
  let maxValue = amount;
  let maxValueDate = commonDates[0];
  let minValue = amount;
  let minValueDate = commonDates[0];

  const timeline = commonDates.map(date => {
    let totalValue = 0;
    const stockValues = {};

    for (const hd of holdingData) {
      const price = hd.dateMap[date];
      if (!price) continue;
      const value = hd.shares * price;
      totalValue += value;
      stockValues[hd.symbol] = parseFloat(value.toFixed(2));
    }

    totalValue = parseFloat(totalValue.toFixed(2));
    const returnPct = parseFloat((((totalValue - amount) / amount) * 100).toFixed(2));

    if (totalValue > peakValue) peakValue = totalValue;
    const drawdown = ((peakValue - totalValue) / peakValue) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownDate = date;
    }
    if (totalValue > maxValue) { maxValue = totalValue; maxValueDate = date; }
    if (totalValue < minValue) { minValue = totalValue; minValueDate = date; }

    return { date, value: totalValue, returnPct, ...stockValues };
  });

  const finalValue = timeline[timeline.length - 1].value;
  const totalReturn = ((finalValue - amount) / amount) * 100;
  const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
  const years = daysDiff / 365.25;
  const annualizedReturn = years > 0
    ? (Math.pow(finalValue / amount, 1 / years) - 1) * 100
    : totalReturn;

  // Portfolio volatility (from weekly combined returns)
  const weeklyReturns = [];
  for (let i = 1; i < timeline.length; i++) {
    weeklyReturns.push((timeline[i].value - timeline[i - 1].value) / timeline[i - 1].value);
  }
  const avgRet = weeklyReturns.reduce((s, r) => s + r, 0) / weeklyReturns.length;
  const variance = weeklyReturns.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / weeklyReturns.length;
  const annualVolatility = Math.sqrt(variance) * Math.sqrt(52) * 100;

  // Sector distribution
  const sectorMap = {};
  for (const hd of holdingData) {
    const sec = hd.sector || 'אחר';
    sectorMap[sec] = (sectorMap[sec] || 0) + hd.weight;
  }

  return {
    holdings: holdingData.map(hd => ({
      symbol: hd.symbol,
      name: hd.name,
      nameEn: hd.nameEn,
      sector: hd.sector,
      index: hd.index,
      weight: hd.weight,
      amount: hd.amount,
      entryPrice: hd.entryPrice,
      exitPrice: hd.exitPrice,
      shares: hd.shares,
      currentValue: hd.currentValue,
      profitLoss: hd.profitLoss,
      returnPct: hd.returnPct,
    })),
    summary: {
      totalInvested: amount,
      currentValue: parseFloat(finalValue.toFixed(2)),
      profitLoss: parseFloat((finalValue - amount).toFixed(2)),
      returnPct: parseFloat(totalReturn.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      annualVolatility: parseFloat(annualVolatility.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      maxDrawdownDate,
      maxValue: parseFloat(maxValue.toFixed(2)),
      maxValueDate,
      minValue: parseFloat(minValue.toFixed(2)),
      minValueDate,
      periodDays: Math.round(daysDiff),
      periodYears: parseFloat(years.toFixed(2)),
      stockCount: holdingData.length,
      sectorDistribution: sectorMap,
    },
    startDate: commonDates[0],
    endDate: commonDates[commonDates.length - 1],
    timeline,
    dataPoints: timeline.length,
  };
}

module.exports = {
  simulateInvestment,
  simulatePortfolio,
  getSimulatableStocks,
};
