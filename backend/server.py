# pyrefly: ignore [missing-import]
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import asyncio
import base64
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

import resend
import bcrypt
from emergentintegrations.llm.chat import LlmChat, UserMessage
from management import create_management_router


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CLAUDE_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")
MAX_USER_TURNS = 12

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
LUPUS_ADMIN_EMAIL = os.environ.get("LUPUS_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "lumi2025")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

ALLOWED_ATTACH_MIME = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/rtf",
}
ALLOWED_ATTACH_EXT = (".pdf", ".doc", ".docx", ".txt", ".md", ".rtf")
MAX_ATTACH_BYTES = 3 * 1024 * 1024  # 3 MB

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ============================================================
# Models
# ============================================================
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class LeadIn(BaseModel):
    name: str = Field(default="", max_length=80)
    phone: str = Field(min_length=5, max_length=20)
    country_code: str = Field(min_length=2, max_length=6)
    intent: Optional[str] = Field(default="login")
    mode: Optional[str] = Field(default="signup")
    source: Optional[str] = Field(default="hero")


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    country_code: str
    full_phone: str
    intent: str = "login"
    source: str = "hero"
    submissions: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IntakeStart(BaseModel):
    user_id: str
    language: Optional[str] = Field(default="en")


class IntakeMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class IntakeMessage(BaseModel):
    role: str  # "user" | "assistant"
    text: str
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IntakeSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    language: str = "en"
    status: str = "active"        # "active" | "ready" | "sent" | "closed"
    user_turn_count: int = 0
    messages: List[IntakeMessage] = Field(default_factory=list)
    prd_doc_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IntakeMessageOut(BaseModel):
    session_id: str
    assistant_text: str
    ready: bool = False
    user_turn_count: int
    max_turns: int
    prd: Optional[Dict[str, Any]] = None  # populated when ready=true


class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: Optional[str] = None
    type: str  # "PRD" | "SOW" | "QUOTATION" | "SLA" | "NDA" | "INVOICE" | "REQUIREMENTS"
    title: str
    status: str = "draft"  # draft | sent | accepted | placeholder
    body_markdown: str = ""
    meta: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================
# Helpers
# ============================================================
def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize_dt(doc: dict, keys: List[str]) -> dict:
    for k in keys:
        v = doc.get(k)
        if isinstance(v, str):
            try:
                doc[k] = datetime.fromisoformat(v)
            except ValueError:
                pass
    return doc


