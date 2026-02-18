
import os
import json
import sys
from datetime import datetime

# ──────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.getcwd(), '..', 'customer')
LOG_DIR = os.path.join(os.getcwd(), '..', 'logs')

# ──────────────────────────────────────────────────────────
# RULES
# ──────────────────────────────────────────────────────────
ANOMALY_RULES = [
    {
        "id": "LOGIC-ERR-20260218-01",
        "name": "Dinner Campaign Misattribution",
        "description": "Detects if a Dinner Campaign lead bought a non-Dinner product without being flagged as Cross-Sell.",
        "check": lambda c: check_dinner_misattribution(c)
    }
]

def check_dinner_misattribution(customer):
    """
    Rule:
    IF source == 'Dinner Campaign'
    AND total_spend > 0
    AND purchased_products NOT CONTAIN 'Shabu'
    THEN -> Potential Misattribution (Cross-Sell)
    """
    # 1. Check Source
    intel = customer.get('intelligence', {})
    campaign = intel.get('campaign_name', '').lower()
    
    # Also check tags or lead_channel
    is_dinner_lead = 'dinner' in campaign or 'shabu' in campaign
    
    if not is_dinner_lead:
        return None

    # 2. Check Spend
    metrics = intel.get('metrics', {})
    if metrics.get('total_spend', 0) == 0:
        return None

    # 3. Check Products
    orders = customer.get('orders', [])
    bought_shabu = False
    bought_other = False
    
    for o in orders:
        if o.get('status') != 'PAID':
            continue
        # Simplify item check (in real app, check item IDs)
        # Here we just assume order structure or check raw text if needed
        # For now, let's look at the customer tags or raw order data
        # Assuming order has 'items' list
        items = o.get('items', [])
        for item in items:
            p_name = item.get('name', '').lower()
            if 'shabu' in p_name or 'dinner' in p_name:
                bought_shabu = True
            else:
                bought_other = True

    if bought_other and not bought_shabu:
        return {
            "severity": "WARN",
            "message": f"Customer {customer.get('customer_id')} entered via '{campaign}' but bought NON-Shabu products. Verify Attribution.",
            "value": metrics.get('total_spend')
        }
    
    return None

# ──────────────────────────────────────────────────────────
# ENGINE
# ──────────────────────────────────────────────────────────
def load_customers():
    customers = []
    if not os.path.exists(DATA_DIR):
        return []
        
    for folder in os.listdir(DATA_DIR):
        folder_path = os.path.join(DATA_DIR, folder)
        if not os.path.isdir(folder_path) or folder.startswith('.'):
            continue
            
        for f in os.listdir(folder_path):
            if f.startswith('profile_') and f.endswith('.json'):
                try:
                    with open(os.path.join(folder_path, f), 'r', encoding='utf-8') as fh:
                        customers.append(json.load(fh))
                except:
                    pass
    return customers

def run_audit():
    print(f"[{datetime.now()}] 🔍 Starting Data Integrity Audit...")
    customers = load_customers()
    print(f"Loaded {len(customers)} customers.")
    
    issues = []
    
    for cust in customers:
        for rule in ANOMALY_RULES:
            result = rule['check'](cust)
            if result:
                issues.append({
                    "rule_id": rule['id'],
                    "customer_id": cust.get('customer_id'),
                    "result": result
                })
    
    # Report
    if issues:
        print(f"\n🚨 FOUND {len(issues)} ANOMALIES:")
        for i in issues:
            print(f"  [{i['rule_id']}] {i['customer_id']} -> {i['result']['message']} (Value: {i['result']['value']} THB)")
            
            # Log to JSONL (simulating ErrorLogger)
            log_entry = {
                "errorId": f"ANOM-{datetime.now().strftime('%Y%m%d')}-{i['customer_id'][-4:]}",
                "category": "logic_audit",
                "severity": i['result']['severity'],
                "message": i['result']['message'],
                "context": {"rule_id": i['rule_id'], "value": i['result']['value']},
                "timestamp": datetime.now().isoformat()
            }
            write_log(log_entry)
            
    else:
        print("\n✅ No anomalies found. Data looks clean.")

def write_log(entry):
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)
    
    # Write to today's log
    date_str = datetime.now().strftime('%Y-%m-%d')
    log_file = os.path.join(LOG_DIR, f'errors_{date_str}.jsonl')
    
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(json.dumps(entry) + '\n')

if __name__ == "__main__":
    run_audit()
