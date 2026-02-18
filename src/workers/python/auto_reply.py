"""
V-School AI Auto-Reply Engine
─────────────────────────────
Handles contextual response generation based on:
1. Conversation History (Context)
2. User Intent (from AI analysis)
3. School Knowledge (FAQ/Catalog)
"""

import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
# genai configuration removed

# Simplified Course Catalog / FAQ for RAG (Initial Version)
SCHOOL_KNOWLEDGE = {
    "courses": [
        {"name": "Sushi & Sashimi 101", "price": "17,000 THB", "duration": "12 hours"},
        {"name": "Ramen Professional", "price": "17,000 THB", "duration": "12 hours"},
        {"name": "Traditional Japanese Food", "price": "9,900 THB", "duration": "12 hours"},
        {"name": "Full Course Menu 111H", "price": "110,000 THB", "duration": "111 hours"}
    ],
    "location": "V School, Bangkok (near BTS/MRT). Map: https://maps.app.goo.gl/vschool",
    "contact": "Phone: 02-123-4567 | Line: @vschool"
}

from knowledge_base import search_knowledge

def generate_auto_reply(sender_id, messages, intelligence):
    """
    Generates a contextual reply using Gemini Pro with RAG.
    """
    if not GEMINI_API_KEY:
        return None

    last_user_message = next((m.get('message', '') for m in messages if m.get('from', {}).get('id') == sender_id), None)
    
    # RAG: Retrieve knowledge for the query
    context_text = ""
    if last_user_message:
        kb_results = search_knowledge(last_user_message, top_k=2)
        if kb_results:
            context_text = "\n".join([f"- {r['original']['answer']}" for r in kb_results if r['score'] > 0.6])

    intent = intelligence.get('intent', 'Question')
    score = intelligence.get('score', 0)
    interest = intelligence.get('main_interest', 'General')

    # Guardrails: Don't auto-reply if:
    # 1. Score is too low (unclear intent)
    # 2. Intent is 'Complaint' (needs human manager)
    # 3. Last message was from the business (staff already intervening)
    
    if score < 40 and intent != 'Greeting':
        print(f"[Auto-Reply] Score too low ({score}). Skipping.")
        return None
    
    if intent == 'Complaint':
        print(f"[Auto-Reply] Intent is 'Complaint'. Escalating to human.")
        return None

    if messages and messages[0].get('from', {}).get('id') != sender_id:
        print(f"[Auto-Reply] Last message was from staff. Skipping.")
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Build prompt with context
        history_text = "\n".join([f"{m.get('from', {}).get('name', 'User')}: {m.get('message', '')}" for m in messages[:3][::-1]])
        
        prompt = f"""
        You are 'Chef V', the AI Assistant for V School (Japanese Cooking School in Bangkok).
        You are polite, professional, and helpful. Use Thai as the primary language unless the user speaks English.

        School Knowledge (Static):
        {json.dumps(SCHOOL_KNOWLEDGE, ensure_ascii=False, indent=2)}

        Specific Knowledge (Retrieved for this Query):
        {context_text if context_text else "No specific matching knowledge found."}

        Current Intelligence:
        - Intent: {intent}
        - User Interest: {interest}
        - Lead Score: {score}

        Conversation History (oldest to newest):
        {history_text}

        Guidelines:
        - If 'Specific Knowledge' is provided, prioritize it for accurate answers.
        - If Intent is 'Greeting', welcome them warmly.
        - If Intent is 'Question' about price or location, provide accurate data.
        - If Intent is 'Purchase', encourage them and offer to send payment details or book a seat.
        - Be concise. Don't sound like a robot. Use emojis appropriately.
        - End with a question to keep the conversation going.
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        reply_text = response.text.strip()
        
        print(f"[Auto-Reply] Generated for {sender_id}: {reply_text[:50]}...")
        return reply_text

    except Exception as e:
        print(f"[Auto-Reply] Error: {e}")
        return None

if __name__ == "__main__":
    # Test block
    test_messages = [{"from": {"id": "123", "name": "User"}, "message": "สนใจคอร์สซูชิครับ ราคาเท่าไหร่"}]
    test_intel = {"intent": "Question", "score": 85, "main_interest": "Sushi"}
    print(generate_auto_reply("123", test_messages, test_intel))
