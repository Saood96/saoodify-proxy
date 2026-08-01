const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Server ki memory me cookie save rakhne ke liye
let CACHED_COOKIES = "";
let isFetchingCookies = false;

// 🤖 AUTO-LOGIN FUNCTION (Invisible Browser)
async function getFreshCookies() {
    if (isFetchingCookies) return;
    isFetchingCookies = true;
    console.log("Starting Auto-Login process for OK.ru...");

    let browser;
    try {
        // Render server par invisible Chrome launch karna
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        
        // Data bachane ke liye mobile version open karenge
        await page.goto('https://m.ok.ru/', { waitUntil: 'domcontentloaded' });

        // Email aur Password type karna
        await page.type('input[name="fr.login"]', process.env.OKRU_EMAIL);
        await page.type('input[name="fr.password"]', process.env.OKRU_PASSWORD);

        // Login button par click karna aur page load hone ka wait karna
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.click('input[type="submit"]')
        ]);

        // Login hone ke baad saari cookies nikal lena
        const cookies = await page.cookies();
        
        // Cookies ko sahi format (name=value;) mein jodna
        CACHED_COOKIES = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        console.log("Successfully fetched new VIP Cookies! 🎉");
        
    } catch (error) {
        console.error("Auto-login me error aaya:", error.message);
    } finally {
        if (browser) await browser.close();
        isFetchingCookies = false;
    }
}

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    // Agar server ke paas cookie nahi hai, toh pehle login karega
    if (!CACHED_COOKIES) {
        await getFreshCookies();
    }

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': CACHED_COOKIES,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0'
            }
        });

        const html = response.data;
        let m3u8Url = '';
        
        const match1 = html.match(/hlsManifestUrl\\\\&quot;:\\\\&quot;(.*?)\\\\&quot;/);
        const match2 = html.match(/"hlsManifestUrl":"(.*?)"/);
        
        if (match1 && match1[1]) m3u8Url = decodeURIComponent(JSON.parse(`"${match1[1]}"`)).replace(/\\\\u0026/g, '&');
        else if (match2 && match2[1]) m3u8Url = match2[1].replace(/\\u0026/g, '&');

        if (m3u8Url) {
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            m3u8Response.data.pipe(res);
        } else {
            // Agar link nahi mili (Cookie expire ho chuki hai), toh dobara fresh cookie nikalne ko bolenge
            console.log("Cookie purani ho gayi. Nayi cookie nikal raha hu...");
            CACHED_COOKIES = ""; // Purani cookie delete
            await getFreshCookies(); // Dobara auto-login
            res.status(404).send("Refreshing cookies in background... Please refresh the page in 10 seconds.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send("Server Error: " + error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Saoodify Auto-Login API is running on port ${PORT}`);
});