SYSTEM_PROMPT = """\
You are LUMI, the AI intake specialist for LUPUS AI LABS — an AI engineering studio in Hyderabad, Telangana, India.

ROLE
Conduct a friendly, focused intake interview with a prospective client so the Lupus engineering team can deliver a precise build.

LANGUAGE RULE
- Detect the user's language from their FIRST message and respond ONLY in that language for the entire conversation. Supported: English (en), Hindi (hi), Telugu (te), Tamil (ta), Kannada (kn), Malayalam (ml).
- Keep tone warm, professional, slightly cinematic — like a thoughtful product consultant.

CONVERSATION RULES
- Ask ONE question at a time. Each reply <= 3 sentences. NEVER bullet a list of questions in a single turn.
- Acknowledge what the user just said in one short clause, then ask the next question.
- Topics to cover (adaptive — skip what is already clear, push deeper on what's vague):
  1) The project / idea
  2) Their business or org name + one line about it
  3) Industry / domain
  4) Target users
  5) Core problem being solved
  6) Key features for MVP
  7) Existing systems / integrations / data
  8) Success metrics
  9) Timeline / launch urgency
  10) Budget range (broad)
  11) Location (city, country)
  12) Best WhatsApp/phone for contact
- If the user is verbose and already covered multiple topics, batch-acknowledge and move on.
- HARD STOP: the backend will tell you when the user has spent their turn budget; if a system note says BUDGET_EXCEEDED, finalize immediately.

FINALIZING
When you have enough OR when budget is exceeded:
1) Write ONE short closing sentence to the user (in their language) e.g. "Got everything I need. Preparing your PRD."
2) On a NEW LINE, output EXACTLY this marker block (do NOT translate the markers, do NOT add anything after):

<<<PRD_READY>>>
{
  "client_name": "<the user's name or '—'>",
  "company_name": "<company or '—'>",
  "company_details": "<one line about their company or '—'>",
  "location": "<city, country or '—'>",
  "phone": "<contact or '—'>",
  "language": "<en|hi|te|ta|kn|ml>",
  "title": "<short project title in English>",
  "summary": "<one-line elevator pitch in English>",
  "prd_markdown": "<full PRD as markdown using the TEMPLATE below — write in English regardless of conversation language>"
}
<<<END>>>

PRD MARKDOWN TEMPLATE (5–6 lines per section, prose paragraphs, not bullets):

# <Project Title>
**Prepared by LUPUS AI LABS** — {{auto fill today's date and weekday e.g. "12 December 2025 · Friday"}}
**Client:** <name> · <company> · <location> · <phone>

## 1. Executive Summary
<5–6 line paragraph>

## 2. Business Context
<5–6 line paragraph>

## 3. Target Users
<5–6 line paragraph>

## 4. Problem & Opportunity
<5–6 line paragraph>

## 5. Scope & Key Features
<5–6 line paragraph — include features as prose>

## 6. Integrations & Systems
<5–6 line paragraph>

## 7. Success Metrics
<5–6 line paragraph>

## 8. Timeline & Milestones
<5–6 line paragraph>

## 9. Commercials & Next Steps
<5–6 line paragraph>

---
**LUPUS AI LABS PVT LTD · HYDERABAD · TELANGANA**
*Your Problem. Our Formula.*

After the <<<END>>> marker, output nothing else.
"""


PRD_RE = re.compile(r"<<<PRD_READY>>>\s*(.*?)\s*<<<END>>>", re.DOTALL)


def _split_assistant_reply(raw: str) -> Dict[str, Any]:
    """Return { 'text': visible_text, 'ready': bool, 'prd': dict|None }."""
    m = PRD_RE.search(raw)
    if not m:
        return {"text": raw.strip(), "ready": False, "prd": None}
    payload = m.group(1).strip()
    visible = raw[: m.start()].strip()
    try:
        prd = json.loads(payload)
    except json.JSONDecodeError:
        # try to be lenient — strip code fences
        cleaned = payload.strip("` \n")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        try:
            prd = json.loads(cleaned)
        except json.JSONDecodeError:
            return {"text": visible or raw, "ready": False, "prd": None}
    return {"text": visible, "ready": True, "prd": prd}


async def _call_claude(session_id: str, history: List[IntakeMessage], user_text: str,
                       budget_exceeded: bool) -> str:
    """Send a turn to Claude. We feed full history each call (LlmChat with session_id)."""
    sys = SYSTEM_PROMPT
    if budget_exceeded:
        sys = sys + "\n\nSYSTEM NOTE: BUDGET_EXCEEDED — the user has reached the maximum turns. Finalize now."

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=sys,
    ).with_model(*CLAUDE_MODEL)

    # Replay history before sending the new user_text.
    # LlmChat is stateful per-instance, so for each call we replay every prior user/assistant turn.
    # The library appends only after StreamDone (or send_message completion). To avoid double-appending
    # the new user message, we send only the historical user messages via send_message in a tight loop is expensive.
    # Cleaner: prepend history into the user message as a single transcript prefix. Simpler MVP.
    transcript = []
    for m in history:
        prefix = "User:" if m.role == "user" else "Assistant:"
        transcript.append(f"{prefix} {m.text}")
    transcript.append(f"User: {user_text}")
    full_msg = "\n\n".join(transcript) if transcript else user_text

    user_msg = UserMessage(text=full_msg)
    reply = await chat.send_message(user_msg)
    return str(reply)


