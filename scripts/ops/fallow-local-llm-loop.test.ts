import { describe, expect, it } from 'vitest';
import { eligibleGroups, selectGroups, validateDecision, workflowRunState } from './fallow-local-llm-loop.js';

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

describe('workflow completion', () => {
  const ci = { workflowName: 'CI Gates (PR)', status: 'completed', conclusion: 'success' };

  it('waits for the CI workflow and all runs on the published commit', () => {
    expect(workflowRunState([])).toBe('pending');
    expect(workflowRunState([{ workflowName: 'Studio Changelog', status: 'completed', conclusion: 'success' }])).toBe('pending');
    expect(workflowRunState([ci, { workflowName: 'CodeQL Security', status: 'in_progress', conclusion: '' }])).toBe('pending');
    expect(workflowRunState([ci, { workflowName: 'CodeQL Security', status: 'completed', conclusion: 'success' }])).toBe('passed');
    expect(workflowRunState([ci, { workflowName: 'CodeQL Security', status: 'completed', conclusion: 'failure' }])).toBe('failed');
  });
});
