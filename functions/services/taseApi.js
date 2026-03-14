const axios = require('axios');
const ta35Stocks = require('../data/ta35');

const MAYA_BASE_URL = 'https://maya.tase.co.il/api/v1';

// Headers mimic a real browser for general requests
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
});

/**
 * Return the static TA-35 list, mapped to the format expected by recommender
 */
async function getIndexStocks() {
  return {
      result: ta35Stocks.map(stock => ({
          securityId: stock.symbol, // using symbol a securityId
          companyId: stock.companyId,
          name: stock.name,
          securityType: 1
      }))
  };
}

/**
 * Fetch fundamental financials from Maya for a given company
 */
async function getCompanyFinancials(companyId) {
    try {
        const url = `${MAYA_BASE_URL}/companies/${companyId}/financials`;
        const response = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`Error fetching financials for company ${companyId}:`, error.message);
        return null;
    }
}

/**
 * Fetch real-time price from Google Finance HTML (Bypasses TASE WAF)
 * e.g. https://www.google.com/finance/quote/LUMI:TLV
 */
async function getSecurityMajorData(securityId, companyId) {
    try {
        const url = `https://www.google.com/finance/quote/${securityId}:TLV`;
        const response = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
        
        // Extract price from Google Finance HTML using Regex
        const html = response.data;
        const priceMatch = html.match(/class="[a-zA-Z0-9 ]*?fxKbKc[a-zA-Z0-9 ]*?">([\d,.]+)</);
        const peMatch = html.match(/P\/E ratio<\/div><div class="P6K39c.*?>([\d,.]+)</);
        
        let lastPrice = null;
        if (priceMatch && priceMatch[1]) {
            lastPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        }

        let peRatio = null;
        if (peMatch && peMatch[1]) {
            peRatio = parseFloat(peMatch[1].replace(/,/g, ''));
        }

        return {
            lastPrice: lastPrice,
            fundamentalData: { peRatio: peRatio }
        };
    } catch (error) {
        console.error(`Error fetching price for security ${securityId}:`, error.message);
        return null;
    }
}

module.exports = {
  getIndexStocks,
  getCompanyFinancials,
  getSecurityMajorData
};
