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
        
        // Rumble ka naya JSON/JS HLS manifest pattern
        let m3u8Url = '';
        const match = html.name ? null : html.match(/"i"\s*:\s*("(https:\/\/[^"]+\.m3u8[^"]*)")/) || html.match(/"u"\s*:\s*("(https:\/\/[^"]+\.m3u8[^"]*)")/);
        
        // Agar upar wale se na mile toh generic regex search
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
