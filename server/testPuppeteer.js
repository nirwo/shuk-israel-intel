const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function test() {
    console.log("Launching...");
    const browser = await puppeteer.launch({
        headless: true, // Use headless true for standard
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log("Going to TASE...");
    try {
        await page.goto('https://api.tase.co.il/api/index/components?indexId=704&dType=1', { waitUntil: 'networkidle2', timeout: 30000 });
        console.log("Page loaded. Taking screenshot...");
        await page.screenshot({ path: 'tase_puppeteer.png' });
        
        const html = await page.evaluate(() => document.body.innerHTML);
        console.log("HTML length:", html.length);
        console.log("Preview:", html.substring(0, 200));
        
    } catch (e) {
        console.error("Error:", e);
        try {
            await page.screenshot({ path: 'tase_error.png' });
        } catch (screenshotError) {
             console.error("Could not take screenshot:", screenshotError);
        }
    }
    
    await browser.close();
}

test();
