# LABSIGHT AI Prototype

Build the complete frontend prototype for LABSIGHT AI, a modern healthcare AI web application. Follow these specifications:

1. THEME & DESIGN SYSTEM:
- Deep navy background (#07111F) with subtle ambient cyan/soft blue radial gradients/glows.
- Accents: Cool cyan/teal (#36D1C4), soft blue (#5B8DEF). Text: #F8FAFC and #94A3B8.
- Tasteful glassmorphism: translucent glass cards with backdrop-blur-md/lg, thin borders (border-white/10), soft layered shadows, subtle hover elevation. Highly readable, never neon or overly transparent.
- Status badges: Green (Stable), Amber (Review), Coral/Red (Significant change - used sparingly).
- Strictly non-diagnostic clinical decision support language: "Pattern detected", "Significant change", "Review recommended", "Discuss with a qualified healthcare professional". Avoid diagnostic claims.

2. NAVIGATION & ROUTES:
- Landing Page ('/')
- Login ('/login') & Sign Up ('/signup') with mock authentication and seamless redirection to dashboard
- Persistent App Layout with Glassmorphism Sidebar (collapsible + mobile responsive hamburger sheet) for:
  - Dashboard ('/dashboard')
  - Upload Report ('/upload')
  - My Reports ('/reports')
  - Report Details ('/reports/:id')
  - AI Analysis ('/analysis')
  - Lab Trends ('/trends')
  - Settings / Profile ('/settings')

3. MOCK DATA (stored in a central state/data file):
- 3 realistic lab reports across time: Jan 12, 2026; Apr 18, 2026; Sep 13, 2026.
- Parameters: TSH (3.2 -> 4.1 -> 5.8 mIU/L, +81.3% significant progressive upward), Hemoglobin (12.8 -> 12.5 -> 11.2 g/dL, -12.5% review downward), Vitamin D (24 -> 25 -> 26 ng/mL, +8.3% stable), WBC (6800 -> 7100 -> 7300 cells/µL, stable), Platelets (240k -> 245k -> 238k, stable), Glucose (92 -> 104 -> 118 mg/dL, upward deviation review), Creatinine (0.9 -> 0.92 -> 0.95, stable), Sodium, Potassium.

4. PAGE DETAILS:
- Landing Page: Hero with headline "See the change, not just the number.", animated glass preview panel showing TSH/Hemoglobin trends, CTAs ("Analyze My Reports", "Explore Demo"), Detect/Compare/Understand feature cards, Traditional vs LABSIGHT AI comparison, 5-step "How it works", Privacy section, Medical Disclaimer, and footer.
- Dashboard: Greeting "Good morning 👋", last analyzed date, 4 summary stat cards (Reports Analyzed: 3, Parameters Tracked: 24, Changes Detected: 5, Stable Parameters: 19), "Latest Analysis" findings with expandable cards, interactive parameter trend preview chart (Recharts with TSH, Hemoglobin, Vitamin D, WBC toggle), and "Patterns Detected" summary categories.
- Upload Report: Drag & drop glass zone (PDF/CSV/TXT). On drop or file select, simulate step-by-step progress: 1) Uploading... 2) Extracting laboratory values... 3) Comparing historical results... 4) Analyzing patterns... then show "Report ready for analysis" with "View Analysis" button linking to /analysis.
- My Reports: 3 report cards (CBC Sep 13, Thyroid Panel Apr 18, Health Screening Jan 12) with date, parameter count, status badge, and "View Details" button linking to /reports/:id.
- Report Details: Header with lab info and date, search/filter, and a clean tabular breakdown (Parameter, Result, Unit, Reference Range, Status badge, and sparkline or trend note).
- AI Analysis ("WOW page"): Prominent "5 patterns detected" banner, detailed multi-point timeline cards for TSH, Hemoglobin, Glucose, Vitamin D with step arrows (e.g. 3.2 → 4.1 → 5.8), percentage change, "Why was this flagged?" breakdown, pattern confidence gauge/badge, and clear medical disclaimer.
- Lab Trends: Full interactive trend analytics dashboard with parameter selector chips (TSH, Hemoglobin, Vitamin D, Glucose, WBC, Platelets), time range filter, Recharts interactive line/area chart with custom glass tooltips, historical reference baseline, and min/max/current statistics.
- Settings: Profile info (Name, Email), Preferences (Analysis notifications, alert thresholds), Privacy & Data management, About LABSIGHT AI, and Mock Logout button.

5. POLISH:
- Fully responsive across desktop, tablet, and mobile.
- Lucide-react icons, Tailwind CSS styling, Recharts for charts, Sonner/Toast for notifications. Smooth micro-interactions and transitions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e92d40e5-802e-43d9-b7f5-e34b784dbc54).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
