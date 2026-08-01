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

// 0. HEALTH CHECK ROUTE (Render crash hone se roknay ke liye)
app.get('/', (req, res) => {
    res.status(200).send("Saoodify API Server Live Hai!");
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

// 1. OK.RU STREAM ROUTE
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
            const m3u8Response = await axios.get(m3u8Url, {
                headers: {
                    'Cookie': freshCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://ok.ru/'
                },
                responseType: 'text'
            });

            let playlistData = m3u8Response.data;
            const parentUrlObj = new URL(m3u8Url);
            const parentSearch = parentUrlObj.search;
            const masterBaseUrl = `${parentUrlObj.protocol}//${parentUrlObj.host}`;

            playlistData = playlistData.split('\n').map(line => {
                let trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    try {
                        let absoluteUrl;
                        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                            absoluteUrl = new URL(trimmed);
                        } else if (trimmed.startsWith('/')) {
                            absoluteUrl = new URL(trimmed, masterBaseUrl);
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
            return res.status(404).send("Error: OK.ru video player data extract nahi ho paya.");
        }
    } catch (error) {
        console.error("OK.ru API Error:", error.message);
        return res.status(500).send(`Server Error: ${error.message}`);
    }
});

// 2. RUMBLE STREAM ROUTE (Updated & Robust)
app.get('/api/rumble/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    try {
        const rumbleUrl = `https://rumble.com/embed/${videoId}/`;
        const response = await axios.get(rumbleUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://rumble.com/'
            }
        });

        const html = response.data;
        
        let m3u8Url = '';
        const match = html.name ? null : html.match(/"i"\s*:\s*("(https:\/\/[^"]+\.m3u8[^"]*)")/) || html.match(/"u"\s*:\s*("(https:\/\/[^"]+\.m3u8[^"]*)")/);
        
        if (!match) {
            const fallbackMatch = html.match(/(https:\/\/[^\s"']+\.m3u8[^\s"']*)/);
            if (fallbackMatch) {
                m3u8Url = fallbackMatch[1];
            }
        } else {
            m3u8Url = JSON.parse(match[1]);
        }
        
        if (m3u8Url) {
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
            return res.status(404).send("Error: Rumble HLS manifest extract nahi ho paya.");
        }
    } catch (error) {
        console.error("Rumble API Error:", error.message);
        return res.status(500).send(`Server Error: ${error.message}`);
    }
});

// 3. UNIVERSAL PROXY ROUTE
app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const freshCookie = await getCookieFromGitHub();

    if (!targetUrl) {
        return res.status(400).send("Missing URL parameter");
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'Cookie': freshCookie || '',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://ok.ru/'
            },
            responseType: 'stream'
        });

        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send("Proxy Error");
    }
});

// Port Binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saoodify API Server Running on Port ${PORT}`));
