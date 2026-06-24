import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, LogOut, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Team", href: "#team" },
  { label: "HQ's", href: "#hq" },
  { label: "FAQ's", href: "#faq" },
  { label: "Reviews", href: "#reviews" },
];

const JESSE_DP =
  "https://customer-assets.emergentagent.com/job_blueprint-ai-68/artifacts/9gbr64ag_image.png";

export const Navbar = ({ user, onLoginClick, onLogout }) => {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed top-0 inset-x-0 z-50"
      data-testid="lumi-navbar"
    >
      <div className="mx-auto mt-4 max-w-[1320px] px-4">
        <div className="glass-strong rounded-full px-3 py-2 flex items-center gap-4">
          {/* ============ LEFT — LUMI AI | LUPUS AI LABS ============ */}
          <div
            className="flex items-center gap-3 pl-2 pr-2"
            data-testid="navbar-brand-left"
          >
            {/* LUMI logomark */}
            <div className="flex items-center gap-2">
              <span className="font-cine text-[16px] tracking-[0.14em] text-[#050a1a] leading-none">
                LUMI&nbsp;AI
              </span>
            </div>

            <span className="h-5 w-px bg-[#2455FF]/30" />

            {/* LUPUS AI LABS — accent block */}
            <div className="flex items-center">
              <span className="relative inline-flex font-display text-[18px] sm:text-[19px] tracking-[0.05em] leading-none">
                <span className="text-[#2455FF]">LUPUS</span>
                <span className="ml-1 text-[#050a1a]">AI&nbsp;LABS</span>
              </span>
            </div>
          </div>

          {/* ============ CENTER — Nav links (truly centered) ============ */}
          <nav
            className="hidden lg:flex items-center gap-1 mx-auto"
            data-testid="navbar-links"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                data-testid={`nav-link-${item.label.toLowerCase().replace(/[^a-z]/g, "")}`}
                className="group relative px-3.5 py-2 text-[13px] font-medium text-[#050a1a]/70 hover:text-[#2455FF] transition-colors"
              >
                <span className="relative">
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#2455FF] transition-all duration-300 group-hover:w-full" />
                </span>
              </a>
            ))}
          </nav>

          {/* spacer for mobile when nav hidden */}
          <div className="lg:hidden flex-1" />

          {/* ============ RIGHT — Say Your Name / User pill ============ */}
          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="group relative inline-flex items-center gap-1.5 rounded-2xl border border-[#2455FF]/20 bg-white/80 hover:bg-[#2455FF]/5 px-3 py-2 text-[13px] font-semibold text-[#050a1a] transition-all duration-300 shadow-sm"
              data-testid="navbar-dashboard-btn"
            >
              <LayoutDashboard className="h-4 w-4 text-[#2455FF]" />
              <span className="font-cine tracking-[0.12em] text-[#050a1a] hidden sm:inline">
                Dashboard
              </span>
            </a>

            {!user ? (
              <button
                onClick={onLoginClick}
                data-testid="navbar-say-your-name-btn"
                className="group relative inline-flex items-center gap-2 rounded-2xl bg-[#050a1a] text-white pl-4 pr-2 py-2 text-[13px] font-semibold ring-lumi hover:bg-[#0b1530] transition-colors"
              >
                <span className="relative z-10 font-cine tracking-[0.14em]">
                  Say&nbsp;Your&nbsp;Name
                </span>
                <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[#2455FF]">
                  <ArrowUpRight
                    className="h-4 w-4 text-white transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={2.4}
                  />
                </span>
              </button>
            ) : (
              <div
                className="relative inline-flex items-center gap-2 rounded-full bg-white/70 ring-1 ring-[#2455FF]/25 pl-1 pr-3 py-1 shadow-[0_8px_24px_-12px_rgba(36,85,255,0.45)]"
                data-testid="navbar-user-pill"
              >
                <span className="relative h-8 w-8 rounded-full overflow-hidden ring-2 ring-[#2455FF]/30">
                  <img
                    src={JESSE_DP}
                    alt={user.name}
                    className="h-full w-full object-cover"
                    draggable="false"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#25D366] ring-2 ring-white" />
                </span>
                <div className="leading-tight pr-1">
                  <div
                    className="font-cine text-[13px] tracking-[0.14em] text-[#050a1a]"
                    data-testid="navbar-user-name"
                  >
                    {user.name}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#2455FF]/70">
                    Lab Member · Online
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  aria-label="Log out"
                  data-testid="navbar-logout-btn"
                  className="h-7 w-7 rounded-full bg-[#050a1a]/5 hover:bg-[#050a1a]/10 inline-flex items-center justify-center text-[#050a1a]/55 hover:text-[#2455FF] transition"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Navbar;
