
import os
import redis
import json
import time
from dotenv import load_dotenv
from PIL import Image
from io import BytesIO
import requests
from google import genai

# Load environment variables
load_dotenv()

# Configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# genai configuration removed, now handled via client instantiation

def connect_redis():
    try:
        r = redis.from_url(REDIS_URL)
        r.ping()
        print("[Python Worker] Connected to Redis successfully.")
        return r
    except Exception as e:
        print(f"[Python Worker] Redis connection skipped/failed: {e}")
        return None

from auto_reply import generate_auto_reply

from notification_service import send_staff_notification
from db_adapter import update_customer_intelligence, save_chat_messages, create_task
from behavioral_analyzer import analyze_customer_behavior

def process_event(event):
    """
    Core business logic for processing a Facebook Event.
    """
    sender_id = event.get('sender', {}).get('id')
    if not sender_id:
        return {"success": False, "error": "No sender ID"}

    print(f"[Python Worker] Processing event from: {sender_id}")

    # Initialize results
    intelligence_results = {}

    # 1. Reactive Sync
    print(f"[Python Worker] Syncing chat for {sender_id}...")
    sync_result = sync_chat(f"t_{sender_id}")
    messages = sync_result.get('data', []) if sync_result.get('success') else []
    
    # PHASE 17 & 18: HYBRID TOKEN GUARD (High Intent Real-time + Hourly Batch)
    msg_count = len(messages)
    
    # ⚡ HIGH INTENT (Force Real-time)
    BUY_INTENT_KEYWORDS = ["ราคา", "โอน", "เลขพัสดุ", "สมัคร", "บัญชี", "กี่บาท", "promotion", "โปร", "ส่วนลด", "สน", "จอง"]
    latest_text = event.get('message', '').lower()
    has_buy_intent = any(k in latest_text for k in BUY_INTENT_KEYWORDS)
    
    # Logic: 
    # - Run Intel (Lead Score) every 5 messages or if Buy Intent.
    # - Run Behavioral (Tags) ONLY if Buy Intent (Otherwise wait for Hourly Batch Auditor).
    
    should_run_intel = msg_count <= 1 or msg_count % 5 == 0 or has_buy_intent
    should_run_behavioral = has_buy_intent # Real-time only for sales. Deep profile is handled hourly.

    # AI INTELLIGENCE: Analyze Chat Context (Lead Score/Intent)
    intel_data = None
    if should_run_intel:
        print(f"[Python AI] Running Intel Analysis for {sender_id}...")
        intel_data = analyze_chat_intelligence(sender_id, messages)
        if intel_data:
            intelligence_results['chat'] = intel_data
    else:
        print(f"[Python AI] 🛡️ Skipping Intel Analysis (Token Guard) for {sender_id}")

    # PHASE 16: BEHAVIORAL AI (Deep Tagging & CTA)
    if should_run_behavioral:
        print(f"[Python Worker] Running Behavioral Analysis for {sender_id}...")
        behavioral_data = analyze_customer_behavior(sender_id, messages)
        if behavioral_data and "error" not in behavioral_data:
            intelligence_results['behavioral'] = behavioral_data
            # Update metadata/tags in DB
            update_customer_intelligence(sender_id, {
                "behavioral": behavioral_data,
                "status": behavioral_data.get('customer_status', 'WARM'),
                "tags": behavioral_data.get('behavioral_tags', [])
            })
    else:
        print(f"[Python Worker] 🛡️ Skipping Behavioral Analysis (Token Guard) for {sender_id}")

    # 2. Slip Detection & AI Verification
    attachments = event.get('attachments', [])
    if attachments and attachments[0].get('type') == 'image':
        image_url = attachments[0].get('payload', {}).get('url')
        print(f"[Python Worker] Image detected: {image_url}")
        slip_data = verify_slip_real(sender_id, image_url)
        if slip_data:
            intelligence_results['slip'] = slip_data
            # Update intel_data for auto-reply logic
            if intel_data: 
                intel_data.update({"intent": "Purchase", "score": 100})
            else:
                intel_data = {"intent": "Purchase", "score": 100, "main_interest": "Payment"}

    # 3. AUTO-REPLY LOGIC (Phase 7)
    auto_reply_text = generate_auto_reply(sender_id, messages, intel_data or {})
    if auto_reply_text:
        send_result = send_facebook_message(sender_id, auto_reply_text)
        intelligence_results['auto_reply'] = {
            "sent": send_result.get('success', False),
            "text": auto_reply_text
        }

    # 4. STAFF ALERTS & TASKS (Phase 7)
    if intel_data:
        score = intel_data.get('score', 0)
        intent = intel_data.get('intent', 'Question')
        
        # High Score Alert (>70)
        if score > 70:
            send_staff_notification(
                title=f"🔥 High Value Lead: {sender_id}",
                message=f"A customer is very interested ({score}%). Intent: {intent}",
                priority="HIGH" if score > 85 else "NORMAL",
                metadata={"ID": sender_id, "Score": score, "Intent": intent}
            )
        
        # Automated Task Generation (>80 or Purchase)
        if score > 80 or intent == 'Purchase':
            task_title = f"Follow-up with {sender_id}"
            task_desc = f"AI assigned high priority. Intent: {intent}, Score: {score}. Please close the sale."
            create_task(sender_id, task_title, task_desc, priority="HIGH" if score > 90 else "NORMAL")
            intelligence_results['automation'] = {"task_created": True}

    return {"success": True, "sender_id": sender_id, "intelligence": intelligence_results}

