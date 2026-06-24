import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Globe2,
  Wallet,
  PackageCheck,
  ArrowRight,
  CornerDownLeft,
  CheckCircle2,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "./Navbar";
import WhatsAppLoginModal from "./WhatsAppLoginModal";
import AnimatedPhone from "./AnimatedPhone";
import { playWelcomeChime } from "@/lib/sfx";
import { useUser } from "@/lib/userStore";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HERO_IMG =
  "https://customer-assets.emergentagent.com/job_56744677-6f22-48af-a9ef-c90f8234cb73/artifacts/wy82csnv_ChatGPT%20Image%20Jun%2015%2C%202026%2C%2009_15_50%20PM.png";

const PROMPTS = [
  "I want a MCP",
  "I want a Personal Agent",
  "I want to automate my Restaurant",
  "I want a Sales Agent",
  "I want AI Consultation",
  "I need an AI Chatbot",
  "I want Workflow Automation",
  "I want AI Voice Agent",
  "I want to build an AI SaaS",
  "I need AI Integration",
  "I want AI Strategy",
];

const METRICS = [
  { icon: PackageCheck, label: "Delivered", value: "100+", sub: "AI Builds" },
  { icon: Globe2, label: "Countries", value: "5", sub: "Global Reach" },
  { icon: Wallet, label: "MRR", value: "10K$+", sub: "Recurring" },
  { icon: Sparkles, label: "Velocity", value: "Shipped", sub: "Before Deadline" },
];

const CINEMA_TAGS = [
  "Enter The AI Lab",
  "Building Intelligence",
  "From Idea To Impact",
  "Precision Engineered AI",
  "Your Problem. Our Formula.",
  "AI Crafted For Growth",
];

/* -----------------------------------------------------------
   Cycling placeholder w/ typing effect
----------------------------------------------------------- */
function useTypewriter(words, { typing = 55, pause = 1400, deleting = 28 } = {}) {
  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | deleting

  useEffect(() => {
    const current = words[idx % words.length];
    let timer;
    if (phase === "typing") {
      if (sub.length < current.length) {
        timer = setTimeout(() => setSub(current.slice(0, sub.length + 1)), typing);
      } else {
        timer = setTimeout(() => setPhase("deleting"), pause);
      }
    } else {
      if (sub.length > 0) {
        timer = setTimeout(() => setSub(current.slice(0, sub.length - 1)), deleting);
      } else {
        timer = setTimeout(() => {
          setIdx((i) => (i + 1) % words.length);
          setPhase("typing");
        }, 60);
      }
    }
    return () => clearTimeout(timer);
  }, [sub, phase, idx, words, typing, pause, deleting]);

  return sub;
}

