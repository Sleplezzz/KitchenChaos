# Worker contract

## Completion

- Send `worker_done` exactly once when the whole assigned task ends.
- Send it on success and on failure.
- Include `task-id` and `dispatch-id` on every orchestration message.

## Heartbeat

- Send `heartbeat` only at major milestones:
  - a finished module
  - a coherent group of changes with green tests
  - a clear phase boundary named in the task
- Do not send `heartbeat` after every file edit.
- Prefer fewer, higher-signal heartbeats.

## Heartbeat command shape

```sh
orca orchestration send \
  --to <coordinator> \
  --type heartbeat \
  --subject "milestone: <short-name>" \
  --body "<what finished>; <evidence>; <what is next>" \
  --task-id <taskId> \
  --dispatch-id <dispatchId> \
  --phase "<phase-name>" \
  --json
```

## Blockers

- On a blocker, send `escalation`.
- Do not stay silent while blocked.
