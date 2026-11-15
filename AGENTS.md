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

- Since 2026-11-16 `back/` is a Python service (Flask + requests + dotenv, modeled on
  `../plst/back` but simplified): ONE function — `GET /wake` wakes the render.com backend
  (`WAKE_TARGET` env or `?target=`) and waits until it is up. Run: `python app.py`
  (default port 3211, venv in `back/venv/`). No DB, no history, no stat events.
- The old Node build (Express + axios, controllers as class-instance singletons, DB +
  history + stat) is kept as behavioral reference in `back-nodejs-backup/` — not deployed.
- Deploy target (2026-11-15): Timeweb virtual hosting — always awake, no execution-time
  cap. Earlier targets were Vercel (Hobby function timeout caps the synchronous wake) and
  Render (sleeping-proxy problem) — both abandoned; see DECISIONS.md.