/* -----------------------------------------------------------
   Hero
----------------------------------------------------------- */
export const Hero = () => {
  const placeholder = useTypewriter(PROMPTS);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  // Particles — randomized once via lazy initializer (purity-safe, runs once)
  const [particles] = useState(() =>
    Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 40,
      delay: -Math.random() * 9,
      scale: 0.5 + Math.random() * 1.2,
    }))
  );

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const value = (input || placeholder || "").trim();
    if (!value) return;
    if (!user) {
      setModalIntent("login");
      setModalStep("choice");
      setModalMode("signup");
      setPostAuthAction("open-studio");
      sessionStorage.setItem("lumi.firstPrompt", value);
      setLoginOpen(true);
      return;
    }
    sessionStorage.setItem("lumi.firstPrompt", value);
    setInput("");
    navigate("/studio");
  };

  // ===== Login state =====
  const navigate = useNavigate();
  const [user, setUser] = useUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [modalIntent, setModalIntent] = useState("login"); // "login" | "book"
  const [modalStep, setModalStep] = useState("choice");    // "choice" | "form"
  const [modalMode, setModalMode] = useState("signup");    // "signup" | "signin"
  // pending action after auth: "open-studio" | null
  const [postAuthAction, setPostAuthAction] = useState(null);

  const openLogin = () => {
    setModalIntent("login");
    setModalStep("choice");
    setModalMode("signup");
    setLoginOpen(true);
  };
  const openBook = async () => {
    // If already logged in, book directly without showing the auth modal.
    if (user?.id) {
      try {
        const phone = (user.phone || "").trim();
        // Try to extract country code + digits from stored "+91 9876543210"
        let code = "+91";
        let digits = phone.replace(/\D/g, "");
        const m = phone.match(/^(\+\d{1,4})\s*(.*)$/);
        if (m) {
          code = m[1];
          digits = m[2].replace(/\D/g, "");
        }
        await axios.post(`${API}/leads`, {
          name: user.name || "",
          phone: digits,
          country_code: code,
          intent: "book",
          mode: "signin",
          source: "hero-cta",
        });
        playWelcomeChime();
        toast.success(`We'll call you, ${user.name || "there"}.`, {
          description: `Slot reserved. Our team will WhatsApp ${user.phone} within 24 hours.`,
          duration: 4600,
          icon: <PhoneCall className="h-5 w-5 text-[#2455FF]" strokeWidth={2.6} />,
        });
      } catch (err) {
        toast.error("Couldn't book your call.", {
          description: err?.response?.data?.detail || err.message,
        });
      }
      return;
    }
    // Not logged in — open auth modal in "book" intent
    setModalIntent("book");
    setModalStep("choice");
    setModalMode("signup");
    setLoginOpen(true);
  };

  const handleLoginSubmit = async ({ phone, name, code, mode }) => {
    const wasBook = modalIntent === "book";
    const digits = (phone || "").replace(/\D/g, "");
    try {
      const res = await axios.post(`${API}/leads`, {
        name: name || "",
        phone: digits,
        country_code: code || "+91",
        intent: wasBook ? "book" : "login",
        mode: mode || "signup",
        source: "hero",
      });
      const saved = res.data;
      setUser({ name: saved.name, phone: saved.full_phone, id: saved.id });
      setLoginOpen(false);
      playWelcomeChime();
      const isSignin = mode === "signin";
      if (wasBook) {
        toast.success(`We'll call you, ${saved.name}.`, {
          description: `Slot reserved. Our team will WhatsApp ${saved.full_phone} within 24 hours.`,
          duration: 4600,
          icon: <PhoneCall className="h-5 w-5 text-[#2455FF]" strokeWidth={2.6} />,
        });
      } else if (isSignin) {
        toast.success(`Welcome back, ${saved.name}.`, {
          description: "Signed in. The lab missed you.",
          duration: 4200,
          icon: <CheckCircle2 className="h-5 w-5 text-[#2455FF]" strokeWidth={2.6} />,
        });
      } else {
        toast.success(`Welcome, ${saved.name}.`, {
          description: "Account created. The cook begins.",
          duration: 4200,
          icon: <CheckCircle2 className="h-5 w-5 text-[#25D366]" strokeWidth={2.6} />,
        });
      }
      // Continue any pending action (e.g. user typed in command bar before logging in)
      if (postAuthAction === "open-studio") {
        setPostAuthAction(null);
        setTimeout(() => navigate("/studio"), 250);
      }
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.message || "Please try again.";
      toast.error("Could not save your details.", { description: String(detail) });
    }
  };

  const handleLogout = () => {
    setUser(null);
    toast("Signed out.", { description: "See you in the lab.", duration: 2400 });
  };

  const onBookCall = () => openBook();

  return (
    <div className="relative w-full bg-white">
      <Navbar
        user={user}
        onLoginClick={openLogin}
        onLogout={handleLogout}
      />
      <WhatsAppLoginModal
        open={loginOpen}
        intent={modalIntent}
        step={modalStep}
        onStepChange={setModalStep}
        mode={modalMode}
        onModeChange={setModalMode}
        onClose={() => setLoginOpen(false)}
        onSubmit={handleLoginSubmit}
      />

      {/* ===================== HERO ===================== */}
      <section
        className="relative w-full overflow-hidden"
        data-testid="hero-section"
        style={{ minHeight: "100vh" }}
      >
        {/* Background — blueprint grid */}
        <div className="absolute inset-0 bp-grid" aria-hidden="true" />
        <div className="absolute inset-0 bp-wash" aria-hidden="true" />

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.id}
              className="particle"
              style={{
                left: `${p.left}%`,
                bottom: `${p.bottom}%`,
                animationDelay: `${p.delay}s`,
                transform: `scale(${p.scale})`,
              }}
            />
          ))}
        </div>

        {/* Bottom landmark — full-width panoramic */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none select-none" aria-hidden="true">
          <div
            className="relative w-[110%] -ml-[5%] landmark-pan"
            style={{
              maskImage:
                "linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 92%, rgba(0,0,0,0) 100%)",
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 92%, rgba(0,0,0,0) 100%)",
              WebkitMaskComposite: "source-in",
              maskComposite: "intersect",
            }}
          >
            <img
              src={HERO_IMG}
              alt="Hyderabad · Vizag · Karnataka — blueprint skyline"
              className="w-full h-auto block opacity-90 mix-blend-multiply"
              draggable="false"
            />
          </div>
          {/* Soft cyan glow under skyline */}
          <div className="absolute inset-x-0 -bottom-8 h-40 bg-gradient-to-t from-[#00e5ff]/10 to-transparent blur-2xl" />
        </div>

        {/* Cinematic floating tags — left edge */}
        <div className="hidden xl:flex flex-col gap-3 absolute left-6 top-[28%] z-10">
          {CINEMA_TAGS.slice(0, 3).map((t, i) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.15, duration: 0.7 }}
              className="float-y"
              style={{ animationDelay: `${i * 0.6}s` }}
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#2455FF]/70 inline-flex items-center gap-2">
                <span className="h-px w-6 bg-[#2455FF]/50" />
                {t}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="hidden xl:flex flex-col gap-3 absolute right-6 top-[26%] z-10 items-end">
          {CINEMA_TAGS.slice(3).map((t, i) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.15, duration: 0.7 }}
              className="float-y"
              style={{ animationDelay: `${i * 0.7}s` }}
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#2455FF]/70 inline-flex items-center gap-2">
                {t}
                <span className="h-px w-6 bg-[#2455FF]/50" />
              </span>
            </motion.div>
          ))}
        </div>

        {/* ===== Center content ===== */}
        <div className="relative z-20 max-w-[1240px] mx-auto px-6 pt-36 sm:pt-40 pb-24 flex flex-col items-center text-center">
          {/* Since badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5"
            data-testid="hero-since-badge"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2455FF]" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#050a1a]/70">
              Since 2023 · Lab Online
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-6 font-display text-[20vw] sm:text-[14vw] lg:text-[180px] leading-[1.05] pb-2 pt-1 tracking-tight text-lumi-gradient overflow-visible"
            style={{ paddingBottom: "0.12em", paddingTop: "0.06em" }}
            data-testid="hero-main-heading"
          >
            AI&nbsp;AS&nbsp;SERVICE
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mt-7 max-w-[680px]"
            data-testid="hero-subtitle"
          >
            <p className="font-cine text-2xl sm:text-3xl tracking-[0.08em] text-[#050a1a]">
              Yu Know the Business.{" "}
              <span className="text-[#2455FF]">We Know the AI.</span>
            </p>
            <p className="mt-3 text-[13.5px] sm:text-sm text-[#050a1a]/60 max-w-[520px] mx-auto leading-relaxed">
              An AI lab born in Hyderabad — engineering agents, automations and
              custom intelligence systems for builders shipping to the world.
            </p>
          </motion.div>

          {/* ===== AI Command bar ===== */}
          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7 }}
            onSubmit={handleSubmit}
            className="relative mt-10 w-full max-w-[760px] bracket"
            data-testid="ai-command-bar"
          >
            <div className="glass-strong rounded-2xl p-2 pl-4 flex items-center gap-3">
              {/* Status dot + label */}
              <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-[#2455FF]/15">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2455FF]" />
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-[#050a1a]/60">
                  lumi://lab
                </span>
              </div>

              {/* Input + cycling placeholder */}
              <div className="relative flex-1 min-w-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-transparent outline-none font-mono text-[14.5px] text-[#050a1a] placeholder-transparent caret-[#2455FF] py-2"
                  placeholder="Describe your AI"
                  aria-label="Describe what you want to build"
                  data-testid="ai-command-input"
                />
                {!input && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center font-mono text-[14.5px] text-[#050a1a]/55"
                  >
                    <span className="text-[#2455FF] mr-2">{">"}</span>
                    <span>{placeholder}</span>
                    <span className="caret" />
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                data-testid="ai-command-submit"
                className="group inline-flex items-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] transition-colors text-white px-4 py-2.5 text-[13px] font-semibold"
              >
                <span className="hidden sm:inline">Run</span>
                <CornerDownLeft className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            {/* Scanline */}
            <div className="absolute inset-x-2 top-0 h-px overflow-hidden rounded-full pointer-events-none">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent scanline" />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#050a1a]/45">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded border border-[#2455FF]/25 bg-white/70 text-[#2455FF]">
                Enter
              </kbd>
              <span>to enter the lab</span>
            </div>
          </motion.form>

          {/* ===== Metrics ===== */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.95 } },
            }}
            className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-[1040px]"
            data-testid="hero-metrics"
          >
            {METRICS.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
                  }}
                  whileHover={{ y: -4 }}
                  className="glass rounded-2xl p-4 sm:p-5 text-left relative group"
                  data-testid={`metric-card-${i}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#2455FF]/8 ring-1 ring-[#2455FF]/15">
                      <Icon className="h-4 w-4 text-[#2455FF]" strokeWidth={2.2} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#2455FF]/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-4 font-display text-4xl sm:text-5xl leading-none text-[#050a1a]">
                    {m.value}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="font-cine text-[13px] tracking-[0.14em] text-[#050a1a]">
                      {m.label}
                    </div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#050a1a]/50">
                      {m.sub}
                    </div>
                  </div>
                  <div className="absolute -bottom-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#2455FF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              );
            })}
          </motion.div>

          {/* CTA — centered Book Your Call with animated number */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.7 }}
            className="mt-10 flex justify-center w-full"
          >
            <button
              onClick={onBookCall}
              data-testid="hero-cta-book-call"
              className="group relative inline-flex items-center gap-3 rounded-full bg-[#050a1a] text-white pl-5 pr-2 py-2.5 text-sm font-semibold ring-lumi hover:bg-[#0b1530] transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E5FF]" />
              </span>
              <span className="font-cine tracking-[0.14em] text-[15px]">
                Book&nbsp;Your&nbsp;Call
              </span>
              <span className="hidden sm:inline opacity-50">·</span>
              <AnimatedPhone
                prefix="+91 98"
                className="hidden sm:inline-flex text-[14px] text-[#00E5FF]"
              />
              <span className="inline-flex h-9 px-3 items-center gap-1.5 rounded-full bg-[#2455FF] text-white">
                <PhoneCall className="h-4 w-4" strokeWidth={2.6} />
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.6}
                />
              </span>
            </button>
          </motion.div>
        </div>

        {/* Bottom strip — lab readouts (above the landmark) */}
        <div className="absolute bottom-3 inset-x-0 z-10 pointer-events-none">
          <div className="max-w-[1240px] mx-auto px-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-[#2455FF]/60">
            <span>LUMI · LAB-01</span>
            <span className="hidden md:inline">Hyderabad · 17.3850° N, 78.4867° E</span>
            <span>STATUS: SYNTHESIZING</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
