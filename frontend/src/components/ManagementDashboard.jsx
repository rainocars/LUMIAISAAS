import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, BadgeIndianRupee, BriefcaseBusiness, CheckCircle2, ChevronRight,
  CircleDollarSign, ClipboardCheck, Code2, FileText, FolderKanban, LayoutDashboard,
  Loader2, LockKeyhole, LogOut, Menu, Plus, Search, ShieldCheck, Users, X,
  Settings, FileUp, HelpCircle, MessageSquare
} from "lucide-react";
import { managementApi as api, apiError } from "@/lib/managementApi";
import Sidebar from "./dashboard/Sidebar";
import AdminPanel from "./dashboard/AdminPanel";
import DeveloperPanel from "./dashboard/DeveloperPanel";
import ClientPanel from "./dashboard/ClientPanel";

const TOKEN = "lumi.management.token";
const USER = "lumi.management.user";

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      sessionStorage.setItem(TOKEN, data.accessToken);
      sessionStorage.setItem(USER, JSON.stringify(data.user));
      // Proactively save password for admin PRD endpoints if user is admin
      if (data.user.role === "SUPER_ADMIN") {
        sessionStorage.setItem("lumi.admin.pwd.v1", form.password);
      }
      onLogin(data.user);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bp-grid flex items-center justify-center p-5">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="glass-strong bracket relative w-full max-w-md rounded-2xl p-7"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-[#2455FF]/10 px-3 py-1.5 text-[#2455FF] ring-1 ring-[#2455FF]/20">
          <ShieldCheck size={15} />
          <span className="font-mono text-[10px] uppercase tracking-[.2em]">Secure workspace</span>
        </div>
        <h1 className="mt-5 font-cine text-4xl tracking-[.08em] text-[#050a1a]">Command Center</h1>
        <p className="mt-1 text-sm text-[#050a1a]/55">Projects, approvals and delivery—one controlled system.</p>
        
        <label className="mt-6 block text-xs font-semibold text-[#050a1a]">
          Work email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-2 w-full rounded-xl border bg-white/75 px-4 py-3 outline-none focus:ring-2 focus:ring-[#2455FF]/30 text-sm"
            placeholder="you@company.com"
          />
        </label>
        
        <label className="mt-4 block text-xs font-semibold text-[#050a1a]">
          Password
          <input
            required
            minLength={8}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-2 w-full rounded-xl border bg-white/75 px-4 py-3 outline-none focus:ring-2 focus:ring-[#2455FF]/30 text-sm"
          />
        </label>
        
        <button
          disabled={loading}
          type="submit"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2455FF] py-3 font-semibold text-white transition hover:bg-[#1a44e0] disabled:opacity-60 text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          <span>Sign in</span>
        </button>
        
        <a href="/" className="mt-4 block text-center font-mono text-[10px] uppercase tracking-[.2em] text-[#050a1a]/45 hover:text-[#2455ff] transition">
          ← LUMI AI
        </a>
      </motion.form>
    </main>
  );
}

