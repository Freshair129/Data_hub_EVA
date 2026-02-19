"""
marketing_sync.py
─────────────────
Bulk fetcher for Facebook Marketing API data.
Handles Campaigns, AdSets, Ads, and Daily Insights.
Updates PostgreSQL via db_adapter.py.
"""

import os
import json
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.adsinsights import AdsInsights

from db_adapter import upsert_marketing_data, upsert_ad_daily_metrics

load_dotenv()

def sync_marketing_data():
    # 1. Config
    access_token = os.getenv('FB_ACCESS_TOKEN')
    ad_account_id = os.getenv('FB_AD_ACCOUNT_ID')
    
    if not access_token or not ad_account_id:
        print("[MarketingSync] ❌ Missing credentials in .env")
        return

    # 2. Init API
    FacebookAdsApi.init(access_token=access_token)
    account_id = f"act_{ad_account_id}" if not ad_account_id.startswith("act_") else ad_account_id
    account = AdAccount(account_id)
    
    data = {
        "campaigns": [],
        "adsets": [],
        "ads": [],
        "creatives": []
    }

    try:
        print(f"[MarketingSync] 🔄 Fetching bulk data for {account_id}...")

        # -- Fetch Campaigns --
        fields = [Campaign.Field.id, Campaign.Field.name, Campaign.Field.status, Campaign.Field.objective, Campaign.Field.start_time]
        campaigns = account.get_campaigns(fields=fields)
        data["campaigns"] = [c.export_all_data() for c in campaigns]
        print(f"✅ Found {len(data['campaigns'])} Campaigns")

        # -- Fetch AdSets --
        fields = [AdSet.Field.id, AdSet.Field.name, AdSet.Field.status, AdSet.Field.daily_budget, AdSet.Field.campaign_id, AdSet.Field.targeting]
        adsets = account.get_ad_sets(fields=fields)
        data["adsets"] = [a.export_all_data() for a in adsets]
        print(f"✅ Found {len(data['adsets'])} AdSets")

        # -- Fetch Ads --
        fields = [Ad.Field.id, Ad.Field.name, Ad.Field.status, Ad.Field.adset_id, Ad.Field.creative]
        ads = account.get_ads(fields=fields)
        data["ads"] = [a.export_all_data() for a in ads]
        print(f"✅ Found {len(data['ads'])} Ads")

        # -- Fetch Creatives --
        fields = [AdCreative.Field.id, AdCreative.Field.name, AdCreative.Field.body, AdCreative.Field.title, AdCreative.Field.image_url, AdCreative.Field.thumbnail_url, AdCreative.Field.call_to_action_type]
        creatives = account.get_ad_creatives(fields=fields, params={'limit': 100})
        data["creatives"] = [c.export_all_data() for c in creatives]
        print(f"✅ Found {len(data['creatives'])} Creatives")

        # 3. Save Bulk Data to DB
        success = upsert_marketing_data(data)
        if not success:
            print("[MarketingSync] ❌ Failed to save bulk data to DB")
            return

        # 4. Fetch Daily Insights (Last 7 Days)
        print("[MarketingSync] 🔄 Fetching Daily Insights (7-day window)...")
        since = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        until = datetime.now().strftime('%Y-%m-%d')
        
        insight_fields = [
            AdsInsights.Field.ad_id,
            AdsInsights.Field.spend,
            AdsInsights.Field.impressions,
            AdsInsights.Field.clicks,
            AdsInsights.Field.actions,
        ]
        
        insights = account.get_insights(fields=insight_fields, params={
            'time_range': {'since': since, 'until': until},
            'level': 'ad',
            'time_increment': 1 # Daily
        })
        
        metrics_list = []
        for ins in insights:
            actions = ins.get('actions', [])
            leads = sum([int(a['value']) for a in actions if a['action_type'] == 'lead'])
            purchases = sum([int(a['value']) for a in actions if a['action_type'] == 'purchase'])
            
            metrics_list.append({
                'ad_id': ins.get('ad_id'),
                'date': ins.get('date_start'),
                'spend': float(ins.get('spend', 0)),
                'impressions': int(ins.get('impressions', 0)),
                'clicks': int(ins.get('clicks', 0)),
                'leads': leads,
                'purchases': purchases
            })
            
        if metrics_list:
            upsert_ad_daily_metrics(metrics_list)
            print(f"✅ Processed {len(metrics_list)} daily metric entries")

        print("[MarketingSync] 🏁 Sync Complete!")
        print(json.dumps({"success": True, "details": "Marketing sync completed successfully"}))

    except Exception as e:
        print(f"[MarketingSync] ❌ Error during sync: {e}")
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    sync_marketing_data()
