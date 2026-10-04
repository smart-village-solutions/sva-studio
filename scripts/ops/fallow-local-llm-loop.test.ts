import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { completedForBase, eligibleGroups, externalSymbolReferences, selectGroups, validateDecision, workflowRunState } from './fallow-local-llm-loop.js';

const path = 'apps/example/src/lib/preferences.ts';
const finding = (name: string, line: number, file = path) => ({ path: file, export_name: name, line, is_type_only: false, is_re_export: false, actions: [{ type: 'remove-export', auto_fixable: true }] });
const envelope = (items: ReturnType<typeof finding>[]) => ({ kind: 'dead-code', unused_exports: items });

describe('Fallow local loop selection', () => {
  it('keeps only coherent, bounded app file groups', () => {
    const groups = selectGroups(envelope([finding('first', 1), finding('second', 2), finding('danger', 1, 'packages/core/src/lib/index.ts'), finding('role', 3, 'apps/example/src/lib/iam-role.ts'), finding('escape', 4, 'apps/example/src/lib/../../escape.ts')]));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.findings.map((f) => f.export_name)).toEqual(['first', 'second']);
  });

  it('rejects singleton and ambiguous same-line findings', () => {
    expect(selectGroups(envelope([finding('first', 1)]))).toEqual([]);
    expect(selectGroups(envelope([finding('first', 1), finding('second', 1)]))).toEqual([]);
  });

  it('excludes authorization handlers even when their file names lack auth or iam', () => {
    const names = ['interfaces-api-context.ts', 'interfaces-api-list.ts', 'map-geocoding-api.operations.ts', 'permission-actions.ts'];
    for (const name of names) {
      const file = `apps/example/src/lib/${name}`;
      expect(selectGroups(envelope([finding('first', 1, file), finding('second', 2, file)]))).toEqual([]);
    }
  });

  it('groups a small set of UI export specifiers', () => {
    const ui = 'apps/example/src/components/ui/dialog.tsx';
    expect(selectGroups(envelope([finding('DialogOverlay', 3, ui), finding('DialogPortal', 4, ui)]))).toHaveLength(1);
  });

  it('skips open PR paths and already attempted groups at the same base', () => {
    const ui = 'apps/example/src/components/ui/dialog.tsx';
    const groups = selectGroups(envelope([finding('first', 1), finding('second', 2), finding('DialogOverlay', 3, ui), finding('DialogPortal', 4, ui)]));
    expect(eligibleGroups(groups, new Set([path]), new Set())).toEqual(groups.filter((g) => g.path === ui));
    expect(eligibleGroups(groups, new Set(), new Set(groups.map((g) => g.id)))).toEqual([]);
  });

  it('retries incomplete work for the same base but keeps final outcomes terminal', () => {
    const base = 'abc';
    for (const status of ['failed', 'pr-opened', 'worktree-exists', 'remote-branch-exists']) {
      expect(completedForBase({ base, status, at: '' }, base)).toBe(false);
    }
    for (const status of ['ci-green', 'rejected', 'ci-failed', 'pr-closed', 'needs-operator']) {
      expect(completedForBase({ base, status, at: '' }, base)).toBe(true);
    }
  });
});

