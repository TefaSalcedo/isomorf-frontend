---
name: isomorf-runtime-testing
description: Run ISOMORF frontend/backend together and verify persisted editor state and responsive calculation memories.
---

# Runtime setup

- Follow each repository's environment blueprint for dependencies and startup.
- Verify the PostgreSQL listener matches backend DATABASE_URL. A system cluster may use 5433 while a stopped local `isomorf-pg` Docker container owns the intended 5432; inspect `pg_lsclusters` and `docker ps -a` before starting another database.
- Run migrations, then start uvicorn from the current backend checkout. A healthy endpoint alone does not establish that the running process has the current schema: check OpenAPI for fields needed by the feature, such as DesignSettings.layers.
- Start Next after sourcing `~/.nvm/nvm.sh`.
- Use disposable users/projects and UI save/reload rather than direct authenticated API mutation.

# Editor testing

- Test compact views below 1024px: tablet 820x1180 and phone 390x844.
- Device-toolbar scaling changes screen/page coordinate mappings. Verify viewport dimensions and touch event coordinates before interpreting missed canvas taps as defects.
- In 3D, click a beam or column to open its design inspector; compact mode opens a scrollable sheet automatically.
- For calculation-memory tests, independently compute expected values, inspect the detailed modal, download Markdown, and inspect the actual file.
- Include a post-calculation input change before recalculating: old results must not appear authoritative or be exported alongside new inputs.
- Reload, re-enter 3D, and select both members to establish persistence.
- Numerical agreement with implemented simplified formulas is not engineering-code certification.

## Devin Secrets Needed

None for the local disposable environment. Hosted environments require their own authorized test account.
