"""
V-School Knowledge Ingestion Engine (Zero-Dependency)
────────────────────────────────────────────────────
Standalone script to generate AI embeddings for the V-School KB.
No external dependencies (no dotenv, no requests, no google-ai).
"""

import os
import json
import urllib.request
import urllib.error
import time
import ssl

# --- Manual .env Reader ---
def get_api_key():
    # Try multiple possible locations
    base_paths = [
        "/Users/ideab/Desktop/data_hub/crm-app",
        "/Users/ideab/Desktop/data_hub",
        os.getcwd()
    ]
    
    for base in base_paths:
        for ext in [".env.local", ".env"]:
            env_file = os.path.join(base, ext)
            if os.path.exists(env_file):
                try:
                    with open(env_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if '=' in line and not line.startswith('#'):
                                key, val = line.split('=', 1)
                                if key.strip() == 'GEMINI_API_KEY':
                                    return val.strip().strip('"').strip("'")
                except: pass
    return None

API_KEY = os.getenv('GEMINI_API_KEY') or get_api_key()
KNOWLEDGE_DIR = "/Users/ideab/Desktop/data_hub/knowledge"
INDEX_PATH = os.path.join(KNOWLEDGE_DIR, "vector_index.json")

def generate_embedding(text):
    if not API_KEY: return None

    # Using gemini-embedding-001 as confirmed by model list
    model = "gemini-embedding-001"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={API_KEY}"
    
    payload = {
        "model": f"models/{model}",
        "content": {"parts": [{"text": text}]}
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    
    context = ssl._create_unverified_context()
    
    try:
        with urllib.request.urlopen(req, context=context, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data.get('embedding', {}).get('values')
    except urllib.error.HTTPError as e:
        print(f"[Ingest] HTTP Error {e.code}: {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"[Ingest] Error: {e}")
        return None

def ingest_all():
    if not os.path.exists(KNOWLEDGE_DIR):
        print(f"[Ingest] Directory not found: {KNOWLEDGE_DIR}")
        return

    vector_store = []
    
    # Seed data search
    for filename in os.listdir(KNOWLEDGE_DIR):
        if filename.endswith(".json") and filename != "vector_index.json":
            file_path = os.path.join(KNOWLEDGE_DIR, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                print(f"[Ingest] Processing {filename}...")
                for item in data:
                    combined_text = f"Question: {item.get('question', '')}\nAnswer: {item.get('answer', '')}"
                    print(f"  -> Indexing: {item.get('id')}...")
                    embedding = generate_embedding(combined_text)
                    if embedding:
                        vector_store.append({
                            "id": item.get("id"),
                            "text": combined_text,
                            "original": item,
                            "vector": embedding
                        })
                        time.sleep(0.5) 
            except Exception as e:
                print(f"[Ingest] File Error {filename}: {e}")

    if vector_store:
        try:
            with open(INDEX_PATH, 'w', encoding='utf-8') as f:
                json.dump(vector_store, f, ensure_ascii=False, indent=2)
            print(f"[Ingest] Total: {len(vector_store)} vectors saved to {INDEX_PATH}")
        except Exception as e:
            print(f"[Ingest] Save Error: {e}")

if __name__ == "__main__":
    if not API_KEY:
        print("[Ingest] ERROR: GEMINI_API_KEY not found in .env files.")
    else:
        ingest_all()
