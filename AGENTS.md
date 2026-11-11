# AGENTS.md — agent rules for this project

Source of truth: `/Users/artyomantoshkin/server/know/entries/rules.md` (the know rules).
Other know entries live in `/Users/artyomantoshkin/server/know/README.md` (index) —
absolute-path reference works from any tool.

## DECISIONS.md workflow

- **Session start:** read `DECISIONS.md` (repo root) first and keep it in mind throughout
  the session.
- **Before any code action:** write the plan to `DECISIONS.md`.
- **After any code action:** write the progress/result to `DECISIONS.md`.
- Record important information: architectural decisions, gotchas, environment quirks,
  lessons learned.
- Keep the file small: when it gets too big, flag it to the user and move or archive old
  entries per the project's convention. Never delete history.

## Git and commits

1. Never commit unless the user explicitly asks.
2. Commit messages must have a plain imperative subject. Never append `-d` or `-d;` (nor any
   other suffix token): `-d` triggers a deploy hook, and deploy decisions are the user's.

## Project quirks (environment)

- Node 18 (`engines` in `back/package.json`), CommonJS, Express + axios.
- Controllers are class-instance singletons (`controllers/*.js`), routes in
  `back/routes/routes.js`.
- Deploy target is Vercel (`back/vercel.json`) — mind function execution timeouts for
  long-running endpoints (see `back/utils/wakeServer.js` history in DECISIONS.md).
