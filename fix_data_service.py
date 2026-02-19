
import os

target_file = 'src/workers/python/data_service.py'

new_code = r'''        # 3. UPSERT AdSets
        # Schema: id, adSetId, name, status, campaignId, dailyBudget, targeting
        print(f"💾 Saving {len(data['adsets'])} AdSets...")
        for a in data['adsets']:
            # Try to find existing by adSetId
            cur.execute("SELECT id FROM ad_sets WHERE ad_set_id = %s", (a.get('id'),))
            res = cur.fetchone()
            
            if res:
                # Update
                cur.execute("""
                    UPDATE ad_sets SET 
                        name = %s, status = %s, daily_budget = %s, targeting = %s, updated_at = NOW()
                    WHERE ad_set_id = %s
                """, (
                    a.get('name'), a.get('status'), int(a.get('daily_budget') or 0)/100, 
                    json.dumps(a.get('targeting') or {}), a.get('id')
                ))
            else:
                # Insert
                new_id = f"c{uuid.uuid4().hex}" # Pseudo-CUID
                cur.execute("""
                    INSERT INTO ad_sets (id, ad_set_id, campaign_id, name, status, daily_budget, targeting, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    new_id, a.get('id'), a.get('campaign_id'), 
                    a.get('name'), a.get('status'), int(a.get('daily_budget') or 0)/100,
                    json.dumps(a.get('targeting') or {})
                ))

        # 4. UPSERT Creatives
        # Schema: id, name, body, headline, imageUrl, videoUrl, callToAction
        print(f"💾 Saving {len(data['creatives'])} Creatives...")
        for c in data['creatives']:
            cur.execute("""
                INSERT INTO ad_creatives (id, name, body, headline, image_url, video_url, call_to_action, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    body = EXCLUDED.body,
                    headline = EXCLUDED.headline,
                    image_url = EXCLUDED.image_url,
                    video_url = EXCLUDED.video_url,
                    call_to_action = EXCLUDED.call_to_action,
                    updated_at = NOW();
            """, (
                c.get('id'), # FB Creative ID as Primary Key
                c.get('name'),
                c.get('body'),
                c.get('title'),
                c.get('image_url') or c.get('thumbnail_url'),
                c.get('video_url'), 
                c.get('call_to_action_type')
            ))

        # 5. UPSERT Ads
        # Schema: id, adId, name, status, adSetId, creativeId, spend, etc.
        print(f"💾 Saving {len(data['ads'])} Ads...")
        for ad in data['ads']:
            # Lookup AdSet CUID
            cur.execute("SELECT id FROM ad_sets WHERE ad_set_id = %s", (ad.get('adset_id'),))
            res_set = cur.fetchone()
            if not res_set:
                print(f"[Warn] AdSet {ad.get('adset_id')} not found for Ad {ad.get('name')}")
                continue
            real_adset_id = res_set[0]
            
            # Lookup Creative ID
            creative_fb_id = ad.get('creative', {}).get('id')
            
            # Upsert Ad
            cur.execute("SELECT id FROM ads WHERE ad_id = %s", (ad.get('id'),))
            res_ad = cur.fetchone()
            
            if res_ad:
                cur.execute("""
                    UPDATE ads SET 
                        name = %s, status = %s, ad_set_id = %s, creative_id = %s, updated_at = NOW()
                    WHERE ad_id = %s
                """, (
                    ad.get('name'), ad.get('status'), real_adset_id, creative_fb_id, ad.get('id')
                ))
            else:
                new_ad_uuid = f"ad{uuid.uuid4().hex}"
                cur.execute("""
                    INSERT INTO ads (id, ad_id, name, status, ad_set_id, creative_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    new_ad_uuid, ad.get('id'), ad.get('name'), ad.get('status'), 
                    real_adset_id, creative_fb_id
                ))
        
        print("✅ Database Population Complete!")
'''

with open(target_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
end_index = -1

# Find start
for i, line in enumerate(lines):
    if "# 3. UPSERT AdSets" in line:
        start_index = i
        break

if start_index != -1:
    # Find end (identifying the 'pass' statement in the loop later)
    # We know the structure is roughly ending with a `pass` before `except Exception as e:`
    # Let's search for "except Exception as e:" and go back up to find the previous `pass` or just close the gap.
    
    for i in range(start_index, len(lines)):
        if "except Exception as e:" in lines[i]:
            # The previous non-empty line should be replaced or we just splice until here.
            # But we want to keep the "except" block.
            end_index = i
            break

if start_index != -1 and end_index != -1:
    print(f"Replacing lines {start_index} to {end_index}")
    # We replace everything from start_index to end_index (exclusive of end_index)
    # But wait, the original code had a huge comment block and `pass`.
    # Let's clean up empty lines before `except`.
    
    # Check if lines[end_index-1] is whitespace
    # We want to replace exactly the block.
    
    new_lines = lines[:start_index] + [new_code + '\n'] + lines[end_index:]
    
    with open(target_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Success!")
else:
    print("Could not find start/end markers.")
