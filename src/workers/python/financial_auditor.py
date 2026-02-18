import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

def audit_financial_context(conversation_id, chat_messages, reported_value):
    """
    Analyzes chat messages to verify if a reported value (sale) is unique, a deposit, 
    or a duplicate count of a previous transaction.
    """
    if not GEMINI_API_KEY:
        return {"error": "Missing API Key"}

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Format chat for LLM
    chat_context = ""
    # Sort messages by time if possible, otherwise use original order
    for msg in chat_messages[-20:]: # Last 20 messages for context
        sender = msg.get('from', {}).get('name', 'User')
        text = msg.get('message', '')
        chat_context += f"{sender}: {text}\n"

    prompt = f"""
    You are a Financial Integrity Auditor for V School (Japanese Cooking School).
    Your task is to analyze the following chat conversation and determine the nature of a reported payment of {reported_value} THB.

    CONTEXT:
    {chat_context}

    REPORTED VALUE: {reported_value} THB
    CONVERSATION ID: {conversation_id}

    OBJECTIVE:
    1. Determine if this payment is a "New Sale", a "Deposit" (มัดจำ), or a "Remaining Balance" (จ่ายส่วนที่เหลือ).
    2. Check if this is the SAME unique transaction as a previous payment (e.g. customer paid twice for one course).
    3. Identify the ACTUAL Product/Course mentioned in the context.

    OUTPUT FORMAT (JSON ONLY):
    {{
        "is_unique_sale": boolean,
        "transaction_type": "NEW_SALE" | "DEPOSIT" | "BALANCE_PAYMENT" | "CROSS_SELL",
        "product_detected": "string",
        "confidence_score": 0-100,
        "analysis": "short Thai explanation",
        "suggested_action": "KEEP" | "MERGE" | "REJECT" | "FLAG_FOR_REVIEW"
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        # Clean response
        text = response.text.replace('```json', '').replace('```', '').strip()
        # Basic JSON extraction if LLM adds fluff
        if '{' in text and '}' in text:
            text = text[text.find('{'):text.rfind('}')+1]
        
        result = json.loads(text)
        return result
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Test stub
    sample_chat = [
        {"from": {"name": "User"}, "message": "สนใจคอร์สซูชิ 4900 ครับ"},
        {"from": {"name": "Admin"}, "message": "ได้ครับ มัดจำก่อน 1000 นะครับ"},
        {"from": {"name": "User"}, "message": "โอนแล้วครับ 1000"},
        {"from": {"name": "User"}, "message": "นี่ครับสลิป (ภาพ)"}
    ]
    print(json.dumps(audit_financial_context("TEST-ID", sample_chat, 1000), indent=2, ensure_ascii=False))