def _placeholder_doc(user_id: str, dtype: str, title: str, body: str, meta: Dict[str, Any] = None) -> dict:
    doc = Document(
        user_id=user_id,
        type=dtype,
        title=title,
        status="placeholder",
        body_markdown=body,
        meta=meta or {},
    ).model_dump()
    doc["created_at"] = _iso(doc["created_at"])
    doc["updated_at"] = _iso(doc["updated_at"])
    return doc


PLACEHOLDER_DOCS = []  # PRD only — created on actual send. No sample docs in the sidebar.


async def _ensure_placeholder_docs(user_id: str):
    # Remove any legacy placeholder docs (Phase-1 simplification: PRD only).
    await db.documents.delete_many({"user_id": user_id, "status": "placeholder"})


# ============================================================
# Email helpers (Resend)
# ============================================================
def _markdown_to_html(md: str) -> str:
    """Minimal MD → inline-styled HTML for email clients."""
    out = []
    for raw in md.split("\n"):
        line = raw.rstrip()
        if not line.strip():
            out.append('<div style="height:8px"></div>')
            continue
        if line.startswith("# "):
            out.append(f'<h1 style="font-family:Arial,sans-serif;font-size:22px;margin:18px 0 6px;color:#050a1a;">{line[2:]}</h1>')
        elif line.startswith("## "):
            out.append(f'<h2 style="font-family:Arial,sans-serif;font-size:16px;letter-spacing:1px;text-transform:uppercase;margin:18px 0 6px;color:#2455FF;">{line[3:]}</h2>')
        elif line.startswith("---"):
            out.append('<hr style="border:0;border-top:1px solid #2455FF22;margin:16px 0;"/>')
        elif line.startswith("**") and line.endswith("**"):
            out.append(f'<p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#050a1a99;margin:6px 0;">{line.replace("**","")}</p>')
        else:
            out.append(f'<p style="font-family:Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#050a1ad9;margin:4px 0;">{line}</p>')
    return (
        '<div style="max-width:680px;margin:0 auto;background:#fff;padding:28px;'
        'border:1px solid #2455FF22;border-radius:14px;">'
        + "".join(out)
        + "</div>"
    )


async def _send_prd_email(prd_doc: dict, lead: Optional[dict]) -> Dict[str, Any]:
    if not (RESEND_API_KEY and LUPUS_ADMIN_EMAIL):
        return {"sent": False, "reason": "RESEND_API_KEY or LUPUS_ADMIN_EMAIL not configured."}
    meta = prd_doc.get("meta") or {}
    client_name = meta.get("client_name") or (lead or {}).get("name") or "—"
    title = prd_doc.get("title") or "PRD"

    subject = f"[LUMI Intake] New PRD · {title} · {client_name}"
    md = prd_doc.get("body_markdown", "")
    summary_block = (
        '<div style="background:#2455FF;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0;'
        'font-family:Arial,sans-serif;">'
        f'<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;">LUMI · New PRD</div>'
        f'<div style="font-size:20px;font-weight:700;margin-top:4px;">{title}</div>'
        f'<div style="font-size:12px;margin-top:6px;opacity:.85;">Client: {client_name}'
        f' &nbsp;·&nbsp; Phone: {meta.get("phone") or (lead or {}).get("full_phone") or "—"}'
        f' &nbsp;·&nbsp; Location: {meta.get("location") or "—"}'
        f' &nbsp;·&nbsp; Language: {meta.get("language") or "—"}'
        '</div></div>'
    )
    html = (
        '<div style="background:#f5f7ff;padding:24px 12px;">'
        '<div style="max-width:680px;margin:0 auto;">'
        + summary_block
        + _markdown_to_html(md)
        + '</div></div>'
    )

    text_attach = (md or "").encode("utf-8")
    attachments = [
        {
            "filename": f"PRD-{(meta.get('client_name') or 'client').replace(' ', '_')}.md",
            "content": list(text_attach),  # Resend expects byte array
        }
    ]
    params = {
        "from": SENDER_EMAIL,
        "to": [LUPUS_ADMIN_EMAIL],
        "subject": subject,
        "html": html,
        "attachments": attachments,
    }
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {"sent": True, "id": email.get("id")}
    except Exception as e:
        logger.exception("Resend send failed")
        return {"sent": False, "reason": str(e)}


