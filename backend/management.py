"""Role-based project management and milestone approval API.

All project progress is derived at read time from CLIENT_APPROVED/CLOSED
milestones. There is intentionally no writable progress field.
"""
from __future__ import annotations

import hashlib
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    DEVELOPER = "DEVELOPER"
    CLIENT = "CLIENT"


class MilestoneStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED_BY_DEVELOPER = "SUBMITTED_BY_DEVELOPER"
    UNDER_ADMIN_REVIEW = "UNDER_ADMIN_REVIEW"
    SENT_TO_CLIENT = "SENT_TO_CLIENT"
    CLIENT_APPROVED = "CLIENT_APPROVED"
    CLIENT_REQUESTED_CHANGES = "CLIENT_REQUESTED_CHANGES"
    BACK_TO_DEVELOPER = "BACK_TO_DEVELOPER"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class PersonIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    company: str = Field(default="", max_length=150)
    capacity_hours: int = Field(default=40, ge=1, le=168)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value


class ProjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    client_id: str
    developer_ids: List[str] = Field(default_factory=list, max_length=30)
    prd_id: Optional[str] = None
    deadline: Optional[datetime] = None


class ProjectPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    client_id: Optional[str] = None
    developer_ids: Optional[List[str]] = Field(default=None, max_length=30)
    prd_id: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = Field(default=None, pattern="^(INTAKE|ACTIVE|PAUSED|ARCHIVED|CLOSED)$")


class MilestoneIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=3000)
    release_notes: str = Field(default="", max_length=5000)
    deadline: Optional[datetime] = None


class SubmissionIn(BaseModel):
    notes: str = Field(min_length=1, max_length=8000)
    deliverable_description: str = Field(min_length=1, max_length=8000)
    demo_video_url: HttpUrl
    staging_url: HttpUrl
    github_pr_url: Optional[HttpUrl] = None
    file_ids: List[str] = Field(default_factory=list, max_length=20)


class DecisionIn(BaseModel):
    action: str
    comments: str = Field(default="", max_length=5000)


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    status: str = Field(default="TODO", pattern="^(TODO|IN_PROGRESS|REVIEW|DONE)$")
    assignee_id: Optional[str] = None


