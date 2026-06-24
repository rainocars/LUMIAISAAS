import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function CountUp({ value, duration = 800 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let numericStr = String(value).replace(/[^0-9.]/g, "");
    const numericVal = parseFloat(numericStr);
    
    if (isNaN(numericVal) || numericVal === 0) {
      setCount(value);
      return;
    }

    let start = 0;
    const incrementTime = 25;
    const totalSteps = duration / incrementTime;
    const increment = numericVal / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= numericVal) {
        clearInterval(timer);
        setCount(numericVal);
      } else {
        setCount(Math.ceil(start));
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  if (typeof value === "string" && value.includes("₹")) {
    return <>₹{new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(count)}</>;
  }
  if (typeof value === "string" && value.includes("$")) {
    return <>${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(count)}</>;
  }
  return <>{count}</>;
}

export function GlassCard({ children, className = "", delay = 0, hoverLift = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={hoverLift ? { y: -3, transition: { duration: 0.18 } } : {}}
      className={`glass relative overflow-hidden rounded-2xl p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function MetricCard({ icon: Icon, label, value, color = "#2455FF", delay = 0 }) {
  return (
    <GlassCard delay={delay} className="group">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#050a1a]/55">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="mt-3 text-2xl font-semibold text-[#050a1a] leading-none">
        <CountUp value={value} />
      </div>
      {/* Subtle hover gradient glow */}
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-[#2455FF]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </GlassCard>
  );
}

export function GlowBadge({ status = "" }) {
  const normalized = status.toUpperCase().replaceAll("_", " ");
  
  let styles = "bg-slate-50 text-slate-600 ring-slate-200";
  
  if (["CLIENT_APPROVED", "CLOSED", "ACTIVE", "PAID", "COMPLETED", "APPROVED"].includes(status)) {
    styles = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  } else if (["SENT_TO_CLIENT", "IN_PROGRESS", "TODO", "SENT"].includes(status)) {
    styles = "bg-amber-50 text-amber-700 ring-amber-200";
  } else if (["SUBMITTED_BY_DEVELOPER", "UNDER_ADMIN_REVIEW", "REVIEW"].includes(status)) {
    styles = "bg-violet-50 text-violet-700 ring-violet-200";
  } else if (["CLIENT_REQUESTED_CHANGES", "BACK_TO_DEVELOPER", "REJECTED", "SUSPENDED"].includes(status)) {
    styles = "bg-rose-50 text-rose-700 ring-rose-200";
  }
  
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ring-1 ${styles}`}>
      {normalized}
    </span>
  );
}

export function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="font-cine text-3xl tracking-[.06em] text-[#050a1a] uppercase">{title}</h2>
      {subtitle && <p className="text-sm text-[#050a1a]/50 mt-1">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ text = "No records found.", actionText, onAction }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2455FF]/25 bg-white/40 px-5 py-12 text-center text-sm text-[#050a1a]/45">
      <p className="font-mono text-xs uppercase tracking-wider text-slate-400">{text}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] px-4 py-2 font-mono text-xs uppercase tracking-wider text-white font-semibold transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export function FormField({ label, optional = false, error = "", ...props }) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="block text-xs font-semibold text-[#050a1a]">
        <span>{label}</span>
        {optional && <span className="text-slate-400 font-normal ml-1">optional</span>}
      </label>
      <input
        {...props}
        className="w-full rounded-xl border bg-white/75 px-4 py-3 outline-none focus:ring-2 focus:ring-[#2455FF]/30 text-[#050a1a] text-sm transition"
      />
      {error && <p className="text-[10px] text-rose-500 font-mono">{error}</p>}
    </div>
  );
}

export function FormSelect({ label, children, ...props }) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="block text-xs font-semibold text-[#050a1a]">{label}</label>
      <select
        {...props}
        className="w-full rounded-xl border bg-white/75 px-4 py-3 outline-none focus:ring-2 focus:ring-[#2455FF]/30 text-[#050a1a] text-sm transition"
      >
        {children}
      </select>
    </div>
  );
}
