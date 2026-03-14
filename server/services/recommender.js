const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { getAllStocks, getStocksByIndex, getAvailableIndices } = require('../data/tase_stocks');
const cache = require('./cache');

const MAX_PE_RATIO = 25;
const CACHE_TTL = 3600 * 4;
const CHUNK_SIZE = 8;
const CHUNK_DELAY_MS = 400;

/**
 * Analyze a single stock via Yahoo Finance
 */
async function analyzeStock(stock) {
    const yfSymbol = `${stock.symbol}.TA`;
    try {
        const summary = await yf.quoteSummary(yfSymbol, {
            modules: ['financialData', 'defaultKeyStatistics'],
        });

        if (!summary.financialData) return null;

        const price = summary.financialData.currentPrice || 0;

        let peRatio = null;
        if (summary.defaultKeyStatistics?.trailingEps) {
            peRatio = (price / 100) / summary.defaultKeyStatistics.trailingEps;
        } else if (summary.defaultKeyStatistics?.forwardPE) {
            peRatio = summary.defaultKeyStatistics.forwardPE;
        }

        const netProfit = summary.defaultKeyStatistics?.netIncomeToCommon || 0;
        const isProfitable = netProfit > 0;

        return {
            id: `${stock.symbol}_${stock.index}`,
            symbol: yfSymbol,
            name: stock.name,
            nameEn: stock.nameEn,
            price,
            peRatio: peRatio !== null ? parseFloat(peRatio.toFixed(2)) : null,
            netProfit,
            isProfitable,
            sector: stock.sector,
            index: stock.index,
        };
    } catch (err) {
        console.error(`  ✗ ${stock.nameEn} (${yfSymbol}): ${err.message}`);
        return null;
    }
}

/**
 * Fetch and analyze all TASE stocks
 */
async function getRecommendations(indexFilter = 'all') {
    const cacheKey = `recommendations_${indexFilter}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        console.log(`Serving ${indexFilter} recommendations from cache.`);
        return cachedData;
    }

    const stocks = getStocksByIndex(indexFilter);
    const total = stocks.length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Analyzing ${total} stocks (index: ${indexFilter})...`);
    console.log(`${'='.repeat(60)}`);

    const analyzedStocks = [];
    const recommendations = [];
    let processed = 0;

    for (let i = 0; i < stocks.length; i += CHUNK_SIZE) {
        const chunk = stocks.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(stocks.length / CHUNK_SIZE);
        console.log(`\n[${chunkNum}/${totalChunks}] Processing: ${chunk.map(s => s.symbol).join(', ')}`);

        const results = await Promise.all(chunk.map(analyzeStock));

        for (const analysis of results) {
            if (!analysis) continue;
            processed++;
            analyzedStocks.push(analysis);

            if (analysis.peRatio !== null && analysis.peRatio > 0 && analysis.peRatio <= MAX_PE_RATIO && analysis.isProfitable) {
                recommendations.push(analysis);
            }
        }

        console.log(`  ✓ ${processed}/${total} analyzed | ${recommendations.length} recommendations so far`);

        if (i + CHUNK_SIZE < stocks.length) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
        }
    }

    recommendations.sort((a, b) => a.peRatio - b.peRatio);

    const sectorBreakdown = {};
    for (const stock of analyzedStocks) {
        sectorBreakdown[stock.sector] = (sectorBreakdown[stock.sector] || 0) + 1;
    }

    const indexBreakdown = {};
    for (const stock of analyzedStocks) {
        indexBreakdown[stock.index] = (indexBreakdown[stock.index] || 0) + 1;
    }

    const result = {
        totalAnalyzed: analyzedStocks.length,
        recommendationsCount: recommendations.length,
        recommendations: analyzedStocks.sort((a, b) => {
            if (a.peRatio === null) return 1;
            if (b.peRatio === null) return -1;
            return a.peRatio - b.peRatio;
        }),
        topPicks: recommendations.slice(0, 15),
        sectorBreakdown,
        indexBreakdown,
        indices: getAvailableIndices(),
        lastUpdated: new Date().toISOString(),
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Done! ${analyzedStocks.length} analyzed, ${recommendations.length} recommendations`);
    console.log(`${'='.repeat(60)}\n`);

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
}

module.exports = {
    getRecommendations,
};
