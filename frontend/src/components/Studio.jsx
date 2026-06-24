import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe2,
  Loader2,
  LogOut,
  MessageSquarePlus,
  Send,
  X,
  Languages,
  Plus,
  Paperclip,
  Trash2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/lib/userStore";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const JESSE_DP =
  "https://customer-assets.emergentagent.com/job_blueprint-ai-68/artifacts/9gbr64ag_image.png";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
];

/* =========================================================
   Sidebar — user · New chat · Sessions · Documents (PRD only)
   ========================================================= */
const Sidebar = ({
  user,
  onLogout,
  onNewSession,
  sessions,
  activeSessionId,
  onPickSession,
  onOpenDoc,
  documents,
}) => {
  const prdDoc = (documents || []).find((d) => d.type === "PRD");
  return (
    <aside className="hidden md:flex w-[340px] shrink-0 flex-col gap-4 p-4 border-r border-[#2455FF]/12 bg-white/60 backdrop-blur-md">
      {/* User */}
      <div
        className="glass rounded-2xl p-3 flex items-center gap-3"
        data-testid="studio-user-card"
      >
        <span className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-[#2455FF]/30 shrink-0">
          <img src={JESSE_DP} alt={user?.name} className="h-full w-full object-cover" draggable="false" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#25D366] ring-2 ring-white" />
        </span>
        <div className="leading-tight min-w-0 flex-1">
          <div className="font-cine text-[14px] tracking-[0.12em] text-[#050a1a] truncate" data-testid="studio-user-name">
            {user?.name || "Guest"}
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#2455FF]/70 truncate">
            {user?.phone || "Lab Member"}
          </div>
        </div>
        <button
          onClick={onLogout}
          aria-label="Sign out"
          data-testid="studio-logout-btn"
          className="h-8 w-8 rounded-full bg-[#050a1a]/5 hover:bg-[#050a1a]/10 inline-flex items-center justify-center text-[#050a1a]/55 hover:text-[#2455FF] transition"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      {/* New chat (CTA only — no subtext) + history list */}
      <div className="glass rounded-2xl p-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#2455FF]/70 inline-flex items-center gap-1.5">
            <MessageSquarePlus className="h-3 w-3" strokeWidth={2.6} />
            Ask&nbsp;Our&nbsp;AI
          </div>
          <button
            onClick={onNewSession}
            data-testid="studio-new-session-btn"
            className="inline-flex items-center gap-1 text-[11px] font-cine tracking-[0.12em] text-white bg-[#2455FF] hover:bg-[#1a44e0] px-2.5 py-1 rounded-md transition"
          >
            <Plus className="h-3 w-3" strokeWidth={2.8} />
            New&nbsp;chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-1" data-testid="studio-sessions-list">
          {(sessions || []).length === 0 && (
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/40 px-1 py-2">
              No chats yet
            </div>
          )}
          {(sessions || []).map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <button
                key={s.id}
                onClick={() => onPickSession?.(s)}
                data-testid={`session-row-${s.id}`}
                className={`group w-full text-left rounded-lg px-2.5 py-2 transition flex items-center gap-2 ring-1 ${
                  isActive
                    ? "bg-[#2455FF]/10 ring-[#2455FF]/30"
                    : "bg-white/55 ring-transparent hover:bg-white hover:ring-[#2455FF]/15"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  s.status === "sent" ? "bg-[#25D366]" :
                  s.status === "ready" ? "bg-[#FFA600]" :
                  "bg-[#2455FF]/60"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-[#050a1a] truncate leading-tight">
                    {s.title || "New chat"}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#050a1a]/45 mt-0.5">
                    {s.language || "en"} · {s.user_turn_count || 0}/12
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Documents — PRD only */}
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#2455FF]/70 inline-flex items-center gap-1.5">
            <Layers className="h-3 w-3" strokeWidth={2.6} />
            Your&nbsp;Documents
          </div>
          <span className="font-mono text-[10px] text-[#050a1a]/40">{prdDoc ? 1 : 0}</span>
        </div>
        <div className="mt-3" data-testid="studio-docs-grid">
          <button
            onClick={() => onOpenDoc("PRD")}
            disabled={!prdDoc}
            data-testid="doc-card-prd"
            className={`group w-full rounded-xl p-3 text-left transition flex items-center gap-3 ring-1 ${
              prdDoc
                ? "bg-[#2455FF]/8 ring-[#2455FF]/30 hover:bg-[#2455FF]/12 cursor-pointer"
                : "bg-white/60 ring-[#2455FF]/12 opacity-70 cursor-not-allowed"
            }`}
          >
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${prdDoc ? "bg-[#2455FF]" : "bg-[#2455FF]/15"}`}>
              <FileText className={`h-4 w-4 ${prdDoc ? "text-white" : "text-[#2455FF]"}`} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-cine text-[13px] tracking-[0.12em] text-[#050a1a]">PRD</div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#050a1a]/55 truncate">
                {prdDoc ? `${prdDoc.status} · ${prdDoc.title}` : "Generate one with Lumi"}
              </div>
            </div>
            {prdDoc && <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />}
          </button>
        </div>
      </div>

      <a
        href="/"
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/45 hover:text-[#2455FF] inline-flex items-center gap-1.5"
        data-testid="studio-back-home"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.6} />
        Back to lab home
      </a>
    </aside>
  );
};

const Bubble = ({ role, children }) => {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#2455FF] text-white shadow-[0_10px_30px_-12px_rgba(36,85,255,0.6)]"
            : "glass-strong text-[#050a1a]"
        }`}
        data-testid={`chat-bubble-${role}`}
      >
        {children}
      </div>
    </div>
  );
};

const PRDPreview = ({ prd, sessionId, onSent, onBack }) => {
  const [sending, setSending] = useState(false);
  const [edited, setEdited] = useState(prd?.prd_markdown || "");
  const send = async () => {
    setSending(true);
    try {
      const res = await axios.post(`${API}/intake/${sessionId}/send-prd`, {
        edited_markdown: edited,
      });
      toast.success("PRD sent to the build team.", {
        description: "Our team will get back to you in 24 hours.",
        duration: 5200,
        icon: <CheckCircle2 className="h-5 w-5 text-[#25D366]" strokeWidth={2.6} />,
      });
      onSent?.(res.data);
    } catch (e) {
      toast.error("Could not send PRD.", { description: e?.response?.data?.detail || e.message });
    } finally {
      setSending(false);
    }
  };

  const renderMd = (text) =>
    text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="font-display text-3xl text-[#050a1a] tracking-tight mb-2">{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="font-cine text-lg tracking-[0.1em] text-[#2455FF] mt-5 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith("---")) return <hr key={i} className="my-4 border-[#2455FF]/15" />;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#050a1a]/65">{line.replace(/\*\*/g, "")}</p>;
      if (!line.trim()) return <div key={i} className="h-2" />;
      return <p key={i} className="text-[13.5px] text-[#050a1a]/85 leading-relaxed mb-1">{line}</p>;
    });

  return (
    <div className="flex flex-col h-full" data-testid="prd-preview-pane">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2455FF]/12">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            data-testid="prd-back-btn"
            className="h-8 w-8 rounded-full bg-white/60 ring-1 ring-[#2455FF]/15 hover:bg-white flex items-center justify-center text-[#050a1a]/60 hover:text-[#2455FF] transition"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#2455FF]/70">PRD Preview</div>
            <div className="font-cine text-[18px] tracking-[0.06em] text-[#050a1a] leading-none mt-0.5">
              {prd?.title || "Product Requirements Document"}
            </div>
          </div>
        </div>
        <button
          onClick={send}
          disabled={sending}
          data-testid="prd-send-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1fbb5a] disabled:opacity-50 text-white px-4 py-2.5 text-[13px] font-semibold transition shadow-[0_10px_30px_-12px_rgba(37,211,102,0.6)]"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} /> Sending…</>
          ) : (
            <><Send className="h-4 w-4" strokeWidth={2.6} /> Send to Team</>
          )}
        </button>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-0 overflow-hidden min-h-0">
        <div className="border-r border-[#2455FF]/12 p-4 flex flex-col min-h-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/55 mb-2">
            Edit (markdown)
          </div>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            data-testid="prd-editor"
            className="flex-1 w-full rounded-xl bg-white/70 ring-1 ring-[#2455FF]/15 focus:ring-[#2455FF]/50 outline-none p-4 font-mono text-[12.5px] leading-relaxed text-[#050a1a] resize-none"
          />
        </div>
        <div className="p-6 overflow-y-auto bp-grid bp-wash" data-testid="prd-preview-render">
          <article className="prose-doc max-w-none">{renderMd(edited)}</article>
        </div>
      </div>
    </div>
  );
};

const DocViewer = ({ type, document: doc, onClose }) => {
  return (
    <AnimatePresence>
      {type && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          data-testid="doc-viewer-modal"
        >
          <button onClick={onClose} className="absolute inset-0 bg-[#050a1a]/35 backdrop-blur-sm" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative glass-strong rounded-2xl w-full max-w-[860px] max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2455FF]/12">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#2455FF]/70">{type}</div>
                <div className="font-cine text-[18px] tracking-[0.06em] text-[#050a1a] leading-none mt-0.5">
                  {doc?.title || `${type}`}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" data-testid="doc-viewer-close" className="h-8 w-8 rounded-full bg-white/60 ring-1 ring-[#2455FF]/15 hover:bg-white flex items-center justify-center text-[#050a1a]/60 hover:text-[#2455FF] transition">
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 bp-grid bp-wash flex-1" data-testid="doc-viewer-body">
              {(doc?.body_markdown || "_Loading…_").split("\n").map((line, i) => {
                if (line.startsWith("# ")) return <h1 key={i} className="font-display text-2xl text-[#050a1a] mb-2">{line.slice(2)}</h1>;
                if (line.startsWith("## ")) return <h2 key={i} className="font-cine text-base tracking-[0.1em] text-[#2455FF] mt-4 mb-2">{line.slice(3)}</h2>;
                if (line.startsWith("---")) return <hr key={i} className="my-4 border-[#2455FF]/15" />;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#050a1a]/65">{line.replace(/\*\*/g, "")}</p>;
                if (!line.trim()) return <div key={i} className="h-2" />;
                return <p key={i} className="text-[13px] text-[#050a1a]/85 leading-relaxed mb-1">{line}</p>;
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* =========================================================
   Main Studio
   ========================================================= */
export const Studio = () => {
  const navigate = useNavigate();
  const [user, setUser] = useUser();
  const [lang, setLang] = useState("en");
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [prd, setPrd] = useState(null);
  const [viewerType, setViewerType] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [attachments, setAttachments] = useState([]); // local turn-scoped chips
  const fileRef = useRef(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  const turnsLeft = useMemo(
    () => Math.max(0, 12 - (session?.user_turn_count || 0)),
    [session]
  );

  const startSession = async (langCode = lang) => {
    if (!user?.id) return null;
    try {
      const res = await axios.post(`${API}/intake/start`, { user_id: user.id, language: langCode });
      const data = { ...res.data, max_turns: 12 };
      setSession(data);
      setReady(false);
      setPrd(null);
      setAttachments([]);
      await refreshSessions();
      const pendingPrompt = sessionStorage.getItem("lumi.firstPrompt");
      if (pendingPrompt && pendingPrompt.trim()) {
        sessionStorage.removeItem("lumi.firstPrompt");
        setTimeout(() => sendFirstPrompt(data.id, pendingPrompt.trim()), 400);
      }
      return data;
    } catch (e) {
      toast.error("Couldn't start intake.", { description: e.message });
      return null;
    }
  };

  const sendFirstPrompt = async (sid, text) => {
    setPending(true);
    setSession((s) => ({
      ...s,
      messages: [...(s?.messages || []), { role: "user", text, ts: new Date().toISOString() }],
      user_turn_count: (s?.user_turn_count || 0) + 1,
    }));
    try {
      const res = await axios.post(`${API}/intake/${sid}/message`, { text });
      setSession((s) => ({
        ...s,
        messages: [...(s.messages || []), { role: "assistant", text: res.data.assistant_text, ts: new Date().toISOString() }],
        user_turn_count: res.data.user_turn_count,
      }));
      if (res.data.ready && res.data.prd) {
        setPrd(res.data.prd);
        setReady(true);
      }
      await refreshSessions();
    } catch (e) {
      toast.error("Lumi hit a snag.", { description: e?.response?.data?.detail || e.message });
    } finally {
      setPending(false);
    }
  };

  const refreshSessions = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/sessions`, { params: { user_id: user.id } });
      setSessions(res.data || []);
    } catch {
      /* non-critical */
    }
  };

  const refreshDocs = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/documents`, { params: { user_id: user.id } });
      setDocuments(res.data || []);
    } catch {
      /* non-critical */
    }
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    const t = setTimeout(() => {
      if (!session) startSession(lang);
      refreshDocs();
      refreshSessions();
    }, 0);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [session?.messages?.length, pending]);

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !session?.id || pending || ready) return;
    setInput("");
    setAttachments([]);
    setSession((s) => ({
      ...s,
      messages: [...(s.messages || []), { role: "user", text, ts: new Date().toISOString() }],
      user_turn_count: (s?.user_turn_count || 0) + 1,
    }));
    setPending(true);
    try {
      const res = await axios.post(`${API}/intake/${session.id}/message`, { text });
      setSession((s) => ({
        ...s,
        messages: [...(s.messages || []), { role: "assistant", text: res.data.assistant_text, ts: new Date().toISOString() }],
        user_turn_count: res.data.user_turn_count,
      }));
      if (res.data.ready && res.data.prd) {
        setPrd(res.data.prd);
        setReady(true);
        toast.success("Your PRD is ready.", {
          description: "Review on the right and send it to the team.",
          duration: 4800,
          icon: <FileText className="h-5 w-5 text-[#2455FF]" strokeWidth={2.6} />,
        });
      }
      await refreshSessions();
    } catch (err) {
      toast.error("Lumi hit a snag.", { description: err?.response?.data?.detail || err.message });
    } finally {
      setPending(false);
    }
  };

  const openFilePicker = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset for repeat upload
    if (!file || !session?.id) return;
    setAttaching(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API}/intake/${session.id}/attach`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments((a) => [
        ...a,
        { id: res.data.id, filename: res.data.filename, size: res.data.size },
      ]);
      setSession((s) => ({
        ...s,
        messages: [
          ...(s.messages || []),
          {
            role: "user",
            text: `📎 Attached: ${res.data.filename} (${Math.round((res.data.size || 0) / 1024)} KB)`,
            ts: new Date().toISOString(),
          },
        ],
      }));
      toast.success("Document attached.", {
        description: `${res.data.filename} added to this chat.`,
        duration: 3200,
      });
    } catch (err) {
      toast.error("Couldn't attach file.", { description: err?.response?.data?.detail || err.message });
    } finally {
      setAttaching(false);
    }
  };

  const pickSession = async (s) => {
    try {
      const res = await axios.get(`${API}/intake/${s.id}`);
      const data = { ...res.data, max_turns: 12 };
      setSession(data);
      const isReady = data.status === "ready" && data.pending_prd;
      setReady(isReady);
      setPrd(isReady ? data.pending_prd : null);
      setAttachments([]);
    } catch (e) {
      toast.error("Couldn't load chat.", { description: e.message });
    }
  };

  const onOpenDoc = async (type) => {
    setViewerType(type);
    setViewerDoc(null);
    const matched = documents.find((d) => d.type === type);
    if (matched) {
      try {
        const res = await axios.get(`${API}/documents/${matched.id}`);
        setViewerDoc(res.data);
      } catch {
        setViewerDoc(matched);
      }
    }
  };

  const onLogout = () => {
    setUser(null);
    navigate("/", { replace: true });
  };

  const handleLanguageChange = (code) => {
    setLang(code);
    startSession(code);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      {/* slim top bar — no black square */}
      <header
        className="border-b border-[#2455FF]/12 bg-white/70 backdrop-blur-md px-4 py-2.5 flex items-center justify-between"
        data-testid="studio-topbar"
      >
        <div className="flex items-center gap-3">
          <span className="font-cine text-[15px] tracking-[0.14em] text-[#050a1a]">LUMI&nbsp;AI</span>
          <span className="h-4 w-px bg-[#2455FF]/25" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#2455FF]/70">
            Studio · Intake
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2455FF]/8 ring-1 ring-[#2455FF]/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2455FF]" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#050a1a]/70" data-testid="studio-turns-indicator">
              {ready ? "PRD READY" : `${turnsLeft} turns left`}
            </span>
          </div>
          <Select value={lang} onValueChange={handleLanguageChange}>
            <SelectTrigger
              data-testid="studio-language-select"
              aria-label="Language"
              className="h-9 w-[150px] rounded-full bg-white/70 border-0 ring-1 ring-[#2455FF]/15 px-3 font-mono text-[12px] text-[#050a1a]"
            >
              <SelectValue>
                <span className="inline-flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 text-[#2455FF]" strokeWidth={2.4} />
                  {LANGUAGES.find((l) => l.code === lang)?.native || "English"}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6} className="z-[200] glass-strong border-0 ring-1 ring-[#2455FF]/20 rounded-xl">
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="font-mono text-[12.5px] focus:bg-[#2455FF]/8 data-[state=checked]:bg-[#2455FF]/10 data-[state=checked]:text-[#2455FF]">
                  <span className="inline-flex items-center gap-2">
                    <Globe2 className="h-3.5 w-3.5 text-[#2455FF]" strokeWidth={2.4} />
                    <span className="w-16">{l.label}</span>
                    <span className="text-[#050a1a]/55">{l.native}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar
          user={user}
          onLogout={onLogout}
          onNewSession={() => startSession(lang)}
          sessions={sessions}
          activeSessionId={session?.id}
          onPickSession={pickSession}
          onOpenDoc={onOpenDoc}
          documents={documents}
        />

        <main className="flex-1 min-w-0 flex flex-col bp-grid bp-wash">
          {!ready && (
            <>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-3" data-testid="studio-chat-scroll">
                {(session?.messages || []).map((m, i) => (
                  <Bubble key={i} role={m.role}>{m.text}</Bubble>
                ))}
                {pending && (
                  <div className="flex justify-start">
                    <div className="glass-strong rounded-2xl px-4 py-3 inline-flex items-center gap-2 text-[#050a1a]/70 text-[13px]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2455FF]" strokeWidth={2.6} />
                      Lumi is thinking…
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={sendMessage}
                className="border-t border-[#2455FF]/12 bg-white/70 backdrop-blur-md px-4 sm:px-8 py-4"
                data-testid="studio-composer"
              >
                {/* Attachment chips */}
                {attachments.length > 0 && (
                  <div className="max-w-[920px] mx-auto mb-2 flex flex-wrap gap-2" data-testid="studio-attachment-chips">
                    {attachments.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#2455FF]/8 ring-1 ring-[#2455FF]/20 px-2.5 py-1 font-mono text-[11px] text-[#050a1a]"
                      >
                        <Paperclip className="h-3 w-3 text-[#2455FF]" strokeWidth={2.6} />
                        <span className="max-w-[180px] truncate">{a.filename}</span>
                        <span className="text-[#050a1a]/45">{Math.round(a.size / 1024)} KB</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((arr) => arr.filter((x) => x.id !== a.id))}
                          aria-label="Remove"
                          className="ml-1 text-[#050a1a]/45 hover:text-[#2455FF]"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2.6} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="max-w-[920px] mx-auto glass-strong rounded-2xl p-2 pl-2 flex items-center gap-2">
                  {/* + attach */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf"
                    onChange={onFileChange}
                    className="hidden"
                    data-testid="studio-file-input"
                  />
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={attaching || pending || ready}
                    data-testid="studio-attach-btn"
                    aria-label="Attach a document"
                    className="h-10 w-10 rounded-xl bg-white/70 ring-1 ring-[#2455FF]/15 hover:ring-[#2455FF]/40 hover:bg-white flex items-center justify-center text-[#2455FF] transition disabled:opacity-50"
                    title="Attach a document (PDF, DOC, TXT — max 3 MB)"
                  >
                    {attaching ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={2.8} />
                    )}
                  </button>

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={ready ? "PRD ready — open preview on the right." : "Write your reply…"}
                    disabled={ready || pending}
                    data-testid="studio-input"
                    className="flex-1 min-w-0 bg-transparent outline-none font-sans text-[14.5px] text-[#050a1a] placeholder-[#050a1a]/35 py-2 px-1"
                  />
                  <button
                    type="submit"
                    disabled={ready || pending || !input.trim()}
                    data-testid="studio-send-btn"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 text-[13px] font-semibold transition"
                  >
                    <Send className="h-4 w-4" strokeWidth={2.6} />
                    Send
                  </button>
                </div>
                <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/40">
                  Lumi · powered by Claude · {LANGUAGES.find(l => l.code === lang)?.label} · docs only · max 3 MB
                </div>
              </form>
            </>
          )}

          {ready && prd && (
            <PRDPreview
              prd={prd}
              sessionId={session.id}
              onBack={() => setReady(false)}
              onSent={async (doc) => {
                await refreshDocs();
                await refreshSessions();
                setReady(false);
                setPrd(null);
                setViewerType("PRD");
                setViewerDoc(doc);
              }}
            />
          )}
        </main>
      </div>

      <DocViewer
        type={viewerType}
        document={viewerDoc}
        onClose={() => {
          setViewerType(null);
          setViewerDoc(null);
        }}
      />
    </div>
  );
};

export default Studio;
