const express = require('express');
const axios = require('axios');
const app = express();

// Rumble Stream & Proxy Route
app.get('/api/rumble/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    try {
        // Rumble embed / video endpoint fetch karna
        const rumbleUrl = `https://rumble.com/embed/${videoId}/`;
        const response = await axios.get(rumbleUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://rumble.com/'
            }
        });

        const html = response.data;
        
        // Rumble ke HTML se HLS (.m3u8) manifest URL extract karna
        // (Rumble ke JSON/JS config structure ke mutabiq regex pattern)
        const match = html.match(/"u"\s*:\s*("(https:\/\/[^"]+\.m3u8[^"]*)")/);
        
        if (match && match[1]) {
            let m3u8Url = JSON.parse(match[1]);
            
            const m3u8Response = await axios.get(m3u8Url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://rumble.com/'
                },
                responseType: 'text'
            });

            let playlistData = m3u8Response.data;
            const parentUrlObj = new URL(m3u8Url);
            const parentSearch = parentUrlObj.search;

            // Playlist ke andar ke relative/absolute chunk URLs ko proxy se wrap karna
            playlistData = playlistData.split('\n').map(line => {
                let trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    try {
                        let absoluteUrl;
                        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                            absoluteUrl = new URL(trimmed);
                        } else {
                            const baseDir = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
                            absoluteUrl = new URL(trimmed, baseDir);
                        }

                        if (!absoluteUrl.search && parentSearch) {
                            absoluteUrl.search = parentSearch;
                        }
                        absoluteUrl.protocol = 'https:';
                        
                        return `https://saoodify-api.onrender.com/api/proxy?url=${encodeURIComponent(absoluteUrl.href)}`;
                    } catch (e) {
                        return line;
                    }
                }
                return line;
            }).join('\n');

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(playlistData);

        } else {
            res.status(404).send("Error: Rumble HLS manifest extract nahi ho paya.");
        }
    } catch (error) {
        console.error("Rumble API Error:", error.message);
        res.status(500).send(`Server Error: ${error.message}`);
    }
});
