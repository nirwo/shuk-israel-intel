/**
 * Portfolio Builder Service
 * 
 * Takes an investment amount and risk profile, then builds an optimal
 * portfolio from analyzed TASE stocks based on value investing principles.
 * 
 * Risk Profiles:
 *   - conservative: Low PE, high profit, large caps (TA-35), max 8 stocks, sector limit
 *   - balanced: Mix of value + growth, TA-35 + TA-90, max 12 stocks
 *   - aggressive: Higher risk/reward, includes SME, max 15 stocks, growth-oriented
 */

const { getRecommendations } = require('./recommender');

const RISK_PROFILES = {
  conservative: {
    name: 'שמרני',
    nameEn: 'Conservative',
    description: 'תיק יציב עם דגש על חברות גדולות ורווחיות. מתאים למי שמעדיף ביטחון על תשואה גבוהה.',
    maxPE: 18,
    minProfit: 100_000_000, // 100M ILS minimum net profit
    maxStocks: 8,
    maxPerSector: 2,
    maxPercentPerStock: 20,
    indexWeights: { 'TA-35': 0.80, 'TA-90': 0.20, 'SME': 0 },
    scoreWeights: { pe: 0.4, profit: 0.35, index: 0.25 },
    icon: '🛡️',
    expectedReturn: '6-10%',
    riskLevel: 'נמוך',
  },
  balanced: {
    name: 'מאוזן',
    nameEn: 'Balanced',
    description: 'תיק מגוון שמשלב חברות ערך עם פוטנציאל צמיחה. איזון בין סיכון לתשואה.',
    maxPE: 25,
    minProfit: 10_000_000, // 10M ILS
    maxStocks: 12,
    maxPerSector: 3,
    maxPercentPerStock: 15,
    indexWeights: { 'TA-35': 0.50, 'TA-90': 0.35, 'SME': 0.15 },
    scoreWeights: { pe: 0.35, profit: 0.30, index: 0.20, diversification: 0.15 },
    icon: '⚖️',
    expectedReturn: '10-18%',
    riskLevel: 'בינוני',
  },
  aggressive: {
    name: 'אגרסיבי',
    nameEn: 'Aggressive',
    description: 'תיק ממוקד תשואה מקסימלית. כולל חברות קטנות עם פוטנציאל צמיחה גבוה. סיכון גבוה יותר.',
    maxPE: 35,
    minProfit: 1_000_000, // 1M ILS
    maxStocks: 15,
    maxPerSector: 4,
    maxPercentPerStock: 12,
    indexWeights: { 'TA-35': 0.30, 'TA-90': 0.35, 'SME': 0.35 },
    scoreWeights: { pe: 0.30, profit: 0.25, index: 0.15, diversification: 0.15, growth: 0.15 },
    icon: '🚀',
    expectedReturn: '15-30%',
    riskLevel: 'גבוה',
  },
};

/**
 * Score a stock for portfolio inclusion based on risk profile
 */
function scoreStock(stock, profile) {
  let score = 0;

  // PE Score — lower PE = higher score (value)
  if (stock.peRatio !== null && stock.peRatio > 0) {
    const peScore = Math.max(0, 1 - (stock.peRatio / (profile.maxPE * 1.5)));
    score += peScore * (profile.scoreWeights.pe || 0);
  } else {
    return -1; // Skip stocks with no PE
  }

  // Profitability Score — higher profit = higher score
  if (stock.netProfit > 0) {
    const profitNorm = Math.min(1, Math.log10(stock.netProfit / 1_000_000) / 4); // log scale, max at 10B
    score += profitNorm * (profile.scoreWeights.profit || 0);
  } else {
    return -1; // Skip unprofitable stocks
  }

  // Index Score — prefer stocks from preferred indices
  const indexWeight = profile.indexWeights[stock.index] || 0;
  score += indexWeight * (profile.scoreWeights.index || 0);

  // Growth potential (for aggressive) — lower PE in smaller cap = higher growth potential
  if (profile.scoreWeights.growth && stock.index !== 'TA-35') {
    const growthScore = stock.peRatio < 15 ? 0.8 : stock.peRatio < 25 ? 0.5 : 0.2;
    score += growthScore * profile.scoreWeights.growth;
  }

  return score;
}

/**
 * Build portfolio allocation percentages with diversification constraints
 */
function allocatePortfolio(selectedStocks, profile, investmentAmount) {
  const totalScore = selectedStocks.reduce((sum, s) => sum + s.score, 0);

  // Initial allocation proportional to score
  let allocations = selectedStocks.map(s => ({
    ...s,
    allocationPercent: (s.score / totalScore) * 100,
  }));

  // Cap individual stock allocation
  const maxPercent = profile.maxPercentPerStock;
  let excess = 0;
  let uncapped = 0;

  for (const alloc of allocations) {
    if (alloc.allocationPercent > maxPercent) {
      excess += alloc.allocationPercent - maxPercent;
      alloc.allocationPercent = maxPercent;
    } else {
      uncapped++;
    }
  }

  // Redistribute excess
  if (excess > 0 && uncapped > 0) {
    const redistribution = excess / uncapped;
    for (const alloc of allocations) {
      if (alloc.allocationPercent < maxPercent) {
        alloc.allocationPercent = Math.min(maxPercent, alloc.allocationPercent + redistribution);
      }
    }
  }

  // Normalize to exactly 100%
  const totalPercent = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);
  allocations = allocations.map(a => ({
    ...a,
    allocationPercent: parseFloat(((a.allocationPercent / totalPercent) * 100).toFixed(2)),
  }));

  // Calculate amounts and shares
  allocations = allocations.map(a => {
    const amount = (a.allocationPercent / 100) * investmentAmount;
    const priceInShekel = a.price / 100;
    const shares = priceInShekel > 0 ? Math.floor(amount / priceInShekel) : 0;
    const actualAmount = shares * priceInShekel;

    return {
      symbol: a.symbol,
      name: a.name,
      nameEn: a.nameEn,
      sector: a.sector,
      index: a.index,
      price: a.price,
      priceILS: priceInShekel,
      peRatio: a.peRatio,
      netProfit: a.netProfit,
      score: parseFloat(a.score.toFixed(4)),
      allocationPercent: a.allocationPercent,
      investmentAmount: parseFloat(actualAmount.toFixed(2)),
      shares: shares,
      reasoning: generateReasoning(a),
    };
  });

  return allocations;
}

