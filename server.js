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
            const m3u8Response = await axios.get(m3u8Url, {
                headers: {
                    'Cookie': freshCookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://ok.ru/'
                },
                responseType: 'text'
            });

            let playlistData = m3u8Response.data;
            const hostUrl = `${req.protocol}://${req.get('host')}`;
            const parentUrlObj = new URL(m3u8Url);
            const parentSearch = parentUrlObj.search;

            // Strict HTTPS Replacement for every chunk URL
            playlistData = playlistData.split('\n').map(line => {
                if (line && !line.startsWith('#')) {
                    try {
                        const absoluteUrl = new URL(line, m3u8Url);
                        if (!absoluteUrl.search && parentSearch) {
                            absoluteUrl.search = parentSearch;
                        }
                        
                        // Forcefully replace protocol with https
                        absoluteUrl.protocol = 'https:';

                        return `${hostUrl}/api/proxy?url=${encodeURIComponent(absoluteUrl.href)}`;
                    } catch (e) {
                        return line;
                    }
                }
                return line;
            }).join('\n');

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

app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const freshCookie = await getCookieFromGitHub();

    if (!targetUrl) {
        return res.status(400).send("Missing URL parameter");
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'Cookie': freshCookie,
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

app.listen(process.env.PORT || 3000, () => console.log(`Saoodify Force HTTPS API Running`));
