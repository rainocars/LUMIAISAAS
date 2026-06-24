import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Users, FolderKanban, ClipboardCheck, CircleDollarSign, Plus, Search,
  Activity, Eye, ChevronRight, FileText, BadgeIndianRupee, LockKeyhole,
  CheckCircle2, PlusCircle, Settings, X, Calendar, UserPlus, FileUp, HelpCircle
} from "lucide-react";
import { managementApi as api, apiError } from "@/lib/managementApi";
import {
  GlassCard, MetricCard, GlowBadge, SectionTitle, EmptyState,
  FormField, FormSelect
} from "./UIElements";
import { RevenueChart, ProjectStatusChart } from "./Charts";

const money = (value = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const titleCase = (value = "") => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminPanel({ user, data, loadData, activeTab }) {
  const [adminPwd, setAdminPwd] = useState(() => sessionStorage.getItem("lumi.admin.pwd.v1") || "lumi2025");
  const [prdQueue, setPrdQueue] = useState([]);
  const [selectedPrd, setSelectedPrd] = useState(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(null); // 'CLIENT' | 'DEVELOPER'
  const [creatingFinance, setCreatingFinance] = useState(null); // 'invoice' | 'payment' | 'contract'
  const [peopleTab, setPeopleTab] = useState("developers"); // developers | clients

  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docForm, setDocForm] = useState({ type: "PRD", title: "", body_markdown: "", client_id: "", project_id: "", meta: {} });
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState([]);
  const [newComment, setNewComment] = useState("");

  const [activeCommUser, setActiveCommUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [forwardDevId, setForwardDevId] = useState("");
  const [forwardingMsgId, setForwardingMsgId] = useState("");
  const [customReplyTexts, setCustomReplyTexts] = useState({});

  useEffect(() => {
    if (!user?.id) return;
    const wsUrl = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000")
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    const ws = new WebSocket(`${wsUrl}/api/management/ws/${user.id}?role=${user.role}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE") {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [data.message, ...prev];
          });
        } else if (data.type === "MESSAGE_FORWARDED" || data.type === "MESSAGE_RESPONDED" || data.type === "MESSAGE_COMPLETED") {
          api.get("/messages")
            .then(res => setMessages(res.data || []))
            .catch(() => {});
        }
      } catch (e) {
        console.error("WebSocket message error", e);
      }
    };
    return () => ws.close();
  }, [user]);

  const [changeRequests, setChangeRequests] = useState([]);
  const [selectedCR, setSelectedCR] = useState(null);
  const [crForwardDevId, setCrForwardDevId] = useState("");
  const [crAdminComments, setCrAdminComments] = useState("");

  // Load Documents
  useEffect(() => {
    if (activeTab === "prdManagement" || activeTab === "sowManagement" || activeTab === "documentApproval") {
      api.get("/documents")
        .then(res => setDocuments(res.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Load Messages
  useEffect(() => {
    if (activeTab === "clientCommunications" || activeTab === "developerCommunications") {
      api.get("/messages")
        .then(res => setMessages(res.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Load Change Requests
  useEffect(() => {
    if (activeTab === "changeRequests") {
      api.get("/change-requests")
        .then(res => setChangeRequests(res.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Load Comments for selected document
  useEffect(() => {
    if (selectedDoc) {
      api.get(`/documents/${selectedDoc.id}/comments`)
        .then(res => setDocFeedback(res.data || []))
        .catch(() => {});
    }
  }, [selectedDoc]);


  // Load PRDs from admin intake queue
  useEffect(() => {
    if (activeTab === "prdQueue" || activeTab === "overview") {
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/prds`, { params: { password: adminPwd } })
        .then(res => setPrdQueue(res.data || []))
        .catch(() => {});
    }
  }, [activeTab, adminPwd]);

  // Project details refresh helper
  const handleProjectRefresh = async () => {
    await loadData();
    if (selectedProject) {
      const refreshed = data.projects.find(p => p.id === selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
      }
    }
  };

  // Stats definition
  const stats = [
    { label: "Active Projects", value: data.summary.activeProjects ?? 0, icon: FolderKanban, color: "#2455FF" },
    { label: "Active Clients", value: data.summary.activeClients ?? 0, icon: Users, color: "#2455FF" },
    { label: "Pending Reviews", value: data.summary.pendingReviews ?? 0, icon: ClipboardCheck, color: "#2455FF" },
    { label: "Revenue", value: money(data.summary.revenue ?? 0), icon: CircleDollarSign, color: "#2455FF" }
  ];

  // 1. Dashboard Overview Tab
  if (activeTab === "overview") {
    // Generate data for project status chart
    const projectStatusData = [
      { name: "Active", value: data.projects.filter(p => p.status === "ACTIVE").length },
      { name: "Intake", value: data.projects.filter(p => p.status === "INTAKE").length },
      { name: "Paused", value: data.projects.filter(p => p.status === "PAUSED").length },
      { name: "Closed", value: data.projects.filter(p => p.status === "CLOSED").length }
    ].filter(x => x.value > 0);

    return (
      <div className="space-y-6">
        <SectionTitle title={`Good to see you, ${user.name.split(" ")[0]}.`} subtitle="LUMI AI Admin Command Center Dashboard" />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, idx) => (
            <MetricCard key={s.label} {...s} delay={idx * 0.08} />
          ))}
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#050a1a]">Financial Growth</h3>
              <span className="font-mono text-[9px] text-[#2455ff] border border-[#2455ff]/15 rounded px-2 py-0.5">INR (₹)</span>
            </div>
            <RevenueChart />
          </GlassCard>

          <GlassCard hoverLift={false}>
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-[#050a1a]">Project Lifecycles</h3>
            </div>
            {projectStatusData.length > 0 ? (
              <ProjectStatusChart data={projectStatusData} />
            ) : (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-[#050a1a]/40">
                No active projects to display status.
              </div>
            )}
          </GlassCard>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Command Actions</h3>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => setCreatingProject(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-3 font-semibold text-sm transition"
              >
                <PlusCircle size={16} />
                <span>Create New Project</span>
              </button>
              <button
                onClick={() => setCreatingPerson("DEVELOPER")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2455FF]/15 bg-white hover:bg-slate-50 text-[#050a1a] py-3 text-sm font-semibold transition"
              >
                <UserPlus size={16} />
                <span>Onboard Developer</span>
              </button>
              <button
                onClick={() => setCreatingPerson("CLIENT")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2455FF]/15 bg-white hover:bg-slate-50 text-[#050a1a] py-3 text-sm font-semibold transition"
              >
                <Users size={16} />
                <span>Onboard Client</span>
              </button>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-2" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Recent Project Activity</h3>
            <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
              {data.activity.slice(0, 5).map((act) => (
                <div key={act.id} className="flex gap-4 items-start text-xs border-b border-[#2455ff]/8 pb-3.5 last:border-0 last:pb-0">
                  <div className="mt-0.5 rounded-full bg-[#2455FF]/10 p-1.5 text-[#2455FF]">
                    <Activity size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#050a1a]">{titleCase(act.action)}</div>
                    <div className="text-[10px] text-[#050a1a]/55 mt-0.5">
                      {act.userName} ({titleCase(act.role)})
                    </div>
                  </div>
                  <time className="text-[10px] text-slate-400 font-mono">{new Date(act.createdAt).toLocaleDateString()}</time>
                </div>
              ))}
              {data.activity.length === 0 && <EmptyState text="No activity logs found." />}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 2. PRD Intake Queue Tab
  if (activeTab === "prdQueue") {
    return (
      <div className="space-y-6">
        <SectionTitle title="PRD Intake Queue" subtitle="Verify and review requirements generated from user intake chats" />

        <GlassCard hoverLift={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2455ff]/10 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Project Title</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2455ff]/8">
                {prdQueue.map((prd) => (
                  <tr key={prd.id} className="hover:bg-[#2455FF]/5 text-xs text-[#050a1a]">
                    <td className="py-3.5 px-4 font-semibold text-[#050a1a]">{prd.client_name || "—"}</td>
                    <td className="py-3.5 px-4 text-slate-500">{prd.company || "—"}</td>
                    <td className="py-3.5 px-4 truncate max-w-[200px]">{prd.title}</td>
                    <td className="py-3.5 px-4 uppercase font-mono text-[10px] text-[#2455FF]">{prd.language || "en"}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{new Date(prd.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedPrd(prd)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2455FF] hover:bg-[#1a44e0] text-white px-3 py-1.5 font-semibold text-xs transition"
                      >
                        <Eye size={12} />
                        <span>Preview PRD</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {prdQueue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <EmptyState text="No intake PRDs currently available in queue." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* PRD Reader Slide-in Drawer */}
        <AnimatePresence>
          {selectedPrd && (
            <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#050a1a]/30 backdrop-blur-sm">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full w-full max-w-2xl bg-white border-l border-[#2455FF]/15 flex flex-col shadow-2xl p-6"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-4 mb-4">
                  <div>
                    <h3 className="font-cine text-2xl tracking-wider text-[#050a1a]">{selectedPrd.title}</h3>
                    <p className="text-[10px] text-[#2455FF] font-mono mt-1">Client: {selectedPrd.client_name}</p>
                  </div>
                  <button onClick={() => setSelectedPrd(null)} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bp-grid bp-wash p-5 rounded-xl border border-[#2455FF]/15 bg-white/70 text-[#050a1a] font-sans space-y-4">
                  {selectedPrd.body_markdown.split("\n").map((line, idx) => {
                    if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-2xl text-[#2455FF] mt-4 mb-2">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-lg text-[#050a1a] mt-3 mb-1 border-b border-slate-200 pb-1">{line.slice(3)}</h2>;
                    if (line.startsWith("---")) return <hr key={idx} className="border-[#2455ff]/15 my-4" />;
                    if (line.startsWith("**") && line.endsWith("**")) return <p key={idx} className="font-mono text-xs uppercase tracking-wider text-[#050a1a]/60 font-semibold">{line.replaceAll("**", "")}</p>;
                    if (!line.trim()) return <div key={idx} className="h-2" />;
                    return <p key={idx} className="text-xs leading-relaxed text-[#050a1a]/85">{line}</p>;
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 3. Projects Tab
  if (activeTab === "projects") {
    const filteredProjects = data.projects.filter(p => p.name.toLowerCase().includes(projectFilter.toLowerCase()));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle title="Projects Operations" subtitle="Coordinate active client builds, developer staffing, and deliveries" />
          <button
            onClick={() => setCreatingProject(true)}
            className="flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2.5 text-xs font-semibold transition"
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="Search projects by name..."
            className="w-full rounded-xl bg-white/70 border border-[#2455ff]/15 pl-10 pr-4 py-2.5 text-xs text-[#050a1a] outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition"
          />
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className="glass p-5 text-left rounded-2xl border border-[#2455FF]/10 hover:border-[#2455FF]/30 transition hover:-translate-y-0.5 w-full flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3 w-full">
                <div>
                  <h3 className="font-semibold text-[#050a1a] text-sm">{p.name}</h3>
                  <p className="mt-1.5 text-xs text-[#050a1a]/55 line-clamp-2 leading-relaxed">{p.description || "No project description provided."}</p>
                </div>
                <GlowBadge status={p.status} />
              </div>
              <div className="mt-5 flex items-end gap-4 w-full">
                <div className="flex-1">
                  <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider mb-1.5 text-slate-400">
                    <span>{p.approvedMilestones}/{p.totalMilestones} Approved</span>
                    <span className="text-[#2455FF] font-semibold">{p.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#2455FF]/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-[#2455FF] to-[#00E5FF] rounded-full"
                    />
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#2455FF] shrink-0" />
              </div>
            </button>
          ))}
          {filteredProjects.length === 0 && <div className="col-span-2"><EmptyState text="No projects found matching filter." /></div>}
        </div>

        {/* Project Details Modal */}
        <AnimatePresence>
          {selectedProject && (
            <ProjectDetailsModal
              project={selectedProject}
              onClose={() => setSelectedProject(null)}
              refresh={handleProjectRefresh}
              activity={data.activity}
              people={data.people}
            />
          )}
        </AnimatePresence>

        {/* Create Project Modal */}
        <AnimatePresence>
          {creatingProject && (
            <CreateProjectModal
              onClose={() => setCreatingProject(false)}
              onDone={loadData}
              people={data.people}
              prdQueue={prdQueue}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 4. People Directory Tab
  if (activeTab === "people") {
    const clients = data.people.filter(p => p.role === "CLIENT");
    const developers = data.people.filter(p => p.role === "DEVELOPER");
    const activePeople = peopleTab === "developers" ? developers : clients;

    const toggleStatus = async (personId, currentStatus) => {
      try {
        const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        await api.patch(`/people/${personId}/status`, null, { params: { status: nextStatus } });
        toast.success(`User state updated to ${nextStatus}`);
        loadData();
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle title="System Members Directory" subtitle="Manage account registrations, access control, and engineering capacities" />
          <button
            onClick={() => setCreatingPerson(peopleTab === "developers" ? "DEVELOPER" : "CLIENT")}
            className="flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2.5 text-xs font-semibold transition"
          >
            <Plus size={14} />
            <span>Add {peopleTab === "developers" ? "Developer" : "Client"}</span>
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex border-b border-[#2455FF]/10">
          <button
            onClick={() => setPeopleTab("developers")}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider border-b-2 font-semibold transition-all ${
              peopleTab === "developers" ? "border-[#2455FF] text-[#050a1a] bg-[#2455ff]/5" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Developers ({developers.length})
          </button>
          <button
            onClick={() => setPeopleTab("clients")}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-wider border-b-2 font-semibold transition-all ${
              peopleTab === "clients" ? "border-[#2455FF] text-[#050a1a] bg-[#2455ff]/5" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Clients ({clients.length})
          </button>
        </div>

        {/* Directory Table */}
        <GlassCard hoverLift={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2455ff]/10 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Name / Contact</th>
                  <th className="py-3 px-4">Organization</th>
                  {peopleTab === "developers" && <th className="py-3 px-4">Weekly Bandwidth</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2455ff]/5">
                {activePeople.map((person) => (
                  <tr key={person.id} className="hover:bg-[#2455FF]/5 text-xs text-[#050a1a]">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#050a1a]">{person.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{person.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{person.company || "—"}</td>
                    {peopleTab === "developers" && (
                      <td className="py-3.5 px-4 font-mono text-[#050a1a]">{person.capacity_hours || 40} hrs/week</td>
                    )}
                    <td className="py-3.5 px-4">
                      <GlowBadge status={person.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleStatus(person.id, person.status)}
                        className={`inline-flex items-center rounded-lg px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider font-semibold transition ${
                          person.status === "ACTIVE"
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100/50"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50"
                        }`}
                      >
                        {person.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {activePeople.length === 0 && (
                  <tr>
                    <td colSpan={peopleTab === "developers" ? 5 : 4} className="py-8 text-center">
                      <EmptyState text={`No ${peopleTab} currently registered.`} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Add Person Modal */}
        <AnimatePresence>
          {creatingPerson && (
            <CreatePersonModal
              role={creatingPerson}
              onClose={() => setCreatingPerson(null)}
              onDone={loadData}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 5. Billing & Finance Tab
  if (activeTab === "finance") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle title="Financial Records Console" subtitle="Track invoicing statuses, transactions, and commercial contracts" />
          <div className="flex gap-2">
            <button
              onClick={() => setCreatingFinance("invoice")}
              className="flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2.5 text-xs font-semibold transition"
            >
              <Plus size={14} />
              <span>Add Invoice</span>
            </button>
            <button
              onClick={() => setCreatingFinance("contract")}
              className="flex items-center gap-2 rounded-xl border border-[#2455FF]/15 bg-white text-[#050a1a] hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold transition"
            >
              <Plus size={14} />
              <span>Link Contract</span>
            </button>
          </div>
        </div>

        {/* Finance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoices */}
          <GlassCard hoverLift={false}>
            <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3 mb-4">
              <h3 className="font-semibold text-sm text-[#050a1a]">Invoices</h3>
              <GlowBadge status="Pending" />
            </div>
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {data.finance.invoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-[#2455FF]/10 bg-white/50 p-3.5 flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold text-[#050a1a]">{money(inv.amount)}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {inv.reference || "None"}</div>
                  </div>
                  <GlowBadge status={inv.status} />
                </div>
              ))}
              {data.finance.invoices.length === 0 && <EmptyState text="No invoices created yet." />}
            </div>
          </GlassCard>

          {/* Payments */}
          <GlassCard hoverLift={false}>
            <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3 mb-4">
              <h3 className="font-semibold text-sm text-[#050a1a]">Payments</h3>
              <GlowBadge status="PAID" />
            </div>
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {data.finance.payments.map((pmt) => (
                <div key={pmt.id} className="rounded-xl border border-[#2455FF]/10 bg-white/50 p-3.5 flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold text-[#050a1a]">{money(pmt.amount)}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {pmt.reference || "None"}</div>
                  </div>
                  <GlowBadge status={pmt.status} />
                </div>
              ))}
              {data.finance.payments.length === 0 && <EmptyState text="No transactions logged yet." />}
            </div>
          </GlassCard>

          {/* Contracts */}
          <GlassCard hoverLift={false}>
            <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3 mb-4">
              <h3 className="font-semibold text-sm text-[#050a1a]">SOW Contracts</h3>
              <GlowBadge status="ACTIVE" />
            </div>
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {data.finance.contracts.map((cnt) => (
                <div key={cnt.id} className="rounded-xl border border-[#2455FF]/10 bg-white/50 p-3.5 flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold text-[#050a1a]">{money(cnt.amount)}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {cnt.reference || "None"}</div>
                  </div>
                  <GlowBadge status={cnt.status} />
                </div>
              ))}
              {data.finance.contracts.length === 0 && <EmptyState text="No active contracts linked." />}
            </div>
          </GlassCard>
        </div>

        {/* Create Finance Modal */}
        <AnimatePresence>
          {creatingFinance && (
            <CreateFinanceModal
              type={creatingFinance}
              onClose={() => setCreatingFinance(null)}
              onDone={loadData}
              projects={data.projects}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 6. Activity logs Tab
  if (activeTab === "activity") {
    return (
      <div className="space-y-6">
        <SectionTitle title="System Activity Logs" subtitle="Immutable, cryptographic history trail of delivery updates and approvals" />

        <GlassCard hoverLift={false}>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {data.activity.map((act) => (
              <div key={act.id} className="flex gap-4 items-start text-xs border-b border-[#2455ff]/8 pb-3.5 last:border-0 last:pb-0">
                <div className="mt-0.5 rounded-full bg-[#2455FF]/10 p-2 text-[#2455FF]">
                  <Activity size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#050a1a]">{titleCase(act.action)}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Actor: {act.userName} · Role: <span className="text-[#2455FF] font-mono text-[10px] uppercase font-semibold">{act.role}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">Entity ID: {act.entityId} ({act.entityType})</div>
                </div>
                <time className="text-xs text-slate-400 font-mono mt-0.5">{new Date(act.createdAt).toLocaleString()}</time>
              </div>
            ))}
            {data.activity.length === 0 && <EmptyState text="No activity records." />}
          </div>
        </GlassCard>
      </div>
    );
  }

  const loadDocs = () => {
    api.get("/documents")
      .then(res => setDocuments(res.data || []))
      .catch(() => {});
  };

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...docForm,
        client_id: docForm.client_id || null,
        project_id: docForm.project_id || null
      };
      await api.post("/documents", payload);
      toast.success(`${docForm.type} created successfully`);
      setDocForm({ type: "PRD", title: "", body_markdown: "", client_id: "", project_id: "", meta: {} });
      loadDocs();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleUpdateDoc = async (e) => {
    e.preventDefault();
    if (!selectedDoc) return;
    try {
      const payload = {
        title: docForm.title,
        body_markdown: docForm.body_markdown,
        meta: docForm.meta
      };
      await api.patch(`/documents/${selectedDoc.id}`, payload);
      toast.success("Document updated successfully");
      setIsEditingDoc(false);
      setSelectedDoc(null);
      loadDocs();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleLockDoc = async (docId, locked) => {
    try {
      await api.patch(`/documents/${docId}`, { locked });
      toast.success(locked ? "Version locked" : "Version unlocked (incremented)");
      loadDocs();
      if (selectedDoc?.id === docId) {
        const refreshed = await api.get(`/documents/${docId}`);
        setSelectedDoc(refreshed.data);
      }
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleDocStatus = async (docId, status) => {
    try {
      await api.patch(`/documents/${docId}`, { status });
      toast.success(`Document status updated to ${status}`);
      loadDocs();
      if (selectedDoc?.id === docId) {
        const refreshed = await api.get(`/documents/${docId}`);
        setSelectedDoc(refreshed.data);
      }
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleSendComment = async (e, isClarification) => {
    e.preventDefault();
    if (!selectedDoc || !newComment.trim()) return;
    try {
      await api.post(`/documents/${selectedDoc.id}/comments`, {
        content: newComment,
        is_clarification: isClarification
      });
      toast.success(isClarification ? "Clarification reply posted" : "Internal comment added");
      setNewComment("");
      const comms = await api.get(`/documents/${selectedDoc.id}/comments`);
      setDocFeedback(comms.data || []);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const loadMessages = () => {
    api.get("/messages")
      .then(res => setMessages(res.data || []))
      .catch(() => {});
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activeCommUser || !newMessageText.trim()) return;
    try {
      await api.post("/messages", {
        receiver_id: activeCommUser.id,
        message_text: newMessageText.trim()
      });
      toast.success("Message sent");
      setNewMessageText("");
      loadMessages();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleForwardMsg = async (msgId, devId) => {
    try {
      await api.post(`/messages/${msgId}/forward`, null, { params: { developer_id: devId } });
      toast.success("Message forwarded to developer");
      setForwardingMsgId("");
      setForwardDevId("");
      loadMessages();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleSendFinalReply = async (msgId, text) => {
    try {
      await api.post(`/messages/${msgId}/send-final`, {
        receiver_id: "",
        message_text: text
      });
      toast.success("Final reply sent to client");
      setCustomReplyTexts(prev => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      loadMessages();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const loadChangeRequests = () => {
    api.get("/change-requests")
      .then(res => setChangeRequests(res.data || []))
      .catch(() => {});
  };

  const handleForwardCR = async (crId, devId) => {
    try {
      await api.post(`/change-requests/${crId}/forward-dev`, null, { params: { developer_id: devId } });
      toast.success("Forwarded to developer for estimation");
      setCrForwardDevId("");
      setSelectedCR(null);
      loadChangeRequests();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleCRAdminDecision = async (crId, approved) => {
    try {
      await api.post(`/change-requests/${crId}/admin-decision`, {
        approved,
        comments: crAdminComments
      });
      toast.success(approved ? "Approved change request" : "Rejected change request");
      setCrAdminComments("");
      setSelectedCR(null);
      loadChangeRequests();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleCRStartDev = async (crId) => {
    try {
      await api.post(`/change-requests/${crId}/start-dev`);
      toast.success("Development started");
      setSelectedCR(null);
      loadChangeRequests();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // 2. PRD Management Tab
  if (activeTab === "prdManagement") {
    const prds = documents.filter(d => d.type === "PRD");
    const clients = data.people.filter(p => p.role === "CLIENT");
    const activeProjects = data.projects.filter(p => p.status === "ACTIVE");

    return (
      <div className="space-y-6">
        <SectionTitle title="Product Requirements (PRD) Operations" subtitle="Establish business goals, feature metrics, and release specifications" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of PRDs */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-[#050a1a] text-sm mb-4">PRD Documents</h3>
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {prds.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsEditingDoc(false);
                    setDocForm({
                      type: doc.type,
                      title: doc.title,
                      body_markdown: doc.body_markdown,
                      client_id: doc.user_id,
                      project_id: doc.project_id || "",
                      meta: doc.meta || {}
                    });
                  }}
                  className={`w-full p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedDoc?.id === doc.id
                      ? "border-[#2455FF] bg-[#2455FF]/5"
                      : "border-[#2455FF]/10 bg-white/70 hover:border-[#2455FF]/20"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-semibold text-xs text-[#050a1a]">{doc.title}</span>
                    <GlowBadge status={doc.status.toUpperCase()} />
                  </div>
                  <div className="mt-3.5 flex items-center justify-between text-[10px] text-slate-400 font-mono w-full">
                    <span>v{doc.version || 1} {doc.locked && "🔒 Locked"}</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
              {prds.length === 0 && <EmptyState text="No PRDs currently managed." />}
            </div>
          </GlassCard>

          {/* Details / Create Panel */}
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            {selectedDoc && !isEditingDoc ? (
              <div className="space-y-5">
                <div className="flex justify-between items-start border-b border-[#2455ff]/10 pb-4">
                  <div>
                    <h3 className="font-cine text-2xl text-[#050a1a] tracking-wider">{selectedDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1.5">PRD ID: {selectedDoc.id} · Version {selectedDoc.version || 1}</p>
                  </div>
                  <div className="flex gap-2">
                    {!selectedDoc.locked && (
                      <button
                        onClick={() => setIsEditingDoc(true)}
                        className="rounded-xl border border-[#2455FF]/15 px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
                      >
                        Edit specs
                      </button>
                    )}
                    <button
                      onClick={() => handleLockDoc(selectedDoc.id, !selectedDoc.locked)}
                      className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition ${
                        selectedDoc.locked ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {selectedDoc.locked ? "Unlock (Inc Version)" : "Lock Version"}
                    </button>
                    <button
                      onClick={() => handleDocStatus(selectedDoc.id, "approved")}
                      disabled={selectedDoc.status === "approved"}
                      className="rounded-xl bg-[#2455FF] text-white px-4 py-2 text-xs font-semibold hover:bg-[#1a44e0] disabled:opacity-50 transition"
                    >
                      Approve Spec
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#2455ff]/12 bg-[#2455ff]/5 p-4 text-xs font-mono">
                  <strong>PRD Document Specs Status</strong>: <GlowBadge status={selectedDoc.status.toUpperCase()} />
                </div>

                {/* Body Preview */}
                <div className="prose max-w-none text-xs leading-relaxed text-[#050a1a]/85 border border-[#2455ff]/10 rounded-xl p-4 bg-white/50 max-h-[300px] overflow-y-auto">
                  {selectedDoc.body_markdown.split("\n").map((line, idx) => {
                    if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-lg text-[#2455FF] mt-2 mb-1">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-sm text-[#050a1a] mt-2 mb-1 border-b border-slate-100 pb-0.5">{line.slice(3)}</h2>;
                    if (line.startsWith("---")) return <hr key={idx} className="border-[#2455ff]/15 my-2" />;
                    if (!line.trim()) return <div key={idx} className="h-1.5" />;
                    return <p key={idx} className="mb-1">{line}</p>;
                  })}
                </div>

                {/* Dual Feedback Sections (partitioned internal / clarifications) */}
                <div className="border-t border-[#2455ff]/10 pt-4 space-y-4">
                  <h4 className="font-semibold text-[#050a1a] text-sm">PRD Feedback Threads</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Internal Developer Comments */}
                    <div className="border border-[#2455FF]/10 rounded-xl p-3.5 bg-slate-50 space-y-2 flex flex-col justify-between h-[280px]">
                      <div className="font-semibold text-xs text-[#2455FF]">Internal Developer Discussion</div>
                      <div className="flex-1 overflow-y-auto space-y-2 my-2 text-[10px]">
                        {docFeedback.filter(c => !c.is_clarification).map(c => (
                          <div key={c.id} className="border-b border-slate-200/50 pb-1.5">
                            <span className="font-semibold">{c.author_name} ({c.author_role})</span>: {c.content}
                          </div>
                        ))}
                        {docFeedback.filter(c => !c.is_clarification).length === 0 && <span className="text-slate-400">No developer notes.</span>}
                      </div>
                      <form onSubmit={(e) => handleSendComment(e, false)} className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Type internal developer comment..."
                          className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-[10px]"
                        />
                        <button type="submit" className="rounded-lg bg-[#2455FF] text-white px-3 text-[10px]">Send</button>
                      </form>
                    </div>

                    {/* Client Clarifications */}
                    <div className="border border-[#2455FF]/10 rounded-xl p-3.5 bg-slate-50 space-y-2 flex flex-col justify-between h-[280px]">
                      <div className="font-semibold text-xs text-[#2455FF]">Client Clarification Requests</div>
                      <div className="flex-1 overflow-y-auto space-y-2 my-2 text-[10px]">
                        {docFeedback.filter(c => c.is_clarification).map(c => (
                          <div key={c.id} className="border-b border-slate-200/50 pb-1.5">
                            <span className="font-semibold">{c.author_name} ({c.author_role})</span>: {c.content}
                          </div>
                        ))}
                        {docFeedback.filter(c => c.is_clarification).length === 0 && <span className="text-slate-400">No client clarifications.</span>}
                      </div>
                      <form onSubmit={(e) => handleSendComment(e, true)} className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Type response to client..."
                          className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-[10px]"
                        />
                        <button type="submit" className="rounded-lg bg-[#2455FF] text-white px-3 text-[10px]">Reply</button>
                      </form>
                    </div>
                  </div>
                </div>

                <button onClick={() => setSelectedDoc(null)} className="text-xs text-[#2455FF] underline">← Back to Create Form</button>
              </div>
            ) : (
              <form onSubmit={isEditingDoc ? handleUpdateDoc : handleCreateDoc} className="space-y-4">
                <h3 className="font-semibold text-[#050a1a] text-sm border-b border-[#2455ff]/10 pb-2">
                  {isEditingDoc ? `Modify spec version for: ${selectedDoc.title}` : "Author New Project Requirements (PRD)"}
                </h3>

                <FormField label="PRD Project Title" value={docForm.title} onChange={(v) => setDocForm({ ...docForm, title: v })} required />
                
                <FormSelect label="Associate Client" value={docForm.client_id} onChange={(e) => setDocForm({ ...docForm, client_id: e.target.value })} required>
                  <option value="">Select client organization</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </FormSelect>

                <FormSelect label="Associate Project" value={docForm.project_id} onChange={(e) => setDocForm({ ...docForm, project_id: e.target.value })}>
                  <option value="">Link project workspace (Optional)</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </FormSelect>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#050a1a]">Detailed Requirement Specs (Markdown format)</label>
                  <textarea
                    value={docForm.body_markdown}
                    onChange={(e) => setDocForm({ ...docForm, body_markdown: e.target.value })}
                    placeholder="# Project Requirements Document&#10;&#10;## 1. Business Goals&#10;Describe goals here...&#10;&#10;## 2. Scope & Key Features&#10;List features here..."
                    className="w-full h-48 rounded-xl border bg-white/75 p-3 text-xs outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition text-[#050a1a] font-mono"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-xl bg-[#2455FF] text-white py-3 font-semibold text-sm hover:bg-[#1a44e0] transition">
                    {isEditingDoc ? "Update PRD Version" : "Author PRD"}
                  </button>
                  {isEditingDoc && (
                    <button type="button" onClick={() => { setIsEditingDoc(false); setSelectedDoc(null); }} className="rounded-xl border px-5 py-3 text-xs font-semibold">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 3. SOW Management Tab
  if (activeTab === "sowManagement") {
    const sows = documents.filter(d => d.type === "SOW");
    const clients = data.people.filter(p => p.role === "CLIENT");
    const activeProjects = data.projects.filter(p => p.status === "ACTIVE");

    return (
      <div className="space-y-6">
        <SectionTitle title="Statement of Work (SOW) Contracts" subtitle="Prepare timeline delivery roadmaps,Payment terms, and profitability bounds" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of SOWs */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-[#050a1a] text-sm mb-4">SOW Documents</h3>
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {sows.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsEditingDoc(false);
                    setDocForm({
                      type: doc.type,
                      title: doc.title,
                      body_markdown: doc.body_markdown,
                      client_id: doc.user_id,
                      project_id: doc.project_id || "",
                      meta: doc.meta || {}
                    });
                  }}
                  className={`w-full p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedDoc?.id === doc.id
                      ? "border-[#2455FF] bg-[#2455FF]/5"
                      : "border-[#2455FF]/10 bg-white/70 hover:border-[#2455FF]/20"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-semibold text-xs text-[#050a1a]">{doc.title}</span>
                    <GlowBadge status={doc.status.toUpperCase()} />
                  </div>
                  <div className="mt-3.5 flex items-center justify-between text-[10px] text-slate-400 font-mono w-full">
                    <span>INR: {money(doc.meta?.cost || 0)}</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
              {sows.length === 0 && <EmptyState text="No SOW contracts linked." />}
            </div>
          </GlassCard>

          {/* Details / Create Panel */}
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            {selectedDoc && !isEditingDoc ? (
              <div className="space-y-5">
                <div className="flex justify-between items-start border-b border-[#2455ff]/10 pb-4">
                  <div>
                    <h3 className="font-cine text-2xl text-[#050a1a] tracking-wider">{selectedDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1.5">SOW ID: {selectedDoc.id} · v{selectedDoc.version || 1}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDocStatus(selectedDoc.id, "sent_to_client")}
                      disabled={selectedDoc.status === "sent_to_client" || selectedDoc.status === "approved"}
                      className="rounded-xl border border-[#2455FF]/15 px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      Send SOW to Client
                    </button>
                    <button
                      onClick={() => handleDocStatus(selectedDoc.id, "approved")}
                      disabled={selectedDoc.status === "approved"}
                      className="rounded-xl bg-[#2455FF] text-white px-4 py-2 text-xs font-semibold hover:bg-[#1a44e0] transition"
                    >
                      Approve SOW
                    </button>
                    <button
                      onClick={() => handleDocStatus(selectedDoc.id, "archived")}
                      className="rounded-xl border border-rose-500/20 bg-rose-50 hover:bg-rose-100/50 text-rose-700 px-4 py-2 text-xs font-semibold transition"
                    >
                      Archive
                    </button>
                  </div>
                </div>

                {/* SOW Metrics Details Panel */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-[#2455ff]/10 bg-slate-50 p-4 text-xs font-mono">
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Cost Value</span>
                    <strong className="text-emerald-700">{money(selectedDoc.meta?.cost || 0)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Contract Value</span>
                    <strong className="text-slate-700">{money(selectedDoc.meta?.contract_value || 0)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Profit Margin</span>
                    <strong className="text-[#2455FF]">{selectedDoc.meta?.profit_margins || "—"}%</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Duration</span>
                    <strong>{selectedDoc.meta?.project_duration || "—"} Days</strong>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[#050a1a]/85 leading-relaxed">
                  <div><strong>Timeline Roadmap</strong>: {selectedDoc.meta?.timeline || "—"}</div>
                  <div><strong>Milestones Breakdown</strong>: {selectedDoc.meta?.milestones || "—"}</div>
                  <div><strong>Payment Conditions</strong>: {selectedDoc.meta?.payment_terms || "—"}</div>
                  <div><strong>Support Terms</strong>: {selectedDoc.meta?.support_terms || "—"}</div>
                </div>

                {/* Body Preview */}
                <div className="prose max-w-none text-xs leading-relaxed text-[#050a1a]/85 border border-[#2455ff]/10 rounded-xl p-4 bg-white/50 max-h-[300px] overflow-y-auto">
                  {selectedDoc.body_markdown.split("\n").map((line, idx) => {
                    if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-lg text-[#2455FF] mt-2 mb-1">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-sm text-[#050a1a] mt-2 mb-1 border-b border-slate-200 pb-0.5">{line.slice(3)}</h2>;
                    if (!line.trim()) return <div key={idx} className="h-1.5" />;
                    return <p key={idx} className="mb-1">{line}</p>;
                  })}
                </div>

                <button onClick={() => setSelectedDoc(null)} className="text-xs text-[#2455FF] underline">← Back to Create Form</button>
              </div>
            ) : (
              <form onSubmit={handleCreateDoc} className="space-y-4 text-xs">
                <h3 className="font-semibold text-[#050a1a] text-sm border-b border-[#2455ff]/10 pb-2">
                  Draft New Statement of Work (SOW) Contract
                </h3>

                <FormField label="SOW Title" value={docForm.title} onChange={(v) => setDocForm({ ...docForm, title: v })} required />

                <div className="grid grid-cols-2 gap-3">
                  <FormSelect label="Associate Client" value={docForm.client_id} onChange={(e) => setDocForm({ ...docForm, client_id: e.target.value })} required>
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </FormSelect>

                  <FormSelect label="Associate Project" value={docForm.project_id} onChange={(e) => setDocForm({ ...docForm, project_id: e.target.value })}>
                    <option value="">Select Project</option>
                    {activeProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </FormSelect>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <FormField label="Pricing Cost (INR)" type="number" value={docForm.meta?.cost || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, cost: parseFloat(v) } })} required />
                  <FormField label="Contract Value (INR)" type="number" value={docForm.meta?.contract_value || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, contract_value: parseFloat(v) } })} required />
                  <FormField label="Profit Margins (%)" type="number" value={docForm.meta?.profit_margins || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, profit_margins: parseFloat(v) } })} required />
                  <FormField label="Project Duration (days)" type="number" value={docForm.meta?.project_duration || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, project_duration: parseInt(v) } })} required />
                </div>

                <FormField label="Delivery Timeline" value={docForm.meta?.timeline || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, timeline: v } })} placeholder="Define timeline scope..." required />
                <FormField label="Milestones Details" value={docForm.meta?.milestones || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, milestones: v } })} placeholder="Outline key milestones deliverables..." required />
                <FormField label="Payment Terms" value={docForm.meta?.payment_terms || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, payment_terms: v } })} placeholder="e.g. 50% upfront, 50% complete..." required />
                <FormField label="Support / Service Terms" value={docForm.meta?.support_terms || ""} onChange={(v) => setDocForm({ ...docForm, meta: { ...docForm.meta, support_terms: v } })} placeholder="e.g. 30 days post-launch support..." required />

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#050a1a]">Additional Contract Terms (Markdown format)</label>
                  <textarea
                    value={docForm.body_markdown}
                    onChange={(e) => setDocForm({ ...docForm, body_markdown: e.target.value })}
                    placeholder="# Statement of Work Agreement&#10;&#10;## 1. Terms of engagement..."
                    className="w-full h-32 rounded-xl border bg-white/75 p-3 text-xs outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition text-[#050a1a] font-mono"
                    required
                  />
                </div>

                <button type="submit" className="w-full rounded-xl bg-[#2455FF] text-white py-3 font-semibold text-sm hover:bg-[#1a44e0] transition">
                  Author SOW Contract
                </button>
              </form>
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 4. Client Communications Tab
  if (activeTab === "clientCommunications") {
    const clients = data.people.filter(p => p.role === "CLIENT");
    const activeMessages = messages.filter(m => 
      activeCommUser && (
        (m.sender_id === activeCommUser.id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === activeCommUser.id)
      )
    ).reverse();

    const devs = data.people.filter(p => p.role === "DEVELOPER");

    return (
      <div className="space-y-6">
        <SectionTitle title="Client Communications Command Center" subtitle="Directly message clients and coordinate responses with engineering staff" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client List */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Clients Directory</h3>
            <div className="space-y-2">
              {clients.map(c => {
                const latestMsg = messages.find(m => m.sender_id === c.id || m.receiver_id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCommUser(c)}
                    className={`w-full p-3 rounded-xl border text-left transition flex flex-col space-y-1 ${
                      activeCommUser?.id === c.id ? "border-[#2455FF] bg-[#2455FF]/5" : "border-slate-100 hover:bg-slate-50 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-xs text-[#050a1a]">{c.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{c.company}</div>
                    {latestMsg && (
                      <div className="text-[10px] text-[#2455ff] mt-1.5 truncate max-w-full">
                        "{latestMsg.message_text}"
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Chat thread */}
          <GlassCard className="lg:col-span-2 flex flex-col h-[520px] justify-between p-4" hoverLift={false}>
            {activeCommUser ? (
              <div className="flex flex-col h-full justify-between">
                <div className="border-b border-[#2455ff]/10 pb-3 mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[#050a1a] text-xs">{activeCommUser.name} chat</h4>
                    <span className="text-[9px] text-[#2455FF] font-mono">{activeCommUser.company}</span>
                  </div>
                </div>

                {/* Messages log */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
                  {activeMessages.map(m => {
                    const isClientMsg = m.sender_role === "CLIENT";
                    const isForwarded = m.status === "forwarded";
                    const hasResponse = m.status === "responded";
                    const isCompleted = m.status === "completed";
                    
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className={`flex ${isClientMsg ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                            isClientMsg 
                              ? "bg-slate-100 border border-slate-200 text-[#050a1a] rounded-bl-none" 
                              : "bg-[#2455FF] text-white rounded-br-none"
                          }`}>
                            <div className="font-semibold text-[9px] text-slate-400 mb-1">{m.sender_name}</div>
                            {m.message_text}
                          </div>
                        </div>

                        {/* Hierarchy operations overlay (shown for Client messages only) */}
                        {isClientMsg && !isCompleted && (
                          <div className="ml-8 mt-1.5 flex flex-col gap-2 rounded-xl bg-slate-50 border p-3 text-[10px]">
                            {!(isForwarded || hasResponse) && (
                              <div className="flex gap-2 items-center">
                                <span className="text-slate-400 font-mono">Routing Option:</span>
                                <FormSelect
                                  value={forwardDevId}
                                  onChange={(e) => setForwardDevId(e.target.value)}
                                  className="w-36 text-[10px] py-1"
                                >
                                  <option value="">Forward to Dev</option>
                                  {devs.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </FormSelect>
                                <button
                                  onClick={() => handleForwardMsg(m.id, forwardDevId)}
                                  disabled={!forwardDevId}
                                  className="bg-[#2455FF] text-white rounded px-2.5 py-1 text-[9px] font-semibold"
                                >
                                  Forward
                                </button>
                              </div>
                            )}

                            {isForwarded && (
                              <span className="font-mono text-[#2455FF] italic">Awaiting response from assigned developer...</span>
                            )}

                            {hasResponse && (
                              <div className="space-y-2">
                                <div className="bg-emerald-50 text-emerald-800 p-2 rounded border border-emerald-200">
                                  <strong>Developer response:</strong> "{m.developer_response_text}"
                                </div>
                                <textarea
                                  value={customReplyTexts[m.id] ?? m.developer_response_text}
                                  onChange={(e) => {
                                    const nextText = e.target.value;
                                    setCustomReplyTexts(prev => ({ ...prev, [m.id]: nextText }));
                                  }}
                                  className="w-full rounded border p-2 text-[10px] bg-white"
                                  placeholder="Review / Edit Developer response..."
                                />
                                <button
                                  onClick={() => handleSendFinalReply(m.id, customReplyTexts[m.id] ?? m.developer_response_text)}
                                  className="bg-emerald-600 text-white rounded px-3 py-1.5 font-semibold text-[9px]"
                                >
                                  Approve & Send Final Response to Client
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Input area */}
                <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-[#2455ff]/10 pt-3">
                  <input
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Type direct response to client..."
                    className="flex-1 rounded-xl border bg-white/75 px-3 py-2 text-xs outline-none"
                  />
                  <button type="submit" className="rounded-xl bg-[#2455FF] text-white px-4 text-xs font-semibold">Send</button>
                </form>
              </div>
            ) : (
              <EmptyState text="Select a client from directory to open active communications." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 5. Developer Communications Tab
  if (activeTab === "developerCommunications") {
    const developers = data.people.filter(p => p.role === "DEVELOPER");
    const activeMessages = messages.filter(m => 
      activeCommUser && (
        (m.sender_id === activeCommUser.id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === activeCommUser.id)
      )
    ).reverse();

    return (
      <div className="space-y-6">
        <SectionTitle title="Developer Communications Center" subtitle="Directly message your engineering team regarding sprints and deliverables" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dev Directory */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Developers Directory</h3>
            <div className="space-y-2">
              {developers.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveCommUser(d)}
                  className={`w-full p-3 rounded-xl border text-left transition flex flex-col space-y-1 ${
                    activeCommUser?.id === d.id ? "border-[#2455FF] bg-[#2455FF]/5" : "border-slate-100 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="font-semibold text-xs text-[#050a1a]">{d.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{d.capacity_hours} hrs/week limit</div>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Chat thread */}
          <GlassCard className="lg:col-span-2 flex flex-col h-[520px] justify-between p-4" hoverLift={false}>
            {activeCommUser ? (
              <div className="flex flex-col h-full justify-between">
                <div className="border-b border-[#2455ff]/10 pb-3 mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[#050a1a] text-xs">{activeCommUser.name} chat</h4>
                    <span className="text-[9px] text-[#2455FF] font-mono">{activeCommUser.email}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
                  {activeMessages.map(m => {
                    const isDevMsg = m.sender_role === "DEVELOPER";
                    return (
                      <div key={m.id} className={`flex ${isDevMsg ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                          isDevMsg 
                            ? "bg-slate-100 border border-slate-200 text-[#050a1a] rounded-bl-none" 
                            : "bg-[#2455FF] text-white rounded-br-none"
                        }`}>
                          <div className="font-semibold text-[9px] text-slate-400 mb-1">{m.sender_name}</div>
                          {m.message_text}
                          {m.status === "forwarded" && (
                            <div className="mt-2 text-[9px] text-amber-600 font-mono uppercase font-semibold">
                              FORWARDED CLIENT REQUEST
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-[#2455ff]/10 pt-3">
                  <input
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Type message to developer..."
                    className="flex-1 rounded-xl border bg-white/75 px-3 py-2 text-xs outline-none"
                  />
                  <button type="submit" className="rounded-xl bg-[#2455FF] text-white px-4 text-xs font-semibold">Send</button>
                </form>
              </div>
            ) : (
              <EmptyState text="Select a developer from directory to open active communications." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 6. Change Request Queue Tab
  if (activeTab === "changeRequests") {
    const devs = data.people.filter(p => p.role === "DEVELOPER");

    return (
      <div className="space-y-6">
        <SectionTitle title="Client Change Request Operations" subtitle="Assess developer estimations, timeline requests, and approve modifications" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Requests list */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Change Request Queue</h3>
            <div className="space-y-3">
              {changeRequests.map(cr => (
                <button
                  key={cr.id}
                  onClick={() => setSelectedCR(cr)}
                  className={`w-full p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedCR?.id === cr.id
                      ? "border-[#2455FF] bg-[#2455FF]/5"
                      : "border-slate-100 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start w-full mb-2">
                    <span className="font-semibold text-xs text-[#050a1a]">{cr.title}</span>
                    <GlowBadge status={cr.status.toUpperCase()} />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono w-full flex justify-between">
                    <span>Project: {cr.project_name}</span>
                    <span>{new Date(cr.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
              {changeRequests.length === 0 && <EmptyState text="No change requests registered." />}
            </div>
          </GlassCard>

          {/* Details & actions */}
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            {selectedCR ? (
              <div className="space-y-5">
                <div className="border-b border-[#2455ff]/10 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-cine text-xl text-[#050a1a] tracking-wider">{selectedCR.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Request ID: {selectedCR.id}</p>
                  </div>
                  <GlowBadge status={selectedCR.status.toUpperCase()} />
                </div>

                <div className="space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">Request Description</span>
                  <p className="text-xs text-[#050a1a]/85 leading-relaxed bg-white border border-[#2455ff]/10 p-3 rounded-xl">
                    {selectedCR.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Client Organization</span>
                    <strong>{selectedCR.client_name}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[9px] uppercase">Staged Project Workspace</span>
                    <strong>{selectedCR.project_name}</strong>
                  </div>
                </div>

                <div className="border-t border-[#2455ff]/10 pt-4 space-y-4">
                  <h4 className="font-semibold text-xs text-[#2455FF] font-mono uppercase tracking-wider">Change Request Operations Console</h4>
                  
                  {/* Step 1: Forward to Dev for Estimation */}
                  {selectedCR.status === "submitted" && (
                    <div className="rounded-xl border p-4 bg-slate-50 space-y-3">
                      <div className="font-semibold text-[10px] uppercase text-slate-500">Route to Engineer for Resource Estimation</div>
                      <div className="flex gap-2">
                        <FormSelect
                          value={crForwardDevId}
                          onChange={(e) => setCrForwardDevId(e.target.value)}
                          className="text-xs max-w-sm"
                        >
                          <option value="">Select Developer</option>
                          {devs.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </FormSelect>
                        <button
                          onClick={() => handleForwardCR(selectedCR.id, crForwardDevId)}
                          disabled={!crForwardDevId}
                          className="rounded-xl bg-[#2455FF] text-white px-4 py-2 text-xs font-semibold hover:bg-[#1a44e0] disabled:opacity-50"
                        >
                          Forward Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Dev Estimating */}
                  {selectedCR.status === "under_dev_estimation" && (
                    <span className="font-mono text-amber-600 italic block text-xs">
                      Awaiting technical estimation notes and hours from the assigned developer...
                    </span>
                  )}

                  {/* Step 3: Admin review estimation */}
                  {selectedCR.status === "dev_estimated" && (
                    <div className="rounded-xl border p-4 bg-slate-50 space-y-4">
                      <div className="font-semibold text-[10px] uppercase text-slate-500 mb-2">Review Developer Estimation Details</div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400">Estimated Hours</span>
                          <strong>{selectedCR.estimation_hours} Hours</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">Developer Notes</span>
                          <strong>"{selectedCR.estimation_notes}"</strong>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <label className="block text-xs font-semibold">Admin Comments / Refined Terms</label>
                        <textarea
                          value={crAdminComments}
                          onChange={(e) => setCrAdminComments(e.target.value)}
                          placeholder="Provide commercial guidelines or feedback..."
                          className="w-full rounded border p-2 text-xs bg-white h-20"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCRAdminDecision(selectedCR.id, true)}
                          className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold hover:bg-emerald-700"
                        >
                          Approve Estimation & Send to Client
                        </button>
                        <button
                          onClick={() => handleCRAdminDecision(selectedCR.id, false)}
                          className="rounded-xl border border-rose-500/20 bg-rose-50 hover:bg-rose-100/50 text-rose-700 px-4 py-2.5 text-xs font-semibold"
                        >
                          Reject Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Awaiting Client Approval */}
                  {selectedCR.status === "admin_approved" && (
                    <span className="font-mono text-[#2455FF] italic block text-xs">
                      Staged estimation ({selectedCR.estimation_hours} hours) approved by Admin. Awaiting Client confirmation...
                    </span>
                  )}

                  {/* Step 5: Client approved, start dev */}
                  {selectedCR.status === "client_approved" && (
                    <div className="rounded-xl border p-4 bg-slate-50 space-y-3">
                      <span className="block text-xs text-slate-650">
                        Client approved the estimation. Start project workspace development.
                      </span>
                      <button
                        onClick={() => handleCRStartDev(selectedCR.id)}
                        className="rounded-xl bg-[#2455FF] text-white px-4 py-2.5 text-xs font-semibold hover:bg-[#1a44e0]"
                      >
                        Authorize & Start Development
                      </button>
                    </div>
                  )}

                  {/* Development stage */}
                  {selectedCR.status === "in_development" && (
                    <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-250 text-emerald-800 text-xs">
                      <strong>Sprint Active</strong>: This feature modification is currently in development.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState text="Select a change request from queue to details." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 7. Document Approval Center Tab
  if (activeTab === "documentApproval") {
    const pendingDocs = documents.filter(d => d.status === "draft" || d.status === "sent_to_client" || d.status === "under_review");

    return (
      <div className="space-y-6">
        <SectionTitle title="Document Approval Command Console" subtitle="Expedite pending PRDs, contract statement of works, and service milestones" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending list */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Pending Approvals</h3>
            <div className="space-y-3">
              {pendingDocs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedDoc?.id === doc.id
                      ? "border-[#2455FF] bg-[#2455FF]/5"
                      : "border-slate-100 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start w-full mb-2">
                    <span className="font-semibold text-xs text-[#050a1a]">{doc.title}</span>
                    <GlowBadge status={doc.status.toUpperCase()} />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono w-full flex justify-between">
                    <span>Type: {doc.type}</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
              {pendingDocs.length === 0 && <EmptyState text="No documents awaiting admin approval." />}
            </div>
          </GlassCard>

          {/* Details & quick approve */}
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            {selectedDoc ? (
              <div className="space-y-5">
                <div className="border-b border-[#2455ff]/10 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-cine text-xl text-[#050a1a] tracking-wider">{selectedDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">Type: {selectedDoc.type} · ID: {selectedDoc.id}</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedDoc.type === "SOW" && (
                      <button
                        onClick={() => handleDocStatus(selectedDoc.id, "sent_to_client")}
                        className="rounded-xl border border-[#2455FF]/15 px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
                      >
                        Send SOW to Client
                      </button>
                    )}
                    <button
                      onClick={() => handleDocStatus(selectedDoc.id, "approved")}
                      className="rounded-xl bg-[#2455FF] text-white px-4 py-2 text-xs font-semibold hover:bg-[#1a44e0] transition"
                    >
                      Approve Document
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none text-xs leading-relaxed text-[#050a1a]/85 border border-[#2455ff]/10 rounded-xl p-4 bg-white/50 max-h-[300px] overflow-y-auto">
                  {selectedDoc.body_markdown.split("\n").map((line, idx) => {
                    if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-lg text-[#2455FF] mt-2 mb-1">{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-sm text-[#050a1a] mt-2 mb-1 border-b border-slate-200 pb-0.5">{line.slice(3)}</h2>;
                    if (!line.trim()) return <div key={idx} className="h-1.5" />;
                    return <p key={idx} className="mb-1">{line}</p>;
                  })}
                </div>
              </div>
            ) : (
              <EmptyState text="Select a document from queue to preview specs and execute approval action." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // 7. Settings Tab
  if (activeTab === "settings") {
    const handleReset = () => {
      toast.success("Settings updated");
    };

    return (
      <div className="space-y-6 max-w-xl">
        <SectionTitle title="Command Settings" subtitle="Admin control preferences and dashboard layouts" />

        <GlassCard hoverLift={false} className="space-y-5">
          <h3 className="font-semibold text-[#050a1a] border-b border-[#2455ff]/10 pb-2">Admin Profile</h3>
          <FormField label="Admin Email" defaultValue={user.email} disabled />
          <FormField label="Authorized Company" defaultValue={user.company} disabled />
          
          <h3 className="font-semibold text-[#050a1a] border-b border-[#2455ff]/10 pb-2 mt-6">Intake Preferences</h3>
          <FormField label="LUMI intake API credentials" defaultValue={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} type="password" />
          
          <button
            onClick={handleReset}
            className="flex items-center justify-center rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-5 py-3 font-semibold transition"
          >
            <span>Save Settings</span>
          </button>
        </GlassCard>
      </div>
    );
  }

  return null;
}

// ==========================================
// Project Details Modal Component
// ==========================================
function ProjectDetailsModal({ project, onClose, refresh, activity, people }) {
  const [milestoneForm, setMilestoneForm] = useState({ name: "", description: "", deadline: "" });
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [reviewForm, setReviewForm] = useState({ comments: "" });

  const addMilestone = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${project.id}/milestones`, {
        ...milestoneForm,
        deadline: milestoneForm.deadline || null
      });
      toast.success("Milestone defined successfully");
      setMilestoneForm({ name: "", description: "", deadline: "" });
      refresh();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const runDecision = async (milestoneId, action) => {
    try {
      if (action !== "APPROVE" && !reviewForm.comments.trim()) {
        toast.error("Comments are required to reject or request changes.");
        return;
      }
      const response = await api.post(`/milestones/${milestoneId}/admin-decision`, {
        action,
        comments: reviewForm.comments
      });
      toast.success(`Milestone review complete: ${response.data.status}`);
      setSelectedMilestone(null);
      setReviewForm({ comments: "" });
      refresh();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const beginReview = async (milestoneId) => {
    try {
      await api.post(`/milestones/${milestoneId}/begin-admin-review`);
      toast.success("Admin review initiated");
      refresh();
      const reviewDetails = await api.get(`/milestones/${milestoneId}/review`);
      setSelectedMilestone(reviewDetails.data);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const closeMilestone = async (milestoneId) => {
    try {
      await api.post(`/milestones/${milestoneId}/close`);
      toast.success("Milestone archived/closed");
      refresh();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleMilestoneClick = async (m) => {
    try {
      const reviewDetails = await api.get(`/milestones/${m.id}/review`);
      setSelectedMilestone(reviewDetails.data);
    } catch (err) {
      setSelectedMilestone({ milestone: m, submission: null, history: [] });
    }
  };

  const projectActivities = useMemo(() => {
    if (!activity) return [];
    const mIds = new Set((project.milestones || []).map(m => m.id));
    return activity.filter(a => 
      (a.entityType === "PROJECT" && a.entityId === project.id) ||
      (a.entityType === "MILESTONE" && mIds.has(a.entityId))
    );
  }, [activity, project]);

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 12, opacity: 0 }}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#2455ff]/15 bg-white p-6 shadow-2xl space-y-6 text-[#050a1a]"
      >
        <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3.5">
          <div>
            <h3 className="font-cine text-2xl tracking-wider text-[#050a1a]">{project.name}</h3>
            <p className="text-[10px] text-[#2455FF] font-mono mt-1">Project ID: {project.id}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Left panel: Milestones list */}
          <div className="space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Project milestones</div>
            <div className="space-y-2">
              {project.milestones && project.milestones.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleMilestoneClick(m)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#2455FF]/12 bg-white/70 p-4 text-left hover:border-[#2455FF]/30 transition"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#050a1a]">{m.order}. {m.name}</div>
                    <div className="mt-1 font-mono text-[9px] text-slate-400">
                      Deadline: {m.deadline ? new Date(m.deadline).toLocaleDateString() : "Flexible"}
                    </div>
                  </div>
                  <GlowBadge status={m.status} />
                </button>
              ))}
              {(!project.milestones || project.milestones.length === 0) && (
                <EmptyState text="No milestones defined yet." />
              )}
            </div>
          </div>

          {/* Right panel: Progress metrics and Add Milestone Form */}
          <aside className="space-y-5">
            <div className="rounded-2xl border border-[#2455FF]/12 bg-[#2455FF]/5 p-4">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#2455FF]">Aggregate Progress</div>
              <div className="mt-2 text-3xl font-semibold text-[#050a1a]">{project.progress}%</div>
              <div className="mt-3.5 h-2 rounded-full bg-[#2455FF]/10 overflow-hidden">
                <div style={{ width: `${project.progress}%` }} className="h-full bg-[#2455FF] rounded-full" />
              </div>
            </div>

            {/* Create Milestone */}
            <form onSubmit={addMilestone} className="space-y-3.5 border-t border-[#2455ff]/10 pt-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Define Milestone</div>
              <FormField label="Milestone Name" value={milestoneForm.name} onChange={(v) => setMilestoneForm({ ...milestoneForm, name: v })} placeholder="e.g. Prototype delivery" required />
              <FormField label="Milestone Description" value={milestoneForm.description} onChange={(v) => setMilestoneForm({ ...milestoneForm, description: v })} placeholder="Detailed deliverable requirements" required />
              <FormField label="Completion Deadline" type="date" value={milestoneForm.deadline} onChange={(v) => setMilestoneForm({ ...milestoneForm, deadline: v })} />
              
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2.5 font-semibold text-xs transition"
              >
                <span>Add Milestone</span>
              </button>
            </form>
          </aside>
        </div>

        {/* Project History Timeline */}
        {projectActivities.length > 0 && (
          <div className="border-t border-[#2455FF]/10 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-3">Project History Log</div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {projectActivities.map((a) => (
                <div key={a.id} className="flex gap-4 items-start text-xs text-[#050a1a]/85 border-b border-slate-50 pb-2 last:border-0">
                  <div className="mt-0.5 rounded-full bg-[#2455FF]/10 p-1 text-[#2455FF]">
                    <Activity size={10} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800">{titleCase(a.action)}</span> · <span className="text-slate-400 font-mono text-[10px]">{a.userName} ({titleCase(a.role)})</span>
                  </div>
                  <time className="font-mono text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestone Action modal overlay */}
        <AnimatePresence>
          {selectedMilestone && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/40 p-4">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="w-full max-w-lg rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <div>
                    <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">{selectedMilestone.milestone.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Status Check Console</p>
                  </div>
                  <button onClick={() => setSelectedMilestone(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-650">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono">Current Status:</span>
                  <GlowBadge status={selectedMilestone.milestone.status} />
                </div>

                {selectedMilestone.submission && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2.5 text-xs text-[#050a1a]">
                    <div className="font-semibold text-[#050a1a]">Developer Submission:</div>
                    <div className="text-[#050a1a]/70 leading-relaxed">{selectedMilestone.submission.deliverableDescription}</div>
                    <div className="text-slate-400 italic mt-1">"{selectedMilestone.submission.notes}"</div>
                    
                    <div className="flex flex-wrap gap-3 font-mono text-[10px] text-[#2455FF] mt-2">
                      <a href={selectedMilestone.submission.stagingUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#1a44e0]">Staging Build Preview</a>
                      <a href={selectedMilestone.submission.demoVideoUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#1a44e0]">Demo Video</a>
                      {selectedMilestone.submission.githubPrUrl && (
                        <a href={selectedMilestone.submission.githubPrUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#1a44e0]">GitHub PR</a>
                      )}
                    </div>
                  </div>
                )}

                {/* Review Actions */}
                <div className="space-y-3 pt-2">
                  {selectedMilestone.milestone.status === "SUBMITTED_BY_DEVELOPER" && (
                    <button
                      onClick={() => beginReview(selectedMilestone.milestone.id)}
                      className="w-full rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-2.5 font-semibold text-xs transition"
                    >
                      Begin Review Process
                    </button>
                  )}

                  {selectedMilestone.milestone.status === "UNDER_ADMIN_REVIEW" && (
                    <div className="space-y-3">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Admin review comments</label>
                      <textarea
                        value={reviewForm.comments}
                        onChange={(e) => setReviewForm({ comments: e.target.value })}
                        placeholder="Write constructive notes here..."
                        className="w-full h-20 rounded-xl bg-white border border-[#2455ff]/15 text-[#050a1a] outline-none focus:ring-2 focus:ring-[#2455ff]/30 p-3 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => runDecision(selectedMilestone.milestone.id, "APPROVE")}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-[10px] font-mono uppercase tracking-wider font-semibold transition"
                        >
                          Approve SOW
                        </button>
                        <button
                          onClick={() => runDecision(selectedMilestone.milestone.id, "REQUEST_CHANGES")}
                          className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white py-2 text-[10px] font-mono uppercase tracking-wider font-semibold transition"
                        >
                          Request Edit
                        </button>
                        <button
                          onClick={() => runDecision(selectedMilestone.milestone.id, "REJECT")}
                          className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white py-2 text-[10px] font-mono uppercase tracking-wider font-semibold transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedMilestone.milestone.status === "CLIENT_APPROVED" && (
                    <button
                      onClick={() => closeMilestone(selectedMilestone.milestone.id)}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-semibold text-xs transition"
                    >
                      Close & Archive Milestone
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ==========================================
// Create Project Modal Component
// ==========================================
function CreateProjectModal({ onClose, onDone, people, prdQueue }) {
  const clients = people.filter(p => p.role === "CLIENT" && p.status === "ACTIVE");
  const devs = people.filter(p => p.role === "DEVELOPER" && p.status === "ACTIVE");
  
  const [form, setForm] = useState({ name: "", description: "", client_id: "", developer_ids: [], prd_id: "", deadline: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/projects", {
        ...form,
        prd_id: form.prd_id || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null
      });
      toast.success("Project initialized successfully");
      onDone();
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
          <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">Create New Project</h4>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <FormField label="Project Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FormField label="Project Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          
          <FormSelect label="Target Client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
            <option value="">Select client Organization</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
            ))}
          </FormSelect>

          <label className="block space-y-1">
            <span className="font-semibold text-xs text-[#050a1a]">Assigned Developers</span>
            <select
              multiple
              value={form.developer_ids}
              onChange={(e) => setForm({ ...form, developer_ids: [...e.target.selectedOptions].map(o => o.value) })}
              className="w-full h-24 rounded-xl border bg-white/75 p-2 text-[#050a1a] text-xs outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition"
            >
              {devs.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <FormSelect label="Linked Intake PRD" value={form.prd_id} onChange={(e) => setForm({ ...form, prd_id: e.target.value })}>
            <option value="">No PRD Attachment</option>
            {prdQueue.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </FormSelect>

          <FormField label="Target Deadline" type="date" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />

          <button
            type="submit"
            className="w-full rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-3 font-semibold text-sm transition"
          >
            Create Project
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ==========================================
// Create User/Person Modal Component
// ==========================================
function CreatePersonModal({ role, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "", capacity_hours: 40 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/people/${role}`, form);
      toast.success(`${titleCase(role)} account created successfully`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
          <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">Add New {titleCase(role)}</h4>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <FormField label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FormField label="Work Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <FormField label="Access Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
          <FormField label="Company / Organisation" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
          {role === "DEVELOPER" && (
            <FormField label="Bandwidth Limit (hours/week)" type="number" value={form.capacity_hours} onChange={(v) => setForm({ ...form, capacity_hours: parseInt(v) })} required />
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-3 font-semibold text-sm transition"
          >
            Create Account
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ==========================================
// Create Finance Modal Component
// ==========================================
function CreateFinanceModal({ type, onClose, onDone, projects }) {
  const [form, setForm] = useState({ project_id: "", amount: "", currency: "INR", status: "DRAFT", reference: "", due_at: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/finance/${type}`, {
        ...form,
        amount: parseFloat(form.amount),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null
      });
      toast.success(`${titleCase(type)} record registered`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
          <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">Add {titleCase(type)}</h4>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <FormSelect label="Target Project" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required>
            <option value="">Select project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </FormSelect>

          <FormField label="Amount (INR)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          <FormField label="Reference Code" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} placeholder="e.g. SOW-2025-01" required />
          
          <FormSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required>
            {type === "invoice" ? (
              <>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="PAID">Paid</option>
              </>
            ) : type === "payment" ? (
              <>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
              </>
            ) : (
              <>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
              </>
            )}
          </FormSelect>

          <FormField label="Due Date" type="date" value={form.due_at} onChange={(v) => setForm({ ...form, due_at: v })} />

          <button
            type="submit"
            className="w-full rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-3 font-semibold text-sm transition"
          >
            Submit Entry
          </button>
        </form>
      </motion.div>
    </div>
  );
}
