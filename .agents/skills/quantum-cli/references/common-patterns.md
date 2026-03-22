# Common `quantum-cli` Patterns

## List endpoints

```bash
quantum-cli endpoints ls --output json
```

## List stacks on an endpoint

```bash
quantum-cli stacks ls --endpoint "$QUANTUM_ENDPOINT" --output json
```

## Inspect tasks for a stack

```bash
quantum-cli ps \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --output json
```

## Inspect all tasks for a service

```bash
quantum-cli ps \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --service "$QUANTUM_SERVICE" \
  --all \
  --output json
```

## Validate a project before deploy

```bash
quantum-cli validate --project "$PROJECT_DIR"
```

## Create a stack explicitly

```bash
quantum-cli stacks create \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --project "$PROJECT_DIR" \
  --environment "$QUANTUM_ENVIRONMENT" \
  --wait
```

## Update a stack and create it if missing

```bash
quantum-cli stacks update \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --project "$PROJECT_DIR" \
  --environment "$QUANTUM_ENVIRONMENT" \
  --create \
  --wait
```

## Remove a stack

```bash
quantum-cli stacks rm \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --force
```

## Open a remote shell

```bash
quantum-cli exec \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --service "$QUANTUM_SERVICE"
```

## Run a one-off command in a service

```bash
quantum-cli exec \
  --endpoint "$QUANTUM_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --service "$QUANTUM_SERVICE" \
  --command "sh -lc 'env | sort'"
```

Use this kind of command carefully. Do not dump secrets back into the user response.

## Migrate a stack to another endpoint

```bash
quantum-cli migration \
  --source-endpoint "$QUANTUM_SOURCE_ENDPOINT" \
  --stack "$QUANTUM_STACK" \
  --target-endpoint "$QUANTUM_TARGET_ENDPOINT" \
  --target-stack "$QUANTUM_TARGET_STACK"
```

Add `--up` only if the target stack should start immediately after the migration.

## Use environment variables for CI-style deploys

```bash
export QUANTUM_USER="$DEPLOY_USER"
export QUANTUM_PASSWORD="$DEPLOY_PASSWORD"
export QUANTUM_ENDPOINT="customer-prod"
export QUANTUM_STACK="my-app"
export RELEASE_VERSION="1.2.3"

quantum-cli stacks update --create --wait
```

According to the docs, `quantum-cli` can pass environment variables into the deployment without rewriting the stack file in-place.

## Update the CLI itself

```bash
quantum-cli selfupdate
```
