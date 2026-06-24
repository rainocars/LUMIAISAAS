# LUMI AI — Premium Hero Section

## Original Problem
Build a premium AI services landing page hero for LUMI AI (Powered by LUPUS AI LABS, Since 2023). Breaking Bad-inspired cinematic AI lab aesthetic. Electric Blue #2455FF + Cyan #00E5FF on white blueprint grid. Just the hero section for now.

## Stack
- Frontend: React 19 + Tailwind + framer-motion + sonner + lucide-react
- Fonts: Anton (display), IBM Plex Sans (body), IBM Plex Mono (terminal)
- No backend changes

## Implemented (Dec 2025)
- Glass navbar: "SAY YOUR NAME" brand-left, 6 center links (About/Services/Team/HQ's/FAQ's/Reviews), LUMI AI right brand, "Build With AI" CTA pill
- Hero: animated blueprint grid bg + cyan particles + parallax landmark skyline (Hyderabad/Vizag/Karnataka)
- Huge gradient "AI AS SERVICE" display heading + "Yu Know the Business. We Know the AI." subtitle
- Since 2023 lab-online badge + 6 cinematic floating tags (Enter The AI Lab, etc.)
- AI command bar: cycling typewriter placeholder (11 prompts), blink caret, scanline, Run button → sonner toast
- 4 floating glass metric cards (100+ Delivered, 5 Countries, 10K$+ MRR, Shipped)
- Status readout strip (LUMI · LAB-01 · coordinates · STATUS: SYNTHESIZING)
- Testing: 10/10 frontend tests passed

## Files
- `/app/frontend/src/components/Hero.jsx`
- `/app/frontend/src/components/Navbar.jsx`
- `/app/frontend/src/App.js`
- `/app/frontend/src/index.css` (grid/glass/particles/gradient/keyframes)
- `/app/frontend/public/index.html` (Google Fonts)

## Backlog (P1)
- About / Services (7 cards) / Team / HQ's / FAQ accordion / Reviews sections
- Real form submission for AI command bar (backend + email/Resend)
- Mobile polish on huge display heading

## Backlog (P2)
- Cursor follower, magnetic CTA, Lottie atom animation
- Light/dark theme toggle
