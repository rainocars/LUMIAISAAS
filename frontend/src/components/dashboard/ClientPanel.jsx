import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  BriefcaseBusiness, FolderKanban, FileText, CheckCircle2, ChevronRight, MessageSquare,
  Activity, Sparkles, Send, CreditCard, Download, User, X, HelpCircle, PhoneCall, Eye
} from "lucide-react";
import { managementApi as api, apiError } from "@/lib/managementApi";
import {
  GlassCard, MetricCard, GlowBadge, SectionTitle, EmptyState, FormField
} from "./UIElements";

const money = (value = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const titleCase = (value = "") => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function ClientPanel({ user, data, loadData, activeTab }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [reviewComments, setReviewComments] = useState("");
  const [userDocs, setUserDocs] = useState([]);
  const [payingInvoice, setPayingInvoice] = useState(null);
  
  const [documents, setDocuments] = useState([]);
  const [selectedPrd, setSelectedPrd] = useState(null);
  const [prdComments, setPrdComments] = useState([]);
  const [newPrdComment, setNewPrdComment] = useState("");

  const [sows, setSows] = useState([]);
  const [selectedSow, setSelectedSow] = useState(null);

  const [adminUser, setAdminUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");

  const [changeRequests, setChangeRequests] = useState([]);
  const [newCRTitle, setNewCRTitle] = useState("");
  const [newCRDesc, setNewCRDesc] = useState("");
  const [creatingCR, setCreatingCR] = useState(false);
  const [selectedCR, setSelectedCR] = useState(null);

  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Hello! How can I help you today?" }
  ]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

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
        }
      } catch (e) {
        console.error("WebSocket message error", e);
      }
    };
    return () => ws.close();
  }, [user]);

  // Load documents
  useEffect(() => {
    if (activeTab === "prds" || activeTab === "sowViewer") {
      api.get("/documents")
        .then(res => {
          const docs = res.data || [];
          setDocuments(docs);
          setSows(docs.filter(d => d.type === "SOW"));
        })
        .catch(() => {});
    }
  }, [activeTab]);

  // Load Admin user and messages
  useEffect(() => {
    if (activeTab === "adminCommunications") {
      api.get("/admin-user")
        .then(res => setAdminUser(res.data))
        .catch(() => setAdminUser({ id: "admin-system", name: "System Admin" }));
        
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

  // Load PRD comments
  useEffect(() => {
    if (selectedPrd) {
      api.get(`/documents/${selectedPrd.id}/comments`)
        .then(res => setPrdComments(res.data || []))
        .catch(() => {});
    }
  }, [selectedPrd]);

  // Load client documents
  useEffect(() => {
    if (activeTab === "documents") {
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/documents`, { params: { user_id: user.id } })
        .then(res => setUserDocs(res.data || []))
        .catch(() => {});
    }
  }, [activeTab, user.id]);

  const handleClientDecision = async (milestoneId, action) => {
    try {
      if (action === "REQUEST_REVISION" && !reviewComments.trim()) {
        toast.error("Comments are required to request a revision.");
        return;
      }
      await api.post(`/milestones/${milestoneId}/client-decision`, {
        action,
        comments: reviewComments
      });
      toast.success(action === "APPROVE_MILESTONE" ? "Milestone approved!" : "Revision requested");
      setSelectedMilestone(null);
      setReviewComments("");
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handlePayInvoice = (invoice) => {
    setPayingInvoice(invoice);
  };

  const confirmPayment = async () => {
    toast.success("Payment simulation successful", {
      description: "Payment status will be updated after verification check."
    });
    setPayingInvoice(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;
    
    const userMsg = { role: "user", text: newChatMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setNewChatMessage("");
    setSendingChat(true);

    setTimeout(() => {
      let replyText = "I will escalate this feedback to your developer team. We'll post an update to the project activity feed shortly!";
      if (newChatMessage.toLowerCase().includes("invoice") || newChatMessage.toLowerCase().includes("billing")) {
        replyText = "I've flagged this commercial query. The accounts manager will follow up via WhatsApp.";
      } else if (newChatMessage.toLowerCase().includes("status") || newChatMessage.toLowerCase().includes("progress")) {
        replyText = "The aggregate status of your active milestone has been updated in your main Projects portal. Please check the Milestones tab for details.";
      }
      setChatMessages(prev => [...prev, { role: "assistant", text: replyText }]);
      setSendingChat(false);
    }, 1000);
  };

  const handleMilestoneClick = async (m) => {
    try {
      const reviewDetails = await api.get(`/milestones/${m.id}/review`);
      setSelectedMilestone(reviewDetails.data);
    } catch (err) {
      setSelectedMilestone({ milestone: m, submission: null, history: [] });
    }
  };

  // 1. My Projects Tab
  if (activeTab === "projects") {
    return (
      <div className="space-y-6">
        <SectionTitle title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="LUMI AI Client Delivery Portal" />

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Active Projects" value={data.projects.filter(p => p.status === "ACTIVE").length} icon={BriefcaseBusiness} color="#2455FF" />
          <MetricCard label="Awaiting Approval" value={data.summary.pendingClientApprovals ?? 0} icon={CheckCircle2} color="#2455FF" />
          <MetricCard label="Total Projects" value={data.projects.length} icon={FolderKanban} color="#2455FF" />
        </div>

        {/* Project progress cards */}
        <div className="space-y-4">
          {data.projects.map((p) => (
            <GlassCard key={p.id} hoverLift={false} className="space-y-5">
              <div className="flex items-start justify-between border-b border-[#2455ff]/10 pb-3">
                <div>
                  <h3 className="font-semibold text-[#050a1a] text-sm">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{p.description || "No project description."}</p>
                </div>
                <GlowBadge status={p.status} />
              </div>

              {/* Progress visualizer */}
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  <span>Development progress</span>
                  <span className="text-[#2455FF] font-semibold">{p.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#2455FF]/10 overflow-hidden">
                  <div style={{ width: `${p.progress}%` }} className="h-full bg-gradient-to-r from-[#2455FF] to-[#00E5FF] rounded-full" />
                </div>
              </div>

              {/* Milestones list trigger */}
              <div className="space-y-2.5 pt-2">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">Milestones timeline</span>
                <div className="space-y-2">
                  {p.milestones && p.milestones.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleMilestoneClick(m)}
                      className="flex w-full items-center justify-between rounded-xl bg-white/70 border border-[#2455FF]/10 p-3.5 text-xs text-[#050a1a] hover:border-[#2455FF]/30 transition"
                    >
                      <span className="font-medium">{m.order}. {m.name}</span>
                      <div className="flex items-center gap-3">
                        <GlowBadge status={m.status} />
                        {m.status === "SENT_TO_CLIENT" && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono text-rose-500 font-semibold uppercase tracking-wider animate-pulse">
                            Review Required
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>
          ))}
          {data.projects.length === 0 && <EmptyState text="No projects registered under your organization." />}
        </div>

        {/* Milestone review modal overlay */}
        <AnimatePresence>
          {selectedMilestone && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4 text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <div>
                    <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">{selectedMilestone.milestone.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Milestone status check</p>
                  </div>
                  <button onClick={() => setSelectedMilestone(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-650">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono">Status:</span>
                  <GlowBadge status={selectedMilestone.milestone.status} />
                </div>

                {selectedMilestone.submission && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3.5 text-xs text-[#050a1a]">
                    <div className="font-semibold text-[#050a1a]">Milestone Submission Details:</div>
                    <div className="text-[#050a1a]/70 leading-relaxed">{selectedMilestone.submission.deliverableDescription}</div>
                    
                    <div className="flex flex-wrap gap-4 font-mono text-[10px] text-[#2455FF] mt-2">
                      <a href={selectedMilestone.submission.stagingUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#1a44e0]">Staging Build Preview</a>
                      <a href={selectedMilestone.submission.demoVideoUrl} target="_blank" rel="noreferrer" className="underline hover:text-[#1a44e0]">Demo Video</a>
                    </div>
                  </div>
                )}

                {/* Client Decisions */}
                {selectedMilestone.milestone.status === "SENT_TO_CLIENT" && (
                  <div className="space-y-3.5 pt-2 border-t border-[#2455ff]/10">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Review Comments / Revision Feedback</label>
                    <textarea
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder="Comment for developer team..."
                      className="w-full h-20 rounded-xl bg-white border border-[#2455ff]/15 text-[#050a1a] outline-none focus:ring-2 focus:ring-[#2455ff]/30 p-3 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleClientDecision(selectedMilestone.milestone.id, "APPROVE_MILESTONE")}
                        className="rounded-xl bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-xs font-semibold uppercase tracking-wider transition"
                      >
                        Approve Milestone
                      </button>
                      <button
                        onClick={() => handleClientDecision(selectedMilestone.milestone.id, "REQUEST_REVISION")}
                        className="rounded-xl border border-rose-500/20 bg-rose-50 hover:bg-rose-100/50 text-rose-700 py-3 text-xs font-semibold uppercase tracking-wider transition"
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2. PRD Viewer Tab
  if (activeTab === "prds") {
    const prds = documents.filter(d => d.type === "PRD");

    const handleReadPrd = async (doc) => {
      setSelectedPrd(doc);
      try {
        const comms = await api.get(`/documents/${doc.id}/comments`);
        setPrdComments(comms.data || []);
      } catch (err) {
        toast.error("Couldn't fetch feedback threads");
      }
    };

    const handleAddPrdComment = async (e) => {
      e.preventDefault();
      if (!selectedPrd || !newPrdComment.trim()) return;
      try {
        await api.post(`/documents/${selectedPrd.id}/comments`, {
          content: newPrdComment.trim(),
          is_clarification: true // Clients can only request clarifications
        });
        toast.success("Clarification request submitted to Admin");
        setNewPrdComment("");
        const comms = await api.get(`/documents/${selectedPrd.id}/comments`);
        setPrdComments(comms.data || []);
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    return (
      <div className="space-y-6">
        <SectionTitle title="Product Specifications (PRD)" subtitle="Review the requirements and scope for your active builds" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prds.map((doc) => (
            <GlassCard key={doc.id} hoverLift={true} className="flex justify-between items-center p-5">
              <div className="space-y-1">
                <h3 className="font-semibold text-[#050a1a] text-sm">{doc.title}</h3>
                <p className="text-[10px] text-slate-400 font-mono">Linked PRD ID: {doc.id} · status: {doc.status}</p>
              </div>
              <button
                onClick={() => handleReadPrd(doc)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2455FF]/10 border border-[#2455ff]/15 text-[#2455FF] px-4 py-2 font-semibold text-xs hover:bg-[#2455FF]/20 transition"
              >
                <FileText size={14} />
                <span>Read Specs</span>
              </button>
            </GlassCard>
          ))}
          {prds.length === 0 && (
            <div className="col-span-2">
              <EmptyState text="No product specifications currently uploaded." />
            </div>
          )}
        </div>

        {/* PRD Viewer & Feedback Drawer */}
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
                  <button onClick={() => setSelectedPrd(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-655">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="bp-grid bp-wash p-5 rounded-xl border border-[#2455FF]/15 bg-white/70 text-[#050a1a] font-sans space-y-4">
                    {selectedPrd.body_markdown.split("\n").map((line, idx) => {
                      if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-2xl text-[#2455FF] mt-4 mb-2">{line.slice(2)}</h1>;
                      if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-lg text-[#050a1a] mt-3 mb-1 border-b border-slate-200 pb-1">{line.slice(3)}</h2>;
                      if (line.startsWith("---")) return <hr key={idx} className="border-[#2455ff]/15 my-4" />;
                      if (!line.trim()) return <div key={idx} className="h-2" />;
                      return <p key={idx} className="text-xs leading-relaxed text-[#050a1a]/85">{line}</p>;
                    })}
                  </div>

                  {/* Clarification Request Feed */}
                  <div className="border-t border-[#2455ff]/10 pt-4 space-y-3">
                    <h5 className="font-semibold text-xs text-[#2455FF] font-mono uppercase tracking-wider">Clarification requests with Admin</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 border p-3 rounded-xl text-xs">
                      {prdComments.map(c => (
                        <div key={c.id} className="border-b border-slate-200/50 pb-1.5 last:border-0 last:pb-0">
                          <span className="font-semibold text-[#050a1a]">{c.author_name} ({c.author_role})</span>: {c.content}
                        </div>
                      ))}
                      {prdComments.length === 0 && <span className="text-slate-400 italic text-[11px]">No clarification request history.</span>}
                    </div>

                    <form onSubmit={handleAddPrdComment} className="flex gap-2">
                      <input
                        value={newPrdComment}
                        onChange={(e) => setNewPrdComment(e.target.value)}
                        placeholder="Request clarification or specs detail from Admin..."
                        className="flex-1 rounded-xl border bg-white px-3 py-2 text-xs outline-none"
                        required
                      />
                      <button type="submit" className="rounded-xl bg-[#2455FF] text-white px-4 text-xs font-semibold">Submit Request</button>
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

  // 2b. SOW Viewer Tab
  if (activeTab === "sowViewer") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Statement of Work (SOW) Contracts" subtitle="Review contractual timelines, deliverables, and payment boundaries" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sows.map((doc) => (
            <GlassCard key={doc.id} hoverLift={true} className="flex flex-col justify-between p-5 min-h-[180px]">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-[#050a1a] text-sm">{doc.title}</h3>
                  <GlowBadge status={doc.status.toUpperCase()} />
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-1">Contract value: {money(doc.meta?.contract_value || 0)}</p>
                <div className="text-xs text-[#050a1a]/70 mt-3 line-clamp-2 leading-relaxed">
                  Timeline: {doc.meta?.timeline || "—"}
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-3">
                <span className="font-mono text-[10px] text-slate-400">Duration: {doc.meta?.project_duration || "—"} Days</span>
                <button
                  onClick={() => setSelectedSow(doc)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2455FF]/10 border border-[#2455ff]/15 text-[#2455FF] px-3.5 py-1.5 font-semibold text-xs hover:bg-[#2455FF]/20 transition"
                >
                  <Eye size={12} />
                  <span>View Contract Details</span>
                </button>
              </div>
            </GlassCard>
          ))}
          {sows.length === 0 && (
            <div className="col-span-2">
              <EmptyState text="No Statement of Work agreements have been prepared yet." />
            </div>
          )}
        </div>

        {/* SOW Viewer Modal */}
        <AnimatePresence>
          {selectedSow && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4" onMouseDown={() => setSelectedSow(null)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-3xl rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl flex flex-col max-h-[85vh] text-[#050a1a] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3 mb-2 shrink-0">
                  <h4 className="font-cine text-xl tracking-wider text-[#050a1a]">{selectedSow.title}</h4>
                  <button onClick={() => setSelectedSow(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-655">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {/* SOW Commercial Terms */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 border rounded-xl p-4 text-xs font-mono">
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">Client Cost</span>
                      <strong className="text-emerald-700">{money(selectedSow.meta?.cost || 0)}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">Contract Total</span>
                      <strong className="text-slate-700">{money(selectedSow.meta?.contract_value || 0)}</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">Profit Margin</span>
                      <strong className="text-[#2455FF]">{selectedSow.meta?.profit_margins || "—"}%</strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[9px] uppercase">Duration</span>
                      <strong>{selectedSow.meta?.project_duration || "—"} Days</strong>
                    </div>
                  </div>

                  {/* SOW Details List */}
                  <div className="space-y-2 text-xs leading-relaxed border border-[#2455ff]/10 p-4 rounded-xl bg-white/50">
                    <div><strong>Project Timeline Roadmap</strong>: {selectedSow.meta?.timeline || "—"}</div>
                    <div className="mt-2"><strong>Milestones Breakdown</strong>: {selectedSow.meta?.milestones || "—"}</div>
                    <div className="mt-2"><strong>Payment Schedule & Terms</strong>: {selectedSow.meta?.payment_terms || "—"}</div>
                    <div className="mt-2"><strong>Support & Maintenance</strong>: {selectedSow.meta?.support_terms || "—"}</div>
                  </div>

                  {/* Markdown agreement */}
                  <div className="prose max-w-none text-xs leading-relaxed text-[#050a1a]/85 border p-4 rounded-xl bg-white/30 font-mono">
                    {selectedSow.body_markdown.split("\n").map((line, idx) => {
                      if (line.startsWith("# ")) return <h1 key={idx} className="font-cine text-xl text-[#2455FF] mt-2 mb-1">{line.slice(2)}</h1>;
                      if (line.startsWith("## ")) return <h2 key={idx} className="font-cine text-sm text-[#050a1a] mt-2 mb-1 border-b border-slate-200 pb-0.5">{line.slice(3)}</h2>;
                      if (!line.trim()) return <div key={idx} className="h-1.5" />;
                      return <p key={idx} className="mb-1">{line}</p>;
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2c. Admin Communications (Support center)
  if (activeTab === "adminCommunications") {
    const activeMessages = messages.filter(m => 
      adminUser && (
        (m.sender_id === adminUser.id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === adminUser.id)
      )
    ).reverse();

    const handleSendMessageToAdmin = async (e) => {
      e.preventDefault();
      if (!newMessageText.trim() || !adminUser) return;
      try {
        await api.post("/messages", {
          receiver_id: adminUser.id,
          message_text: newMessageText.trim()
        });
        toast.success("Message sent to Admin");
        setNewMessageText("");
        const res = await api.get("/messages");
        setMessages(res.data || []);
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    return (
      <div className="space-y-6 max-w-xl">
        <SectionTitle title="Admin Communication Center" subtitle="Directly message the accounts manager or delivery administrator" />

        <GlassCard hoverLift={false} className="h-[430px] flex flex-col justify-between p-4 bg-white/70">
          {adminUser ? (
            <div className="flex flex-col h-full justify-between">
              {/* Header */}
              <div className="border-b border-[#2455ff]/10 pb-3.5 mb-3">
                <h4 className="font-semibold text-[#050a1a] text-xs">Chatting with Admin: {adminUser.name}</h4>
                <span className="text-[9px] text-[#2455FF] font-mono">{adminUser.email}</span>
              </div>

              {/* Message log */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-4">
                {activeMessages.map((m, idx) => {
                  const isAdminMsg = m.sender_role === "SUPER_ADMIN";
                  return (
                    <div key={idx} className={`flex ${isAdminMsg ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                        !isAdminMsg 
                          ? "bg-[#2455FF] text-white rounded-br-none" 
                          : "bg-slate-100 border border-slate-200/50 text-[#050a1a] rounded-bl-none"
                      }`}>
                        {m.message_text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessageToAdmin} className="flex gap-2 border-t border-[#2455ff]/10 pt-3">
                <input
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Ask Admin about pricing, milestones, or timeline..."
                  className="flex-1 rounded-xl bg-white/75 border border-[#2455ff]/15 px-3.5 py-2.5 text-xs text-[#050a1a] outline-none"
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

  // 2d. Change Request Tab
  if (activeTab === "changeRequests") {
    const activeProjects = data.projects.filter(p => p.status === "ACTIVE");

    const handleCreateCR = async (e) => {
      e.preventDefault();
      if (!newCRTitle.trim() || !newCRDesc.trim() || activeProjects.length === 0) return;
      try {
        const projectId = activeProjects[0].id;
        await api.post("/change-requests", {
          project_id: projectId,
          title: newCRTitle.trim(),
          description: newCRDesc.trim()
        });
        toast.success("Change request submitted for Admin review");
        setNewCRTitle("");
        setNewCRDesc("");
        setCreatingCR(false);
        // refresh list
        const res = await api.get("/change-requests");
        setChangeRequests(res.data || []);
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    const handleCRClientDecision = async (crId, approved) => {
      try {
        await api.post(`/change-requests/${crId}/client-decision`, {
          approved,
          comments: ""
        });
        toast.success(approved ? "Estimation approved by Client" : "Estimation rejected");
        setSelectedCR(null);
        const res = await api.get("/change-requests");
        setChangeRequests(res.data || []);
      } catch (err) {
        toast.error(apiError(err));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <SectionTitle title="Scope Change Requests" subtitle="Request feature modifications and review engineering estimations" />
          <button
            onClick={() => setCreatingCR(!creatingCR)}
            className="flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2 text-xs font-semibold"
          >
            {creatingCR ? "View Requests" : "New Change Request"}
          </button>
        </div>

        {creatingCR ? (
          <GlassCard className="max-w-xl" hoverLift={false}>
            <form onSubmit={handleCreateCR} className="space-y-4">
              <h3 className="font-semibold text-[#050a1a] text-sm border-b border-[#2455ff]/10 pb-2">Submit Feature Change Request</h3>
              <FormField label="Feature Title" value={newCRTitle} onChange={(v) => setNewCRTitle(v)} required />
              <div className="space-y-1">
                <label className="block text-xs font-semibold">Modification Description</label>
                <textarea
                  value={newCRDesc}
                  onChange={(e) => setNewCRDesc(e.target.value)}
                  placeholder="Provide details about the feature requirements..."
                  className="w-full h-32 rounded-xl border bg-white/75 p-3 text-xs outline-none text-[#050a1a]"
                  required
                />
              </div>
              <button type="submit" className="w-full rounded-xl bg-[#2455FF] text-white py-3 font-semibold text-xs transition">
                Submit Change Request
              </button>
            </form>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <GlassCard className="lg:col-span-1" hoverLift={false}>
              <h3 className="font-semibold text-sm mb-4">Requests list</h3>
              <div className="space-y-2">
                {changeRequests.map(cr => (
                  <button
                    key={cr.id}
                    onClick={() => setSelectedCR(cr)}
                    className={`w-full p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                      selectedCR?.id === cr.id ? "border-[#2455FF] bg-[#2455FF]/5" : "border-slate-100 hover:bg-slate-50 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full mb-1">
                      <span className="font-semibold text-xs">{cr.title}</span>
                      <GlowBadge status={cr.status.toUpperCase()} />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono mt-1">Submitted: {new Date(cr.created_at).toLocaleDateString()}</span>
                  </button>
                ))}
                {changeRequests.length === 0 && <EmptyState text="No change requests submitted." />}
              </div>
            </GlassCard>

            {/* Details */}
            <GlassCard className="lg:col-span-2" hoverLift={false}>
              {selectedCR ? (
                <div className="space-y-4">
                  <div className="border-b border-[#2455ff]/10 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-[#050a1a] text-sm">{selectedCR.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Request ID: {selectedCR.id}</span>
                    </div>
                    <GlowBadge status={selectedCR.status.toUpperCase()} />
                  </div>

                  <p className="text-xs text-[#050a1a]/85 leading-relaxed bg-white border p-3.5 rounded-xl">
                    {selectedCR.description}
                  </p>

                  {/* Estimation reviews */}
                  {selectedCR.status === "admin_approved" && (
                    <div className="rounded-xl border p-4 bg-slate-50 space-y-4">
                      <div className="font-semibold text-[10px] uppercase text-slate-400 font-mono tracking-wider">Review approved estimation terms</div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400">Total Estimation Hours</span>
                          <strong>{selectedCR.estimation_hours} Hours</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">Notes & Milestones Impact</span>
                          <strong>"{selectedCR.estimation_notes}"</strong>
                        </div>
                      </div>

                      {selectedCR.admin_comments && (
                        <div className="text-xs bg-white p-3 rounded-lg border">
                          <strong>Admin Notes:</strong> "{selectedCR.admin_comments}"
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCRClientDecision(selectedCR.id, true)}
                          className="rounded-xl bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-semibold transition"
                        >
                          Approve Estimation & Authorize Dev
                        </button>
                        <button
                          onClick={() => handleCRClientDecision(selectedCR.id, false)}
                          className="rounded-xl border border-rose-500/20 bg-rose-50 hover:bg-rose-100/50 text-rose-700 px-4 py-2.5 text-xs font-semibold transition"
                        >
                          Reject Estimation
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedCR.status === "client_approved" && (
                    <span className="font-mono text-xs text-[#2455FF] italic block">
                      Estimation approved. Awaiting Admin authorization to deploy resources and start sprints...
                    </span>
                  )}

                  {selectedCR.status === "in_development" && (
                    <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-250 text-emerald-800 text-xs">
                      <strong>Sprint Active</strong>: Engineering is actively developing this request.
                    </div>
                  )}

                  {selectedCR.status === "submitted" && (
                    <span className="font-mono text-xs text-amber-600 italic block">
                      Submitted request. Awaiting Admin review to forward for developer estimation...
                    </span>
                  )}

                  {selectedCR.status === "under_dev_estimation" && (
                    <span className="font-mono text-xs text-slate-400 italic block">
                      Technical estimation under progress by developers...
                    </span>
                  )}
                </div>
              ) : (
                <EmptyState text="Select a change request from the queue to view details." />
              )}
            </GlassCard>
          </div>
        )}
      </div>
    );
  }

  // 3. Billing center Tab
  if (activeTab === "finance") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Invoices & Transactions" subtitle="View invoice balances, linked receipts, and transaction records" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unpaid Invoices */}
          <GlassCard hoverLift={false} className="space-y-4">
            <h3 className="font-semibold text-sm text-[#050a1a] border-b border-[#2455ff]/10 pb-2">Outstanding Invoices</h3>
            <div className="space-y-3">
              {data.finance.invoices.filter(i => i.status !== "PAID").map((inv) => (
                <div key={inv.id} className="rounded-xl border border-[#2455FF]/10 bg-white/50 p-4 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-[#050a1a]">{money(inv.amount)}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {inv.reference}</div>
                  </div>
                  <button
                    onClick={() => handlePayInvoice(inv)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-2 font-mono uppercase text-[9px] font-semibold transition"
                  >
                    <CreditCard size={11} />
                    <span>Pay Invoice</span>
                  </button>
                </div>
              ))}
              {data.finance.invoices.filter(i => i.status !== "PAID").length === 0 && (
                <div className="text-slate-400 text-xs font-mono py-2">No pending outstanding invoices.</div>
              )}
            </div>
          </GlassCard>

          {/* Paid History */}
          <GlassCard hoverLift={false} className="space-y-4">
            <h3 className="font-semibold text-sm text-[#050a1a] border-b border-[#2455ff]/10 pb-2">Paid History</h3>
            <div className="space-y-3">
              {data.finance.invoices.filter(i => i.status === "PAID").map((inv) => (
                <div key={inv.id} className="rounded-xl border border-[#2455FF]/10 bg-white/50 p-4 flex justify-between items-center text-xs text-slate-500">
                  <div>
                    <div className="font-semibold text-[#050a1a]">{money(inv.amount)}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {inv.reference}</div>
                  </div>
                  <GlowBadge status="Paid" />
                </div>
              ))}
              {data.finance.invoices.filter(i => i.status === "PAID").length === 0 && (
                <div className="text-slate-400 text-xs font-mono py-2">No transaction history.</div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Invoice Pay Simulation Dialog */}
        <AnimatePresence>
          {payingInvoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050a1a]/30 backdrop-blur-sm p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl border border-[#2455FF]/15 bg-white p-6 shadow-2xl space-y-4 text-[#050a1a]"
              >
                <div className="flex items-center justify-between border-b border-[#2455FF]/10 pb-3">
                  <h4 className="font-cine text-lg tracking-wider text-[#050a1a]">Pay Invoice</h4>
                  <button onClick={() => setPayingInvoice(null)} className="rounded-lg p-1 text-slate-400 hover:text-slate-650">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-center">
                  <div className="text-slate-400 text-xs font-mono">Invoice Balance</div>
                  <div className="text-3xl font-display text-[#050a1a] mt-1">{money(payingInvoice.amount)}</div>
                </div>

                <div className="space-y-3.5">
                  <FormField label="Card Number" defaultValue="4242 •••• •••• 4242" disabled />
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Expiration" defaultValue="12/28" disabled />
                    <FormField label="CVC" defaultValue="•••" disabled />
                  </div>

                  <button
                    onClick={confirmPayment}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-semibold text-sm transition mt-4"
                  >
                    Authorize Payment
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 4. Documents Portal Tab
  if (activeTab === "documents") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Client documents" subtitle="Review statement of works, service level contracts, specs, and PRD uploads" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userDocs.map((doc) => (
            <GlassCard key={doc.id} hoverLift={true} className="flex justify-between items-center p-5">
              <div>
                <h4 className="font-semibold text-xs text-[#050a1a]">{doc.title}</h4>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Type: {doc.type} · Created: {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMilestone({ milestone: { name: doc.title }, prdText: doc.body_markdown });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2455FF]/10 border border-[#2455ff]/15 text-[#2455FF] px-4 py-2 font-semibold text-xs hover:bg-[#2455FF]/20 transition"
              >
                <Download size={14} />
                <span>View Doc</span>
              </button>
            </GlassCard>
          ))}
          {userDocs.length === 0 && <div className="col-span-2"><EmptyState text="No document files linked." /></div>}
        </div>
      </div>
    );
  }

  // 5. Support consultation simulator
  if (activeTab === "support") {
    return (
      <div className="space-y-6 max-w-xl">
        <SectionTitle title="LUMI AI Support Consultation" subtitle="Direct support connection to your LUMI AI delivery assistant" />

        <GlassCard hoverLift={false} className="h-[420px] flex flex-col justify-between p-4 bg-white/70">
          {/* Message log */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-4">
            {chatMessages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                  m.role === "user" 
                    ? "bg-[#2455FF] text-white rounded-br-none" 
                    : "bg-slate-100 border border-slate-200/50 text-[#050a1a] rounded-bl-none"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {sendingChat && (
              <div className="flex justify-start">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider animate-pulse">LUMI is typing...</span>
              </div>
            )}
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-[#2455ff]/10 pt-3">
            <input
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
              placeholder="Ask LUMI about milestone details..."
              className="flex-1 rounded-xl bg-white/75 border border-[#2455ff]/15 px-3.5 py-2.5 text-xs text-[#050a1a] outline-none focus:ring-2 focus:ring-[#2455FF]/30 transition"
            />
            <button
              type="submit"
              disabled={sendingChat || !newChatMessage.trim()}
              className="rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white p-2.5 transition shrink-0"
            >
              <Send size={15} />
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  // 6. Project history Activity Tab
  if (activeTab === "activity") {
    return (
      <div className="space-y-6">
        <SectionTitle title="Delivery activity trail" subtitle="Immutable operations audit trail tracking your project developments" />

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
                    Updated by {act.userName} · Scope: {act.entityType}
                  </div>
                </div>
                <time className="text-[10px] text-slate-500 font-mono">{new Date(act.createdAt).toLocaleString()}</time>
              </div>
            ))}
            {data.activity.length === 0 && <EmptyState text="No activity records." />}
          </div>
        </GlassCard>
      </div>
    );
  }

  // 7. Client Account settings
  if (activeTab === "settings") {
    return (
      <div className="space-y-6 max-w-xl">
        <SectionTitle title="Client Account Details" subtitle="View registration specs associated with your client profile" />

        <GlassCard hoverLift={false} className="space-y-4">
          <FormField label="Full Name" defaultValue={user.name} disabled />
          <FormField label="Authorized Email" defaultValue={user.email} disabled />
          <FormField label="Company Organisation" defaultValue={user.company} disabled />
        </GlassCard>
      </div>
    );
  }

  return null;
}
