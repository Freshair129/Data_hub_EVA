import json
from event_processor import process_event
from batch_auditor import run_hourly_audit
import os

def test_hybrid_flow():
    print("--- Testing Hybrid Intelligence (Real-time + Hourly Batch) ---")
    
    history = []
    import event_processor
    event_processor.sync_chat = lambda id: {"success": True, "data": history}

    # 1. Message 1 (General Question - SHOULD skip Behavioral, run Intel)
    print("\n[Test] Message 1: 'สวัสดีครับ' (Real-time Intel Only)...")
    history.append({"from": {"id": "U-HYBRID", "name": "Customer"}, "message": "สวัสดีครับ"})
    process_event({"sender": {"id": "U-HYBRID"}, "message": "สวัสดีครับ"})

    # 2. Message 2 (Casual - SHOULD SKIP BOTH)
    print("\n[Test] Message 2: 'ถามอะไรหน่อยครับ' (Should Skip Both Real-time)...")
    history.insert(0, {"from": {"id": "U-HYBRID", "name": "Customer"}, "message": "ถามอะไรหน่อยครับ"})
    process_event({"sender": {"id": "U-HYBRID"}, "message": "ถามอะไรหน่อยครับ"})

    # 3. Message 3 (Buy Intent - SHOULD FORCE RUN BOTH Real-time)
    print("\n[Test] Message 3: 'คอร์สกี่บาทครับ?' (FORCE RUN Both Real-time)...")
    history.insert(0, {"from": {"id": "U-HYBRID", "name": "Customer"}, "message": "คอร์สกี่บาทครับ?"})
    process_event({"sender": {"id": "U-HYBRID"}, "message": "คอร์สกี่บาทครับ?"})

    # 4. Hourly Sweep Simulation
    print("\n[Test] Running Hourly Batch Auditor Sweep...")
    # This should catch the deep profile even if real-time skipped it earlier
    run_hourly_audit()

if __name__ == "__main__":
    test_hybrid_flow()
