import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

def analyze_batch_customer_behavior(batch_data):
    """
    Analyzes multiple customer conversations in a single API call for token efficiency.
    batch_data: List of dicts {"customer_id": "...", "messages": [...]}
    """
    if not GEMINI_API_KEY:
        return {"error": "Missing API Key"}

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Pack multiple contexts
    packed_context = ""
    for entry in batch_data:
        cid = entry['customer_id']
        msgs = entry['messages']
        packed_context += f"### CUSTOMER_ID: {cid}\n"
        for msg in msgs[-30:]:
            sender = msg.get('from', {}).get('name', 'User')
            text = msg.get('message', '')
            packed_context += f"{sender}: {text}\n"
        packed_context += "\n---\n"

    prompt = f"""
    You are a Senior Marketing Strategist & Behavioral Analyst for V School.
    Analyze the following {len(batch_data)} conversations to extract deep behavioral metadata for EACH customer.

    CONVERSATIONS:
    {packed_context}

    OBJECTIVE FOR EACH CUSTOMER:
    1. Identify 'behavioral_tags': (e.g., LOVES_SUSHI, BARGAIN_HUNTER, LONG_TIME_FAN, PRICE_SENSITIVE, DECISION_MAKER).
    2. Identify 'marketing_persona': (e.g., Casual Hobbyist, Professional Chef, Event Planner, Gift Buyer).
    3. Track 'emotional_state': (e.g., Enthusiastic, Hesitant, Skeptical, Satisfied).
    4. Recommend 'next_best_action' (CTA).
    5. Determine 'customer_status': (e.g., COLD, WARM, HOT_LEAD, WON, DORMANT).

    OUTPUT FORMAT (JSON OBJECT ONLY, KEYED BY CUSTOMER_ID):
    {{
        "CUSTOMER_ID_1": {{
            "behavioral_tags": ["string"],
            "marketing_persona": "string",
            "emotional_state": "string",
            "recommended_cta": "string",
            "customer_status": "string",
            "analysis_summary": "Thai text",
            "intent_evolution": "string"
        }},
        ...
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        text = response.text.replace('```json', '').replace('```', '').strip()
        if '{' in text and '}' in text:
            text = text[text.find('{'):text.rfind('}')+1]
        
        return json.loads(text)
    except Exception as e:
        return {"error": str(e)}

def analyze_customer_behavior(customer_id, chat_messages):
    """
    Analyzes the full conversation context to detect behavioral patterns, 
    marketing persona, and recommended CTAs.
    """
    if not GEMINI_API_KEY:
        return {"error": "Missing API Key"}

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Format chat for LLM
    chat_context = ""
    for msg in chat_messages[-30:]: # Use last 30 messages for deep context
        sender = msg.get('from', {}).get('name', 'User')
        text = msg.get('message', '')
        chat_context += f"{sender}: {text}\n"

    prompt = f"""
    You are a Senior Marketing Strategist & Behavioral Analyst for V School (Japanese Cooking School).
    Analyze this conversation with Customer {customer_id} to extract deep behavioral metadata.

    CONVERSATION:
    {chat_context}

    OBJECTIVE:
    1. Identify 'behavioral_tags': (e.g., LOVES_SUSHI, BARGAIN_HUNTER, LONG_TIME_FAN, PRICE_SENSITIVE, DECISION_MAKER).
    2. Identify 'marketing_persona': (e.g., Casual Hobbyist, Professional Chef, Event Planner, Gift Buyer).
    3. Track 'emotional_state': (e.g., Enthusiastic, Hesitant, Skeptical, Satisfied).
    4. Recommend 'next_best_action' (CTA): What should the admin/AI say or do next to close the sale or build loyalty?
    5. Determine 'customer_status': (e.g., COLD, WARM, HOT_LEAD, WON, DORMANT).

    OUTPUT FORMAT (JSON ONLY):
    {{
        "behavioral_tags": ["string"],
        "marketing_persona": "string",
        "emotional_state": "string",
        "recommended_cta": "string",
        "customer_status": "string",
        "analysis_summary": "short Thai description of customer behavior",
        "intent_evolution": "how their interest changed during the chat"
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        # Clean response
        text = response.text.replace('```json', '').replace('```', '').strip()
        if '{' in text and '}' in text:
            text = text[text.find('{'):text.rfind('}')+1]
        
        result = json.loads(text)
        return result
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Test stub
    sample_chat = [
        {"from": {"name": "User"}, "message": "อยากเรียนซูชิแบบเปิดร้านเลยครับ"},
        {"from": {"name": "User"}, "message": "แต่ราคาแอบแรงนิดนึง มีโปรโมชั่นไหมครับ?"},
        {"from": {"name": "Admin"}, "message": "สวสัดีครับ ถ้าเน้นเปิดร้านแนะนำคอร์ส Professional เลยครับ ตอนนี้มีโปรแถมชุดมีดครับ"},
        {"from": {"name": "User"}, "message": "โอ้ ชุดมีดน่าสนใจครับ งานยี่ห้ออะไรเหรอครับ"}
    ]
    print(json.dumps(analyze_customer_behavior("TEST-B01", sample_chat), indent=2, ensure_ascii=False))
