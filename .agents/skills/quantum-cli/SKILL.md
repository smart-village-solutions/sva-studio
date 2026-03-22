---
name: quantum-cli
description: Work with Planetary Quantum stacks and endpoints via `quantum-cli`. Use this skill when inspecting endpoints, listing stacks or tasks, validating `.quantum` configuration, deploying or removing stacks, opening remote shells with `exec`, or migrating stacks between endpoints.
---

# Quantum CLI

## When to Use

Use this skill for Planetary Quantum operational work, especially when the task involves:

- checking authentication, console connectivity, or endpoint availability
- listing endpoints, stacks, services, or tasks
- validating `.quantum` configuration before deployment
- creating, updating, or removing stacks
- opening a remote shell or running one-off commands with `exec`
- migrating a stack including volumes and configs between endpoints
- checking environment-variable based deploy setup in CI or local shells

If MCP tools for Quantum are available in the session, prefer them for read-only inventory work. Use `quantum-cli` when you need CLI-native flows such as deploys, validation, migrations, auth checks, or remote command execution.

## Guardrails

- Start with read-only inspection before any mutating command.
- Never guess flags. Run `quantum-cli help` or `quantum-cli <subcommand> --help` if a command shape is uncertain.
- Prefer `--output json` for commands whose output you will filter or summarize programmatically.
- Use shell-safe placeholders like `"$QUANTUM_ENDPOINT"` and `"$QUANTUM_STACK"` in examples. Avoid angle-bracket placeholders in shell snippets.
- Do not expose API keys, passwords, tokens, or full environment dumps in the response.
- Treat `--no-validate` and `--no-pre-pull` as exceptions. The docs explicitly say they are not recommended.
- For deploys, prefer `--wait` so completion state is observable.
- For stack deletion or migration, verify the source and target identifiers explicitly before running the command.
- For migrations involving databases, assume the data can be corrupted if the database is still writing. Prefer application/database replication or stop writes first.
- The CLI still accepts `PORTAINER_*` environment variables, but `QUANTUM_*` names are the current interface and should be preferred.

## Default Workflow

### 1. Confirm auth and target

Start by checking authentication inputs and discovering available targets:

```bash
command -v quantum-cli
quantum-cli endpoints ls --output json
quantum-cli stacks ls --endpoint "$QUANTUM_ENDPOINT" --output json
```

If the task depends on environment-driven configuration, check the effective variable source before mutating anything.

### 2. Inspect runtime state

Before changing anything, inspect current tasks:

```bash
quantum-cli ps --endpoint "$QUANTUM_ENDPOINT" --stack "$QUANTUM_STACK" --output json
quantum-cli ps --endpoint "$QUANTUM_ENDPOINT" --stack "$QUANTUM_STACK" --service "$QUANTUM_SERVICE" --all --output json
```

Use `--all` when diagnosing restarts, failed rollouts, or non-running tasks.

### 3. Validate config before deploy

If the task touches a deployable project with a `.quantum` file, validate first:

```bash
quantum-cli validate --help
quantum-cli validate --project "$PROJECT_DIR"
quantum-cli stacks update --help
```

The docs also support environment-variable driven deployments. `quantum-cli` injects environment variables during deployment without modifying the stack file in-place.

### 4. Deploy safely

Preferred deploy pattern:

```bash
quantum-cli stacks update \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --project "$PROJECT_DIR" \
  --environment "$QUANTUM_ENVIRONMENT" \
  --wait
```

Use `--create` only when the intent is to create the stack if missing. Use `stacks create` when the operation should be explicitly create-only.

### 5. Verify after deploy

After deployment, re-check tasks:

```bash
quantum-cli ps --endpoint "$QUANTUM_ENDPOINT" --stack "$QUANTUM_STACK" --all --output json
```

If needed, inspect a specific workload with `exec`.

## Remote Debugging with `exec`

Use `exec` only after identifying the correct target container via `ps`.

Interactive shell:

```bash
quantum-cli exec --endpoint "$QUANTUM_ENDPOINT" --stack "$QUANTUM_STACK" --service "$QUANTUM_SERVICE"
```

One-off command:

```bash
quantum-cli exec \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --service "$QUANTUM_SERVICE" \
  --command "sh -lc 'pwd && ls -la'"
```

Useful options:

- `--slot <n>` to target a specific replica
- `--container <id>` when a direct container selection is safer than service selection
- `--command-user <user>` when command context matters

`shell` and `ssh` are documented aliases for `exec`.

## Stack Lifecycle Coverage

According to the current Quantum CLI reference, the tool covers at least these operational areas:

- `endpoints ls` for endpoint inventory
- `stacks create`, `stacks ls`, `stacks update`, and `stacks rm`
- `validate` for `.quantum` projects
- `ps` for task inspection
- `exec`, `shell`, and `ssh` for remote shell and command execution
- `migration` / `migrate` for stack duplication across endpoints
- `selfupdate` / `self-update` for updating the CLI itself

This capability list is taken from the official CLI reference, not inferred from repo usage.

## Environment Variables

The docs describe two environment-variable layers:

- global auth and host config such as `QUANTUM_HOST`, `QUANTUM_USER`, and `QUANTUM_PASSWORD`
- command-scoped selectors such as `QUANTUM_ENDPOINT`, `QUANTUM_STACK`, `QUANTUM_SERVICE`, and migration-specific variables

The docs also note compatibility aliases such as `PORTAINER_HOST`, `PORTAINER_USER`, `PORTAINER_PASSWORD`, and `PORTAINER_ENDPOINT`. Treat those as compatibility inputs, not the preferred naming scheme.

When the task involves CI or a scripted deploy, prefer explicit environment variables over interactive flags, and avoid echoing them back to the user.

## Migration Notes

`quantum-cli migration` can copy a whole stack including volumes and configs from one endpoint to another.

Use it carefully:

- verify source endpoint, target endpoint, source stack, and target stack names explicitly
- prefer a maintenance window or at least stop traffic first
- treat running databases as unsafe to copy at the volume level unless you know the storage is quiesced
- use database-native replication instead of raw volume copying when the task is a database migration

## Common Patterns

See [common-patterns.md](./references/common-patterns.md) for compact examples covering endpoint discovery, stack inspection, validated deploys, removals, `exec`, migrations, and CI-style environment-variable usage.

## Response Expectations

When reporting results back to the user:

- name the endpoint, stack, and service you inspected or changed
- state whether the action was read-only or mutating
- summarize the relevant task, deployment, or migration state
- call out any assumptions, especially environment selection and target stack names
- if a deploy or migration was not executed, say whether validation, auth, target discovery, or safety concerns were the blocker
