const express = require('express');
const axios = require('axios');
const app = express();

// 🌟 CORS FIX: Yeh har request (chahe error ho ya success) par access allow karega
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Aapki OK.ru Cookies (Yeh check karna ki yeh expire na hui ho)
const OKRU_COOKIES = "JSESSIONID=b883632427c2a2e5fa44fd53154046a6e230f4cca31dd666.9b2432bc; AUTHCODE=k_QKGgLsbdsz5ts6rTVFRJKezkbaaO_hgbziqw9BtTNNhhBX4xdhZmVaQZI_ACZ8SVHYiuKlGECrXM5YDkfozUhkuTw4Egx7lymTJgNOZwa73ROrf_qtwQCZxAEJyNRrpdXm44TzuOfFDdJexA_5; _statid=d4643dcc-33d9-499b-95eb-afcfd9303f73; bci=-8069214103590913890; mrcu=5d3fd53ccb2b1e4cf8da0791500b; msg_conf=2468555756792551; oid=49u31jkuozT6z2Fdtjxa2; ss_wb=bgvtsbbbmEKLYW5ObkEdb9q_Ew1eG6Zf2y9AnOJQwvLLljh22Wgt4R_h4FuK1w6U4txoGN5VFuHs8ysXeHQB01J_Qa9s0IELFA; tmr_lvid=c52c56dab1f92e5a5a238138127d42b8; vdt=IqxbwNuHOWBH1+KyKwr+BTU2we4roFzCtlZFIY6T17wAAABn74EbMQeqr5sq2mEJiWcpha3dLRvkML+80Iek5EaiWVHNbMVfOQed1QQhFphZC2uzKqY0svpQ5WqfBxKQD8eHv4CrPqRQi9mX6FlP9Lj+5Br6VKRK8BOLfq7DelEzS7+hksoAZDE=; VID=2yjbF52Ex5If00003g3LrSIf:::0-0-0-f8886e4-0-f888762:CAASEEC_D2vzDnUaLasdWeCMef4aYF4DhL4gyvxRbBG9715d8oaAxP-0ZNJakKhnmvzRGibmXf3-oo1PUMOvHzfXKfQOGUu85Cz9YeZLX_xaal7jUdPiYXmbbho2U2BKyyjTWStulqnAODCfAGdVniI_00fj3A";

app.get('/api/stream/:videoId', async (req, res) => {
    const videoId = req.params.videoId;

    // Security Layer: Referer Lock
    const referer = req.headers.referer || req.headers.origin;
    if (!referer || !referer.includes('arnetsolution.com')) {
        return res.status(403).send("Access Denied: Direct downloading is not allowed.");
    }

    try {
        const okruUrl = `https://ok.ru/video/${videoId}`;
        const response = await axios.get(okruUrl, {
            headers: {
                'Cookie': OKRU_COOKIES,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const match = response.data.match(/hlsManifestUrl\\\\&quot;:\\\\&quot;(.*?)\\\\&quot;/);
        
        if (match && match[1]) {
            const m3u8Url = decodeURIComponent(JSON.parse(`"${match[1]}"`)).replace(/\\\\u0026/g, '&');
            const m3u8Response = await axios.get(m3u8Url, { responseType: 'stream' });
            
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            m3u8Response.data.pipe(res);
        } else {
            // Agar Cookie expire ho gayi toh yahan aayega
            res.status(404).send("Error: M3U8 link not found. Video private hai ya Cookies expire ho gayi hain.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error while fetching video.");
    }
});

app.listen(3000, () => {
    console.log("Saoodify API is running");
});
