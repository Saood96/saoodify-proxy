const express = require('express');
const axios = require('axios');
const app = express();

// 🌍 GLOBAL CORS - ALLOW EVERYONE (Ab koi CORS error nahi aayega)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// 🔴 APNI NAYI FRESH COOKIE YAHAN DAALEIN (Quotes "" ke andar)
const OKRU_COOKIES = "YOUR_NEW_COOKIE_HERE";

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
        
        // 1. OK.ru ka page fetch karna
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': OKRU_COOKIES,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;

        // 2. M3U8 link extract karne ka Naya Smart Logic
        let m3u8Url = '';
        
        // OK.ru 2 alag format me link de sakta hai, hum dono check karenge
        const match1 = html.match(/hlsManifestUrl\\\\&quot;:\\\\&quot;(.*?)\\\\&quot;/);
        const match2 = html.match(/"hlsManifestUrl":"(.*?)"/);
        
        if (match1 && match1[1]) {
            m3u8Url = decodeURIComponent(JSON.parse(`"${match1[1]}"`)).replace(/\\\\u0026/g, '&');
        } else if (match2 && match2[1]) {
            m3u8Url = match2[1].replace(/\\u0026/g, '&');
        }

        // 3. Agar link mil gayi toh seedha stream kar do
        if (m3u8Url) {
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            m3u8Response.data.pipe(res);
        } else {
            // Error handling ko clear kiya gaya hai taaki samajh aaye kahan ruka
            console.error("404 Error: Video link nahi mili.");
            res.status(404).send("Error: Video nahi mila. Ya toh video Private hai aur COOKIES expire ho chuki hain, ya video delete ho gaya hai.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send("Server Error: " + error.message);
    }
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Saoodify Universal API is running on port ${PORT}`);
});
