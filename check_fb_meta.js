const https = require('https');

async function checkMessageMeta() {
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    const messageId = 'm_Zc6S8COUM6FiHx1quzJvzMZGi9Sldgbn00iSkYdGXdS-HNVRW6_j-xy-GenAITQ2ZSferTTA8-2P2P4TgTK7CQ';

    if (!accessToken) {
        console.error('Missing FB_PAGE_ACCESS_TOKEN');
        return;
    }

    const url = `https://graph.facebook.com/v19.0/${messageId}?fields=id,from,message,created_time,tags&access_token=${accessToken}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('--- Message Metadata ---');
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        });
    }).on('error', (err) => {
        console.error('Error fetching metadata:', err);
    });
}

checkMessageMeta();
