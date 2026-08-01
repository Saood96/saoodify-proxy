const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        console.log("Starting GitHub Action Chrome...");
        // GitHub ke supercomputer par headless Chrome chalana
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        await page.goto('https://m.ok.ru/');
        await page.type('input[name="fr.login"]', process.env.OKRU_EMAIL);
        await page.type('input[name="fr.password"]', process.env.OKRU_PASSWORD);
        
        await Promise.all([
            page.waitForNavigation(),
            page.click('input[type="submit"]')
        ]);
        
        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Cookie ko repo me save kar dena
        fs.writeFileSync('cookie.txt', cookieStr);
        console.log("VIP Cookie successfully update ho gayi! Saoodify is ready.");
        
        await browser.close();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();
