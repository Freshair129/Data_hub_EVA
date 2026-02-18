"""
JSON → PostgreSQL Migration Script
───────────────────────────────────
Reads all customer, employee, and product JSON files and inserts
them into PostgreSQL (local or Supabase) via direct SQL.

Usage:
  python migrate_json_to_postgres.py

Requirements:
  - pip install psycopg2-binary python-dotenv
  - DATABASE_URL in .env.local

This script is IDEMPOTENT — safe to re-run.
"""

import os
import json
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("❌ psycopg2 not found. Install it:")
    print("   pip install psycopg2-binary")
    sys.exit(1)


DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL not set in environment.")
    print("   Add to .env.local:")
    print("   DATABASE_URL=postgresql://user:pass@localhost:5432/vschool_crm")
    sys.exit(1)


def connect():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def migrate_customers(conn, data_dir):
    cur = conn.cursor()
    customer_dir = os.path.join(data_dir, 'customer')
    
    if not os.path.exists(customer_dir):
        print("⚠️  No customer directory found, skipping.")
        return 0
    
    count = 0
    for folder in os.listdir(customer_dir):
        folder_path = os.path.join(customer_dir, folder)
        if not os.path.isdir(folder_path) or folder.startswith('.'):
            continue
        
        for f in os.listdir(folder_path):
            if not f.startswith('profile_') or not f.endswith('.json'):
                continue
            
            try:
                with open(os.path.join(folder_path, f), 'r', encoding='utf-8') as fh:
                    cust = json.load(fh)
                
                p = cust.get('profile', {})
                c = cust.get('contact_info', {})
                s = cust.get('social_profiles', {}).get('facebook', {})
                w = cust.get('wallet', {})
                
                customer_id = cust.get('customer_id', folder)
                
                cur.execute("""
                    INSERT INTO customers (
                        id, customer_id, member_id, status,
                        first_name, last_name, nick_name, job_title, company,
                        membership_tier, lifecycle_stage, join_date,
                        email, phone_primary, facebook_id, facebook_name,
                        wallet_balance, wallet_points, wallet_currency,
                        intelligence, conversation_id,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        NOW(), NOW()
                    )
                    ON CONFLICT (customer_id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        intelligence = EXCLUDED.intelligence,
                        wallet_balance = EXCLUDED.wallet_balance,
                        updated_at = NOW()
                """, (
                    customer_id,
                    p.get('member_id'),
                    p.get('status', 'Active'),
                    p.get('first_name'),
                    p.get('last_name'),
                    p.get('nick_name'),
                    p.get('job_title'),
                    p.get('company'),
                    p.get('membership_tier', 'MEMBER'),
                    p.get('lifecycle_stage', 'Lead'),
                    p.get('join_date'),
                    c.get('email'),
                    c.get('phone_primary'),
                    s.get('id'),
                    s.get('name'),
                    w.get('balance', 0),
                    w.get('points', 0),
                    w.get('currency', 'THB'),
                    Json(cust.get('intelligence', {})),
                    cust.get('conversation_id'),
                ))
                count += 1
                
            except Exception as e:
                print(f"  ⚠️  Error migrating {folder}/{f}: {e}")
    
    print(f"✅ Migrated {count} customers")
    return count


def migrate_employees(conn, data_dir):
    cur = conn.cursor()
    emp_dir = os.path.join(data_dir, 'employee')
    
    if not os.path.exists(emp_dir):
        print("⚠️  No employee directory found, skipping.")
        return 0
    
    count = 0
    for folder in os.listdir(emp_dir):
        folder_path = os.path.join(emp_dir, folder)
        if not os.path.isdir(folder_path) or folder.startswith('.'):
            continue
        
        for f in os.listdir(folder_path):
            if not f.startswith('profile_') or not f.endswith('.json'):
                continue
            
            try:
                with open(os.path.join(folder_path, f), 'r', encoding='utf-8') as fh:
                    emp = json.load(fh)
                
                p = emp.get('profile', {})
                c = emp.get('contact_info', {})
                
                cur.execute("""
                    INSERT INTO employees (
                        id, employee_id, agent_id,
                        first_name, last_name, nick_name,
                        role, department, status, join_date,
                        email, phone_primary, line_id,
                        password_hash, permissions, performance,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        NOW(), NOW()
                    )
                    ON CONFLICT (employee_id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        permissions = EXCLUDED.permissions,
                        updated_at = NOW()
                """, (
                    emp.get('employee_id', folder),
                    emp.get('agent_id'),
                    p.get('first_name', ''),
                    p.get('last_name', ''),
                    p.get('nick_name'),
                    p.get('role', 'sales'),
                    p.get('department'),
                    p.get('status', 'Active'),
                    p.get('join_date'),
                    c.get('email', f'{folder}@vschool.local'),
                    c.get('phone_primary'),
                    c.get('line_id'),
                    emp.get('credentials', {}).get('password', ''),  # TODO: hash in production
                    Json(emp.get('permissions', {})),
                    Json(emp.get('performance', {})),
                ))
                count += 1
                
            except Exception as e:
                print(f"  ⚠️  Error migrating employee {folder}: {e}")
    
    print(f"✅ Migrated {count} employees")
    return count


def migrate_products(conn, data_dir):
    cur = conn.cursor()
    catalog_path = os.path.join(data_dir, 'catalog.json')
    
    if not os.path.exists(catalog_path):
        print("⚠️  No catalog.json found, skipping.")
        return 0
    
    with open(catalog_path, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    
    products = catalog.get('packages', [])
    count = 0
    
    for prod in products:
        try:
            cur.execute("""
                INSERT INTO products (
                    id, product_id, name, description, price, base_price,
                    image, category, duration, duration_unit,
                    metadata, is_active,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, true,
                    NOW(), NOW()
                )
                ON CONFLICT (product_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    price = EXCLUDED.price,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
            """, (
                prod.get('id', ''),
                prod.get('name', ''),
                prod.get('description'),
                prod.get('price', 0),
                prod.get('base_price'),
                prod.get('image'),
                prod.get('category', 'course'),
                prod.get('duration'),
                prod.get('duration_unit'),
                Json(prod.get('metadata', {})),
            ))
            count += 1
        except Exception as e:
            print(f"  ⚠️  Error migrating product {prod.get('id')}: {e}")
    
    print(f"✅ Migrated {count} products")
    return count


def main():
    data_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')
    # Resolve to absolute path
    data_dir = os.path.abspath(data_dir)
    
    print("═" * 50)
    print("  V-School CRM: JSON → PostgreSQL Migration")
    print(f"  Data directory: {data_dir}")
    print(f"  Database: {DATABASE_URL[:40]}...")
    print("═" * 50)
    
    conn = connect()
    print("✅ Connected to PostgreSQL\n")
    
    total = 0
    total += migrate_customers(conn, data_dir)
    total += migrate_employees(conn, data_dir)
    total += migrate_products(conn, data_dir)
    
    print(f"\n{'═' * 50}")
    print(f"  Migration Complete! {total} total records migrated.")
    print(f"{'═' * 50}")
    
    conn.close()


if __name__ == '__main__':
    main()