# ============================================================
# Routes — base
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "LUMI AI — lab online"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate):
    status_obj = StatusCheck(**payload.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for r in rows:
        if isinstance(r.get("timestamp"), str):
            r["timestamp"] = datetime.fromisoformat(r["timestamp"])
    return rows


# ============================================================
# Routes — leads (login / signup)
# ============================================================
@api_router.post("/leads", response_model=Lead)
async def create_or_update_lead(payload: LeadIn):
    digits = "".join(ch for ch in payload.phone if ch.isdigit())
    if len(digits) < 5:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    full_phone = f"{payload.country_code} {digits}"
    now_iso = _now_iso()
    mode = (payload.mode or "signup").lower()

    existing = await db.leads.find_one({"full_phone": full_phone}, {"_id": 0})

    if mode == "signin":
        if not existing:
            raise HTTPException(
                status_code=404,
                detail="No account found with that number. Try Sign Up instead.",
            )
        new_doc = {
            **existing,
            "intent": payload.intent or existing.get("intent", "login"),
            "submissions": int(existing.get("submissions", 1)) + 1,
            "last_seen_at": now_iso,
        }
        await db.leads.update_one({"full_phone": full_phone}, {"$set": new_doc})
        await _ensure_placeholder_docs(new_doc["id"])
        return Lead(**_serialize_dt(new_doc, ["created_at", "last_seen_at"]))

    if not (payload.name or "").strip():
        raise HTTPException(status_code=400, detail="Name is required to sign up.")

    if existing:
        new_doc = {
            **existing,
            "name": payload.name,
            "intent": payload.intent or existing.get("intent", "login"),
            "source": payload.source or existing.get("source", "hero"),
            "submissions": int(existing.get("submissions", 1)) + 1,
            "last_seen_at": now_iso,
        }
        await db.leads.update_one({"full_phone": full_phone}, {"$set": new_doc})
        await _ensure_placeholder_docs(new_doc["id"])
        return Lead(**_serialize_dt(new_doc, ["created_at", "last_seen_at"]))

    lead = Lead(
        name=payload.name,
        phone=digits,
        country_code=payload.country_code,
        full_phone=full_phone,
        intent=payload.intent or "login",
        source=payload.source or "hero",
    )
    doc = lead.model_dump()
    doc["created_at"] = now_iso
    doc["last_seen_at"] = now_iso
    await db.leads.insert_one(doc)
    await _ensure_placeholder_docs(lead.id)
    return lead


@api_router.get("/leads", response_model=List[Lead])
async def list_leads(limit: int = 100):
    rows = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Lead(**_serialize_dt(r, ["created_at", "last_seen_at"])) for r in rows]


# ============================================================
# Routes — intake (chat to PRD)
# ============================================================
LANG_GREETING = {
    "en": "Hi! I'm Lumi from Lupus AI Labs. Tell me — in a few sentences — what you'd like to build.",
    "hi": "नमस्ते! मैं Lupus AI Labs से Lumi हूँ। कृपया दो-तीन वाक्यों में बताइए कि आप क्या बनाना चाहते हैं।",
    "te": "హాయ్! నేను Lupus AI Labs నుండి Lumi. మీరు ఏమి తయారు చేయాలనుకుంటున్నారో రెండు మూడు వాక్యాల్లో చెప్పండి.",
    "ta": "வணக்கம்! நான் Lupus AI Labs-ல் இருந்து Lumi. நீங்கள் என்ன கட்டமைக்க விரும்புகிறீர்கள் என்பதை சில வரிகளில் சொல்லுங்கள்.",
    "kn": "ನಮಸ್ಕಾರ! ನಾನು Lupus AI Labs ನಿಂದ Lumi. ನೀವು ಏನು ರಚಿಸಲು ಬಯಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ಎರಡು-ಮೂರು ವಾಕ್ಯಗಳಲ್ಲಿ ಹೇಳಿ.",
    "ml": "ഹായ്! Lupus AI Labs-ൽ നിന്നുള്ള Lumi ആണ്. നിങ്ങൾ എന്താണ് നിർമ്മിക്കാൻ ആഗ്രഹിക്കുന്നതെന്ന് ഏതാനും വരികളിൽ പറയൂ.",
}


