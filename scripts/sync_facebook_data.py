import os
import json
import requests
import shutil
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

FACEBOOK_PAGE_ACCESS_TOKEN = os.getenv('FB_PAGE_ACCESS_TOKEN')
FACEBOOK_PAGE_ID = os.getenv('FB_PAGE_ID')
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'customer'))

if not FACEBOOK_PAGE_ACCESS_TOKEN:
    print("❌ Error: FB_PAGE_ACCESS_TOKEN not found in .env.local")
    exit(1)

API_VERSION = "v19.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

def get_headers():
    return {"Authorization": f"Bearer {FACEBOOK_PAGE_ACCESS_TOKEN}"}

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def download_file(url, save_path):
    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(save_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        return True
    except Exception as e:
        print(f"  ❌ Failed to download {url}: {e}")
        return False

def fetch_conversations_generator():
    print(f"🔄 Fetching conversations for Page ID: {FACEBOOK_PAGE_ID}...")
    url = f"{BASE_URL}/{FACEBOOK_PAGE_ID}/conversations?fields=id,updated_time,link,participants&limit=50"
    
    total_fetched = 0
    while url:
        print(f"  👉 Requesting Page: {url}")
        try:
            res = requests.get(url, headers=get_headers(), timeout=30)
            if res.status_code != 200:
                print(f"❌ Error fetching conversations: {res.text}")
                break
            data = res.json()
            batch = data.get('data', [])
            total_fetched += len(batch)
            print(f"  ✅ Fetched batch of {len(batch)}. Total so far: {total_fetched}")
            
            yield batch
            
            url = data.get('paging', {}).get('next')
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            break

def fetch_messages(conversation_id):
    url = f"{BASE_URL}/{conversation_id}/messages?fields=id,created_time,from,to,message,attachments{'{id,name,mime_type,video_data,image_data,file_url}'}&limit=100"
    messages = []
    
    while url:
        res = requests.get(url, headers=get_headers())
        if res.status_code != 200:
            print(f"❌ Error fetching messages for {conversation_id}: {res.text}")
            break
        data = res.json()
        messages.extend(data.get('data', []))
        url = data.get('paging', {}).get('next')
        
    return messages

def fetch_user_profile(psid):
    url = f"{BASE_URL}/{psid}?fields=first_name,last_name,profile_pic,gender,locale,timezone"
    res = requests.get(url, headers=get_headers())
    if res.status_code == 200:
        return res.json()
    else:
        print(f"⚠️ Could not fetch profile for PSID {psid}: {res.text}")
        return None

def process_customer(conversation):
    # Identify Customer ID (PSID)
    participants = conversation.get('participants', {}).get('data', [])
    customer = next((p for p in participants if p['id'] != FACEBOOK_PAGE_ID), None)
    
    if not customer:
        print(f"⚠️ Skipping conversation {conversation['id']}: No customer participant found.")
        return

    psid = customer['id']
    cust_name = customer['name']
    
    # Generate Folder Structure
    # Standard V7 ID: TVS-CUS-FB-26-XXXX (We will use PSID for uniqueness in this sync)
    # Since we are "fresh fetching", we might not have the running number logic here easily without a database.
    # For now, let's use PSID as the folder name to be safe and unique, or a mapping strategy.
    # To follow the user's previous structure, maybe we should keep using PSID based folder or generated ID.
    # Let's use TVS-CUS-FB-{PSID} for now to avoid collision, or just the PSID folder and let the app handle ID generation.
    # User Implementation Plan says: data_hub/customer/TVS-CUS-FB-26-XXXX/
    # Let's generate a temporary unique folder name using PSID.
    
    folder_name = f"FB-{psid}"
    customer_dir = os.path.join(DATA_DIR, folder_name)
    ensure_dir(customer_dir)
    
    # 1. Fetch & Save Profile
    profile = fetch_user_profile(psid)
    if not profile:
        profile = {"first_name": cust_name, "id": psid}
        
    profile_data = {
        "customer_id": folder_name, # Temporary ID
        "profile": {
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "profile_picture": profile.get("profile_picture"),
            "locale": profile.get("locale"),
            "timezone": profile.get("timezone"),
            "gender": profile.get("gender"),
            "source": "facebook_sync"
        },
        "contact_info": {
            "facebook_id": psid,
            "facebook_name": cust_name
        },
        "social_profiles": {
            "facebook": profile
        },
        "tags": [], # Will fill from Inbox labels if we implement that
        "wallet": {"balance": 0, "points": 0}, # Default
        "inventory": [],
        "conversation_id": conversation['id']
    }
    
    with open(os.path.join(customer_dir, 'profile.json'), 'w', encoding='utf-8') as f:
        json.dump(profile_data, f, indent=4, ensure_ascii=False)
        
    # 2. Fetch & Save Chat History
    messages = fetch_messages(conversation['id'])
    chat_dir = os.path.join(customer_dir, 'chathistory')
    ensure_dir(chat_dir)
    
    chat_file = os.path.join(chat_dir, f"conv_{conversation['id']}.json")
    with open(chat_file, 'w', encoding='utf-8') as f:
        json.dump({"data": messages}, f, indent=4, ensure_ascii=False)
        
    # 3. Download Assets
    assets_dir = os.path.join(customer_dir, 'assets')
    ensure_dir(assets_dir)
    ensure_dir(os.path.join(assets_dir, 'images'))
    ensure_dir(os.path.join(assets_dir, 'videos'))
    ensure_dir(os.path.join(assets_dir, 'files'))
    
    asset_count = 0
    for msg in messages:
        if 'attachments' in msg:
            for attachment in msg['attachments']['data']:
                try:
                    att_type = attachment.get('mime_type', '')
                    download_url = None
                    save_path = None
                    file_id = attachment.get('id', 'unknown')
                    
                    if 'image' in att_type:
                        download_url = attachment.get('image_data', {}).get('url')
                        save_path = os.path.join(assets_dir, 'images', f"{file_id}.jpg")
                    elif 'video' in att_type:
                        download_url = attachment.get('video_data', {}).get('url')
                        save_path = os.path.join(assets_dir, 'videos', f"{file_id}.mp4")
                    else:
                         download_url = attachment.get('file_url')
                         ext = '.pdf' if 'pdf' in att_type else '.bin'
                         save_path = os.path.join(assets_dir, 'files', f"{file_id}{ext}")
                    
                    if download_url:
                        if download_file(download_url, save_path):
                            asset_count += 1
                except Exception as e:
                    print(f"    ⚠️ Error processing attachment {attachment.get('id')}: {e}")

    print(f"✅ Processed {cust_name} (PSID: {psid}) | {len(messages)} msgs | {asset_count} assets")

def main():
    print("🚀 Starting Facebook Data Sync...")
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    for batch in fetch_conversations_generator():
        for conv in batch:
            process_customer(conv)
        
    print("\n🎉 Sync Complete!")

if __name__ == "__main__":
    main()