class FinanceIn(BaseModel):
    project_id: str
    amount: float = Field(gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    due_at: Optional[datetime] = None
    status: str = Field(default="DRAFT", max_length=30)
    reference: str = Field(default="", max_length=200)


class DocumentCreateIn(BaseModel):
    type: str
    title: str
    body_markdown: str = ""
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class DocumentUpdateIn(BaseModel):
    title: Optional[str] = None
    body_markdown: Optional[str] = None
    status: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    locked: Optional[bool] = None


class DocumentCommentIn(BaseModel):
    content: str
    is_clarification: bool = False


class DeveloperNoteIn(BaseModel):
    note_text: str


class MessageIn(BaseModel):
    receiver_id: str
    message_text: str


class ChangeRequestIn(BaseModel):
    project_id: str
    title: str
    description: str


class ChangeRequestEstimateIn(BaseModel):
    estimation_hours: int
    estimation_notes: str


class ChangeRequestDecisionIn(BaseModel):
    approved: bool
    comments: str = ""


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[tuple[WebSocket, str]]] = {}

    async def connect(self, user_id: str, role: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append((websocket, role))

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                (ws, r) for ws, r in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for ws, r in list(self.active_connections[user_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def send_to_role(self, role: str, message: dict):
        for user_id, conns in list(self.active_connections.items()):
            for ws, r in list(conns):
                if r == role:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass


manager = ConnectionManager()


def create_management_router(db, admin_password: str, admin_email: str) -> APIRouter:
    router = APIRouter(prefix="/api/management", tags=["management"])
    secret = os.environ.get("JWT_SECRET") or hashlib.sha256(
        f"{admin_password}:lupus-management".encode()
    ).hexdigest()

    def file_bucket():
        # Motor 3.x resolves the running loop during bucket construction.
        # Keep this lazy for Python 3.14, where no implicit main-thread loop exists.
        return AsyncIOMotorGridFSBucket(db, bucket_name="management_files")

    def public_user(user: dict) -> dict:
        return {k: user.get(k) for k in ("id", "name", "email", "role", "company", "status", "capacity_hours", "createdAt", "updatedAt")}

    def token_for(user: dict) -> str:
        payload = {
            "sub": user["id"], "role": user["role"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=8),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, secret, algorithm="HS256")

    async def ensure_admin() -> dict:
        email = (admin_email or "admin@lupusailabs.com").lower()
        existing = await db.users.find_one({"role": Role.SUPER_ADMIN.value}, {"_id": 0})
        if existing:
            return existing
        stamp = now()
        user = {"id": uid(), "name": "Lupus Super Admin", "email": email,
                "passwordHash": bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode(),
                "role": Role.SUPER_ADMIN.value, "company": "Lupus AI Labs",
                "status": "ACTIVE", "createdAt": stamp, "updatedAt": stamp}
        await db.users.insert_one(user.copy())
        return user

    async def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Authentication required")
        try:
            claims = jwt.decode(authorization[7:], secret, algorithms=["HS256"])
        except jwt.PyJWTError:
            raise HTTPException(401, "Session is invalid or expired")
        user = await db.users.find_one({"id": claims.get("sub"), "status": "ACTIVE"}, {"_id": 0})
        if not user:
            raise HTTPException(401, "Account is unavailable")
        return user

    def roles(*allowed: Role):
        async def guard(user: dict = Depends(current_user)) -> dict:
            if user["role"] not in {r.value for r in allowed}:
                raise HTTPException(403, "You do not have permission to perform this action")
            return user
        return guard

    async def audit(user: dict, action: str, entity_type: str, entity_id: str,
                    metadata: Optional[dict] = None):
        await db.activity_logs.insert_one({"id": uid(), "userId": user["id"],
            "userName": user["name"], "role": user["role"], "action": action,
            "entityType": entity_type, "entityId": entity_id,
            "metadata": metadata or {}, "createdAt": now()})

    async def project_for(user: dict, project_id: str) -> dict:
        project = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            raise HTTPException(404, "Project not found")
        if user["role"] == Role.DEVELOPER.value and user["id"] not in project.get("developerIds", []):
            raise HTTPException(403, "Project is not assigned to you")
        if user["role"] == Role.CLIENT.value and user["id"] != project.get("clientId"):
            raise HTTPException(403, "Project does not belong to your account")
        return project

    async def with_progress(project: dict, viewer: Optional[dict] = None) -> dict:
        milestones = await db.milestones.find({"projectId": project["id"]}, {"_id": 0}).sort("order", 1).to_list(500)
        approved = sum(1 for m in milestones if m["status"] in {MilestoneStatus.CLIENT_APPROVED.value, MilestoneStatus.CLOSED.value})
        result = dict(project)
        result["progress"] = round((approved / len(milestones)) * 100) if milestones else 0
        result["approvedMilestones"] = approved
        result["totalMilestones"] = len(milestones)
        result["milestones"] = milestones
        if viewer and viewer["role"] == Role.CLIENT.value:
            result.pop("developerIds", None)
        return result

    @router.on_event("startup")
    async def management_indexes():
        await ensure_admin()
        await db.users.create_index("email", unique=True)
        await db.projects.create_index("clientId")
        await db.projects.create_index("developerIds")
        await db.milestones.create_index([("projectId", 1), ("order", 1)])
        await db.milestone_submissions.create_index("milestoneId")
        await db.milestone_approvals.create_index([("milestoneId", 1), ("createdAt", 1)])
        await db.activity_logs.create_index([("entityType", 1), ("entityId", 1), ("createdAt", -1)])

    @router.post("/auth/login")
    async def login(payload: LoginIn):
        await ensure_admin()
        user = await db.users.find_one({"email": payload.email.strip().lower()}, {"_id": 0})
        valid = user and bcrypt.checkpw(payload.password.encode(), user.get("passwordHash", "").encode())
        if not valid or user.get("status") != "ACTIVE":
            raise HTTPException(401, "Invalid email or password")
        return {"accessToken": token_for(user), "user": public_user(user)}

    @router.get("/me")
    async def me(user: dict = Depends(current_user)):
        return public_user(user)

    @router.get("/people")
    async def people(user: dict = Depends(roles(Role.SUPER_ADMIN))):
        rows = await db.users.find({}, {"_id": 0, "passwordHash": 0}).sort("createdAt", -1).to_list(1000)
        return rows

    @router.post("/people/{role}")
    async def create_person(role: Role, payload: PersonIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        if role == Role.SUPER_ADMIN:
            raise HTTPException(400, "Additional super admins must be provisioned outside this endpoint")
        if await db.users.find_one({"email": payload.email}):
            raise HTTPException(409, "An account already exists for this email")
        stamp = now(); person_id = uid()
        person = {"id": person_id, "name": payload.name.strip(), "email": payload.email,
            "passwordHash": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
            "role": role.value, "company": payload.company.strip(), "status": "ACTIVE",
            "capacity_hours": payload.capacity_hours, "createdAt": stamp, "updatedAt": stamp}
        await db.users.insert_one(person.copy())
        profile_collection = db.clients if role == Role.CLIENT else db.developers
        await profile_collection.insert_one({"id": uid(), "userId": person_id, "createdAt": stamp, "updatedAt": stamp})
        await audit(user, f"{role.value}_CREATED", "USER", person_id)
        return public_user(person)

    @router.patch("/people/{person_id}/status")
    async def person_status(person_id: str, status: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        if status not in {"ACTIVE", "SUSPENDED"}: raise HTTPException(422, "Invalid status")
        result = await db.users.update_one({"id": person_id, "role": {"$ne": Role.SUPER_ADMIN.value}}, {"$set": {"status": status, "updatedAt": now()}})
        if not result.matched_count: raise HTTPException(404, "User not found")
        await audit(user, f"USER_{status}", "USER", person_id)
        return {"ok": True}

    @router.post("/projects")
    async def create_project(payload: ProjectIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        client = await db.users.find_one({"id": payload.client_id, "role": Role.CLIENT.value, "status": "ACTIVE"})
        dev_count = await db.users.count_documents({"id": {"$in": payload.developer_ids}, "role": Role.DEVELOPER.value, "status": "ACTIVE"})
        if not client: raise HTTPException(422, "Select an active client")
        if dev_count != len(set(payload.developer_ids)): raise HTTPException(422, "One or more developers are invalid")
        stamp = now(); project_id = uid()
        project = {"id": project_id, "name": payload.name.strip(), "description": payload.description,
            "clientId": payload.client_id, "developerIds": list(dict.fromkeys(payload.developer_ids)),
            "prdId": payload.prd_id, "deadline": payload.deadline.isoformat() if payload.deadline else None,
            "status": "ACTIVE", "createdAt": stamp, "updatedAt": stamp}
        await db.projects.insert_one(project.copy()); await audit(user, "PROJECT_CREATED", "PROJECT", project_id)
        return await with_progress(project, user)

    @router.get("/projects")
    async def list_projects(user: dict = Depends(current_user)):
        query: dict = {}
        if user["role"] == Role.DEVELOPER.value: query = {"developerIds": user["id"]}
        elif user["role"] == Role.CLIENT.value: query = {"clientId": user["id"]}
        rows = await db.projects.find(query, {"_id": 0}).sort("updatedAt", -1).to_list(1000)
        return [await with_progress(row, user) for row in rows]

    @router.get("/projects/{project_id}")
    async def get_project(project_id: str, user: dict = Depends(current_user)):
        return await with_progress(await project_for(user, project_id), user)

    @router.get("/projects/{project_id}/prd")
    async def read_project_prd(project_id: str, user: dict = Depends(current_user)):
        project = await project_for(user, project_id)
        if not project.get("prdId"):
            raise HTTPException(404, "No PRD is linked to this project")
        prd = await db.documents.find_one({"id": project["prdId"], "type": "PRD"}, {"_id": 0})
        if not prd:
            raise HTTPException(404, "PRD not found")
        # No mutation endpoint is exposed to developer or client roles.
        return prd

    @router.patch("/projects/{project_id}")
    async def update_project(project_id: str, payload: ProjectPatch, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        patch = payload.model_dump(exclude_none=True)
        mapping = {"client_id": "clientId", "developer_ids": "developerIds", "prd_id": "prdId"}
        patch = {mapping.get(k, k): (v.isoformat() if isinstance(v, datetime) else v) for k, v in patch.items()}
        patch["updatedAt"] = now()
        result = await db.projects.update_one({"id": project_id}, {"$set": patch})
        if not result.matched_count: raise HTTPException(404, "Project not found")
        await audit(user, "PROJECT_UPDATED", "PROJECT", project_id, {"fields": list(patch)})
        return await with_progress(await db.projects.find_one({"id": project_id}, {"_id": 0}), user)

    @router.post("/projects/{project_id}/milestones")
    async def add_milestone(project_id: str, payload: MilestoneIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        await project_for(user, project_id)
        order = await db.milestones.count_documents({"projectId": project_id}) + 1
        stamp = now(); milestone_id = uid()
        item = {"id": milestone_id, "projectId": project_id, "name": payload.name,
            "description": payload.description, "releaseNotes": payload.release_notes,
            "deadline": payload.deadline.isoformat() if payload.deadline else None, "order": order,
            "status": MilestoneStatus.DRAFT.value, "createdAt": stamp, "updatedAt": stamp}
        await db.milestones.insert_one(item.copy()); await audit(user, "MILESTONE_CREATED", "MILESTONE", milestone_id)
        return item

    @router.post("/milestones/{milestone_id}/start")
    async def start_milestone(milestone_id: str, user: dict = Depends(roles(Role.DEVELOPER))):
        milestone = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
        if not milestone: raise HTTPException(404, "Milestone not found")
        await project_for(user, milestone["projectId"])
        if milestone["status"] not in {MilestoneStatus.DRAFT.value, MilestoneStatus.BACK_TO_DEVELOPER.value, MilestoneStatus.CLIENT_REQUESTED_CHANGES.value}:
            raise HTTPException(409, "Milestone cannot be started from its current state")
        await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": MilestoneStatus.IN_PROGRESS.value, "updatedAt": now()}})
        await audit(user, "MILESTONE_STARTED", "MILESTONE", milestone_id); return {"ok": True}

    @router.post("/milestones/{milestone_id}/submit")
    async def submit_milestone(milestone_id: str, payload: SubmissionIn, user: dict = Depends(roles(Role.DEVELOPER))):
        milestone = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
        if not milestone: raise HTTPException(404, "Milestone not found")
        await project_for(user, milestone["projectId"])
        if milestone["status"] not in {MilestoneStatus.IN_PROGRESS.value, MilestoneStatus.BACK_TO_DEVELOPER.value, MilestoneStatus.CLIENT_REQUESTED_CHANGES.value}:
            raise HTTPException(409, "Milestone is not ready for submission")
        files = await db.management_file_meta.count_documents({"id": {"$in": payload.file_ids}, "uploadedBy": user["id"]})
        if files != len(set(payload.file_ids)): raise HTTPException(422, "One or more attachments are invalid")
        stamp = now(); submission_id = uid()
        submission = {"id": submission_id, "milestoneId": milestone_id, "projectId": milestone["projectId"],
            "developerId": user["id"], "developerName": user["name"], "notes": payload.notes,
            "deliverableDescription": payload.deliverable_description, "demoVideoUrl": str(payload.demo_video_url),
            "stagingUrl": str(payload.staging_url), "githubPrUrl": str(payload.github_pr_url) if payload.github_pr_url else None,
            "fileIds": payload.file_ids, "createdAt": stamp, "updatedAt": stamp}
        await db.milestone_submissions.insert_one(submission.copy())
        await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": MilestoneStatus.SUBMITTED_BY_DEVELOPER.value, "latestSubmissionId": submission_id, "updatedAt": stamp}})
        await audit(user, "DEVELOPER_SUBMITTED_MILESTONE", "MILESTONE", milestone_id)
        return submission

    @router.post("/milestones/{milestone_id}/begin-admin-review")
    async def begin_admin_review(milestone_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        result = await db.milestones.update_one(
            {"id": milestone_id, "status": MilestoneStatus.SUBMITTED_BY_DEVELOPER.value},
            {"$set": {"status": MilestoneStatus.UNDER_ADMIN_REVIEW.value, "updatedAt": now()}},
        )
        if not result.matched_count:
            raise HTTPException(409, "Milestone is not awaiting admin intake")
        await audit(user, "ADMIN_BEGAN_MILESTONE_REVIEW", "MILESTONE", milestone_id)
        return {"status": MilestoneStatus.UNDER_ADMIN_REVIEW.value}

    @router.post("/milestones/{milestone_id}/admin-decision")
    async def admin_decision(milestone_id: str, payload: DecisionIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        action = payload.action.upper()
        if action not in {"APPROVE", "REQUEST_CHANGES", "REJECT"}: raise HTTPException(422, "Invalid action")
        if action in {"REQUEST_CHANGES", "REJECT"} and not payload.comments.strip(): raise HTTPException(422, "Admin comments are required")
        milestone = await db.milestones.find_one({"id": milestone_id, "status": MilestoneStatus.UNDER_ADMIN_REVIEW.value}, {"_id": 0})
        if not milestone: raise HTTPException(409, "Milestone is not awaiting admin review")
        target = {"APPROVE": MilestoneStatus.SENT_TO_CLIENT.value, "REQUEST_CHANGES": MilestoneStatus.BACK_TO_DEVELOPER.value, "REJECT": MilestoneStatus.REJECTED.value}[action]
        stamp = now(); approval = {"id": uid(), "milestoneId": milestone_id, "actorId": user["id"], "actorRole": user["role"], "action": action, "comments": payload.comments, "createdAt": stamp}
        await db.milestone_approvals.insert_one(approval)
        await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": target, "updatedAt": stamp}})
        await audit(user, f"ADMIN_{action}_MILESTONE", "MILESTONE", milestone_id); return {"status": target}

    @router.post("/milestones/{milestone_id}/client-decision")
    async def client_decision(milestone_id: str, payload: DecisionIn, user: dict = Depends(roles(Role.CLIENT))):
        action = payload.action.upper()
        if action not in {"APPROVE_MILESTONE", "REQUEST_REVISION"}: raise HTTPException(422, "Invalid action")
        if action == "REQUEST_REVISION" and not payload.comments.strip(): raise HTTPException(422, "Revision comments are required")
        milestone = await db.milestones.find_one({"id": milestone_id, "status": MilestoneStatus.SENT_TO_CLIENT.value}, {"_id": 0})
        if not milestone: raise HTTPException(409, "Milestone is not awaiting client review")
        await project_for(user, milestone["projectId"])
        target = MilestoneStatus.CLIENT_APPROVED.value if action == "APPROVE_MILESTONE" else MilestoneStatus.CLIENT_REQUESTED_CHANGES.value
        stamp = now(); approval = {"id": uid(), "milestoneId": milestone_id, "actorId": user["id"], "actorRole": user["role"], "action": action, "comments": payload.comments, "createdAt": stamp}
        await db.milestone_approvals.insert_one(approval)
        await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": target, "updatedAt": stamp}})
        await audit(user, f"CLIENT_{action}", "MILESTONE", milestone_id); return {"status": target}

    @router.post("/milestones/{milestone_id}/close")
    async def close_milestone(milestone_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        result = await db.milestones.update_one(
            {"id": milestone_id, "status": MilestoneStatus.CLIENT_APPROVED.value},
            {"$set": {"status": MilestoneStatus.CLOSED.value, "updatedAt": now()}},
        )
        if not result.matched_count:
            raise HTTPException(409, "Only a client-approved milestone can be closed")
        await audit(user, "MILESTONE_CLOSED", "MILESTONE", milestone_id)
        return {"status": MilestoneStatus.CLOSED.value}

    @router.get("/milestones/{milestone_id}/review")
    async def review_detail(milestone_id: str, user: dict = Depends(current_user)):
        milestone = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
        if not milestone: raise HTTPException(404, "Milestone not found")
        await project_for(user, milestone["projectId"])
        submission = await db.milestone_submissions.find_one({"id": milestone.get("latestSubmissionId")}, {"_id": 0})
        approvals = await db.milestone_approvals.find({"milestoneId": milestone_id}, {"_id": 0}).sort("createdAt", 1).to_list(100)
        if user["role"] == Role.CLIENT.value and milestone["status"] not in {MilestoneStatus.SENT_TO_CLIENT.value, MilestoneStatus.CLIENT_APPROVED.value, MilestoneStatus.CLIENT_REQUESTED_CHANGES.value, MilestoneStatus.CLOSED.value}:
            raise HTTPException(403, "This milestone has not been released to the client")
        if user["role"] == Role.CLIENT.value:
            approvals = [a for a in approvals if a.get("actorRole") == Role.CLIENT.value]
            if submission:
                for field in ("developerId", "developerName", "notes", "githubPrUrl"):
                    submission.pop(field, None)
        return {"milestone": milestone, "submission": submission, "history": approvals}

    @router.post("/projects/{project_id}/tasks")
    async def create_task(project_id: str, payload: TaskIn, user: dict = Depends(roles(Role.SUPER_ADMIN, Role.DEVELOPER))):
        project = await project_for(user, project_id)
        assignee = payload.assignee_id or (user["id"] if user["role"] == Role.DEVELOPER.value else None)
        if assignee and assignee not in project.get("developerIds", []): raise HTTPException(422, "Assignee is not on this project")
        stamp = now(); task = {"id": uid(), "projectId": project_id, "title": payload.title, "status": payload.status, "assigneeId": assignee, "createdAt": stamp, "updatedAt": stamp}
        await db.tasks.insert_one(task.copy()); await audit(user, "TASK_CREATED", "TASK", task["id"]); return task

    @router.patch("/tasks/{task_id}")
    async def update_task(task_id: str, status: str, user: dict = Depends(roles(Role.SUPER_ADMIN, Role.DEVELOPER))):
        if status not in {"TODO", "IN_PROGRESS", "REVIEW", "DONE"}: raise HTTPException(422, "Invalid status")
        task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task: raise HTTPException(404, "Task not found")
        await project_for(user, task["projectId"])
        await db.tasks.update_one({"id": task_id}, {"$set": {"status": status, "updatedAt": now()}})
        await audit(user, "TASK_STATUS_UPDATED", "TASK", task_id, {"status": status}); return {"ok": True}

    @router.get("/projects/{project_id}/tasks")
    async def list_tasks(project_id: str, user: dict = Depends(current_user)):
        await project_for(user, project_id)
        return await db.tasks.find({"projectId": project_id}, {"_id": 0}).sort("createdAt", 1).to_list(500)

    @router.post("/files")
    async def upload_file(file: UploadFile = File(...), user: dict = Depends(roles(Role.SUPER_ADMIN, Role.DEVELOPER))):
        allowed = {"application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "application/zip"}
        if file.content_type not in allowed: raise HTTPException(415, "Unsupported file type")
        data = await file.read(10 * 1024 * 1024 + 1)
        if len(data) > 10 * 1024 * 1024: raise HTTPException(413, "File exceeds the 10 MB limit")
        file_id = uid(); grid_id = await file_bucket().upload_from_stream(file.filename or "attachment", data, metadata={"owner": user["id"], "contentType": file.content_type})
        meta = {"id": file_id, "gridId": grid_id, "name": (file.filename or "attachment")[:255], "contentType": file.content_type, "size": len(data), "uploadedBy": user["id"], "createdAt": now()}
        await db.management_file_meta.insert_one(meta.copy()); await audit(user, "FILE_UPLOADED", "FILE", file_id); meta.pop("gridId"); return meta

    @router.get("/files/{file_id}")
    async def download_file(file_id: str, user: dict = Depends(current_user)):
        meta = await db.management_file_meta.find_one({"id": file_id}, {"_id": 0})
        if not meta: raise HTTPException(404, "File not found")
        submission = await db.milestone_submissions.find_one({"fileIds": file_id}, {"_id": 0})
        if submission: await project_for(user, submission["projectId"])
        elif user["id"] != meta["uploadedBy"] and user["role"] != Role.SUPER_ADMIN.value: raise HTTPException(403, "File is not available to you")
        stream = await file_bucket().open_download_stream(meta["gridId"]); data = await stream.read()
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", meta["name"])
        return Response(data, media_type=meta["contentType"], headers={"Content-Disposition": f'attachment; filename="{safe_name}"', "X-Content-Type-Options": "nosniff"})

    @router.post("/finance/{kind}")
    async def create_finance(kind: str, payload: FinanceIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        collection = {"invoice": db.invoices, "payment": db.payments, "contract": db.contracts}.get(kind)
        if collection is None: raise HTTPException(404, "Unknown finance record type")
        await project_for(user, payload.project_id); stamp = now()
        record = {"id": uid(), "projectId": payload.project_id, "amount": payload.amount, "currency": payload.currency.upper(), "dueAt": payload.due_at.isoformat() if payload.due_at else None, "status": payload.status, "reference": payload.reference, "createdAt": stamp, "updatedAt": stamp}
        await collection.insert_one(record.copy()); await audit(user, f"{kind.upper()}_CREATED", kind.upper(), record["id"]); return record

    @router.get("/finance")
    async def finance(user: dict = Depends(roles(Role.SUPER_ADMIN, Role.CLIENT))):
        query = {}
        if user["role"] == Role.CLIENT.value:
            projects = await db.projects.find({"clientId": user["id"]}, {"_id": 0, "id": 1}).to_list(1000)
            query = {"projectId": {"$in": [p["id"] for p in projects]}}
        async def rows(collection): return await collection.find(query, {"_id": 0}).sort("createdAt", -1).to_list(1000)
        return {"invoices": await rows(db.invoices), "payments": await rows(db.payments), "contracts": await rows(db.contracts)}

    @router.get("/leads")
    async def list_leads(limit: int = 100, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        rows = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        return rows

    @router.get("/stats")
    async def admin_stats(user: dict = Depends(roles(Role.SUPER_ADMIN))):
        leads_count = await db.leads.count_documents({})
        sessions_count = await db.intake_sessions.count_documents({})
        sent_prds = await db.documents.count_documents({"type": "PRD", "status": "sent"})
        ready_sessions = await db.intake_sessions.count_documents({"status": "ready"})
        return {
            "leads": leads_count,
            "sessions": sessions_count,
            "prds_sent": sent_prds,
            "prds_ready": ready_sessions,
        }

    @router.get("/activity")
    async def activity(limit: int = 100, user: dict = Depends(current_user)):
        query: dict = {}
        if user["role"] != Role.SUPER_ADMIN.value:
            pq = {"developerIds": user["id"]} if user["role"] == Role.DEVELOPER.value else {"clientId": user["id"]}
            projects = await db.projects.find(pq, {"_id": 0, "id": 1}).to_list(1000)
            ids = [p["id"] for p in projects]
            milestones = await db.milestones.find({"projectId": {"$in": ids}}, {"_id": 0, "id": 1}).to_list(5000)
            query = {"$or": [{"entityType": "PROJECT", "entityId": {"$in": ids}}, {"entityType": "MILESTONE", "entityId": {"$in": [m["id"] for m in milestones]}}, {"userId": user["id"]}]}
        return await db.activity_logs.find(query, {"_id": 0}).sort("createdAt", -1).to_list(min(limit, 500))

    @router.get("/dashboard")
    async def dashboard(user: dict = Depends(current_user)):
        pq: dict = {}
        if user["role"] == Role.DEVELOPER.value: pq = {"developerIds": user["id"]}
        elif user["role"] == Role.CLIENT.value: pq = {"clientId": user["id"]}
        projects = await db.projects.find(pq, {"_id": 0}).to_list(1000)
        project_ids = [p["id"] for p in projects]
        milestone_query = {"projectId": {"$in": project_ids}} if user["role"] != Role.SUPER_ADMIN.value else {}
        milestones = await db.milestones.find(milestone_query, {"_id": 0}).to_list(5000)
        data = {"activeProjects": sum(p["status"] == "ACTIVE" for p in projects), "projects": len(projects),
            "pendingReviews": sum(m["status"] in {MilestoneStatus.SUBMITTED_BY_DEVELOPER.value, MilestoneStatus.UNDER_ADMIN_REVIEW.value} for m in milestones),
            "pendingClientApprovals": sum(m["status"] == MilestoneStatus.SENT_TO_CLIENT.value for m in milestones)}
        if user["role"] == Role.SUPER_ADMIN.value:
            data.update({"activeClients": await db.users.count_documents({"role": Role.CLIENT.value, "status": "ACTIVE"}),
                "activeDevelopers": await db.users.count_documents({"role": Role.DEVELOPER.value, "status": "ACTIVE"}),
                "revenue": sum(x.get("amount", 0) for x in await db.payments.find({"status": {"$in": ["PAID", "COMPLETED"]}}, {"_id": 0}).to_list(10000)),
                "outstanding": sum(x.get("amount", 0) for x in await db.invoices.find({"status": {"$nin": ["PAID", "CANCELLED"]}}, {"_id": 0}).to_list(10000))})
        return data

    @router.get("/admin-user")
    async def get_admin_user(user: dict = Depends(current_user)):
        admin = await db.users.find_one({"role": Role.SUPER_ADMIN.value})
        if not admin:
            raise HTTPException(404, "Admin not found")
        return {"id": admin["id"], "name": admin["name"], "email": admin["email"]}

    @router.websocket("/ws/{user_id}")
    async def websocket_endpoint(websocket: WebSocket, user_id: str):
        role = websocket.query_params.get("role", "CLIENT")
        await manager.connect(user_id, role, websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(user_id, websocket)

    def sanitize_sow_for_dev(doc: dict) -> dict:
        if doc.get("type") == "SOW":
            doc = dict(doc)
            meta = dict(doc.get("meta") or {})
            for key in ["cost", "pricing", "contract_value", "payment_terms", "profit_margins"]:
                meta.pop(key, None)
            doc["meta"] = meta
            
            body = doc.get("body_markdown", "")
            lines = body.split("\n")
            new_lines = []
            skip = False
            for line in lines:
                line_lower = line.lower()
                if line.startswith("##") and any(keyword in line_lower for keyword in ["pricing", "cost", "commercial", "payment terms", "margin"]):
                    new_lines.append(f"{line.split()[0]} [REDACTED - NO ACCESS TO PRICING]")
                    skip = True
                    continue
                elif line.startswith("##") and skip:
                    skip = False
                
                if skip:
                    if line.strip():
                        new_lines.append("[Pricing information hidden]")
                else:
                    new_lines.append(line)
            doc["body_markdown"] = "\n".join(new_lines)
        return doc

    # ============================================================
    # PRD & SOW Document Operations
    # ============================================================
    @router.post("/documents")
    async def create_document(payload: DocumentCreateIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        stamp = now()
        doc_id = uid()
        doc = {
            "id": doc_id,
            "user_id": payload.client_id or user["id"],
            "project_id": payload.project_id,
            "type": payload.type.upper(),
            "title": payload.title,
            "status": "draft",
            "body_markdown": payload.body_markdown,
            "meta": payload.meta,
            "created_at": stamp,
            "updated_at": stamp,
            "locked": False,
            "version": 1
        }
        await db.documents.insert_one(doc.copy())
        await audit(user, f"DOCUMENT_{payload.type.upper()}_CREATED", "DOCUMENT", doc_id)
        return doc

    @router.get("/documents")
    async def list_documents(project_id: Optional[str] = None, user: dict = Depends(current_user)):
        query = {}
        if project_id:
            query["project_id"] = project_id
            
        if user["role"] == Role.CLIENT.value:
            projects = await db.projects.find({"clientId": user["id"]}, {"id": 1}).to_list(1000)
            p_ids = [p["id"] for p in projects]
            query["$or"] = [{"project_id": {"$in": p_ids}}, {"user_id": user["id"]}]
        elif user["role"] == Role.DEVELOPER.value:
            projects = await db.projects.find({"developerIds": user["id"]}, {"id": 1}).to_list(1000)
            p_ids = [p["id"] for p in projects]
            query["project_id"] = {"$in": p_ids}
            
        rows = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        if user["role"] == Role.DEVELOPER.value:
            rows = [sanitize_sow_for_dev(r) for r in rows]
            
        return rows

    @router.get("/documents/{doc_id}")
    async def get_document(doc_id: str, user: dict = Depends(current_user)):
        doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Document not found")
            
        if user["role"] == Role.CLIENT.value:
            if doc.get("project_id"):
                project = await db.projects.find_one({"id": doc["project_id"]})
                if not project or project.get("clientId") != user["id"]:
                    raise HTTPException(403, "Access denied")
            elif doc.get("user_id") != user["id"]:
                raise HTTPException(403, "Access denied")
        elif user["role"] == Role.DEVELOPER.value:
            if doc.get("project_id"):
                project = await db.projects.find_one({"id": doc["project_id"]})
                if not project or user["id"] not in project.get("developerIds", []):
                    raise HTTPException(403, "Access denied")
            else:
                raise HTTPException(403, "Access denied")
                
        if user["role"] == Role.DEVELOPER.value:
            doc = sanitize_sow_for_dev(doc)
            
        return doc

    @router.patch("/documents/{doc_id}")
    async def update_document(doc_id: str, payload: DocumentUpdateIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        doc = await db.documents.find_one({"id": doc_id})
        if not doc:
            raise HTTPException(404, "Document not found")
            
        if doc.get("locked") and payload.locked is not False and (payload.title or payload.body_markdown or payload.meta):
            raise HTTPException(409, "Document version is locked and cannot be edited")
            
        patch = payload.model_dump(exclude_none=True)
        if "meta" in patch and doc.get("meta"):
            merged_meta = dict(doc.get("meta") or {})
            merged_meta.update(patch["meta"])
            patch["meta"] = merged_meta
            
        patch["updated_at"] = now()
        
        if doc.get("locked") and payload.locked is False:
            patch["version"] = doc.get("version", 1) + 1
            patch["locked"] = False
            
        await db.documents.update_one({"id": doc_id}, {"$set": patch})
        await audit(user, f"DOCUMENT_UPDATED", "DOCUMENT", doc_id)
        
        updated_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
        return updated_doc

    @router.post("/documents/{doc_id}/comments")
    async def add_document_comment(doc_id: str, payload: DocumentCommentIn, user: dict = Depends(current_user)):
        doc = await db.documents.find_one({"id": doc_id})
        if not doc:
            raise HTTPException(404, "Document not found")
            
        if user["role"] == Role.CLIENT.value and not payload.is_clarification:
            raise HTTPException(403, "Clients can only submit clarification requests")
        if user["role"] == Role.DEVELOPER.value and payload.is_clarification:
            raise HTTPException(403, "Developers can only submit internal comments")
            
        stamp = now()
        comment = {
            "id": uid(),
            "doc_id": doc_id,
            "author_id": user["id"],
            "author_name": user["name"],
            "author_role": user["role"],
            "content": payload.content,
            "is_clarification": payload.is_clarification,
            "created_at": stamp
        }
        await db.document_comments.insert_one(comment.copy())
        await audit(user, "DOCUMENT_COMMENT_ADDED", "DOCUMENT", doc_id)
        return comment

    @router.get("/documents/{doc_id}/comments")
    async def get_document_comments(doc_id: str, user: dict = Depends(current_user)):
        doc = await db.documents.find_one({"id": doc_id})
        if not doc:
            raise HTTPException(404, "Document not found")
            
        query = {"doc_id": doc_id}
        if user["role"] == Role.CLIENT.value:
            query["is_clarification"] = True
        elif user["role"] == Role.DEVELOPER.value:
            query["is_clarification"] = False
            
        comments = await db.document_comments.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)
        return comments

    # ============================================================
    # Developer Notes Operations
    # ============================================================
    @router.post("/projects/{project_id}/developer-notes")
    async def add_developer_note(project_id: str, payload: DeveloperNoteIn, user: dict = Depends(roles(Role.SUPER_ADMIN, Role.DEVELOPER))):
        await project_for(user, project_id)
        stamp = now()
        note = {
            "id": uid(),
            "project_id": project_id,
            "author_id": user["id"],
            "author_name": user["name"],
            "author_role": user["role"],
            "note_text": payload.note_text,
            "created_at": stamp
        }
        await db.developer_notes.insert_one(note.copy())
        await audit(user, "DEVELOPER_NOTE_CREATED", "PROJECT", project_id)
        return note

    @router.get("/projects/{project_id}/developer-notes")
    async def get_developer_notes(project_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN, Role.DEVELOPER))):
        await project_for(user, project_id)
        notes = await db.developer_notes.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return notes

    # ============================================================
    # Hierarchy Messaging Operations
    # ============================================================
    @router.post("/messages")
    async def send_message(payload: MessageIn, user: dict = Depends(current_user)):
        receiver = await db.users.find_one({"id": payload.receiver_id})
        if not receiver:
            raise HTTPException(404, "Receiver not found")
            
        if user["role"] == Role.DEVELOPER.value:
            if receiver["role"] != Role.SUPER_ADMIN.value:
                raise HTTPException(403, "Developers can only communicate with Admin")
        elif user["role"] == Role.CLIENT.value:
            if receiver["role"] != Role.SUPER_ADMIN.value:
                raise HTTPException(403, "Clients can only communicate with Admin")
            
        stamp = now()
        msg_id = uid()
        message = {
            "id": msg_id,
            "sender_id": user["id"],
            "sender_name": user["name"],
            "sender_role": user["role"],
            "receiver_id": receiver["id"],
            "receiver_role": receiver["role"],
            "message_text": payload.message_text,
            "status": "sent",
            "created_at": stamp,
            "updated_at": stamp
        }
        await db.communications.insert_one(message.copy())
        
        # Broadcast to receiver
        await manager.send_to_user(receiver["id"], {
            "type": "NEW_MESSAGE",
            "message": message
        })
        # Broadcast to admins if the receiver is SUPER_ADMIN
        if receiver["role"] == Role.SUPER_ADMIN.value:
            await manager.send_to_role(Role.SUPER_ADMIN.value, {
                "type": "NEW_MESSAGE",
                "message": message
            })
        # Broadcast to sender
        await manager.send_to_user(user["id"], {
            "type": "NEW_MESSAGE",
            "message": message
        })
        
        action = "CLIENT_MESSAGE_SENT" if user["role"] == Role.CLIENT.value else ("DEVELOPER_MESSAGE_SENT" if user["role"] == Role.DEVELOPER.value else "ADMIN_MESSAGE_SENT")
        await audit(user, action, "MESSAGE", msg_id)
        return message

    @router.get("/messages")
    async def list_messages(user: dict = Depends(current_user)):
        if user["role"] == Role.SUPER_ADMIN.value:
            rows = await db.communications.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
        else:
            rows = await db.communications.find({
                "$or": [
                    {"sender_id": user["id"]},
                    {"receiver_id": user["id"]}
                ]
            }, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return rows

    @router.post("/messages/{msg_id}/forward")
    async def forward_message_to_dev(msg_id: str, developer_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        msg = await db.communications.find_one({"id": msg_id})
        if not msg:
            raise HTTPException(404, "Message not found")
            
        dev = await db.users.find_one({"id": developer_id, "role": Role.DEVELOPER.value})
        if not dev:
            raise HTTPException(404, "Developer not found")
            
        await db.communications.update_one({"id": msg_id}, {
            "$set": {
                "status": "forwarded",
                "forwarded_to_id": developer_id,
                "updated_at": now()
            }
        })
        await manager.send_to_user(developer_id, {
            "type": "MESSAGE_FORWARDED",
            "msg_id": msg_id
        })
        await manager.send_to_role(Role.SUPER_ADMIN.value, {
            "type": "MESSAGE_FORWARDED",
            "msg_id": msg_id
        })
        await audit(user, "ADMIN_FORWARDED_MESSAGE", "MESSAGE", msg_id, {"developer_id": developer_id})
        return {"ok": True}

    @router.post("/messages/{msg_id}/respond-internal")
    async def developer_respond_internal(msg_id: str, payload: DeveloperNoteIn, user: dict = Depends(roles(Role.DEVELOPER))):
        msg = await db.communications.find_one({"id": msg_id, "forwarded_to_id": user["id"]})
        if not msg:
            raise HTTPException(404, "Forwarded message not found")
            
        await db.communications.update_one({"id": msg_id}, {
            "$set": {
                "status": "responded",
                "developer_response_text": payload.note_text,
                "developer_response_at": now(),
                "updated_at": now()
            }
        })
        await manager.send_to_role(Role.SUPER_ADMIN.value, {
            "type": "MESSAGE_RESPONDED",
            "msg_id": msg_id,
            "response_text": payload.note_text
        })
        await manager.send_to_user(user["id"], {
            "type": "MESSAGE_RESPONDED",
            "msg_id": msg_id,
            "response_text": payload.note_text
        })
        await audit(user, "DEVELOPER_RESPONSE_SUBMITTED", "MESSAGE", msg_id)
        return {"ok": True}

    @router.post("/messages/{msg_id}/send-final")
    async def admin_send_final_reply(msg_id: str, payload: MessageIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        msg = await db.communications.find_one({"id": msg_id})
        if not msg:
            raise HTTPException(404, "Message not found")
            
        client_id = msg["sender_id"] if msg["sender_role"] == Role.CLIENT.value else msg["receiver_id"]
        client = await db.users.find_one({"id": client_id})
        if not client:
            raise HTTPException(404, "Client not found")
            
        stamp = now()
        reply_id = uid()
        reply = {
            "id": reply_id,
            "sender_id": user["id"],
            "sender_name": user["name"],
            "sender_role": user["role"],
            "receiver_id": client["id"],
            "receiver_role": client["role"],
            "message_text": payload.message_text,
            "status": "sent",
            "created_at": stamp,
            "updated_at": stamp
        }
        await db.communications.insert_one(reply.copy())
        
        await db.communications.update_one({"id": msg_id}, {
            "$set": {
                "status": "completed",
                "updated_at": stamp
            }
        })
        
        await manager.send_to_user(client["id"], {
            "type": "NEW_MESSAGE",
            "message": reply
        })
        await manager.send_to_role(Role.SUPER_ADMIN.value, {
            "type": "NEW_MESSAGE",
            "message": reply
        })
        await manager.send_to_role(Role.SUPER_ADMIN.value, {
            "type": "MESSAGE_COMPLETED",
            "msg_id": msg_id
        })
        
        await audit(user, "ADMIN_APPROVAL_MESSAGE_SENT", "MESSAGE", reply_id)
        return reply

    # ============================================================
    # Change Request System Operations
    # ============================================================
    @router.post("/change-requests")
    async def create_change_request(payload: ChangeRequestIn, user: dict = Depends(roles(Role.CLIENT))):
        project = await db.projects.find_one({"id": payload.project_id})
        if not project or project.get("clientId") != user["id"]:
            raise HTTPException(403, "Project not found or access denied")
            
        stamp = now()
        cr_id = uid()
        cr = {
            "id": cr_id,
            "project_id": payload.project_id,
            "project_name": project.get("name"),
            "client_id": user["id"],
            "client_name": user["name"],
            "title": payload.title,
            "description": payload.description,
            "status": "submitted",
            "estimation_hours": 0,
            "estimation_notes": "",
            "admin_comments": "",
            "created_at": stamp,
            "updated_at": stamp
        }
        await db.change_requests.insert_one(cr.copy())
        await audit(user, "CHANGE_REQUEST_SUBMITTED", "CHANGE_REQUEST", cr_id)
        return cr

    @router.get("/change-requests")
    async def list_change_requests(user: dict = Depends(current_user)):
        query = {}
        if user["role"] == Role.CLIENT.value:
            query["client_id"] = user["id"]
        elif user["role"] == Role.DEVELOPER.value:
            projects = await db.projects.find({"developerIds": user["id"]}, {"id": 1}).to_list(1000)
            p_ids = [p["id"] for p in projects]
            query["project_id"] = {"$in": p_ids}
            query["status"] = {"$in": ["under_dev_estimation", "dev_estimated", "admin_approved", "client_approved", "in_development"]}
            
        rows = await db.change_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return rows

    @router.post("/change-requests/{cr_id}/forward-dev")
    async def change_request_forward_dev(cr_id: str, developer_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        cr = await db.change_requests.find_one({"id": cr_id})
        if not cr:
            raise HTTPException(404, "Change Request not found")
            
        await db.change_requests.update_one({"id": cr_id}, {
            "$set": {
                "status": "under_dev_estimation",
                "assigned_developer_id": developer_id,
                "updated_at": now()
            }
        })
        await audit(user, "CHANGE_REQUEST_FORWARDED_TO_DEV", "CHANGE_REQUEST", cr_id)
        return {"ok": True}

    @router.post("/change-requests/{cr_id}/estimate")
    async def change_request_estimate(cr_id: str, payload: ChangeRequestEstimateIn, user: dict = Depends(roles(Role.DEVELOPER))):
        cr = await db.change_requests.find_one({"id": cr_id, "assigned_developer_id": user["id"]})
        if not cr:
            raise HTTPException(404, "Change Request not found or not assigned to you")
            
        await db.change_requests.update_one({"id": cr_id}, {
            "$set": {
                "status": "dev_estimated",
                "estimation_hours": payload.estimation_hours,
                "estimation_notes": payload.estimation_notes,
                "updated_at": now()
            }
        })
        await audit(user, "CHANGE_REQUEST_ESTIMATED", "CHANGE_REQUEST", cr_id)
        return {"ok": True}

    @router.post("/change-requests/{cr_id}/admin-decision")
    async def change_request_admin_decision(cr_id: str, payload: ChangeRequestDecisionIn, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        cr = await db.change_requests.find_one({"id": cr_id})
        if not cr:
            raise HTTPException(404, "Change Request not found")
            
        status = "admin_approved" if payload.approved else "rejected"
        await db.change_requests.update_one({"id": cr_id}, {
            "$set": {
                "status": status,
                "admin_comments": payload.comments,
                "updated_at": now()
            }
        })
        await audit(user, f"CHANGE_REQUEST_ADMIN_{status.upper()}", "CHANGE_REQUEST", cr_id)
        return {"ok": True}

    @router.post("/change-requests/{cr_id}/client-decision")
    async def change_request_client_decision(cr_id: str, payload: ChangeRequestDecisionIn, user: dict = Depends(roles(Role.CLIENT))):
        cr = await db.change_requests.find_one({"id": cr_id, "client_id": user["id"]})
        if not cr:
            raise HTTPException(404, "Change Request not found")
            
        status = "client_approved" if payload.approved else "client_rejected"
        await db.change_requests.update_one({"id": cr_id}, {
            "$set": {
                "status": status,
                "updated_at": now()
            }
        })
        await audit(user, f"CHANGE_REQUEST_CLIENT_{status.upper()}", "CHANGE_REQUEST", cr_id)
        return {"ok": True}

    @router.post("/change-requests/{cr_id}/start-dev")
    async def change_request_start_dev(cr_id: str, user: dict = Depends(roles(Role.SUPER_ADMIN))):
        cr = await db.change_requests.find_one({"id": cr_id})
        if not cr:
            raise HTTPException(404, "Change Request not found")
            
        await db.change_requests.update_one({"id": cr_id}, {
            "$set": {
                "status": "in_development",
                "updated_at": now()
            }
        })
        await audit(user, "CHANGE_REQUEST_DEVELOPMENT_STARTED", "CHANGE_REQUEST", cr_id)
        return {"ok": True}

    return router
