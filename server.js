const express = require('express');
const axios = require('axios');
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

let CACHED_COOKIES = "";
let isFetchingCookies = false;

// ⚡ FAST AUTO-LOGIN FUNCTION (Bina Browser Ke)
async function getFreshCookies() {
    if (isFetchingCookies) return;
    isFetchingCookies = true;
    console.log("Direct API Login Start...");

    try {
        const email = process.env.OKRU_EMAIL;
        const password = process.env.OKRU_PASSWORD;

        // OK.ru ki Mobile Login API par direct request bhejna
        const loginResponse = await axios.post('https://m.ok.ru/dk?st.cmd=anonymLogin', 
            new URLSearchParams({
                'fr.login': email,
                'fr.password': password
            }), 
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                maxRedirects: 0, // Redirect ko rokna taaki cookies pakad sakein
                validateStatus: status => status >= 200 && status < 400
            }
        );

        // Header se 'set-cookie' nikalna
        const setCookieHeaders = loginResponse.headers['set-cookie'];
        
        if (setCookieHeaders) {
            // Har cookie se uska main hissa nikal kar jodna
            CACHED_COOKIES = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
            console.log("Successfully fetched new Cookies instantly! 🎉");
        } else {
            console.error("Login fail! Shayad Email/Password galat hai.");
        }
    } catch (error) {
        console.error("Auto-login error:", error.message);
    } finally {
        isFetchingCookies = false;
    }
}

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    if (!CACHED_COOKIES) {
        await getFreshCookies();
    }

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': CACHED_COOKIES,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0'
            }
        });

        let m3u8Url = '';
        const match1 = response.data.match(/hlsManifestUrl\\\\&quot;:\\\\&quot;(.*?)\\\\&quot;/);
        const match2 = response.data.match(/"hlsManifestUrl":"(.*?)"/);
        
        if (match1 && match1[1]) m3u8Url = decodeURIComponent(JSON.parse(`"${match1[1]}"`)).replace(/\\\\u0026/g, '&');
        else if (match2 && match2[1]) m3u8Url = match2[1].replace(/\\u0026/g, '&');

        if (m3u8Url) {
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            m3u8Response.data.pipe(res);
        } else {
            console.log("Cookie purani ho gayi. API Login dobara kar raha hu...");
            CACHED_COOKIES = ""; 
            await getFreshCookies(); 
            res.status(404).send("Refreshing cookies... Please refresh the page in 5 seconds.");
        }
    } catch (error) {
        console.error("Stream Error:", error.message);
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Saoodify Fast API is running on port ${PORT}`);
});
