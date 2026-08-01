const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// GitHub se direct raw cookie fetch karna
async function getCookieFromGitHub() {
    try {
        // Cache bypass karne ke liye Date.now() lagaya hai
        const response = await axios.get('https://raw.githubusercontent.com/Saood96/saoodify-proxy/main/cookie.txt?t=' + Date.now());
        return response.data.trim();
    } catch (err) {
        return null;
    }
}

app.get('/api/stream/:videoId', async (req, res) => {
    const freshCookie = await getCookieFromGitHub();

    if (!freshCookie) {
        return res.status(500).send("Error: GitHub par cookie nahi mili.");
    }

    try {
        const okruUrl = `https://ok.ru/video/${req.params.videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': freshCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36'
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
            // Naye code me yeh error message aayega!
            res.status(404).send("Cookie expire ho gayi. Kripya PC Bot ko ek baar run karein.");
        }
    } catch (error) {
        res.status(500).send("Server Error");
    }
});

app.listen(process.env.PORT || 3000, () => console.log(`Saoodify API Running`));
