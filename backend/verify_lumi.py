import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/management"

def api_request(path, method="GET", body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            if res_body:
                return response.status, json.loads(res_body)
            return response.status, None
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(res_body)
        except:
            err_json = res_body
        return e.code, err_json
    except urllib.error.URLError as e:
        return 0, str(e.reason)

def run_tests():
    print("# LUMIA I SAAS - API Verification Script")
    print("Connecting to local API server...")
    
    # 1. Login as Super Admin
    # LUPUS_ADMIN_EMAIL=admin@lupus.ai and password default is "lumi2025" from .env configuration
    status, res = api_request("/auth/login", "POST", {"email": "admin@lupus.ai", "password": "lumi2025"})
    if status != 200:
        # Try default fallback admin email if .env was not created/used
        status, res = api_request("/auth/login", "POST", {"email": "admin@lupusailabs.com", "password": "lumi2025"})
        if status != 200:
            print(f"[-] Admin login failed (status={status}): {res}")
            return
            
    admin_token = res["accessToken"]
    admin_id = res["user"]["id"]
    print(f"[+] Logged in as Admin: {res['user']['name']} (ID: {admin_id})")
    
    # 2. Create Developer
    dev_email = f"dev_{int(time.time())}@example.com"
    status, dev = api_request("/people/DEVELOPER", "POST", {
        "name": "Test Developer",
        "email": dev_email,
        "password": "password123",
        "company": "DevStudio",
        "capacity_hours": 40
    }, token=admin_token)
    if status not in (200, 201):
        print(f"[-] Failed to create developer: {dev}")
        return
    dev_id = dev["id"]
    print(f"[+] Created Developer: {dev['name']} (ID: {dev_id}, Email: {dev_email})")
    
    # 3. Create Client
    client_email = f"client_{int(time.time())}@example.com"
    status, client = api_request("/people/CLIENT", "POST", {
        "name": "Test Client",
        "email": client_email,
        "password": "password123",
        "company": "Acme Corp",
        "capacity_hours": 40
    }, token=admin_token)
    if status not in (200, 201):
        print(f"[-] Failed to create client: {client}")
        return
    client_id = client["id"]
    print(f"[+] Created Client: {client['name']} (ID: {client_id}, Email: {client_email})")
    
    # Get Tokens for Dev and Client
    status, res = api_request("/auth/login", "POST", {"email": dev_email, "password": "password123"})
    dev_token = res["accessToken"]
    
    status, res = api_request("/auth/login", "POST", {"email": client_email, "password": "password123"})
    client_token = res["accessToken"]
    
    # 4. Create Project
    status, project = api_request("/projects", "POST", {
        "name": "Verification Project",
        "description": "Integration verification project",
        "client_id": client_id,
        "developer_ids": [dev_id]
    }, token=admin_token)
    if status not in (200, 201):
        print(f"[-] Failed to create project: {project}")
        return
    project_id = project["id"]
    print(f"[+] Created Project: {project['name']} (ID: {project_id})")
    
    # 5. Create Documents (PRD & SOW)
    # PRD
    status, prd = api_request("/documents", "POST", {
        "type": "PRD",
        "title": "Verification PRD Specs",
        "body_markdown": "# PRD Specs\n\n## Scope\nDetails of the scope of the project.",
        "project_id": project_id,
        "client_id": client_id,
        "meta": {}
    }, token=admin_token)
    print(f"[+] Created PRD Document (Status: {status})")
    prd_id = prd["id"]
    
    # SOW
    sow_markdown = """# Statement of Work
## Scope of Work
Deliver the requested backend features.

## Pricing
The total contract value for this project is 500,000 INR.
Cost of development: 300,000 INR.
Profit margin: 40%.

## Deliverables
1. API endpoints
2. DB indexes
"""
    status, sow = api_request("/documents", "POST", {
        "type": "SOW",
        "title": "Verification SOW Contract",
        "body_markdown": sow_markdown,
        "project_id": project_id,
        "client_id": client_id,
        "meta": {
            "cost": 300000,
            "contract_value": 500000,
            "profit_margins": 40,
            "payment_terms": "50% upfront, 50% on approval",
            "timeline": "4 weeks"
        }
    }, token=admin_token)
    print(f"[+] Created SOW Document (Status: {status})")
    sow_id = sow["id"]
    
    # 6. SOW Sanitization Check (Developer vs Client)
    print("\n--- SOW Sanitization Verification ---")
    # Fetch SOW as Client (should see pricing info)
    status, client_sow = api_request(f"/documents/{sow_id}", "GET", token=client_token)
    has_pricing_client = "cost" in client_sow.get("meta", {}) and "Pricing" in client_sow.get("body_markdown", "")
    print(f"[Client View] Status={status}")
    print(f"  - Cost in meta: {client_sow.get('meta', {}).get('cost')}")
    print(f"  - Pricing Section present: {has_pricing_client}")
    
    # Fetch SOW as Developer (should be sanitized)
    status, dev_sow = api_request(f"/documents/{sow_id}", "GET", token=dev_token)
    meta_keys = dev_sow.get("meta", {}).keys()
    has_cost = "cost" in meta_keys
    has_value = "contract_value" in meta_keys
    has_margin = "profit_margins" in meta_keys
    has_terms = "payment_terms" in meta_keys
    
    body_markdown = dev_sow.get("body_markdown", "")
    has_pricing_dev = "500,000" in body_markdown or "300,000" in body_markdown
    is_redacted = "[REDACTED - NO ACCESS TO PRICING]" in body_markdown
    
    print(f"[Developer View] Status={status}")
    print(f"  - Cost field present in meta: {has_cost}")
    print(f"  - Contract Value field present in meta: {has_value}")
    print(f"  - Margin field present in meta: {has_margin}")
    print(f"  - Payment Terms field present in meta: {has_terms}")
    print(f"  - Pricing detail or values present in body: {has_pricing_dev}")
    print(f"  - Redaction text present: {is_redacted}")
    
    if not has_cost and not has_value and not has_pricing_dev and is_redacted:
        print("[SUCCESS] SOW sanitization rules enforced for Developer role!")
    else:
        print("[FAILURE] SOW sanitization failed or is incomplete!")
        
    # 7. Messaging Boundaries Verification
    print("\n--- Messaging Boundaries Verification ---")
    # Direct Developer -> Client message (should be blocked)
    status, res = api_request("/messages", "POST", {"receiver_id": client_id, "message_text": "Hey client directly!"}, token=dev_token)
    print(f"Dev to Client direct message: status={status}, response={res}")
    dev_to_client_blocked = (status == 403)
    
    # Direct Client -> Developer message (should be blocked)
    status, res = api_request("/messages", "POST", {"receiver_id": dev_id, "message_text": "Hey dev directly!"}, token=client_token)
    print(f"Client to Dev direct message: status={status}, response={res}")
    client_to_dev_blocked = (status == 403)
    
    if dev_to_client_blocked and client_to_dev_blocked:
        print("[SUCCESS] Direct messaging between Client and Developer is strictly blocked!")
    else:
        print("[FAILURE] Direct messaging blocks failed!")

    # 8. Hierarchical Routing Workflow
    print("\n--- Hierarchical Routing Workflow ---")
    # Client messages Admin
    status, msg = api_request("/messages", "POST", {"receiver_id": admin_id, "message_text": "Client query for development team"}, token=client_token)
    client_msg_id = msg["id"]
    print(f"[Step 1] Client sent query to Admin: status={status}, Message ID={client_msg_id}")
    
    # Admin forwards query to Developer
    # Note: query parameters in GET/POST are read from payload or path parameters. Let's make sure they match management.py
    # wait! Let's check management.py line 826:
    # async def forward_message_to_dev(msg_id: str, developer_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
    # This is a path-like parameter or query parameter depending on FastAPI's definition. Let's make sure it is sent correctly:
    # developer_id is a query param
    status, res = api_request(f"/{client_msg_id}/forward?developer_id={dev_id}", "POST", token=admin_token)
    # Wait, the path is "/messages/{msg_id}/forward". We need f"/messages/{client_msg_id}/forward?developer_id={dev_id}"
    status, res = api_request(f"/messages/{client_msg_id}/forward?developer_id={dev_id}", "POST", token=admin_token)
    print(f"[Step 2] Admin forwarded to Dev (ID: {dev_id}): status={status}, response={res}")
    
    # Developer responds internally to Admin
    status, res = api_request(f"/messages/{client_msg_id}/respond-internal", "POST", {"note_text": "Internal dev technical answer"}, token=dev_token)
    print(f"[Step 3] Developer responded internally to Admin: status={status}, response={res}")
    
    # Admin reviews response and sends final reply to Client
    status, res = api_request(f"/messages/{client_msg_id}/send-final", "POST", {"receiver_id": client_id, "message_text": "Admin approved answer to Client"}, token=admin_token)
    print(f"[Step 4] Admin sent final approved reply to Client: status={status}, response={res}")
    
    # Retrieve messages for client and verify they see only Admin replies
    status, msgs = api_request("/messages", "GET", token=client_token)
    print(f"[Verification] Client retrieves messages: status={status}, count={len(msgs)}")
    for m in msgs:
        print(f"  - Sender: {m['sender_role']}, Receiver: {m['receiver_role']}, Text: {m['message_text']}")

    # 9. Change Request Lifecycle (6-Stage)
    print("\n--- Change Request Lifecycle (6-Stage) ---")
    # Stage 1: Client submits CR
    status, cr = api_request("/change-requests", "POST", {
        "project_id": project_id,
        "title": "Add Dark Mode Support",
        "description": "Please implement support for sleek dark mode."
    }, token=client_token)
    cr_id = cr["id"]
    print(f"[Stage 1] Client submitted CR (status={status}): {cr['title']} (ID={cr_id}), Status={cr['status']}")
    
    # Stage 2: Admin forwards to Dev for estimation
    # Note: developer_id query param
    status, res = api_request(f"/change-requests/{cr_id}/forward-dev?developer_id={dev_id}", "POST", token=admin_token)
    status, crs = api_request("/change-requests", "GET", token=dev_token)
    matched_cr = next((x for x in crs if x["id"] == cr_id), None)
    print(f"[Stage 2] Admin forwarded to Dev: status={status}, CR Status={matched_cr['status'] if matched_cr else 'Not Found'}")
    
    # Stage 3: Developer estimates hours and notes
    status, res = api_request(f"/change-requests/{cr_id}/estimate", "POST", {
        "estimation_hours": 12,
        "estimation_notes": "Requires CSS variables redesign and theme provider configuration."
    }, token=dev_token)
    status, crs = api_request("/change-requests", "GET", token=admin_token)
    matched_cr = next((x for x in crs if x["id"] == cr_id), None)
    print(f"[Stage 3] Dev estimated CR: status={status}, CR Status={matched_cr['status'] if matched_cr else 'Not Found'}, Hours={matched_cr['estimation_hours'] if matched_cr else 0}")
    
    # Stage 4: Admin reviews and approves estimation and price
    status, res = api_request(f"/change-requests/{cr_id}/admin-decision", "POST", {
        "approved": True,
        "comments": "Hours estimated look solid. Pricing set to 25,000 INR."
    }, token=admin_token)
    status, crs = api_request("/change-requests", "GET", token=client_token)
    matched_cr = next((x for x in crs if x["id"] == cr_id), None)
    print(f"[Stage 4] Admin approved CR: status={status}, CR Status={matched_cr['status'] if matched_cr else 'Not Found'}, Admin Comments={matched_cr['admin_comments'] if matched_cr else ''}")
    
    # Stage 5: Client approves estimation and price
    status, res = api_request(f"/change-requests/{cr_id}/client-decision", "POST", {
        "approved": True,
        "comments": "Agreed, let's proceed."
    }, token=client_token)
    status, crs = api_request("/change-requests", "GET", token=admin_token)
    matched_cr = next((x for x in crs if x["id"] == cr_id), None)
    print(f"[Stage 5] Client approved CR: status={status}, CR Status={matched_cr['status'] if matched_cr else 'Not Found'}")
    
    # Stage 6: Admin starts development
    status, res = api_request(f"/change-requests/{cr_id}/start-dev", "POST", token=admin_token)
    status, crs = api_request("/change-requests", "GET", token=client_token)
    matched_cr = next((x for x in crs if x["id"] == cr_id), None)
    print(f"[Stage 6] Admin started development: status={status}, CR Status={matched_cr['status'] if matched_cr else 'Not Found'}")
    
    print("\nVerification process complete!")

if __name__ == "__main__":
    run_tests()
