# Figma

File: Content Autopilot – Agency Dashboard, https://www.figma.com/design/lqyyzmSaJxirwnOQ7P9pvh (earlier copy: https://www.figma.com/design/wYLvbNqhyPGWcYryZyHwhe, personal team "Sajesh's team", Starter plan).

Pages: MVP (build first), Screens v2 (long-term design), Screens (original v1), Components.

## MVP page (build first)
Scope in docs/10-mvp-scope.md and decision D28. Sections: 0 MVP scope note; 1 Claude API (M1.1 Settings · Claude API); 2 Clients and voice (M2.0 Clients, M2.1–M2.5 Add client in 5 steps: Business, Voice and tone, Rules and claims, Facts, Examples; M2.6 Client voice); 3 Research (M3.1 Research runs and new run, M3.2 Research report); 4 Topics and content (M4.2 Next 5 blog topics, M4.3 Content board, M4.4 Review blog post, M4.5 Social copy and image keywords). Sidebar MVP component: Clients, Research, Topics, Content, Settings.

Visual style (D30): Skipper design system (https://www.figma.com/design/070oe35byv1D5hjZcsKD6z), light mode. Ivory page #FAFAF9, white surfaces, borders #E5E5E3, ink #0F0E0D for text and primary actions, dark ink sidebar, yellow highlighter MVP tag, Newsreader serif page titles, Inter elsewhere, corners 4/6/8 px. Tokens: variable collection "Skipper (MVP)"; the same values are in web/src/index.css.

## Screens v2 page (long-term design)
Redesigned against the seven-phase service flow (docs/04-service-flow.md), then checked against the PRD and architecture. 38 screens grouped by phase, with the flow diagram and "Review notes" at the top:
- Workspace: Overview, Clients.
- 01 Discover: Research, Research report, Client interview.
- 02 Set up: set-up hub; 7-step add-client wizard; voice sample approval (client-facing); client voice.
- 03 Strategy: strategy, three-month calendar.
- 04 Monthly loop: content board, topic shortlist, post editor, creatives (five formats), client review link (desktop, mobile, expired), publishing queue, approval links.
- 05 Engage and measure: replies and reviews, engagement, monthly report, AI visibility, lead ledger, lead dispute.
- 06 Quarterly and admin: quarterly review, usage and cost, settings, client settings and offboarding.

Main issues fixed in v2: navigation now follows the flow; both gates are shown; posts cannot publish before client approval; the monthly batch replaces the weekly cycle; lint and facts checks on drafts; X removed; creatives render from photo plus brand kit; the wizard covers goals, lead definition, facts and the tracking audit.

Still not drawn: reports index, agency sign-in, call log, empty and error states.
