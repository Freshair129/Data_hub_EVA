import os
import json
import time
from datetime import datetime, timedelta
from google import genai
from dotenv import load_dotenv
from behavioral_analyzer import analyze_customer_behavior, analyze_batch_customer_behavior
from db_adapter import update_customer_intelligence

load_dotenv()

# Configuration
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'customer'))

def run_hourly_audit():
    print(f"[{datetime.now()}] 🕒 Starting Hourly Batch Intelligence Sweep...")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ Data directory not found: {DATA_DIR}")
        return

    # 1. Identify active customers who need an update
    # Criteria: Profile updated in last 60 mins OR has new messages with no 'behavioral' AI stamp
    active_customers = []
    
    now = datetime.now()
    one_hour_ago = now - timedelta(hours=1)

    for folder in os.listdir(DATA_DIR):
        # ... logic to scan folders ...
        # For simplicity in this demo, we'll scan all but you could optimize via file mtime
        folder_path = os.path.join(DATA_DIR, folder)
        profile_file = os.path.join(folder_path, f"profile_{folder}.json")
        
        if os.path.exists(profile_file):
            try:
                with open(profile_file, 'r', encoding='utf-8') as f:
                    profile = json.load(f)
                
                # Check last AI update
                intel = profile.get('intelligence', {})
                last_update_str = intel.get('last_behavior_audit')
                
                should_audit = False
                if not last_update_str:
                    should_audit = True
                else:
                    last_update = datetime.fromisoformat(last_update_str.replace('Z', ''))
                    if last_update < one_hour_ago:
                        should_audit = True
                
                if should_audit:
                    # Get messages
                    history_dir = os.path.join(folder_path, 'chathistory')
                    if os.path.exists(history_dir):
                        # Find the latest conversation file
                        conv_files = [f for f in os.listdir(history_dir) if f.startswith('conv_')]
                        if conv_files:
                            active_customers.append({
                                "id": folder, # Customer ID is usually the folder name
                                "profile_path": profile_file,
                                "conv_file": os.path.join(history_dir, conv_files[0]) # Use latest
                            })
            except Exception as e:
                print(f"  [Error] Skipping {folder}: {e}")

    print(f"Found {len(active_customers)} customers requiring deep audit.")

    # 2. Mega-Batch Processing (Context Packing)
    BATCH_SIZE = 20
    counts = {"success": 0, "failed": 0, "skipped": 0}
    
    for i in range(0, len(active_customers), BATCH_SIZE):
        chunk = active_customers[i:i + BATCH_SIZE]
        batch_payload = []
        
        for customer in chunk:
            try:
                with open(customer['conv_file'], 'r', encoding='utf-8') as f:
                    conv_data = json.load(f)
                
                messages = conv_data.get('messages', {}).get('data', [])
                if messages:
                    batch_payload.append({
                        "customer_id": customer['id'],
                        "messages": messages
                    })
                else:
                    counts['skipped'] += 1
            except Exception as e:
                print(f"  [Error] Failed to read {customer['id']}: {e}")

        if not batch_payload:
            continue

        print(f"  [Mega-Batch] Processing group of {len(batch_payload)} customers in ONE API call...")
        
        try:
            # CALL MEGA-BATCH AI
            batch_results = analyze_batch_customer_behavior(batch_payload)
            
            if "error" not in batch_results:
                for customer_id, result in batch_results.items():
                    # Update with audit timestamp
                    result['last_behavior_audit'] = datetime.now().isoformat() + 'Z'
                    update_customer_intelligence(customer_id, {
                        "behavioral": result,
                        "last_behavior_audit": result['last_behavior_audit'],
                        "status": result.get('customer_status', 'WARM'),
                        "tags": result.get('behavioral_tags', [])
                    })
                    counts['success'] += 1
                print(f"    ✅ Successfully updated {len(batch_results)} customers.")
            else:
                print(f"    [Error] Mega-Batch AI failed: {batch_results['error']}")
                counts['failed'] += len(batch_payload)
            
            # Small delay to be polite to the API
            time.sleep(1)
            
        except Exception as e:
            print(f"    [Error] Mega-Batch Execution failed: {e}")
            counts['failed'] += len(batch_payload)

    print(f"\n✅ Audit Complete. Success: {counts['success']}, Failed: {counts['failed']}, Skipped: {counts['skipped']}")

if __name__ == "__main__":
    run_hourly_audit()
