const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

async function getCookieFromGitHub() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/Saood96/saoodify-proxy/main/cookie.txt?t=' + Date.now());
        return response.data.trim();
    } catch (err) {
        return null;
    }
}

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const freshCookie = await getCookieFromGitHub();

    if (!freshCookie) {
        return res.status(500).send("Error: GitHub par cookie nahi mili.");
    }

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': freshCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;
        let m3u8Url = '';
        
        // Sabhi possible formats ko dhoondhne ke liye smart patterns
        const patterns = [
            /hlsManifestUrl["']?\s*[:=]\s*["']([^"']+)["']/i,
            /\\?"hlsManifestUrl\\?"\s*:\s*\\?"(.*?)\\?"/,
            /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i
        ];

        for (let pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                m3u8Url = match[1].replace(/\\u0026/g, '&').replace(/\\\\/g, '');
                break;
            } else if (match && match[0] && match[0].startsWith('http')) {
                m3u8Url = match[0].replace(/\\u0026/g, '&');
                break;
            }
        }

        // Agar direct regex fail ho, toh text me se .m3u8 link extract karna
        if (!m3u8Url) {
            const m3u8Index = html.indexOf('.m3u8');
            if (m3u8Index !== -1) {
                let start = m3u8Index;
                while (start > 0 && !['"', "'", '(', ' '].includes(html[start])) {
                    start--;
                }
                m3u8Url = html.substring(start + 1, m3u8Index + 5);
            }
        }

        if (m3u8Url) {
            console.log("Found m3u8:", m3u8Url);
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            m3u8Response.data.pipe(res);
        } else {
            // Debugging ke liye HTML print kara lena ya error dena
            res.status(404).send("Error: Video player data extract nahi ho paya. OK.ru ne layout change kiya hai.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send("Server Error: " + error.message);
    }
});

app.listen(process.env.PORT || 3000, () => console.log(`Saoodify Final API Running`));
