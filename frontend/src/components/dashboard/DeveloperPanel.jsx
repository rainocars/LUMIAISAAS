import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Code2, BriefcaseBusiness, ClipboardList, CheckCircle2, ChevronRight,
  Activity, Play, Send, Plus, Eye, Calendar, User, FileText, ChevronLeft, Link2, X,
  HelpCircle
} from "lucide-react";
import { managementApi as api, apiError } from "@/lib/managementApi";
import {
  GlassCard, MetricCard, GlowBadge, SectionTitle, EmptyState,
  FormField, FormSelect
} from "./UIElements";
import { TaskDistributionChart } from "./Charts";

const titleCase = (value = "") => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function DeveloperPanel({ user, data, loadData, activeTab }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeProjectForTasks, setActiveProjectForTasks] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [submissionForm, setSubmissionForm] = useState({
    notes: "",
    deliverable_description: "",
    demo_video_url: "",
    staging_url: "",
    github_pr_url: "",
    file_ids: []
  });

  const [documents, setDocuments] = useState([]);
  const [selectedPrd, setSelectedPrd] = useState(null);
  const [prdComments, setPrdComments] = useState([]);
  const [newPrdComment, setNewPrdComment] = useState("");
  
  const [internalNotes, setInternalNotes] = useState([]);
  const [selectedProjectForNotes, setSelectedProjectForNotes] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [adminUser, setAdminUser] = useState(null);
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
        } else if (data.type === "MESSAGE_FORWARDED" || data.type === "MESSAGE_RESPONDED") {
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

  // Load documents for PRD specs
  useEffect(() => {
    if (activeTab === "prds") {
      api.get("/documents")
        .then(res => setDocuments(res.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Load Admin user for messaging
  useEffect(() => {
    if (activeTab === "adminMessages") {
      api.get("/admin-user")
        .then(res => {
          setAdminUser(res.data);
        })
        .catch(() => {
          setAdminUser({ id: "admin-system", name: "System Admin" });
        });
      
      api.get("/messages")
        .then(res => setMessages(res.data || []))
        .catch(() => {});
    }
  }, [activeTab]);

  // Load internal notes when selectedProjectForNotes changes or internalNotes tab is loaded
  useEffect(() => {
    if (activeTab === "internalNotes" && data.projects.length > 0) {
      const projId = selectedProjectForNotes || data.projects[0].id;
      if (!selectedProjectForNotes) {
        setSelectedProjectForNotes(projId);
      }
      api.get(`/projects/${projId}/developer-notes`)
        .then(res => setInternalNotes(res.data || []))
        .catch(() => {});
    }
  }, [activeTab, selectedProjectForNotes, data.projects]);

  // Load PRD comments
  useEffect(() => {
    if (selectedPrd) {
      api.get(`/documents/${selectedPrd.id}/comments`)
        .then(res => setPrdComments(res.data || []))
        .catch(() => {});
    }
  }, [selectedPrd]);


  // Load tasks for current selected project in Kanban view
  useEffect(() => {
    if (activeTab === "tasks") {
      if (data.projects.length > 0) {
        const projectId = activeProjectForTasks || data.projects[0].id;
        if (!activeProjectForTasks) {
          setActiveProjectForTasks(projectId);
        }
        loadProjectTasks(projectId);
      }
    }
  }, [activeTab, activeProjectForTasks, data.projects]);

  const loadProjectTasks = async (projectId) => {
    setLoadingTasks(true);
    try {
      const res = await api.get(`/projects/${projectId}/tasks`);
      setTasks(res.data || []);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await api.post(`/projects/${activeProjectForTasks}/tasks`, {
        title: newTaskTitle.trim(),
        status: "TODO"
      });
      toast.success("Task created");
      setNewTaskTitle("");
      setCreatingTask(false);
      loadProjectTasks(activeProjectForTasks);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const moveTask = async (taskId, nextStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, null, { params: { status: nextStatus } });
      toast.success(`Task status updated to ${titleCase(nextStatus)}`);
      loadProjectTasks(activeProjectForTasks);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleMilestoneAction = async (milestoneId, action) => {
    try {
      if (action === "start") {
        await api.post(`/milestones/${milestoneId}/start`);
        toast.success("Milestone set to active");
      } else if (action === "submit") {
        if (!submissionForm.staging_url || !submissionForm.demo_video_url) {
          toast.error("Staging URL and Demo Video URL are required.");
          return;
        }
        await api.post(`/milestones/${milestoneId}/submit`, submissionForm);
        toast.success("Milestone submitted for admin verification");
        setSelectedMilestone(null);
        setSubmissionForm({
          notes: "",
          deliverable_description: "",
          demo_video_url: "",
          staging_url: "",
          github_pr_url: "",
          file_ids: []
        });
      }
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // 1. My Dashboard / Overview Tab
  if (activeTab === "overview") {
    const activeProjectsCount = data.projects.filter(p => p.status === "ACTIVE").length;

    const devTasksChartData = [
      { name: "To Do", Tasks: tasks.filter(t => t.status === "TODO").length || 4 },
      { name: "In Progress", Tasks: tasks.filter(t => t.status === "IN_PROGRESS").length || 2 },
      { name: "In Review", Tasks: tasks.filter(t => t.status === "REVIEW").length || 1 },
      { name: "Completed", Tasks: tasks.filter(t => t.status === "DONE").length || 3 }
    ];

    const stats = [
      { label: "Assigned Projects", value: activeProjectsCount, icon: BriefcaseBusiness, color: "#2455FF" },
      { label: "Pending Reviews", value: data.summary.pendingReviews ?? 0, icon: ClipboardList, color: "#2455FF" },
      { label: "Active Hours", value: "40 hrs", icon: Code2, color: "#2455FF" }
    ];

    return (
      <div className="space-y-6">
        <SectionTitle title="Developer Workspace" subtitle="Live tracking of your assigned builds, workflows, and deliverables" />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s, idx) => (
            <MetricCard key={s.label} {...s} delay={idx * 0.08} />
          ))}
        </div>

        {/* Analytics & Tasks Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-[#050a1a]">Tasks State Distribution</h3>
            </div>
            <TaskDistributionChart data={devTasksChartData} />
          </GlassCard>

          <GlassCard hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Assigned Projects Status</h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {data.projects.map((p) => (
                <div key={p.id} className="rounded-xl border border-[#2455FF]/10 bg-white/60 p-3.5 flex flex-col space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#050a1a]">{p.name}</span>
                    <span className="text-[#2455FF] font-mono font-semibold">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2455FF]/10 overflow-hidden">
                    <div style={{ width: `${p.progress}%` }} className="h-full bg-[#2455FF]" />
                  </div>
                </div>
              ))}
              {data.projects.length === 0 && <EmptyState text="No projects assigned." />}
            </div>
          </GlassCard>
        </div>

        {/* Deliverable Submissions Guide */}
        <GlassCard hoverLift={false}>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-[#2455FF]/10 p-3 text-[#2455FF]">
              <HelpCircle size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[#050a1a]">Milestone Submission Guide</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                When a milestone's criteria are complete, go to the **Milestones** tab to submit your build. Please make sure to provide valid demo video links and deployment links for admin verification.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // 2. My Projects Tab
  if (activeTab === "projects") {
    return (
      <div className="space-y-6">
        <SectionTitle title="My Assigned Projects" subtitle="View and track development milestones of assigned builds" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.projects.map((p) => (
            <GlassCard key={p.id} hoverLift={true} className="flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-[#050a1a] text-sm">{p.name}</h3>
                  <GlowBadge status={p.status} />
                </div>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{p.description || "No project description."}</p>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider mb-1 text-slate-400">
                    <span>Approved Milestones</span>
                    <span className="text-[#2455FF] font-semibold">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2455FF]/10 overflow-hidden">
                    <div style={{ width: `${p.progress}%` }} className="h-full bg-[#2455FF]" />
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(p)}
                  className="rounded-lg bg-[#2455FF]/10 border border-[#2455ff]/15 text-[#2455FF] p-2 hover:bg-[#2455FF]/20 transition shrink-0"
                >
                  <Eye size={14} />
                </button>
              </div>
            </GlassCard>
          ))}
          {data.projects.length === 0 && <EmptyState text="No projects currently assigned to your developer profile." />}
        </div>

        {/* Project detail modal */}
        <AnimatePresence>
          {selectedProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={() => setSelectedProject(null)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-xl rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4 text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">{selectedProject.name}</h4>
                  <button onClick={() => setSelectedProject(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedProject.milestones && selectedProject.milestones.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-xl bg-white/70 border border-[#2455FF]/12 p-3.5 text-xs text-[#050a1a]">
                      <div>
                        <div className="font-semibold text-[#050a1a]">{m.order}. {m.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Deadline: {m.deadline ? new Date(m.deadline).toLocaleDateString() : "Flexible"}
                        </div>
                      </div>
                      <GlowBadge status={m.status} />
                    </div>
                  ))}
                  {(!selectedProject.milestones || selectedProject.milestones.length === 0) && (
                    <EmptyState text="No milestones currently defined." />
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 3. PRD Specs Tab
  if (activeTab === "prds") {
    const handleReadPrd = async (p) => {
      try {
        const prdDetails = await api.get(`/projects/${p.id}/prd`);
        setSelectedPrd(prdDetails.data);
        const comms = await api.get(`/documents/${prdDetails.data.id}/comments`);
        setPrdComments(comms.data || []);
      } catch (err) {
        toast.error("Couldn't retrieve PRD document");
      }
    };

    const handleAddPrdComment = async (e) => {
      e.preventDefault();
      if (!selectedPrd || !newPrdComment.trim()) return;
      try {
        await api.post(`/documents/${selectedPrd.id}/comments`, {
          content: newPrdComment.trim(),
          is_clarification: false
        });
        toast.success("Internal comment added");
        setNewPrdComment("");
        const comms = await api.get(`/documents/${selectedPrd.id}/comments`);
        setPrdComments(comms.data || []);
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    return (
      <div className="space-y-6">
        <SectionTitle title="Product Requirements Documents (PRDs)" subtitle="Review product specifications for assigned projects" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.projects.filter(p => p.prdId).map((p) => (
            <GlassCard key={p.id} hoverLift={true} className="flex justify-between items-center p-5">
              <div className="space-y-1">
                <h3 className="font-semibold text-[#050a1a] text-sm">{p.name} Specs</h3>
                <p className="text-[10px] text-slate-400 font-mono">Linked PRD ID: {p.prdId}</p>
              </div>
              <button
                onClick={() => handleReadPrd(p)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2455FF]/10 border border-[#2455ff]/15 text-[#2455FF] px-4 py-2 font-semibold text-xs hover:bg-[#2455FF]/20 transition"
              >
                <FileText size={14} />
                <span>Read Specs</span>
              </button>
            </GlassCard>
          ))}
          {data.projects.filter(p => p.prdId).length === 0 && (
            <div className="col-span-2">
              <EmptyState text="No projects are currently linked to a PRD document." />
            </div>
          )}
        </div>

        {/* Specs Viewer Modal */}
        <AnimatePresence>
          {selectedPrd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={() => setSelectedPrd(null)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-3xl rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl flex flex-col max-h-[85vh] text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3 mb-4 shrink-0">
                  <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">{selectedPrd.title}</h4>
                  <button onClick={() => setSelectedPrd(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-650">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="bp-grid bp-wash p-5 rounded-xl border border-[#2455FF]/15 bg-white/70 text-[#050a1a] font-sans space-y-4">
                    {selectedPrd.body_markdown.split("\n").map((line, idx) => {
                      if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-2xl text-[#2455FF] mt-4 mb-2">{line.slice(2)}</h1>;
                      if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-lg text-[#050a1a] mt-3 mb-1 border-b border-slate-200 pb-1">{line.slice(3)}</h2>;
                      if (line.startsWith("---")) return <hr key={idx} className="border-[#2455ff]/15 my-4" />;
                      if (line.startsWith("**") && line.endsWith("**")) return <p key={idx} className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold">{line.replaceAll("**", "")}</p>;
                      if (!line.trim()) return <div key={idx} className="h-2" />;
                      return <p key={idx} className="text-xs leading-relaxed text-[#050a1a]/85">{line}</p>;
                    })}
                  </div>

                  {/* Internal Developer Comments (Read and write) */}
                  <div className="border-t border-[#2455ff]/10 pt-4 space-y-3">
                    <h5 className="font-semibold text-xs text-[#2455FF] font-mono uppercase tracking-wider">Internal Developer Comments (Clients cannot see)</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 border p-3 rounded-xl text-xs">
                      {prdComments.map(c => (
                        <div key={c.id} className="border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                          <span className="font-semibold text-[#050a1a]">{c.author_name} ({c.author_role})</span>: {c.content}
                        </div>
                      ))}
                      {prdComments.length === 0 && <span className="text-slate-400 italic text-[11px]">No internal comments posted yet.</span>}
                    </div>

                    <form onSubmit={handleAddPrdComment} className="flex gap-2">
                      <input
                        value={newPrdComment}
                        onChange={(e) => setNewPrdComment(e.target.value)}
                        placeholder="Add internal technical comment..."
                        className="flex-1 rounded-xl border bg-white px-3 py-2 text-xs outline-none"
                        required
                      />
                      <button type="submit" className="rounded-xl bg-[#2455FF] text-white px-4 text-xs font-semibold">Post</button>
                    </form>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 3b. Internal Notes Tab
  if (activeTab === "internalNotes") {
    const activeProjects = data.projects.filter(p => p.status === "ACTIVE");

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle title="Project Internal Notes" subtitle="Technical discussions, architecture specs, and development updates" />
          {activeProjects.length > 0 && (
            <FormSelect
              value={selectedProjectForNotes}
              onChange={(e) => setSelectedProjectForNotes(e.target.value)}
              className="max-w-xs"
            >
              {activeProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </FormSelect>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Note */}
          <GlassCard className="lg:col-span-1" hoverLift={false}>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newNoteText.trim()) return;
              try {
                const projId = selectedProjectForNotes || data.projects[0]?.id;
                if (!projId) return;
                await api.post(`/projects/${projId}/developer-notes`, { note_text: newNoteText });
                toast.success("Internal note added");
                setNewNoteText("");
                const res = await api.get(`/projects/${projId}/developer-notes`);
                setInternalNotes(res.data || []);
              } catch (err) {
                toast.error(apiError(err));
              }
            }} className="space-y-4">
              <h3 className="font-semibold text-[#050a1a] text-xs">Add Technical Note</h3>
              <div className="space-y-1">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Type architecture updates or technical logs..."
                  className="w-full h-32 rounded-xl border bg-white/75 p-3 text-xs outline-none text-[#050a1a]"
                  required
                />
              </div>
              <button type="submit" className="w-full rounded-xl bg-[#2455FF] text-white py-2.5 font-semibold text-xs transition">
                Post Internal Note
              </button>
            </form>
          </GlassCard>

          {/* Notes list */}
          <GlassCard className="lg:col-span-2" hoverLift={false}>
            <h3 className="font-semibold text-sm text-[#050a1a] mb-4">Internal Discussion Thread</h3>
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {internalNotes.map(n => (
                <div key={n.id} className="rounded-xl border border-slate-100 bg-white/50 p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-semibold text-[#2455FF]">{n.author_name} ({n.author_role})</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[#050a1a]/85 whitespace-pre-wrap">{n.note_text}</p>
                </div>
              ))}
              {internalNotes.length === 0 && <EmptyState text="No internal notes recorded yet." />}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 3c. Admin Messages Tab
  if (activeTab === "adminMessages") {
    const activeMessages = messages.filter(m => 
      adminUser && (
        (m.sender_id === adminUser.id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === adminUser.id)
      )
    ).reverse();

    return (
      <div className="space-y-6 max-w-2xl">
        <SectionTitle title="Admin Communications Channel" subtitle="Submit internal questions or sprint logs directly to Admin" />

        <GlassCard className="h-[480px] flex flex-col justify-between p-4 bg-white/70" hoverLift={false}>
          {adminUser ? (
            <div className="flex flex-col h-full justify-between">
              {/* Header */}
              <div className="border-b border-[#2455ff]/10 pb-3 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-[#050a1a] text-xs">Chatting with Admin: {adminUser.name}</h4>
                  <span className="text-[9px] text-[#2455FF] font-mono">{adminUser.email}</span>
                </div>
              </div>

              {/* Message thread */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-4">
                {activeMessages.map((m) => {
                  const isAdminMsg = m.sender_role === "SUPER_ADMIN";
                  const isForwarded = m.status === "forwarded";
                  const hasResponse = m.status === "responded";
                  
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className={`flex ${isAdminMsg ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isAdminMsg 
                            ? "bg-slate-100 border border-slate-200 text-[#050a1a] rounded-bl-none" 
                            : "bg-[#2455FF] text-white rounded-br-none"
                        }`}>
                          <div className="font-semibold text-[9px] text-slate-400 mb-1">{m.sender_name}</div>
                          {m.message_text}
                        </div>
                      </div>

                      {/* Forwarded client request support */}
                      {isForwarded && (
                        <div className="bg-amber-50 border border-amber-250 text-amber-800 p-3 rounded-xl text-[10px] space-y-2 mt-1 max-w-[90%]">
                          <div><strong>Admin request:</strong> "Please respond to this client request internally."</div>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            const responseText = customReplyTexts[m.id];
                            if (!responseText || !responseText.trim()) return;
                            try {
                              await api.post(`/messages/${m.id}/respond-internal`, { note_text: responseText.trim() });
                              toast.success("Internal reply sent to Admin");
                              setCustomReplyTexts(prev => {
                                const next = { ...prev };
                                delete next[m.id];
                                return next;
                              });
                              const res = await api.get("/messages");
                              setMessages(res.data || []);
                            } catch (err) {
                              toast.error(apiError(err));
                            }
                          }} className="flex gap-2">
                            <input
                              value={customReplyTexts[m.id] || ""}
                              onChange={(e) => setCustomReplyTexts({ ...customReplyTexts, [m.id]: e.target.value })}
                              placeholder="Write reply to Admin..."
                              className="flex-1 rounded border bg-white px-2 py-1 text-[10px]"
                              required
                            />
                            <button type="submit" className="bg-emerald-600 text-white rounded px-2.5 text-[9px]">Reply</button>
                          </form>
                        </div>
                      )}
                      
                      {hasResponse && (
                        <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 p-2 rounded-xl text-[10px] max-w-[90%] mt-1 italic">
                          Submitted response: "{m.developer_response_text}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newMessageText.trim()) return;
                try {
                  await api.post("/messages", {
                    receiver_id: adminUser.id,
                    message_text: newMessageText.trim()
                  });
                  toast.success("Message sent");
                  setNewMessageText("");
                  const res = await api.get("/messages");
                  setMessages(res.data || []);
                } catch (err) {
                  toast.error(apiError(err));
                }
              }} className="flex gap-2 border-t border-[#2455ff]/10 pt-3">
                <input
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Ask Admin about deliverables or milestones..."
                  className="flex-1 rounded-xl bg-white/75 border border-[#2455ff]/15 px-3 py-2.5 text-xs outline-none"
                />
                <button type="submit" className="rounded-xl bg-[#2455FF] text-white px-4 text-xs font-semibold">Send</button>
              </form>
            </div>
          ) : (
            <EmptyState text="Admin details not loaded." />
          )}
        </GlassCard>
      </div>
    );
  }

  // 4. Milestones & Submissions Tab
  if (activeTab === "milestones") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Milestones Timeline" subtitle="Initiate active milestones and submit deliverables for verification" />

        <div className="space-y-6">
          {data.projects.map((p) => (
            <GlassCard key={p.id} hoverLift={false} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#2455ff]/10 pb-2">
                <h3 className="font-semibold text-slate-800 text-sm">{p.name}</h3>
                <span className="font-mono text-[10px] text-slate-400">{p.progress}% Complete</span>
              </div>

              <div className="space-y-2.5">
                {p.milestones && p.milestones.map((m) => {
                  const canStart = ["DRAFT", "BACK_TO_DEVELOPER", "CLIENT_REQUESTED_CHANGES"].includes(m.status);
                  const canSubmit = m.status === "IN_PROGRESS";
                  
                  return (
                    <div key={m.id} className="flex flex-wrap items-center justify-between rounded-xl bg-white/60 border border-[#2455FF]/10 p-3.5 text-xs text-[#050a1a] gap-3">
                      <div>
                        <div className="font-semibold text-[#050a1a]">{m.order}. {m.name}</div>
                        <div className="text-[10px] text-slate-500 mt-1 max-w-lg">{m.description}</div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <GlowBadge status={m.status} />
                        
                        {canStart && (
                          <button
                            onClick={() => handleMilestoneAction(m.id, "start")}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2455FF] hover:bg-[#1a44e0] text-white px-3 py-1.5 font-mono uppercase text-[9px] font-semibold transition"
                          >
                            <Play size={10} />
                            <span>Start Work</span>
                          </button>
                        )}

                        {canSubmit && (
                          <button
                            onClick={() => setSelectedMilestone({ milestone: m })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 font-mono uppercase text-[9px] font-semibold transition"
                          >
                            <Send size={10} />
                            <span>Submit Build</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!p.milestones || p.milestones.length === 0) && (
                  <EmptyState text="No milestones currently defined for this project." />
                )}
              </div>
            </GlassCard>
          ))}
          {data.projects.length === 0 && <EmptyState text="No projects currently assigned to check milestones." />}
        </div>

        {/* Milestone Submission Modal Drawer */}
        <AnimatePresence>
          {selectedMilestone && !selectedMilestone.prdText && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={() => setSelectedMilestone(null)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4 text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <div>
                    <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">Submit Milestone</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedMilestone.milestone.name}</p>
                  </div>
                  <button onClick={() => setSelectedMilestone(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleMilestoneAction(selectedMilestone.milestone.id, "submit"); }} className="space-y-3.5">
                  <FormField label="Staging URL" type="url" value={submissionForm.staging_url} onChange={(v) => setSubmissionForm({ ...submissionForm, staging_url: v })} placeholder="https://staging.example.com" required />
                  <FormField label="Demo Video URL" type="url" value={submissionForm.demo_video_url} onChange={(v) => setSubmissionForm({ ...submissionForm, demo_video_url: v })} placeholder="https://youtube.com/..." required />
                  <FormField label="GitHub PR URL" type="url" value={submissionForm.github_pr_url} onChange={(v) => setSubmissionForm({ ...submissionForm, github_pr_url: v })} placeholder="https://github.com/..." optional />
                  
                  <FormField label="Deliverable Summary" value={submissionForm.deliverable_description} onChange={(v) => setSubmissionForm({ ...submissionForm, deliverable_description: v })} placeholder="Short description of what was completed" required />
                  
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#050a1a]">Submission Notes</label>
                    <textarea
                      value={submissionForm.notes}
                      onChange={(e) => setSubmissionForm({ ...submissionForm, notes: e.target.value })}
                      placeholder="Special deployment instructions or dev logs..."
                      className="w-full h-20 rounded-xl border bg-white/75 p-3 text-xs outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition text-[#050a1a]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-semibold text-sm transition"
                  >
                    Send to Review
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 5. Kanban Task Board Tab
  if (activeTab === "tasks") {
    const columns = [
      { id: "TODO", label: "To Do" },
      { id: "IN_PROGRESS", label: "In Progress" },
      { id: "REVIEW", label: "In Review" },
      { id: "DONE", label: "Completed" }
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionTitle title="Project Task Board" subtitle="Maintain developer operations, task logs, and sprint boards" />
          
          <div className="flex gap-3">
            <FormSelect
              value={activeProjectForTasks}
              onChange={(e) => setActiveProjectForTasks(e.target.value)}
            >
              {data.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </FormSelect>
            
            <button
              onClick={() => setCreatingTask(true)}
              className="flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2 font-semibold text-xs transition shrink-0"
            >
              <Plus size={14} />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Task Board Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <GlassCard key={col.id} hoverLift={false} className="p-4 flex flex-col space-y-3 min-h-[350px]">
                <div className="flex justify-between items-center border-b border-[#2455ff]/10 pb-2">
                  <span className="font-mono text-xs uppercase tracking-wider font-semibold text-slate-500">{col.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">{colTasks.length}</span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[350px] pr-1">
                  {colTasks.map((t) => (
                    <div key={t.id} className="rounded-xl border border-[#2455FF]/10 bg-white p-3.5 flex flex-col space-y-3 shadow-sm">
                      <div className="text-xs font-semibold text-[#050a1a]">{t.title}</div>
                      
                      <div className="flex justify-end gap-1.5 pt-1.5 border-t border-[#2455ff]/8">
                        {col.id !== "TODO" && (
                          <button
                            onClick={() => moveTask(t.id, col.id === "DONE" ? "REVIEW" : col.id === "REVIEW" ? "IN_PROGRESS" : "TODO")}
                            className="rounded p-1 hover:bg-[#2455ff]/5 text-slate-400 hover:text-slate-600"
                            title="Move back"
                          >
                            <ChevronLeft size={12} />
                          </button>
                        )}
                        {col.id !== "DONE" && (
                          <button
                            onClick={() => moveTask(t.id, col.id === "TODO" ? "IN_PROGRESS" : col.id === "IN_PROGRESS" ? "REVIEW" : "DONE")}
                            className="rounded p-1 hover:bg-[#2455ff]/5 text-slate-400 hover:text-slate-600"
                            title="Move forward"
                          >
                            <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="h-16 flex items-center justify-center font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      Empty Column
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Create Task Modal Overlay */}
        <AnimatePresence>
          {creatingTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={() => setCreatingTask(false)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-[#2455FF]/15 bg-white p-5 shadow-2xl space-y-4 text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <h4 className="font-cine text-lg tracking-wider text-[#050a1a]">Create New Task</h4>
                  <button onClick={() => setCreatingTask(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-650">
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleCreateTask} className="space-y-3.5">
                  <FormField
                    label="Task Title"
                    value={newTaskTitle}
                    onChange={(v) => setNewTaskTitle(v)}
                    placeholder="Describe task work..."
                    required
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white py-2.5 font-semibold text-xs transition"
                  >
                    Add Task
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 6. Deliverables Tab
  if (activeTab === "deliverables") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Project Deliverables" subtitle="Summary logs of files, attachments, and staging links submitted" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.projects.map((p) => (
            <GlassCard key={p.id} hoverLift={false} className="space-y-3">
              <h4 className="font-semibold text-[#050a1a] text-xs">{p.name} Deliverables</h4>
              <div className="space-y-2">
                {p.milestones && p.milestones.filter(m => m.status === "CLIENT_APPROVED" || m.status === "CLOSED").map(m => (
                  <div key={m.id} className="rounded-lg bg-slate-50 border border-slate-100 p-3.5 flex justify-between items-center text-xs text-[#050a1a]">
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Approved Milestone {m.order}</div>
                    </div>
                    <span className="text-[#2455FF] font-mono text-[10px] font-semibold">VERIFIED</span>
                  </div>
                ))}
                {(!p.milestones || p.milestones.filter(m => m.status === "CLIENT_APPROVED" || m.status === "CLOSED").length === 0) && (
                  <EmptyState text="No deliverables currently closed/approved." />
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  // 7. Activity Log Tab
  if (activeTab === "activity") {
    return (
      <div className="space-y-6">
        <SectionTitle title="My History Activity Logs" subtitle="Immutable logs of project milestones, review iterations, and task logs" />

        <GlassCard hoverLift={false}>
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {data.activity.map((act) => (
              <div key={act.id} className="flex gap-4 items-start text-xs border-b border-[#2455ff]/8 pb-3 last:border-0 last:pb-0">
                <div className="mt-0.5 rounded-full bg-[#2455FF]/10 p-2 text-[#2455FF]">
                  <Activity size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#050a1a]">{titleCase(act.action)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {act.userName} · Entity ID: {act.entityId} ({act.entityType})
                  </div>
                </div>
                <time className="text-[10px] text-slate-500 font-mono">{new Date(act.createdAt).toLocaleString()}</time>
              </div>
            ))}
            {data.activity.length === 0 && <EmptyState text="No activity records logged." />}
          </div>
        </GlassCard>
      </div>
    );
  }

  // 8. Settings Tab
  if (activeTab === "settings") {
    return (
      <div className="space-y-6 max-w-xl">
        <SectionTitle title="Developer Profile Settings" subtitle="Verify and modify your account configurations" />

        <GlassCard hoverLift={false} className="space-y-4">
          <FormField label="Full Name" defaultValue={user.name} disabled />
          <FormField label="Work Email" defaultValue={user.email} disabled />
          <FormField label="Weekly Capacity Bandwidth" defaultValue={`${user.capacity_hours || 40} hours`} disabled />
          <FormField label="Company Organisation" defaultValue={user.company || "LUMI AI Developer Staff"} disabled />
        </GlassCard>
      </div>
    );
  }

  return null;
}
