const express = require('express');
const axios = require('axios');
const app = express();

// CORS Configuration
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health Check
app.get('/', (req, res) => {
    res.status(200).send("Saoodify API: Private MP4 Extractor Server Live Hai!");
});

// Helper: Fetch Cookie from GitHub
async function getCookieFromGitHub() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/Saood96/saoodify-proxy/main/cookie.txt?t=' + Date.now());
        return response.data.trim();
    } catch (err) {
        return null;
    }
}

// DIRECT MP4 EXTRACTION ROUTE (Cookie Fix Applied to BOTH Requests)
app.get('/api/direct/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const freshCookie = await getCookieFromGitHub();

    if (!freshCookie) {
        return res.status(500).json({ status: "error", message: "GitHub par cookie nahi mili." });
    }

    try {
        // Request 1: Embed Page
        const response = await axios.get(`https://ok.ru/videoembed/${videoId}`, {
            headers: {
                'Cookie': freshCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://ok.ru/'
            }
        });

        const html = response.data;
        const match = html.match(/data-options="([^"]+)"/);
        
        if (match && match[1]) {
            const cleanJson = match[1].replace(/&quot;/g, '"').replace(/\\\\/g, '\\');
            const data = JSON.parse(cleanJson);
            
            const metadataUrl = decodeURIComponent(data.flashvars.metadataUrl);
            
            // YAHAN THI GALTI: Metadata request mein bhi Cookie bhejni zaroori hai!
            const metadataResponse = await axios.get(metadataUrl, {
                headers: {
                    'Cookie': freshCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://ok.ru/'
                }
            });
            
            const videos = metadataResponse.data.videos;
            
            // Quality preference: HD -> SD -> low
            const bestVideo = videos.find(v => v.name === 'hd') 
                           || videos.find(v => v.name === 'sd') 
                           || videos.find(v => v.name === 'low') 
                           || videos[0];

            if (bestVideo && bestVideo.url) {
                return res.json({ status: "success", url: bestVideo.url });
            } else {
                return res.status(404).json({ status: "error", message: "Video link nahi mila." });
            }
        } else {
            return res.status(404).json({ status: "error", message: "OK.ru data extract nahi hua." });
        }
    } catch (error) {
        console.error("Extraction Error:", error.message);
        return res.status(500).json({ status: "error", message: "Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saoodify Private MP4 Extractor Running on Port ${PORT}`));
