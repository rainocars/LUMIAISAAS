import { X, LogOut } from "lucide-react";

export default function Sidebar({ user, nav, activeTab, setTab, mobileOpen, setMobileOpen, onLogout }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-[#050a1a]/30 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-[#2455FF]/10 bg-white/90 p-4 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <a href="/" className="font-cine text-xl tracking-[.13em] text-[#050a1a]">
            LUMI AI
          </a>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-[#050a1a]/60">
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <div className="mt-3 rounded-xl bg-[#2455FF]/[.06] p-3">
          <div className="truncate text-sm font-semibold text-[#050a1a]">{user.name}</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[.15em] text-[#2455FF]">
            {user.role.replaceAll("_", " ")}
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-5 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition font-medium ${
                  isActive
                    ? "bg-[#2455FF] font-semibold text-white shadow-sm shadow-[#2455ff]/20"
                    : "text-[#050a1a]/60 hover:bg-[#2455FF]/5"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <button
          onClick={onLogout}
          className="absolute bottom-5 left-4 right-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>
    </>
  );
}
