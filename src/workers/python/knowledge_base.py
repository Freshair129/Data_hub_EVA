"""
V-School Semantic Search Engine
───────────────────────────────
Performs cosine similarity search against the vector index.
Zero-dependency version (using pure Python math fallback).
"""

import os
import json
import urllib.request
import ssl
import math

KNOWLEDGE_DIR = "/Users/ideab/Desktop/data_hub/knowledge"
INDEX_PATH = os.path.join(KNOWLEDGE_DIR, "vector_index.json")

# Manual .env Reader (same as ingest)
def get_api_key():
    base_paths = ["/Users/ideab/Desktop/data_hub/crm-app", "/Users/ideab/Desktop/data_hub"]
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
    return os.getenv('GEMINI_API_KEY')

API_KEY = get_api_key()

def cosine_similarity(v1, v2):
    """
    Pure Python cosine similarity.
    """
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude1 = math.sqrt(sum(a * a for a in v1))
    magnitude2 = math.sqrt(sum(b * b for b in v2))
    if magnitude1 == 0 or magnitude2 == 0: return 0
    return dot_product / (magnitude1 * magnitude2)

def generate_query_embedding(text):
    if not API_KEY: return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={API_KEY}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": text}]}
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    context = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(req, context=context, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data.get('embedding', {}).get('values')
    except Exception as e:
        print(f"[KB/Search] Embedding Error: {e}")
        return None

def search_knowledge(query, top_k=2):
    """
    Search the vector index for relevant school knowledge.
    """
    if not os.path.exists(INDEX_PATH):
        print("[KB/Search] Index not found.")
        return []

    try:
        with open(INDEX_PATH, 'r', encoding='utf-8') as f:
            vector_store = json.load(f)
    except Exception as e:
        print(f"[KB/Search] Read Error: {e}")
        return []

    query_vector = generate_query_embedding(query)
    if not query_vector: return []

    results = []
    for item in vector_store:
        score = cosine_similarity(query_vector, item['vector'])
        results.append({
            "score": score,
            "text": item['text'],
            "original": item['original']
        })

    # Sort by score descending
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:top_k]

if __name__ == "__main__":
    # Test
    q = "คอร์สซูชิราคาเท่าไหร่"
    print(f"Searching for: {q}")
    matches = search_knowledge(q)
    for m in matches:
        print(f"[{m['score']:.4f}] {m['original']['answer']}")
