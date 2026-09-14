import urllib.request
import json

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

# Check curriculum_unit_mappings for the 3 agricultural units:
# 'b19c53d4-1c88-46a3-84e9-75e357b09c63' (CHN 2309)
# 'bf4452b0-30a1-48f9-9498-e6de9ad13b71' (DND 3205)
# 'd2aa4182-535f-43b6-bb3e-5d1152cef1b5' (CND 2306)

for uid in ['b19c53d4-1c88-46a3-84e9-75e357b09c63', 'bf4452b0-30a1-48f9-9498-e6de9ad13b71', 'd2aa4182-535f-43b6-bb3e-5d1152cef1b5']:
    res = query_supabase("curriculum_unit_mappings", f"unit_id=eq.{uid}")
    print(f"Mapping for {uid}: {res}")

# Check teaching_document_templates for CHN 2309 or DND 3205 or CND 2306
for code in ['CHN 2309', 'CHN2309', 'DND 3205', 'DND3205', 'CND 2306', 'CND2306']:
    res = query_supabase("teaching_document_templates", f"select=id,document_type&id=ilike.*{code.replace(' ', '')}*")
    print(f"Templates for {code}: {res}")

# Check curriculum_document_versions for agricultural or food security
versions = query_supabase("curriculum_document_versions", "select=id,status,template_id,extracted_metadata&order=created_at.desc&limit=20")
print(f"Recent versions count: {len(versions) if isinstance(versions, list) else versions}")
if isinstance(versions, list):
    for v in versions:
        meta = v.get('extracted_metadata') or {}
        unit = meta.get('unit') or {}
        unit_name = unit.get('unitName') or meta.get('unitName') or ''
        unit_code = unit.get('unitCode') or meta.get('unitCode') or ''
        if 'agric' in unit_name.lower() or 'food' in unit_name.lower() or 'secur' in unit_name.lower():
            print(f"- Version ID: {v['id']}, status: {v['status']}, template: {v.get('template_id')}, Code: {unit_code}, Name: {unit_name}")
