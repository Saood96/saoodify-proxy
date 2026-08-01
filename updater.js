const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        console.log("Starting GitHub Action Chrome...");
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        // Robot ko ek asli Windows PC jaisa banana
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        console.log("OK.ru Desktop site open kar raha hu...");
        await page.goto('https://ok.ru/', { waitUntil: 'networkidle2' });
        
        console.log("Login box aane ka wait kar raha hu...");
        // Desktop version mein box ka naam 'st.email' hota hai
        await page.waitForSelector('input[name="st.email"]', { timeout: 15000 });
        
        console.log("Details daal raha hu...");
        await page.type('input[name="st.email"]', process.env.OKRU_EMAIL);
        await page.type('input[name="st.password"]', process.env.OKRU_PASSWORD);
        
        console.log("Login button click kar raha hu...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('input[type="submit"], input[value="Log in"]') 
        ]);
        
        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Check karna ki login sachi mein hua ya nahi (AUTHCODE aana zaroori hai)
        if (!cookieStr.includes("AUTHCODE")) {
            throw new Error("Login fail ho gaya! Shayad OK.ru ne Captcha laga diya hai.");
        }
        
        fs.writeFileSync('cookie.txt', cookieStr);
        console.log("VIP Cookie successfully update ho gayi! 🎉 Saoodify is ready.");
        
        await browser.close();
    } catch (error) {
        console.error("Error aagaya:", error.message);
        process.exit(1); 
    }
})();