def send_facebook_message(recipient_id, message_text):
    """
    Send a text message back to the user via Facebook Send API.
    """
    page_access_token = os.getenv('FB_PAGE_ACCESS_TOKEN')
    if not page_access_token:
        return {"success": False, "error": "Missing Page Access Token"}

    url = f"https://graph.facebook.com/v19.0/me/messages?access_token={page_access_token}"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message_text},
        "messaging_type": "RESPONSE"
    }

    try:
        response = requests.post(url, json=payload)
        result = response.json()
        if response.status_code == 200:
            print(f"[Facebook API] ✅ Message sent to {recipient_id}")
            return {"success": True, "message_id": result.get('message_id')}
        else:
            print(f"[Facebook API] ❌ Send failed: {result.get('error', {}).get('message')}")
            return {"success": False, "error": result.get('error', {}).get('message')}
    except Exception as e:
        print(f"[Facebook API] Error: {e}")
        return {"success": False, "error": str(e)}

from db_adapter import update_customer_intelligence, save_chat_messages

def analyze_chat_intelligence(sender_id, messages):
    """
    Use AI to detect Intent and Lead Score.
    """
    if not GEMINI_API_KEY:
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Prepare context (last 5 messages)
        chat_text = "\n".join([f"{m.get('from', {}).get('name', 'User')}: {m.get('message', '')}" for m in messages[:5]])
        
        prompt = f"""
        Analyze this conversation for a Japanese Cooking School (V School).
        Conversation:
        {chat_text}
        
        Output only a JSON object with:
        - intent: (one of: Purchase, Question, Complaint, Greeting)
        - score: (integer 0-100 based on conversion probability)
        - main_interest: (short string like 'Sushi Course', 'Price Inquiry', etc.)
        """
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        # Clean response text
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        intelligence = json.loads(clean_json)
        
        print(f"[Python AI] Lead Score for {sender_id}: {intelligence.get('score')}")
        
        # Use DB Adapter instead of direct fs
        update_customer_intelligence(sender_id, intelligence)
        return intelligence
        
    except Exception as e:
        print(f"[Python AI] Intelligence Error: {e}")
        return None

def verify_slip_real(sender_id, image_url):
    """
    Real OCR/AI Verification using Gemini Vision.
    """
    if not GEMINI_API_KEY:
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        # Download image
        response = requests.get(image_url)
        img = Image.open(BytesIO(response.content))

        prompt = """
        Analyze this Thai bank transfer slip. Extract the following information in JSON format:
        - bank_name
        - amount (float)
        - date (YYYY-MM-DD)
        - time (HH:mm)
        - ref_id (Transaction ID)
        - is_valid (Boolean - check for standard Bank Layout)
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash", # gemini-2.0-flash handles multimodal
            contents=[prompt, img]
        )
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(clean_json)
        
        print(f"[Python AI] ✅ Slip Analyzed: {result.get('amount')} THB via {result.get('bank_name')}")
        
        result['status'] = 'VERIFIED' if result.get('is_valid') else 'REJECTED'
        
        # Use DB Adapter instead of direct fs
        intel_update = {
            "slip_verification": result, 
            "score": 100 if result.get('is_valid') else 0, 
            "intent": "Purchase"
        }
        update_customer_intelligence(sender_id, intel_update)
        return result

    except Exception as e:
        print(f"[Python AI] Verification Failed: {e}")
        return None

def sync_chat(conversation_id):
    """
    Fetch messages from Facebook and save to local cache or DB.
    """
    page_access_token = os.getenv('FB_PAGE_ACCESS_TOKEN')
    if not page_access_token:
        return {'success': False, 'error': 'Missing Page Access Token'}

    url = f"https://graph.facebook.com/v19.0/{conversation_id}/messages"
    params = {
        'fields': 'id,message,from,created_time,attachments{id,mime_type,name,file_url,image_data,url}',
        'limit': 50,
        'access_token': page_access_token
    }

    try:
        response = requests.get(url, params=params)
        data = response.json()

        if response.status_code == 200:
            messages = data.get('data', [])
            # Use DB Adapter
            save_chat_messages(conversation_id, messages)
            return {'success': True, 'data': messages, 'source': 'facebook'}
        else:
            return {'success': False, 'error': data.get('error', {}).get('message')}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def main():
    direct_input = os.getenv('PYTHON_INPUT')
    if direct_input:
        try:
            event = json.loads(direct_input)
            result = process_event(event)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
        return

    print("[Python Worker] Starting in Queue Mode...")
    r = connect_redis()
    while True:
        # Queue logic would go here
        time.sleep(1)

if __name__ == "__main__":
    main()
