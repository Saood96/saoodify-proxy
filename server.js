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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;
        let cleanHtml = html.replace(/\\+&quot;/g, '"').replace(/&quot;/g, '"').replace(/\\"/g, '"');
        let m3u8Url = '';
        const match = cleanHtml.match(/"hlsManifestUrl"\s*:\s*"([^"]+)"/);
        
        if (match && match[1]) {
            m3u8Url = match[1].replace(/\\u0026/g, '&').replace(/\\\\/g, '').replace(/\\/g, '');
        }

        if (m3u8Url && m3u8Url.startsWith('http')) {
            console.log("✅ Streaming m3u8 link via Render:", m3u8Url);
            
            // OK.ru se m3u8 file mangwana with proper headers
            const m3u8Response = await axios.get(m3u8Url, {
                headers: {
                    'Cookie': freshCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://ok.ru/'
                },
                responseType: 'text'
            });

            // Playlist ke andar ke relative links ko absolute bana dena taaki 404 na aaye
            let playlistData = m3u8Response.data;
            
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(playlistData);

        } else {
            res.status(404).send("Error: Video player data extract nahi ho paya.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send(`Server Error: ${error.message}`);
    }
});

app.listen(process.env.PORT || 3000, () => console.log(`Saoodify Final Stream API Running`));
