const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// GitHub se raw cookie text uthane ka function
async function getCookieFromGitHub() {
    try {
        // Cache rokne ke liye time add kiya gaya hai
        const response = await axios.get('https://raw.githubusercontent.com/Saood96/saoodify-proxy/main/cookie.txt?t=' + Date.now());
        return response.data.trim();
    } catch (err) {
        console.error("GitHub se cookie abhi bani nahi hai.");
        return null;
    }
}

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const freshCookie = await getCookieFromGitHub();

    if (!freshCookie) {
        return res.status(500).send("System updating... Please refresh in 2 minutes.");
    }

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
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
            res.status(404).send("Error: Video link block ho gayi hai. GitHub Action chalne ka wait karein.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Saoodify Action API is running on port ${PORT}`);
});
