# Repository Guidelines

## Agent Behavior

- Always respond in English, even when the user writes in Spanish.

## Workflow Hazards

- Use `pnpm`. Do not use `npm` or `yarn`.
- Commit only after closing a task. Do not commit before or during a task. Use the git-commit skill. Do not make a large commit or one commit per file. Describe the technical change. Do not use progress statements such as "phase X completed". Do not list file names in the message. Include a file name only if necessary after asking the human.

## Orchestration (orchestrators only)

- Before you dispatch a worker, allow its lifecycle publish commands and verify the mode with a no-code `worker_done` diagnostic.
- Always dispatch with `--inject`.
- Always put the worker reporting rules from `agent/orca-worker-contract.md` into the task `--spec` before dispatch. At minimum: `worker_done` once at the end; `heartbeat` only on major milestones; include task-id and dispatch-id; escalate on blockers.
- After dispatch, run one 10-minute `check --wait` for `worker_done,escalation,decision_gate` (timeout 600000 ms or longer). On timeout, inspect task and terminal state once. If the worker is still active, wait again. Do not intervene unless you receive escalation or decision_gate.
- Wait with `orca orchestration check --terminal <coordinator> --wait`. Do not poll worker terminals. Do not treat TUI idle as completion; background work may still run.
- If publish fails, inspect the coordinator inbox, recover the task from the coordinator, then fix publishing before the next dispatch.

## Testing Quirks

## Maintenance AGENTS.md

Keep this file limited to active, non-obvious hazards. Do not add discoverable project structure, stack details, naming conventions, or generic contribution advice. Remove an instruction when its underlying hazard is fixed.