export default function ManagementDashboard() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(USER));
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState("overview");
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState({
    summary: {},
    projects: [],
    people: [],
    finance: { invoices: [], payments: [], contracts: [] },
    activity: []
  });

  const nav = useMemo(() => {
    if (!user) return [];
    if (user.role === "SUPER_ADMIN") {
      return [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "prdManagement", label: "PRD Management", icon: FileText },
        { id: "sowManagement", label: "SOW Management", icon: FileText },
        { id: "clientCommunications", label: "Client Chat", icon: MessageSquare },
        { id: "developerCommunications", label: "Developer Chat", icon: MessageSquare },
        { id: "changeRequests", label: "Change Requests", icon: ClipboardCheck },
        { id: "documentApproval", label: "Document Approval", icon: CheckCircle2 },
        { id: "projects", label: "Projects", icon: FolderKanban },
        { id: "people", label: "People", icon: Users },
        { id: "finance", label: "Billing", icon: BadgeIndianRupee },
        { id: "activity", label: "Activity Logs", icon: Activity },
        { id: "settings", label: "Settings", icon: Settings }
      ];
    } else if (user.role === "DEVELOPER") {
      return [
        { id: "overview", label: "My Dashboard", icon: LayoutDashboard },
        { id: "projects", label: "My Projects", icon: FolderKanban },
        { id: "prds", label: "Assigned PRDs", icon: FileText },
        { id: "milestones", label: "Assigned Milestones", icon: ClipboardCheck },
        { id: "tasks", label: "Tasks", icon: ClipboardCheck },
        { id: "deliverables", label: "Deliverable Uploads", icon: FileUp },
        { id: "internalNotes", label: "Internal Notes", icon: Code2 },
        { id: "adminMessages", label: "Admin Messages", icon: MessageSquare },
        { id: "activity", label: "Activity", icon: Activity },
        { id: "settings", label: "Settings", icon: Settings }
      ];
    } else if (user.role === "CLIENT") {
      return [
        { id: "projects", label: "My Projects", icon: FolderKanban },
        { id: "prds", label: "PRD Viewer", icon: FileText },
        { id: "sowViewer", label: "SOW Viewer", icon: FileText },
        { id: "adminCommunications", label: "Admin Communication", icon: MessageSquare },
        { id: "changeRequests", label: "Change Requests", icon: ClipboardCheck },
        { id: "finance", label: "Billing", icon: BadgeIndianRupee },
        { id: "documents", label: "Documents", icon: FileUp },
        { id: "activity", label: "Activity", icon: Activity },
        { id: "settings", label: "Settings", icon: Settings }
      ];
    }
    return [];
  }, [user]);

  useEffect(() => {
    if (user) {
      if (user.role === "CLIENT") {
        setTab("projects");
      } else {
        setTab("overview");
      }
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!sessionStorage.getItem(TOKEN)) return;
    setLoading(true);
    try {
      const calls = [api.get("/dashboard"), api.get("/projects"), api.get("/activity")];
      if (user?.role === "SUPER_ADMIN") calls.push(api.get("/people"));
      if (user?.role !== "DEVELOPER") calls.push(api.get("/finance"));
      
      const rows = await Promise.all(calls);
      let i = 0;
      const next = {
        summary: rows[i++].data,
        projects: rows[i++].data,
        activity: rows[i++].data,
        people: [],
        finance: { invoices: [], payments: [], contracts: [] }
      };
      if (user?.role === "SUPER_ADMIN") next.people = rows[i++].data;
      if (user?.role !== "DEVELOPER") next.finance = rows[i++].data;
      
      setData(next);
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(apiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener("management-auth-expired", out);
    return () => window.removeEventListener("management-auth-expired", out);
  }, []);

  const logout = () => {
    sessionStorage.removeItem(TOKEN);
    sessionStorage.removeItem(USER);
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-[#f8faff] text-[#050a1a] flex overflow-hidden font-sans relative">
      {/* Background blueprint grid layers */}
      <div className="absolute inset-0 bp-grid pointer-events-none" aria-hidden="true" />

      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        nav={nav}
        activeTab={tab}
        setTab={setTab}
        mobileOpen={mobile}
        setMobileOpen={setMobile}
        onLogout={logout}
      />

      {/* Workspace Panel */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-[#2455FF]/10 bg-[#f8faff]/85 backdrop-blur-xl px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobile(true)} className="lg:hidden text-[#050a1a]/60">
              <Menu size={20} />
            </button>
            <div className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-[#050a1a]/40 sm:block">
              Lupus AI Labs · Delivery OS
            </div>
          </div>

          <div className="flex items-center gap-4">
            {loading && (
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-[#2455FF] tracking-wider">
                <Loader2 size={13} className="animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.15em] text-emerald-700 ring-1 ring-emerald-200">
              <LockKeyhole size={12} />
              <span>RBAC ACTIVE</span>
            </div>
          </div>
        </header>

        {/* Page Content Panel */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${user.role}-${tab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {user.role === "SUPER_ADMIN" && (
                <AdminPanel user={user} data={data} loadData={load} activeTab={tab} />
              )}
              {user.role === "DEVELOPER" && (
                <DeveloperPanel user={user} data={data} loadData={load} activeTab={tab} />
              )}
              {user.role === "CLIENT" && (
                <ClientPanel user={user} data={data} loadData={load} activeTab={tab} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