describe('model edit validation', () => {
  const group = selectGroups(envelope([finding('first', 1), finding('second', 2)]))[0]!;
  const files = new Map([[path, 'export const first = 1;\nexport const second = 2;\n']]);
  const valid = { decision: 'apply', reason: 'Both declarations remain local', edits: [
    { path, line: 1, name: 'first', old: 'export const first = 1;', replacement: 'const first = 1;' },
    { path, line: 2, name: 'second', old: 'export const second = 2;', replacement: 'const second = 2;' },
  ] } as const;

  it('accepts only exact export keyword removal', () => {
    expect(validateDecision(group, valid, files).get(path)).toBe('const first = 1;\nconst second = 2;\n');
  });

  it('rejects incomplete, stale, duplicate and scope-changing edits', () => {
    expect(() => validateDecision(group, { ...valid, edits: valid.edits.slice(0, 1) }, files)).toThrow();
    expect(() => validateDecision(group, { ...valid, edits: [{ ...valid.edits[0], old: 'export const first = 3;' }, valid.edits[1]] }, files)).toThrow();
    expect(() => validateDecision(group, { ...valid, edits: [valid.edits[0], valid.edits[0]] }, files)).toThrow();
    expect(() => validateDecision(group, { ...valid, edits: [{ ...valid.edits[0], replacement: 'const first = 9;' }, valid.edits[1]] }, files)).toThrow();
    expect(() => validateDecision(group, { ...valid, edits: [{ ...valid.edits[0], path: 'apps/other/src/lib/file.ts' }, valid.edits[1]] }, files)).toThrow();
  });

  it('allows removal of exact named export entries only inside an export block', () => {
    const ui = 'apps/example/src/components/ui/dialog.tsx';
    const uiGroup = selectGroups(envelope([finding('DialogOverlay', 3, ui), finding('DialogPortal', 4, ui)]))[0]!;
    const source = 'const DialogOverlay = 1;\nexport {\n  DialogOverlay,\n  DialogPortal,\n};\n';
    const edits = { decision: 'apply', reason: 'Unused entries', edits: [
      { path: ui, line: 3, name: 'DialogOverlay', old: '  DialogOverlay,', replacement: '' },
      { path: ui, line: 4, name: 'DialogPortal', old: '  DialogPortal,', replacement: '' },
    ] };
    expect(validateDecision(uiGroup, edits, new Map([[ui, source]])).get(ui)).toContain('export {\n\n\n};');
    expect(() => validateDecision(uiGroup, edits, new Map([[ui, 'const DialogOverlay = 1;\nconst x = 0;\n  DialogOverlay,\n  DialogPortal,\n};\n']]))).toThrow();
  });
});

