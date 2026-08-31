# LMS project note routing

Use these rules together with `$course-project-companion`.

## Source scope and precedence

- Treat the user's latest explicit statements as highest priority.
- Treat `C:/Data/obmen/result-uni-all/course-project/materials-for-thoughs/` as the primary starting area for initial project thinking.
- Treat the rest of `C:/Data/obmen/result-uni-all/course-project/` as the ongoing project source: current documents, later code, tests, designs, and relevant handoffs.
- Do not connect or import `G:/My Drive/tuuli/dev/dev-from-codex/lms-project-brief.md`; it is an older external note and is not an authoritative starting source.
- Exclude `.git`, dependency/build output, coverage, state/config files, and temporary skill/setup artifacts from subject-learning discovery. Read a handoff only when it is relevant to the current delta.

## Interpret the starting materials carefully

- Treat `project-tech-requirements.md` and `Answers-to-the-questionnaire.md` as project evidence whose unresolved or conflicting claims must remain visible until the user settles them.
- Treat `tz-example-(the-blog).md` only as an example of specification detail and behavior description. Never inherit its blog entities, roles, routes, stack, or product requirements into the LMS.
- Treat `common-pages.png`, `student-pages.png`, and `admin-pages.png` as provisional visual thinking until the user explicitly accepts or replaces a design decision.
- Do not silently resolve differences between the starting materials and later root documents. Prefer the newer explicit decision and keep a short note of any meaningful unresolved choice.

## Keep the result balanced

- Write concise focused Journal notes that preserve the main mechanism, rationale, useful project state, and continuation point.
- Promote only reusable frontend, backend, architecture, debugging, or tooling understanding to Knowledge.
- Do not create separate decision or question folders. Keep project-specific decisions and open choices in the relevant Journal note or the managed project-index blocks.
- Do not copy source documents into the vault or narrate every Codex action.
