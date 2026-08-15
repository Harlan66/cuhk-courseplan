---
name: plan-cuhk-courses
description: Plan CUHK undergraduate courses from the project’s verified curriculum, timetable, class, meeting, prerequisite, and student data. Use when a student wants to initialize or update their profile, inspect graduation progress, build a complete term course pool, understand eligibility or approval requirements, optimize teaching days and units, generate timetable alternatives, or update the CoursePlan frontend state.
---

# Plan CUHK Courses

Use the user's own agent as the interaction layer. The frontend is optional: complete the whole workflow in conversation and structured files when no frontend is requested. When present, CoursePlan only renders shared project data; never add an embedded chat agent.

## Workflow

1. Read existing personal state before asking questions. See [data-map.md](references/data-map.md).
2. If background is incomplete, ask for all missing essentials together: admission year, programme, concentration/major/minor, college, current year, target term, completed/in-progress courses, exemptions/transfers, unit ceiling, and schedule preferences. Derive obvious facts instead of asking separately.
3. Write confirmed personal facts to `data/student/`. Never delete curriculum, timetable, snapshots, or other public source data when resetting a user.
4. Rebuild the course pool with `node scripts/build_personal_course_pool.mjs` after profile, history, term, or rule changes.
5. Present the full term offering, not a hand-picked shortlist. Order eligible courses by contribution to unmet graduation requirements, then availability and course code. Keep uncertain and unavailable courses in ordered collapsed groups with concise reasons.
6. Treat the course pool as read-only guidance. Do not require checkboxes or manual selection before planning; infer candidate sets from the conversation.
7. Generate multiple schedules from real `Class → Meeting` data. Enforce the student's unit ceiling and time conflicts. Prefer unmet graduation requirements, fewer teaching days, more free full days, and then higher useful units.
8. Return the course pool and schedule alternatives directly in the conversation. Optionally write `data/student/schedule-plans.json` when a renderer or reusable artifact is useful. Mark TBA meetings, zero vacancy, missing prerequisites, consent, reserved quota, and department/college approval explicitly. Never fabricate a meeting or interpret missing rules as permission.
9. Run relevant validation after changing generated data; run `npm test` only when frontend behavior changes.
10. Summarize the result briefly. If a frontend exists, ask whether the user wants it opened; do not open it without permission.

## Product Rules

- Keep the flow: cultivation progress → full course pool → calendar schedule alternatives. Do not create a separate generation stage.
- Keep every core operation usable without a frontend. Let external agents modify shared data; an optional frontend may render progress, eligibility explanations, and comparable weekly calendars.
- Distinguish `eligible`, `needs confirmation`, and `unavailable`. Explain every non-eligible result.
- Treat live CUSIS registration, vacancy, consent, and department decisions as authoritative over local inference.
- Preserve evidence and uncertainty. State provisional assumptions in the plan output.

## Schedule Output

Create at least these alternatives when possible:

- compact: minimum teaching days;
- balanced: strong graduation progress with moderate load;
- maximum: highest useful units not exceeding the confirmed ceiling.

For each plan include units, teaching days, class codes/numbers, meetings, rooms, requirement contribution, approval flags, TBA items, and warnings.