@api_router.post("/intake/start", response_model=IntakeSession)
async def start_intake(payload: IntakeStart):
    lang = (payload.language or "en").lower()
    if lang not in LANG_GREETING:
        lang = "en"
    greeting = LANG_GREETING[lang]
    sess = IntakeSession(
        user_id=payload.user_id,
        language=lang,
        messages=[IntakeMessage(role="assistant", text=greeting)],
    )
    doc = sess.model_dump()
    doc["created_at"] = _iso(doc["created_at"])
    doc["updated_at"] = _iso(doc["updated_at"])
    doc["messages"] = [
        {**m, "ts": _iso(m["ts"])} for m in doc["messages"]
    ]
    await db.intake_sessions.insert_one(doc)
    return sess


@api_router.get("/intake/{session_id}", response_model=IntakeSession)
async def get_intake(session_id: str):
    doc = await db.intake_sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    _serialize_dt(doc, ["created_at", "updated_at"])
    for m in doc.get("messages", []):
        if isinstance(m.get("ts"), str):
            try:
                m["ts"] = datetime.fromisoformat(m["ts"])
            except ValueError:
                pass
    return IntakeSession(**doc)


@api_router.post("/intake/{session_id}/message", response_model=IntakeMessageOut)
async def post_intake_message(session_id: str, payload: IntakeMessageIn):
    doc = await db.intake_sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    if doc.get("status") in ("ready", "sent", "closed"):
        raise HTTPException(status_code=409, detail="This intake is closed. The PRD is ready.")

    history = [IntakeMessage(**m) for m in doc.get("messages", [])]
    user_count = int(doc.get("user_turn_count", 0))

    if user_count >= MAX_USER_TURNS:
        raise HTTPException(status_code=429, detail="Turn budget exhausted. Generating PRD…")

    new_user_count = user_count + 1
    budget_exceeded = new_user_count >= MAX_USER_TURNS

    user_text = payload.text.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty message")

    try:
        raw = await _call_claude(session_id, history, user_text, budget_exceeded)
    except Exception as e:
        logger.exception("Claude call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}") from e

    parsed = _split_assistant_reply(raw)

    now_iso = _now_iso()
    new_messages = doc.get("messages", []) + [
        {"role": "user", "text": user_text, "ts": now_iso},
        {"role": "assistant", "text": parsed["text"] or raw, "ts": _now_iso()},
    ]

    update = {
        "messages": new_messages,
        "user_turn_count": new_user_count,
        "updated_at": now_iso,
    }
    if parsed["ready"] and parsed.get("prd"):
        update["status"] = "ready"
        # Stash PRD on session for preview; document row created on confirm-send.
        update["pending_prd"] = parsed["prd"]

    await db.intake_sessions.update_one({"id": session_id}, {"$set": update})

    return IntakeMessageOut(
        session_id=session_id,
        assistant_text=parsed["text"] or raw,
        ready=bool(parsed["ready"]),
        user_turn_count=new_user_count,
        max_turns=MAX_USER_TURNS,
        prd=parsed.get("prd"),
    )


class SendPRDIn(BaseModel):
    edited_markdown: Optional[str] = None


