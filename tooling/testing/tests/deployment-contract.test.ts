import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const load = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('deployment contracts', () => {
  it('keeps local Compose Redis authentication aligned with the runtime client', () => {
    const override = load('compose.override.yaml');

    expect(override).toContain('--requirepass "$${REDIS_PASSWORD}"');
    expect(override).toContain('REDISCLI_AUTH=$${REDIS_PASSWORD} redis-cli ping');
  });

  it('keeps the local Postgres container discoverable by runtime database tools', () => {
    expect(load('compose.override.yaml')).toContain('container_name: sva-studio-postgres');
  });

  it('loads the local Compose override for local runtime commands', () => {
    expect(load('scripts/ops/runtime/runtime-facade-impl.ts')).toContain(
      "const composeBaseArgs = ['compose', '-f', 'compose.yaml', '-f', 'compose.override.yaml'];"
    );
  });

  it('limits automatic dev promotion to push events with a valid change base', () => {
    const workflow = load('.github/workflows/build.yml');

    expect(workflow).toMatch(/promote-dev:[\s\S]*?if: github\.event_name == 'push'/u);
  });

  it('uses the repository-standard checkout action in the promote workflow', () => {
    const workflow = load('.github/workflows/promote.yml');

    expect(workflow).not.toContain('actions/checkout@v6');
    expect(workflow).toContain('actions/checkout@v7');
  });

  it('skips Quantum pre-pull only for the diagnostic dev deployment path', () => {
    const workflow = load('.github/workflows/promote.yml');

    expect(workflow).toContain('if [ "${ENVIRONMENT}" = "dev" ]; then');
    expect(workflow).toContain('pre_pull_args=(--no-pre-pull)');
    expect(workflow).toContain('"${pre_pull_args[@]}"');
    expect(workflow).toContain('quantum-cli stacks update --create --wait');
    expect(workflow).toContain('--project "${quantum_project_dir}"');
    expect(workflow).toContain("'compose: stack.yaml'");
  });

  it('protects and removes rendered deployment secret files', () => {
    const workflow = load('.github/workflows/promote.yml');

    expect(workflow).toContain('umask 077');
    expect(workflow).toContain('quantum_project_dir="$(mktemp -d)"');
    expect(workflow).toContain(
      "trap 'rm -rf \"${quantum_project_dir}\"; rm -f .env stack.json stack.yaml' EXIT"
    );
  });
});