describe('external export references', () => {
  it('ignores independent same-name symbols and blocks imports of the selected export', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sva-fallow-symbols-'));
    const selected = 'apps/example/src/lib/preferences.ts';
    const unrelated = 'packages/other/src/independent.ts';
    const consumer = 'apps/example/src/lib/consumer.ts';
    const group = selectGroups(envelope([finding('first', 1, selected), finding('second', 2, selected)]))[0]!;
    try {
      for (const path of [selected, unrelated, consumer, 'scripts/.keep']) mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, 'apps/example/tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true } }));
      writeFileSync(join(dir, selected), 'export const first = 1;\nexport const second = 2;\n');
      writeFileSync(join(dir, unrelated), 'export const first = 3;\nconsole.log(first);\n');
      expect(externalSymbolReferences(dir, group)).toEqual([]);

      writeFileSync(join(dir, consumer), "import { first as used } from './preferences';\nconsole.log(used);\n");
      expect(externalSymbolReferences(dir, group)).toEqual([consumer]);

      writeFileSync(join(dir, consumer), "const dynamicName = 'second';\n");
      expect(externalSymbolReferences(dir, group)).toEqual([consumer]);

      writeFileSync(join(dir, consumer), "import { first } from '@app/preferences';\nconsole.log(first);\n");
      expect(externalSymbolReferences(dir, group)).toEqual([consumer]);

      writeFileSync(join(dir, consumer), "const modulePath = './preferences';\nconst { first } = await import(modulePath);\nconsole.log(first);\n");
      expect(externalSymbolReferences(dir, group)).toEqual([consumer]);

      writeFileSync(join(dir, consumer), "const { first } = await import('./preferences');\nconsole.log(first);\n");
      expect(externalSymbolReferences(dir, group)).toEqual([consumer]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('workflow completion', () => {
  const ci = { workflowName: 'CI Gates (PR)', status: 'completed', conclusion: 'success' };

  it('waits for the CI workflow and all runs on the published commit', () => {
    expect(workflowRunState([])).toBe('pending');
    expect(workflowRunState([{ workflowName: 'Studio Changelog', status: 'completed', conclusion: 'success' }])).toBe('pending');
    expect(workflowRunState([{ ...ci, status: 'in_progress', conclusion: '' }])).toBe('pending');
    expect(workflowRunState([ci, { workflowName: 'Copilot', status: 'completed', conclusion: 'failure' }])).toBe('passed');
    expect(workflowRunState([{ ...ci, conclusion: 'failure' }])).toBe('failed');
  });
});

describe('publication recovery', () => {
  it('finishes the same Draft PR after interruption between PR creation and changelog', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sva-fallow-recovery-'));
    const repo = join(dir, 'repo');
    const bare = join(dir, 'remote.git');
    const bin = join(dir, 'bin');
    const prMarker = join(dir, 'pr-created');
    const failOnce = join(dir, 'fail-once');
    const createCount = join(dir, 'create-count');
    const source = 'apps/example/src/lib/preferences.ts';
    const branch = 'automation/fallow-recovery-test';
    const runGit = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    try {
      mkdirSync(repo);
      mkdirSync(bin);
      runGit(dir, ['init', '--bare', bare]);
      runGit(repo, ['init']);
      runGit(repo, ['config', 'user.email', 'fallow-test@example.invalid']);
      runGit(repo, ['config', 'user.name', 'Fallow Test']);
      runGit(repo, ['remote', 'add', 'origin', bare]);
      mkdirSync(dirname(join(repo, source)), { recursive: true });
      writeFileSync(join(repo, source), 'const first = 1;\nconst second = 2;\n');
      runGit(repo, ['add', source]);
      runGit(repo, ['commit', '-m', 'initial']);
      const base = runGit(repo, ['rev-parse', 'HEAD']);
      writeFileSync(failOnce, '1');
      const fakeGh = join(bin, 'gh');
      writeFileSync(fakeGh, [
        '#!/bin/sh',
        'case "$1 $2" in',
        '  "pr list") if test -e "$FAKE_PR_MARKER"; then echo \'[{"number":42,"state":"OPEN","isDraft":true}]\'; else echo \'[]\'; fi ;;',
        '  "pr create") echo create >> "$FAKE_CREATE_COUNT"; touch "$FAKE_PR_MARKER"; if test -e "$FAKE_FAIL_ONCE"; then rm "$FAKE_FAIL_ONCE"; exit 1; fi; echo https://example.invalid/pull/42 ;;',
        '  "pr edit") exit 0 ;;',
        '  "pr view") printf \'{"headRefOid":"%s"}\\n\' "$(git rev-parse HEAD)" ;;',
        '  "pr checks") case "$*" in *--json*) echo \'[{"name":"CI Scope","state":"SUCCESS"}]\' ;; esac ;;',
        '  "run list") echo \'[{"workflowName":"CI Gates (PR)","status":"completed","conclusion":"success"}]\' ;;',
        '  *) exit 1 ;;',
        'esac',
      ].join('\n') + '\n');
      chmodSync(fakeGh, 0o755);
      const modulePath = fileURLToPath(new URL('./fallow-local-llm-loop.ts', import.meta.url));
      const code = "import { publish, selectGroups } from './scripts/ops/fallow-local-llm-loop.ts'; const group = selectGroups({ kind: 'dead-code', unused_exports: [1, 2].map((line) => ({ path: process.env.FAKE_SOURCE!, export_name: line === 1 ? 'first' : 'second', line, is_type_only: false, is_re_export: false, actions: [{ type: 'remove-export', auto_fixable: true }] })) })[0]!; publish(process.env.FAKE_REPO!, group, process.env.FAKE_BRANCH!, process.env.FAKE_BASE!);";
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SVA_FALLOW_STATE_DIR: join(dir, 'state'), FAKE_PR_MARKER: prMarker, FAKE_FAIL_ONCE: failOnce, FAKE_CREATE_COUNT: createCount, FAKE_SOURCE: source, FAKE_REPO: repo, FAKE_BRANCH: branch, FAKE_BASE: base };
      const runPublish = () => execFileSync('pnpm', ['exec', 'tsx', '-e', code], { cwd: dirname(dirname(dirname(modulePath))), env, encoding: 'utf8', stdio: 'pipe' });
      expect(runPublish).toThrow();
      expect(runPublish).not.toThrow();
      expect(readFileSync(createCount, 'utf8').trim().split('\n')).toHaveLength(1);
      const entry = runGit(dir, ['--git-dir', bare, 'show', `${branch}:docs/changelog/entries/pr-42.json`]);
      expect(JSON.parse(entry)).toEqual({ prNumber: 42, body: 'Allgemeine Verbesserungen' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 15_000);
});