/**
 * Generate Hebrew reasoning for why this stock was selected
 */
function generateReasoning(stock) {
  const reasons = [];

  if (stock.peRatio <= 10) {
    reasons.push('מכפיל רווח נמוך מאוד — מציאה פוטנציאלית');
  } else if (stock.peRatio <= 15) {
    reasons.push('מכפיל רווח אטרקטיבי — תמחור זול');
  } else if (stock.peRatio <= 20) {
    reasons.push('מכפיל רווח סביר — תמחור הוגן');
  } else {
    reasons.push('פוטנציאל צמיחה — השוק מתמחר צמיחה עתידית');
  }

  if (stock.netProfit > 1e9) {
    reasons.push('רווחיות גבוהה מאוד — חברה יציבה');
  } else if (stock.netProfit > 100e6) {
    reasons.push('רווחיות טובה — חברה רווחית');
  }

  if (stock.index === 'TA-35') {
    reasons.push('חברת ת"א 35 — יציבות ונזילות גבוהה');
  } else if (stock.index === 'TA-90') {
    reasons.push('חברת ת"א 90 — איזון בין צמיחה ליציבות');
  } else {
    reasons.push('חברה קטנה/בינונית — פוטנציאל צמיחה');
  }

  return reasons;
}

/**
 * Main portfolio building function
 */
async function buildPortfolio(investmentAmount, riskProfile = 'balanced') {
  const profile = RISK_PROFILES[riskProfile];
  if (!profile) {
    throw new Error(`פרופיל סיכון לא תקין: ${riskProfile}`);
  }

  if (investmentAmount < 5000) {
    throw new Error('סכום ההשקעה המינימלי הוא ₪5,000');
  }

  // Get analyzed stocks (uses cache if available)
  const data = await getRecommendations('all');
  const allStocks = data.recommendations || [];

  // Filter and score stocks
  let candidates = allStocks
    .filter(s => {
      if (!s.peRatio || s.peRatio <= 0) return false;
      if (s.peRatio > profile.maxPE) return false;
      if (!s.isProfitable) return false;
      if (s.netProfit < profile.minProfit) return false;
      // Skip stocks that are too expensive for the investment amount
      const priceILS = s.price / 100;
      if (priceILS > investmentAmount * 0.3) return false;
      return true;
    })
    .map(s => ({
      ...s,
      score: scoreStock(s, profile),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Apply sector diversification limits
  const sectorCount = {};
  const diversified = [];

  for (const stock of candidates) {
    const count = sectorCount[stock.sector] || 0;
    if (count >= profile.maxPerSector) continue;
    sectorCount[stock.sector] = count + 1;
    diversified.push(stock);
    if (diversified.length >= profile.maxStocks) break;
  }

  if (diversified.length === 0) {
    throw new Error('לא נמצאו מניות מתאימות לפרופיל הסיכון שנבחר. נסה להגדיל את סכום ההשקעה או לשנות פרופיל.');
  }

  // Allocate portfolio
  const allocations = allocatePortfolio(diversified, profile, investmentAmount);
  const totalInvested = allocations.reduce((sum, a) => sum + a.investmentAmount, 0);
  const cashRemaining = investmentAmount - totalInvested;

  // Sector distribution in portfolio
  const portfolioSectors = {};
  for (const a of allocations) {
    portfolioSectors[a.sector] = (portfolioSectors[a.sector] || 0) + a.allocationPercent;
  }

  // Index distribution in portfolio
  const portfolioIndices = {};
  for (const a of allocations) {
    portfolioIndices[a.index] = (portfolioIndices[a.index] || 0) + a.allocationPercent;
  }

  // Weighted average PE
  const avgPE = allocations.reduce((sum, a) => sum + (a.peRatio * a.allocationPercent / 100), 0);

  return {
    profile: {
      id: riskProfile,
      ...profile,
    },
    investmentAmount,
    totalInvested: parseFloat(totalInvested.toFixed(2)),
    cashRemaining: parseFloat(cashRemaining.toFixed(2)),
    stockCount: allocations.length,
    allocations,
    summary: {
      weightedPE: parseFloat(avgPE.toFixed(2)),
      sectorCount: Object.keys(portfolioSectors).length,
      sectorDistribution: Object.fromEntries(
        Object.entries(portfolioSectors).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, parseFloat(v.toFixed(1))])
      ),
      indexDistribution: Object.fromEntries(
        Object.entries(portfolioIndices).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, parseFloat(v.toFixed(1))])
      ),
    },
    lastUpdated: new Date().toISOString(),
  };
}

function getRiskProfiles() {
  return Object.entries(RISK_PROFILES).map(([id, p]) => ({
    id,
    name: p.name,
    nameEn: p.nameEn,
    description: p.description,
    icon: p.icon,
    expectedReturn: p.expectedReturn,
    riskLevel: p.riskLevel,
    maxStocks: p.maxStocks,
  }));
}

module.exports = {
  buildPortfolio,
  getRiskProfiles,
};