@api_router.post("/intake/{session_id}/send-prd", response_model=Document)
async def send_prd(session_id: str, payload: SendPRDIn):
    doc = await db.intake_sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    if doc.get("status") not in ("ready",):
        raise HTTPException(status_code=400, detail="PRD is not ready yet.")

    prd = doc.get("pending_prd") or {}
    md = payload.edited_markdown or prd.get("prd_markdown", "")
    if not md.strip():
        raise HTTPException(status_code=400, detail="PRD content is empty.")

    document = Document(
        user_id=doc["user_id"],
        session_id=session_id,
        type="PRD",
        title=prd.get("title") or "Product Requirements Document",
        status="sent",
        body_markdown=md,
        meta={
            "client_name": prd.get("client_name"),
            "company_name": prd.get("company_name"),
            "company_details": prd.get("company_details"),
            "location": prd.get("location"),
            "phone": prd.get("phone"),
            "language": prd.get("language"),
            "summary": prd.get("summary"),
        },
    )
    doc_row = document.model_dump()
    doc_row["created_at"] = _iso(doc_row["created_at"])
    doc_row["updated_at"] = _iso(doc_row["updated_at"])
    await db.documents.insert_one(doc_row)

    # Fire-and-forget email to internal team (await is fine — single transactional)
    lead = await db.leads.find_one({"id": doc["user_id"]}, {"_id": 0})
    email_result = await _send_prd_email(doc_row, lead)

    # 1. Automate client user creation if not existing
    if lead:
        client_user = await db.users.find_one({"id": doc["user_id"]})
        if not client_user:
            stamp = _now_iso()
            phone_digits = "".join(ch for ch in lead.get("phone", "") if ch.isdigit())
            email = f"client_{phone_digits}@lupus.ai"
            password_hash = bcrypt.hashpw("demo1234".encode(), bcrypt.gensalt()).decode()
            
            client_user = {
                "id": doc["user_id"],
                "name": lead.get("name", "Demo Client"),
                "email": email,
                "passwordHash": password_hash,
                "role": "CLIENT",
                "company": prd.get("company_name") or "TechVentures",
                "status": "ACTIVE",
                "createdAt": stamp,
                "updatedAt": stamp
            }
            await db.users.insert_one(client_user.copy())
            await db.clients.insert_one({
                "id": str(uuid.uuid4()),
                "userId": doc["user_id"],
                "createdAt": stamp,
                "updatedAt": stamp
            })

    # 2. Automate Project Creation
    project_id = str(uuid.uuid4())
    stamp = _now_iso()
    project = {
        "id": project_id,
        "name": prd.get("title") or "Product Requirements Document",
        "description": prd.get("summary") or "",
        "clientId": doc["user_id"],
        "developerIds": [],
        "prdId": document.id,
        "deadline": None,
        "status": "INTAKE",
        "createdAt": stamp,
        "updatedAt": stamp
    }
    await db.projects.insert_one(project)

    # 3. Create Activity Log
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "userId": doc["user_id"],
        "userName": lead.get("name", "Demo Client") if lead else "Demo Client",
        "role": "CLIENT",
        "action": "CLIENT_SUBMITTED_PRD",
        "entityType": "PROJECT",
        "entityId": project_id,
        "metadata": {"prdId": document.id},
        "createdAt": stamp
    })

    await db.intake_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "sent",
            "prd_doc_id": document.id,
            "email_result": email_result,
            "updated_at": _now_iso(),
        }},
    )
    return document


# ============================================================
# Routes — intake sessions list + attachments
# ============================================================
@api_router.get("/sessions")
async def list_user_sessions(user_id: str, limit: int = 30):
    rows = (
        await db.intake_sessions.find({"user_id": user_id}, {"_id": 0})
        .sort("updated_at", -1)
        .to_list(limit)
    )
    out = []
    for r in rows:
        msgs = r.get("messages", [])
        first_user = next((m for m in msgs if m.get("role") == "user"), None)
        title = (first_user or {}).get("text", "New chat")
        title = (title[:42] + "…") if len(title) > 45 else title
        out.append({
            "id": r.get("id"),
            "title": title or "New chat",
            "language": r.get("language", "en"),
            "status": r.get("status", "active"),
            "user_turn_count": r.get("user_turn_count", 0),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
        })
    return out


