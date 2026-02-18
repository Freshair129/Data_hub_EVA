
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

async function fetchCampaigns() {
    const fields = 'name,status,objective,start_time,stop_time,daily_budget,lifetime_budget,insights{spend,impressions,clicks,reach,cpc,cpm,ctr,actions,action_values,cost_per_action_type}';
    const url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=${fields}&access_token=${ACCESS_TOKEN}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            console.error('API Error:', data.error);
            return;
        }

        const campaigns = data.data || [];
        const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');

        console.log(JSON.stringify(activeCampaigns, null, 2));

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

fetchCampaigns();
