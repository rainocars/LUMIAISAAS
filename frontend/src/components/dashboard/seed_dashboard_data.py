import pymongo
import uuid
from datetime import datetime, timezone

client = pymongo.MongoClient('mongodb://localhost:27017')
db = client['lumi_ai']

# Clear previous test data to prevent duplicates
db['projects'].delete_many({})
db['milestones'].delete_many({})
db['tasks'].delete_many({})
db['invoices'].delete_many({})
db['payments'].delete_many({})
db['contracts'].delete_many({})
db['activity_logs'].delete_many({})

stamp = datetime.now(timezone.utc).isoformat()

# 1. Project
project_id = str(uuid.uuid4())
project = {
    "id": project_id,
    "name": "Smart Agents Delivery System",
    "description": "Custom agentic workflow automation and WhatsApp integration using Lupus AI modules.",
    "clientId": "a06fc538-5c88-46a6-bea0-69122db30e4b", # Priya Sharma
    "developerIds": ["0702e3e3-98b1-4f9a-a5d5-62da313e4716"], # Ravi Kumar
    "prdId": "prd-sample-id-1234",
    "deadline": (datetime.now(timezone.utc)).isoformat(),
    "status": "ACTIVE",
    "createdAt": stamp,
    "updatedAt": stamp
}
db['projects'].insert_one(project)

# 2. Milestones
m1_id = str(uuid.uuid4())
m2_id = str(uuid.uuid4())
m3_id = str(uuid.uuid4())

milestones = [
    {
        "id": m1_id,
        "projectId": project_id,
        "name": "SOW & Architecture Design",
        "description": "Technical requirements gathering and modular design layout approvals.",
        "releaseNotes": "System architecture design document approved.",
        "deadline": stamp,
        "order": 1,
        "status": "CLIENT_APPROVED",
        "createdAt": stamp,
        "updatedAt": stamp
    },
    {
        "id": m2_id,
        "projectId": project_id,
        "name": "Prototype Integration & Agent Build",
        "description": "Integration of agent endpoints with frontend messaging clients.",
        "releaseNotes": "WhatsApp agent prototype staging deploy completed.",
        "deadline": stamp,
        "order": 2,
        "status": "SENT_TO_CLIENT",
        "createdAt": stamp,
        "updatedAt": stamp
    },
    {
        "id": m3_id,
        "projectId": project_id,
        "name": "Final Handover & UAT Testing",
        "description": "Production release, load testing, and documentation walkthrough.",
        "releaseNotes": "",
        "deadline": stamp,
        "order": 3,
        "status": "DRAFT",
        "createdAt": stamp,
        "updatedAt": stamp
    }
]
db['milestones'].insert_many(milestones)

# 3. Tasks
tasks = [
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "title": "Configure FastAPI router",
        "status": "IN_PROGRESS",
        "assigneeId": "0702e3e3-98b1-4f9a-a5d5-62da313e4716",
        "createdAt": stamp,
        "updatedAt": stamp
    },
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "title": "Setup MongoDB database schema",
        "status": "DONE",
        "assigneeId": "0702e3e3-98b1-4f9a-a5d5-62da313e4716",
        "createdAt": stamp,
        "updatedAt": stamp
    },
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "title": "Build UI design elements & panels",
        "status": "TODO",
        "assigneeId": "0702e3e3-98b1-4f9a-a5d5-62da313e4716",
        "createdAt": stamp,
        "updatedAt": stamp
    }
]
db['tasks'].insert_many(tasks)

# 4. Invoices
invoices = [
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "amount": 75000.0,
        "currency": "INR",
        "dueAt": stamp,
        "status": "PAID",
        "reference": "INV-2026-001",
        "createdAt": stamp,
        "updatedAt": stamp
    },
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "amount": 50000.0,
        "currency": "INR",
        "dueAt": stamp,
        "status": "SENT",
        "reference": "INV-2026-002",
        "createdAt": stamp,
        "updatedAt": stamp
    }
]
db['invoices'].insert_many(invoices)

# 5. Payments
payments = [
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "amount": 75000.0,
        "currency": "INR",
        "dueAt": stamp,
        "status": "COMPLETED",
        "reference": "PAY-2026-001",
        "createdAt": stamp,
        "updatedAt": stamp
    }
]
db['payments'].insert_many(payments)

# 6. Contracts
contracts = [
    {
        "id": str(uuid.uuid4()),
        "projectId": project_id,
        "amount": 125000.0,
        "currency": "INR",
        "dueAt": stamp,
        "status": "ACTIVE",
        "reference": "SOW-LUPUS-PRIYA",
        "createdAt": stamp,
        "updatedAt": stamp
    }
]
db['contracts'].insert_many(contracts)

# 7. Activity Logs
activities = [
    {
        "id": str(uuid.uuid4()),
        "userId": "93078fd6-f249-4cd4-bd24-8e3b25d4512a",
        "userName": "Lupus Super Admin",
        "role": "SUPER_ADMIN",
        "action": "PROJECT_CREATED",
        "entityType": "PROJECT",
        "entityId": project_id,
        "metadata": {},
        "createdAt": stamp
    },
    {
        "id": str(uuid.uuid4()),
        "userId": "0702e3e3-98b1-4f9a-a5d5-62da313e4716",
        "userName": "Ravi Kumar",
        "role": "DEVELOPER",
        "action": "MILESTONE_STARTED",
        "entityType": "MILESTONE",
        "entityId": m1_id,
        "metadata": {},
        "createdAt": stamp
    },
    {
        "id": str(uuid.uuid4()),
        "userId": "a06fc538-5c88-46a6-bea0-69122db30e4b",
        "userName": "Priya Sharma",
        "role": "CLIENT",
        "action": "CLIENT_APPROVE_MILESTONE",
        "entityType": "MILESTONE",
        "entityId": m1_id,
        "metadata": {},
        "createdAt": stamp
      }
]
db['activity_logs'].insert_many(activities)

print("Database seeded successfully with realistic project milestones and billing records!")