@api_router.post("/intake/{session_id}/attach")
async def attach_file(session_id: str, file: UploadFile = File(...)):
    sess = await db.intake_sessions.find_one({"id": session_id}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    fname = (file.filename or "file").strip()
    if not fname.lower().endswith(ALLOWED_ATTACH_EXT):
        raise HTTPException(status_code=400, detail=f"Only documents allowed: {', '.join(ALLOWED_ATTACH_EXT)}")
    data = await file.read()
    if len(data) > MAX_ATTACH_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 3 MB).")

    mime = file.content_type or "application/octet-stream"
    # Best-effort plain-text preview for TXT/MD; PDFs/DOCX we just metadata
    preview = ""
    if mime.startswith("text/") or fname.lower().endswith((".txt", ".md")):
        try:
            preview = data.decode("utf-8", errors="ignore")[:2000]
        except Exception:
            preview = ""

    attach_id = str(uuid.uuid4())
    record = {
        "id": attach_id,
        "filename": fname,
        "mime": mime,
        "size": len(data),
        "data_b64": base64.b64encode(data).decode("ascii"),
        "preview": preview,
        "uploaded_at": _now_iso(),
    }
    # Push as attachment AND inject a system-style note into messages so AI sees it
    note = f"[Attachment uploaded by user: '{fname}' ({mime}, {len(data)} bytes)"
    if preview:
        note += f". File text preview:\n---\n{preview[:1200]}\n---"
    note += "]"
    await db.intake_sessions.update_one(
        {"id": session_id},
        {
            "$push": {
                "attachments": record,
                "messages": {"role": "user", "text": note, "ts": _now_iso()},
            },
            "$set": {"updated_at": _now_iso()},
        },
    )
    return {
        "ok": True,
        "id": attach_id,
        "filename": fname,
        "mime": mime,
        "size": len(data),
        "has_preview": bool(preview),
    }


# ============================================================
# Routes — admin
# ============================================================
def _require_admin(password: str):
    if not password or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")


class AdminAuth(BaseModel):
    password: str


@api_router.post("/admin/login")
async def admin_login(payload: AdminAuth):
    _require_admin(payload.password)
    return {"ok": True}


@api_router.get("/admin/prds")
async def admin_list_prds(password: str, limit: int = 200):
    _require_admin(password)
    rows = await db.documents.find({"type": "PRD"}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    leads = {ld["id"]: ld async for ld in db.leads.find({}, {"_id": 0})}
    out = []
    for r in rows:
        meta = r.get("meta") or {}
        lead = leads.get(r.get("user_id"), {})
        out.append({
            "id": r["id"],
            "title": r.get("title"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
            "client_name": meta.get("client_name") or lead.get("name"),
            "phone": meta.get("phone") or lead.get("full_phone"),
            "company": meta.get("company_name"),
            "location": meta.get("location"),
            "language": meta.get("language"),
            "summary": meta.get("summary"),
            "user_id": r.get("user_id"),
            "body_markdown": r.get("body_markdown", ""),
        })
    return out


@api_router.get("/admin/leads")
async def admin_list_leads(password: str, limit: int = 500):
    _require_admin(password)
    rows = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


@api_router.get("/admin/stats")
async def admin_stats(password: str):
    _require_admin(password)
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


# ============================================================
# Routes — documents
# ============================================================
@api_router.get("/documents", response_model=List[Document])
async def list_documents(user_id: str):
    await _ensure_placeholder_docs(user_id)
    rows = await db.documents.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Document(**_serialize_dt(r, ["created_at", "updated_at"])) for r in rows]


@api_router.get("/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str):
    row = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return Document(**_serialize_dt(row, ["created_at", "updated_at"]))


# ============================================================
# Mount
# ============================================================
app.include_router(api_router)
app.include_router(create_management_router(db, ADMIN_PASSWORD, LUPUS_ADMIN_EMAIL))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
