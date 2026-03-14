const yahooFinance = require('yahoo-finance2').default;

async function testYahoo() {
    try {
        console.log("Fetching Leumi Bank (LUMI.TA)...");
        const quote = await yahooFinance.quote('LUMI.TA');
        
        console.log("Price:", quote.regularMarketPrice);
        console.log("P/E Ratio:", quote.trailingPE || quote.forwardPE);
        
        console.log("\nFetching financials...");
        const quoteSummary = await yahooFinance.quoteSummary('LUMI.TA', { modules: ['financialData', 'defaultKeyStatistics'] });
        
        const roe = quoteSummary.financialData?.returnOnEquity;
        console.log("ROE:", roe !== undefined ? (roe * 100).toFixed(2) + '%' : 'N/A');
        
    } catch (e) {
        console.error("Error:", e);
    }
}

testYahoo();
