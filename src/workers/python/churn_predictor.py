"""
V-School Churn Prediction Engine
────────────────────────────────
Analyzes customer behavior patterns to identify risk of abandonment.
Uses RFM (Recency, Frequency, Monetary) inspired logic.
"""

import os
import json
import time
from datetime import datetime
from db_adapter import get_all_customers

def calculate_churn_risk(customer):
    """
    Calculates a risk score (0-100) for a customer.
    100 = Extremely likely to have churned (lost).
    """
    score = 0
    
    # 1. RECENCY (Days since last interaction)
    # ---------------------------------------
    updated_at_str = customer.get('updated_at') or customer.get('updated_time')
    if not updated_at_str: return 0 # New/Empty lead
    
    try:
        # standard ISO format: 2026-02-13T10:00:00Z
        last_active = datetime.strptime(updated_at_str.split('.')[0].replace('Z', ''), '%Y-%m-%dT%H:%M:%S')
        days_since_active = (datetime.now() - last_active).days
        
        # Risk starts growing after 7 days of silence
        if days_since_active > 30: score += 50
        elif days_since_active > 14: score += 30
        elif days_since_active > 7: score += 10
    except: pass

    # 2. MONETARY VALUE (High value customers are bigger losses)
    # ---------------------------------------------------------
    total_spend = customer.get('total_spend', 0)
    if total_spend > 20000: value_weight = 1.5
    elif total_spend > 5000: value_weight = 1.2
    else: value_weight = 1.0

    # 3. ENGAGEMENT (Intent & Tone from AI Intelligence)
    # -------------------------------------------------
    intel = customer.get('intelligence', {})
    intent = intel.get('intent', 'Question')
    if intent == 'Complaint': score += 20
    if intent == 'Greeting' and total_spend == 0: score += 10 # Just browsing

    final_score = min(100, score * value_weight)
    
    # RISK LEVELS: 
    # 0-30: LOW (Active)
    # 31-60: MEDIUM (Quiet)
    # 61-100: HIGH (Critical)
    
    level = "LOW"
    if final_score > 60: level = "HIGH"
    elif final_score > 30: level = "MEDIUM"
    
    return {
        "score": round(final_score),
        "level": level,
        "days_inactive": days_since_active if 'days_since_active' in locals() else 0
    }

def run_prediction_batch():
    """
    Scan all customers and update their churn risk intelligence.
    """
    print("[Predictor] Starting batch prediction...")
    customers = get_all_customers()
    if not customers:
        print("[Predictor] No customers found.")
        return

    results = []
    for c in customers:
        risk = calculate_churn_risk(c)
        # Update intelligence object
        intel = c.get('intelligence', {})
        intel['churn_risk'] = risk
        
        # In a real scenario, we'd save this back to DB/JSON
        # We'll simulate the save here for the CLI output
        results.append({
            "id": c.get('id'),
            "name": c.get('name'),
            "risk": risk
        })
    
    # Sort by risk score to show top "at-risk" customers
    results.sort(key=lambda x: x['risk']['score'], reverse=True)
    
    print("\n--- Top Churn Risks ---")
    for r in results[:5]:
        print(f"[{r['risk']['level']}] {r['name']} ({r['risk']['score']}%) - Inactive {r['risk']['days_inactive']} days")

    return results

if __name__ == "__main__":
    run_prediction_batch()
