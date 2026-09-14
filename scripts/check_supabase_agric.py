import urllib.request
import json
import os

url = "https://craousiqgyhmyyxjdvol.supabase.co"
key = "sb_secret_w45d6DZyZ4u-6tfme7t1pw_nOjy9ucZ"

def query_supabase(table, query_params=""):
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?{query_params}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return f"Error: {e}"

# 1. Search units
units = query_supabase("units", "select=id,code,name,department_id&name=ilike.*agric*")
print("Units matching *agric*:")
print(units)

# 2. Search all units with 'food'
units_food = query_supabase("units", "select=id,code,name,department_id&name=ilike.*food*")
print("\nUnits matching *food*:")
print(units_food)

# 3. Search curriculum_families
families = query_supabase("curriculum_families", "select=id,name,family_key&name=ilike.*agric*")
print("\nCurriculum families matching *agric*:")
print(families)

# 4. Search teaching_document_templates
templates = query_supabase("teaching_document_templates", "select=id&id=ilike.*agric*")
print("\nTeaching document templates matching *agric*:")
print(templates)

# 5. Search teaching allocations for units matching agric
if isinstance(units, list) and len(units) > 0:
    for u in units:
        allocs = query_supabase("teaching_allocations", f"select=id,academic_period_id,trainer_id,cohort_id&unit_id=eq.{u['id']}")
        print(f"\nAllocations for unit {u['code']} - {u['name']}:")
        print(allocs)
