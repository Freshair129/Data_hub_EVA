"""
V-School Staff Notification Service
───────────────────────────────────
Sends alerts to staff via Discord/Line when high-value events occur.
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

DISCORD_WEBHOOK_URL = os.getenv('STAFF_DISCORD_WEBHOOK')
LINE_NOTIFY_TOKEN = os.getenv('STAFF_LINE_NOTIFY_TOKEN')

def send_staff_notification(title, message, priority="NORMAL", metadata=None):
    """
    Sends a notification to available channels.
    """
    print(f"[Notifier] Attempting to send: {title}")
    
    # 1. Discord Webhook
    if DISCORD_WEBHOOK_URL:
        send_discord_alert(title, message, priority, metadata)
    
    # 2. Line Notify
    if LINE_NOTIFY_TOKEN:
        send_line_alert(title, message)
        
    if not DISCORD_WEBHOOK_URL and not LINE_NOTIFY_TOKEN:
        print("[Notifier] ⚠️ No notification channels configured (STAFF_DISCORD_WEBHOOK or STAFF_LINE_NOTIFY_TOKEN).")

def send_discord_alert(title, message, priority, metadata):
    color = 0x00ff00 # Green
    if priority == "HIGH": color = 0xff0000 # Red
    elif priority == "MEDIUM": color = 0xffff00 # Yellow
    
    embed = {
        "title": title,
        "description": message,
        "color": color,
        "fields": []
    }
    
    if metadata:
        for key, value in metadata.items():
            embed["fields"].append({"name": key, "value": str(value), "inline": True})
            
    payload = {"embeds": [embed]}
    try:
        requests.post(DISCORD_WEBHOOK_URL, json=payload)
    except Exception as e:
        print(f"[Notifier/Discord] Error: {e}")

def send_line_alert(title, message):
    url = "https://notify-api.line.me/api/notify"
    headers = {"Authorization": f"Bearer {LINE_NOTIFY_TOKEN}"}
    data = {"message": f"\n{title}\n{message}"}
    try:
        requests.post(url, headers=headers, data=data)
    except Exception as e:
        print(f"[Notifier/Line] Error: {e}")

if __name__ == "__main__":
    # Test
    send_staff_notification("Test Alert", "This is a test notification from V-School CRM.")
