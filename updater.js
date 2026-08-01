const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        console.log("Starting GitHub Action Chrome...");
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        // Robot ko ek asli Mobile Phone jaisa banana taaki OK.ru block na kare
        await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Mobile Safari/537.36');
        
        console.log("OK.ru open kar raha hu...");
        // 'networkidle2' ka matlab hai ki jab tak page poora load na ho jaye, wait karo
        await page.goto('https://m.ok.ru/', { waitUntil: 'networkidle2' });
        
        console.log("Login box aane ka wait kar raha hu...");
        // Yahan robot maximum 15 second tak login box ka wait karega
        await page.waitForSelector('input[name="fr.login"]', { timeout: 15000 });
        
        console.log("Details daal raha hu...");
        await page.type('input[name="fr.login"]', process.env.OKRU_EMAIL);
        await page.type('input[name="fr.password"]', process.env.OKRU_PASSWORD);
        
        console.log("Login button click kar raha hu...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('input[type="submit"]')
        ]);
        
        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        fs.writeFileSync('cookie.txt', cookieStr);
        console.log("VIP Cookie successfully update ho gayi! Saoodify is ready.");
        
        await browser.close();
    } catch (error) {
        console.error("Error aagaya:", error.message);
        process.exit(1); 
    }
})();
