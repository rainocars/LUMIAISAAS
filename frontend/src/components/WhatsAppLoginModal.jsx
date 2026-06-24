import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Loader2, ArrowLeft, UserPlus, LogIn } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+1",  flag: "🇺🇸", name: "USA" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+971",flag: "🇦🇪", name: "UAE" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+7",  flag: "🇷🇺", name: "Russia" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+880",flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+966",flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
];

/**
 * Get in touch modal — used for both "Say Your Name" and "Book Your Call".
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmit: ({ phone, name, code }) => void
 *  - intent: "login" | "book"   (changes subtitle copy + CTA label)
 */
export const WhatsAppLoginModal = ({
  open,
  onClose,
  onSubmit,
  intent = "login",
  step = "choice",
  onStepChange,
  mode = "signup",
  onModeChange,
}) => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("+91");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setStep = (s) => onStepChange?.(s);
  const setMode = (m) => onModeChange?.(m);

  const submit = (e) => {
    e?.preventDefault?.();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return;
    if (mode === "signup" && !name.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSubmit?.({
        phone: `${code} ${digits}`,
        name: name.trim(),
        code,
        mode,
      });
    }, 600);
  };

  const ctaLabel =
    mode === "signin"
      ? "Sign In"
      : intent === "book"
        ? "Book My Call"
        : "Create Account";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          data-testid="whatsapp-login-modal"
        >
          {/* Backdrop */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-[#050a1a]/35 backdrop-blur-sm"
            data-testid="whatsapp-modal-backdrop"
          />

          {/* Card */}
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative glass-strong rounded-3xl w-full max-w-[460px] p-6 sm:p-7 bracket"
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              data-testid="whatsapp-modal-close"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/60 ring-1 ring-[#2455FF]/15 hover:bg-white flex items-center justify-center text-[#050a1a]/60 hover:text-[#2455FF] transition"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>

            {/* Header — left-aligned title + optional back arrow */}
            <div className="pr-10 flex items-center gap-2.5">
              {step === "form" && (
                <button
                  onClick={() => setStep("choice")}
                  aria-label="Back"
                  data-testid="modal-back-btn"
                  className="h-8 w-8 rounded-full bg-white/60 ring-1 ring-[#2455FF]/15 hover:bg-white flex items-center justify-center text-[#050a1a]/60 hover:text-[#2455FF] transition"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
              )}
              <h3
                className="font-cine text-[26px] leading-none tracking-[0.06em] text-[#050a1a]"
                data-testid="modal-heading"
              >
                {step === "choice"
                  ? "Get\u00a0in\u00a0touch"
                  : mode === "signin"
                    ? "Sign\u00a0In"
                    : "Sign\u00a0Up"}
              </h3>
            </div>

            {/* ============ STEP 1 — CHOICE ============ */}
            {step === "choice" && (
              <div className="mt-5 flex flex-col items-center gap-3" data-testid="modal-choice-step">
                <p className="text-[13px] text-[#050a1a]/60 leading-snug text-center">
                  New to the lab or returning cook? Pick a door.
                </p>
                <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      setMode("signup");
                      setStep("form");
                    }}
                    data-testid="choice-signup-btn"
                    className="group relative w-full sm:w-[170px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1fbb5a] text-white px-4 py-3 text-sm font-semibold transition shadow-[0_10px_30px_-12px_rgba(37,211,102,0.6)]"
                  >
                    <UserPlus className="h-4 w-4" strokeWidth={2.6} />
                    <span className="font-cine tracking-[0.12em] text-[14px]">
                      Sign&nbsp;Up
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setMode("signin");
                      setStep("form");
                    }}
                    data-testid="choice-signin-btn"
                    className="group relative w-full sm:w-[170px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#2455FF] hover:bg-[#1a44e0] text-white px-4 py-3 text-sm font-semibold transition shadow-[0_10px_30px_-12px_rgba(36,85,255,0.6)]"
                  >
                    <LogIn className="h-4 w-4" strokeWidth={2.6} />
                    <span className="font-cine tracking-[0.12em] text-[14px]">
                      Sign&nbsp;In
                    </span>
                  </button>
                </div>
                <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/40 pt-2">
                  Encrypted · No Spam · You&rsquo;re The Cook
                </p>
              </div>
            )}

            {/* ============ STEP 2 — FORM ============ */}
            {step === "form" && (
            <form onSubmit={submit} className="mt-6 space-y-3" data-testid="modal-form-step">
              {/* Name — only for signup */}
              {mode === "signup" && (
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/55">
                    Your Name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jesse"
                    data-testid="whatsapp-name-input"
                    className="mt-1.5 w-full rounded-xl bg-white/70 ring-1 ring-[#2455FF]/15 focus:ring-[#2455FF]/50 outline-none px-3.5 py-2.5 font-sans text-[14px] text-[#050a1a] placeholder-[#050a1a]/35 transition"
                  />
                </label>
              )}

              {/* Phone + country dropdown */}
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/55">
                  WhatsApp Number
                </span>
                <div className="mt-1.5 flex items-stretch gap-2">
                  {/* Country code — compact custom Select */}
                  <Select value={code} onValueChange={setCode}>
                    <SelectTrigger
                      data-testid="whatsapp-country-select"
                      aria-label="Country code"
                      className="w-[112px] shrink-0 h-[42px] rounded-xl bg-white/70 border-0 ring-1 ring-[#2455FF]/15 focus:ring-2 focus:ring-[#2455FF]/50 px-3 font-mono text-[14px] text-[#050a1a] hover:bg-white/85 transition shadow-none"
                    >
                      <SelectValue>
                        {(() => {
                          const c = COUNTRY_CODES.find((x) => x.code === code);
                          return c ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[15px] leading-none">{c.flag}</span>
                              <span>{c.code}</span>
                            </span>
                          ) : (
                            code
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={6}
                      className="z-[200] glass-strong border-0 ring-1 ring-[#2455FF]/20 rounded-xl shadow-[0_24px_60px_-20px_rgba(36,85,255,0.4)] p-1 max-h-[230px] overflow-y-auto"
                      data-testid="whatsapp-country-list"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem
                          key={c.code + c.name}
                          value={c.code}
                          data-testid={`country-option-${c.code.replace("+", "")}`}
                          className="font-mono text-[13px] text-[#050a1a] rounded-lg cursor-pointer focus:bg-[#2455FF]/8 data-[state=checked]:bg-[#2455FF]/10 data-[state=checked]:text-[#2455FF]"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[15px] leading-none">{c.flag}</span>
                            <span className="w-10 text-[#050a1a]">{c.code}</span>
                            <span className="text-[#050a1a]/60 font-sans">{c.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    autoFocus
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="98 765 43 210"
                    data-testid="whatsapp-phone-input"
                    className="flex-1 min-w-0 w-full h-[42px] rounded-xl bg-white/70 ring-1 ring-[#2455FF]/15 focus:ring-2 focus:ring-[#2455FF]/50 outline-none px-3.5 font-mono text-[14.5px] text-[#050a1a] placeholder-[#050a1a]/35 transition"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={
                  loading ||
                  phone.replace(/\D/g, "").length < 7 ||
                  (mode === "signup" && !name.trim())
                }
                data-testid="whatsapp-submit-btn"
                className={`group relative w-full inline-flex items-center justify-center gap-2 rounded-xl ${
                  mode === "signin"
                    ? "bg-[#2455FF] hover:bg-[#1a44e0]"
                    : "bg-[#25D366] hover:bg-[#1fbb5a]"
                } disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 text-sm font-semibold transition`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
                    Connecting…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" strokeWidth={2.6} />
                    {ctaLabel}
                  </>
                )}
              </button>

              <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#050a1a]/40 pt-1">
                Encrypted · No Spam · You&rsquo;re The Cook
              </p>
            </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppLoginModal;
