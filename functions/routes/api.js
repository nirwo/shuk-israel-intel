const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../services/recommender');
const { getAvailableIndices } = require('../data/tase_stocks');
const { buildPortfolio, getRiskProfiles } = require('../services/portfolioBuilder');
const { simulateInvestment, simulatePortfolio, getSimulatableStocks } = require('../services/simulator');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Get available indices
router.get('/indices', (req, res) => {
  res.json(getAvailableIndices());
});

// Get risk profiles for portfolio builder
router.get('/portfolio/profiles', (req, res) => {
  res.json(getRiskProfiles());
});

// Build portfolio recommendation
router.post('/portfolio/build', async (req, res) => {
  try {
    const { amount, risk } = req.body;
    const investmentAmount = parseFloat(amount);

    if (!investmentAmount || investmentAmount < 5000) {
      return res.status(400).json({ error: 'סכום ההשקעה המינימלי הוא ₪5,000' });
    }

    const validRisks = ['conservative', 'balanced', 'aggressive'];
    if (!validRisks.includes(risk)) {
      return res.status(400).json({ error: `פרופיל סיכון לא תקין. אפשרויות: ${validRisks.join(', ')}` });
    }

    const portfolio = await buildPortfolio(investmentAmount, risk);
    res.json(portfolio);
  } catch (error) {
    console.error("Portfolio build error:", error);
    res.status(500).json({ error: error.message || 'שגיאה בבניית התיק' });
  }
});

// Run recommendation algorithm with optional index filter
router.get('/recommendations', async (req, res) => {
  try {
    const indexFilter = req.query.index || 'all';
    const validIndices = ['all', 'TA-35', 'TA-90', 'SME'];
    if (!validIndices.includes(indexFilter)) {
      return res.status(400).json({ error: `Invalid index filter. Use: ${validIndices.join(', ')}` });
    }
    const recommendations = await getRecommendations(indexFilter);
    res.json(recommendations);
  } catch (error) {
    console.error("Recommendations API error:", error);
    res.status(500).json({ error: 'שגיאה בטעינת הנתונים', details: error.message });
  }
});

// Search stocks for simulator
router.get('/simulator/stocks', (req, res) => {
  const query = req.query.q || '';
  res.json(getSimulatableStocks(query));
});

// Run investment simulation
router.post('/simulator/run', async (req, res) => {
  try {
    const { symbol, amount, startDate, endDate } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'יש לבחור מניה' });
    }
    const result = await simulateInvestment({
      symbol,
      amount: parseFloat(amount),
      startDate,
      endDate,
    });
    res.json(result);
  } catch (error) {
    console.error("Simulator error:", error);
    res.status(500).json({ error: error.message || 'שגיאה בהרצת הסימולציה' });
  }
});

// Run portfolio simulation (multiple stocks)
router.post('/simulator/portfolio', async (req, res) => {
  try {
    const { holdings, amount, startDate, endDate } = req.body;
    if (!holdings || !holdings.length) {
      return res.status(400).json({ error: 'יש להוסיף לפחות מניה אחת לתיק' });
    }
    const result = await simulatePortfolio({
      holdings,
      amount: parseFloat(amount),
      startDate,
      endDate,
    });
    res.json(result);
  } catch (error) {
    console.error("Portfolio simulator error:", error);
    res.status(500).json({ error: error.message || 'שגיאה בהרצת סימולציית התיק' });
  }
});

module.exports = router;
