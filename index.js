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
    res.status(200).send("Saoodify API: MP4 Extractor Server Live Hai!");
});

// DIRECT MP4 EXTRACTION ROUTE (No Chunk Proxying - Zero Load!)
app.get('/api/direct/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    try {
        // OK.ru ka embed page fetch karna
        const response = await axios.get(`https://ok.ru/videoembed/${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://ok.ru/'
            }
        });

        const html = response.data;
        
        // HTML se data-options extract karna
        const match = html.match(/data-options="([^"]+)"/);
        
        if (match && match[1]) {
            // Unescape HTML entities (&quot; ko " mein convert karna)
            const cleanJson = match[1].replace(/&quot;/g, '"').replace(/\\\\/g, '\\');
            const data = JSON.parse(cleanJson);
            
            // Metadata URL nikalna aur call karna
            const metadataUrl = decodeURIComponent(data.flashvars.metadataUrl);
            const metadataResponse = await axios.get(metadataUrl);
            
            // Videos array se best quality (hd, sd, ya lowest) nikalna
            const videos = metadataResponse.data.videos;
            
            // Quality preference: HD -> SD -> low
            const bestVideo = videos.find(v => v.name === 'hd') 
                           || videos.find(v => v.name === 'sd') 
                           || videos.find(v => v.name === 'low') 
                           || videos[0];

            if (bestVideo && bestVideo.url) {
                // Direct MP4 link JSON mein frontend ko bhej do
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
app.listen(PORT, () => console.log(`Saoodify MP4 Extractor Running on Port ${PORT}`));
