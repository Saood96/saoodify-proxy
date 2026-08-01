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
        
        // SUPER SMART FIX: OK.ru ke saare ajeeb quotes (\&quot;) ko normal quotes (") me badal do
        let cleanHtml = html.replace(/\\+&quot;/g, '"').replace(/&quot;/g, '"').replace(/\\"/g, '"');
        
        let m3u8Url = '';
        // Ab simply normal "hlsManifestUrl" dhoondho (koi galti nahi hogi)
        const match = cleanHtml.match(/"hlsManifestUrl"\s*:\s*"([^"]+)"/);
        
        if (match && match[1]) {
            // Link ke andar ke extra symbols clean karna
            m3u8Url = match[1].replace(/\\u0026/g, '&').replace(/\\\\/g, '').replace(/\\/g, '');
        }

        if (m3u8Url && m3u8Url.startsWith('http')) {
            console.log("✅ Perfect m3u8 link mil gaya:", m3u8Url);
            
            try {
                // Ab actual video stream ko fetch karo
                const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                m3u8Response.data.pipe(res);
            } catch (streamError) {
                console.error("Stream Error:", streamError.message);
                res.status(500).send("Error: OK.ru video fetch fail ho gaya.");
            }
        } else {
            console.error("Link nahi mila. HTML kachra saaf hone ke baad bhi pattern match nahi hua.");
            res.status(404).send("Error: Video player data extract nahi ho paya.");
        }
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(error.response ? error.response.status : 500).send(`Server Error: ${error.message}`);
    }
});

app.listen(process.env.PORT || 3000, () => console.log(`Saoodify Final Stable API Running`));
