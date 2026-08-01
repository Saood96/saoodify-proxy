const express = require('express');
const axios = require('axios');
const app = express();

// Aapki Format Ki Gayi OK.ru Cookies (Yeh ek hi line me honi chahiye)
const OKRU_COOKIES = "JSESSIONID=b883632427c2a2e5fa44fd53154046a6e230f4cca31dd666.9b2432bc; AUTHCODE=k_QKGgLsbdsz5ts6rTVFRJKezkbaaO_hgbziqw9BtTNNhhBX4xdhZmVaQZI_ACZ8SVHYiuKlGECrXM5YDkfozUhkuTw4Egx7lymTJgNOZwa73ROrf_qtwQCZxAEJyNRrpdXm44TzuOfFDdJexA_5; _statid=d4643dcc-33d9-499b-95eb-afcfd9303f73; bci=-8069214103590913890; mrcu=5d3fd53ccb2b1e4cf8da0791500b; msg_conf=2468555756792551; oid=49u31jkuozT6z2Fdtjxa2; ss_wb=bgvtsbbbmEKLYW5ObkEdb9q_Ew1eG6Zf2y9AnOJQwvLLljh22Wgt4R_h4FuK1w6U4txoGN5VFuHs8ysXeHQB01J_Qa9s0IELFA; tmr_lvid=c52c56dab1f92e5a5a238138127d42b8; vdt=IqxbwNuHOWBH1+KyKwr+BTU2we4roFzCtlZFIY6T17wAAABn74EbMQeqr5sq2mEJiWcpha3dLRvkML+80Iek5EaiWVHNbMVfOQed1QQhFphZC2uzKqY0svpQ5WqfBxKQD8eHv4CrPqRQi9mX6FlP9Lj+5Br6VKRK8BOLfq7DelEzS7+hksoAZDE=; VID=2yjbF52Ex5If00003g3LrSIf:::0-0-0-f8886e4-0-f888762:CAASEEC_D2vzDnUaLasdWeCMef4aYF4DhL4gyvxRbBG9715d8oaAxP-0ZNJakKhnmvzRGibmXf3-oo1PUMOvHzfXKfQOGUu85Cz9YeZLX_xaal7jUdPiYXmbbho2U2BKyyjTWStulqnAODCfAGdVniI_00fj3A";

// API Route: Jab user player me link load karega
app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    // 🔴 Security Layer 1: Referer Lock
    // Yeh check karega ki request extension/IDM se toh nahi aayi
    const referer = req.headers.referer || req.headers.origin;
    if (!referer || !referer.includes('saoodify.com')) {
        // Agar local test kar rahe hain (localhost), toh is 'if' block ko temporarily comment kar dein
        return res.status(403).send("Access Denied: Direct downloading is not allowed.");
    }

    try {
        // 1. OK.ru ke page ko request bhejna cookies ke sath
        const okruUrl = `https://ok.ru/video/${videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': OKRU_COOKIES,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        // 2. HTML source code se original m3u8 link nikalna (Regex Extract)
        const match = response.data.match(/hlsManifestUrl\\\\&quot;:\\\\&quot;(.*?)\\\\&quot;/);
        
        if (match && match[1]) {
            // Link ko clean karna taaki wo chal sake
            const m3u8Url = decodeURIComponent(JSON.parse(`"${match[1]}"`)).replace(/\\\\u0026/g, '&');
            
            // 3. Oracle VPS us m3u8 ko ok.ru se fetch karke user ko pipe (stream) kar dega
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*'); // Plyr ko block hone se rokne ke liye
            
            // Stream the file directly to the user!
            m3u8Response.data.pipe(res);
        } else {
            res.status(404).send("Error: M3U8 link not found. Video private hai ya cookies expire ho gayi hain.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error while fetching video.");
    }
});

// Server Start Karna
app.listen(3000, () => {
    console.log("Saoodify Secure OK.ru Proxy is running on Port 3000");
});
