# GoldScale

Read and follow all config files before writing any code:

- `.claude/configs/context.md` — project overview, tech stack, architecture, data model
- `.claude/configs/principles.md` — engineering principles and rules
- `.claude/configs/backend.md` — backend-specific conventions and pitfalls
- `.claude/configs/frontend.md` — frontend-specific conventions and pitfalls
- `.claude/configs/tech-lead.md` — review process, contract verification, config evolution

## Config Evolution

Configs MUST stay in sync with the codebase. After each sprint or significant change:
- New dependencies or decisions → update `context.md`
- New rules from bugs found → add to `principles.md`
- New patterns for backend/frontend → update respective config
- Tech Lead reviews and updates configs as part of the review process

## Git

- Commit format: `fix/feat/refactor/log/chore: <short description>`
- Author: 72nd <gemboleg@gmail.com>
- Incremental commits per logical unit of work
- Do not mention AI or co-authors in commits
