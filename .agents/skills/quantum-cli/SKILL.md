---
name: quantum-cli
description: Work with Planetary Quantum stacks and endpoints via quantum-cli. Use this skill when inspecting endpoints, listing stacks or tasks, validating .quantum configuration, deploying stack updates, opening remote shells with exec, or diagnosing runtime issues in Planetary Quantum environments.
---

# Quantum CLI

## When to Use

Use this skill for Planetary Quantum operational work, especially when the task involves:

- Checking authentication or endpoint availability
- Listing endpoints, stacks, services, or tasks
- Inspecting running workloads before or after a deployment
- Validating `.quantum` and compose configuration
- Updating or creating stacks with `quantum-cli stacks update`
- Opening a remote shell or running one-off commands with `quantum-cli exec`

If MCP tools for Quantum are available in the session, prefer them for read-only inventory work. Use `quantum-cli` when you need CLI-native flows such as auth checks, validation, deploys, or remote command execution.

## Guardrails

- Start with read-only inspection before any mutating command.
- Never guess flags. Run `--help` for the relevant subcommand first if a flag is uncertain.
- Prefer `--output json` for commands whose output you will filter or summarize programmatically.
- Do not expose API keys, passwords, tokens, or full environment dumps in the response.
- Treat `--no-validate` and `--no-pre-pull` as exceptions. They are explicitly not recommended.
- For deploys, prefer `--wait` so completion state is observable.
- If a command fails because the sandbox blocks network access, rerun it with an escalation request instead of changing the workflow.

## Default Workflow

### 1. Confirm auth and target

Start by checking authentication and discovering available targets:

```bash
quantum-cli auth status --output json
quantum-cli endpoints list --output json
quantum-cli stacks list --endpoint <endpoint> --output json
```

Use endpoint, stack, and service names consistently. The CLI also supports `QUANTUM_ENDPOINT`, `QUANTUM_STACK`, and `QUANTUM_SERVICE` env vars, but explicit flags are usually clearer in agent work.

### 2. Inspect runtime state

Before changing anything, inspect tasks:

```bash
quantum-cli ps --endpoint <endpoint> --stack <stack> --output json
quantum-cli ps --endpoint <endpoint> --stack <stack> --service <service> --all --output json
```

Use `--all` when diagnosing restarts, failed rollouts, or non-running tasks.

### 3. Validate config before deploy

If the task touches a deployable project with a `.quantum` file, validate before updating:

```bash
quantum-cli validate --help
quantum-cli stacks update --help
```

Then run the validated update from the project directory or pass `--project <path>`.

### 4. Deploy safely

Preferred deploy pattern:

```bash
quantum-cli stacks update \
  --endpoint <endpoint> \
  --stack <stack> \
  --project <path> \
  --environment <env> \
  --wait
```

Use `--create` only when the intent is to create the stack if missing.

### 5. Verify after deploy

After deployment, re-check tasks:

```bash
quantum-cli ps --endpoint <endpoint> --stack <stack> --all --output json
```

If needed, inspect a specific workload with `exec`.

## Remote Debugging with `exec`

Use `exec` only after identifying the correct target container via `ps`.

Interactive shell:

```bash
quantum-cli exec --endpoint <endpoint> --stack <stack> --service <service>
```

One-off command:

```bash
quantum-cli exec \
  --endpoint <endpoint> \
  --stack <stack> \
  --service <service> \
  --command "sh -lc 'pwd && ls -la'"
```

Useful options:

- `--slot <n>` to target a specific replica
- `--container <id>` when a direct container selection is safer than service selection
- `--command-user <user>` when command context matters

Avoid broad exploratory commands that dump secrets or large sensitive configuration.

## Common Patterns

### Inspect what exists

```bash
quantum-cli endpoints list --output json
quantum-cli stacks list --endpoint <endpoint> --output json
quantum-cli ps --endpoint <endpoint> --stack <stack> --output json
```

### Investigate a failing service

```bash
quantum-cli ps --endpoint <endpoint> --stack <stack> --service <service> --all --output json
quantum-cli exec --endpoint <endpoint> --stack <stack> --service <service> --command "sh"
```

### Roll out a stack update

```bash
quantum-cli stacks update --endpoint <endpoint> --stack <stack> --project <path> --environment <env> --wait
```

## Response Expectations

When reporting results back to the user:

- Name the endpoint, stack, and service you inspected or changed
- State whether the action was read-only or mutating
- Summarize the relevant task or deployment state
- Call out any assumptions, especially environment selection and target stack names
- If a deploy was not executed, say whether validation, auth, target discovery, or approval was the blocker
