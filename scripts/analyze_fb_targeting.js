
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
let envConfig = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim();
        }
    });
}

const ACCESS_TOKEN = envConfig.FB_ACCESS_TOKEN;
const AD_ACCOUNT_ID = envConfig.FB_AD_ACCOUNT_ID;

if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    console.error('Missing FB_ACCESS_TOKEN or FB_AD_ACCOUNT_ID in .env.local');
    process.exit(1);
}

async function fetchTargeting() {
    // Fetch Ad Sets for specific campaign W1+2 : Saline
    const CAMPAIGN_ID = '120232784981690708';
    const fields = 'name,status,targeting,daily_budget,optimization_goal,promoted_object';
    const url = `https://graph.facebook.com/v19.0/${CAMPAIGN_ID}/adsets?fields=${fields}&access_token=${ACCESS_TOKEN}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            console.error('API Error:', data.error);
            return;
        }

        const adsets = data.data || [];
        const activeAdsets = adsets.filter(c => c.status === 'ACTIVE');

        console.log(JSON.stringify(activeAdsets, null, 2));

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

fetchTargeting();
