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

  it('uses the Quantum CLI v3 stack deploy contract', () => {
    const workflow = load('.github/workflows/promote.yml');

    expect(workflow).toContain(
      'quantum-cli stacks deploy -f stack.yaml --stack "studio-${ENVIRONMENT}" --endpoint "${QUANTUM_ENDPOINT}"'
    );
    expect(workflow).not.toContain('--no-pre-pull');
    expect(workflow).not.toContain('quantum_project_dir');
  });

  it('protects and removes rendered deployment secret files', () => {
    const workflow = load('.github/workflows/promote.yml');

    expect(workflow).toContain('umask 077');
    expect(workflow).toContain("trap 'rm -f .env stack.json stack.yaml' EXIT");
  });

  it('promotes Dev with the immutable build commit tag', () => {
    const workflow = load('.github/workflows/build.yml');

    expect(workflow).toContain('image_ref: ${{ github.sha }}');
  });
});
