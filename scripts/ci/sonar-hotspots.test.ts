import { expect, it } from 'vitest';

import {
  buildIssueSearchParams,
  buildListSearchParams,
  filterIssues,
  formatIssueCsv,
  formatIssueTable,
  filterHotspots,
  formatListCsv,
  formatListTable,
  parseCommand,
} from './sonar-hotspots.ts';

it('parseCommand ignores a leading double dash from pnpm forwarding', () => {
  const command = parseCommand(['--', 'bulk-review', '--hotspot', 'AX1', '--resolution', 'SAFE', '--comment', 'ok'], {
    SONAR_TOKEN: 'token',
  });

  expect(command.command).toBe('bulk-review');
  expect(command.hotspotKeys).toEqual(['AX1']);
});

it('parseCommand parses list options with filters', () => {
  const command = parseCommand(
    ['list', '--project', 'foo', '--branch', 'main', '--status', 'TO_REVIEW', '--file-path-includes', 'apps/foo', '--json'],
    { SONAR_TOKEN: 'token' }
  );

  expect(command.command).toBe('list');
  expect(command.projectKey).toBe('foo');
  expect(command.branch).toBe('main');
  expect(command.status).toBe('TO_REVIEW');
  expect(command.filePathIncludes).toBe('apps/foo');
  expect(command.output).toBe('json');
});

it('buildListSearchParams includes supported filters', () => {
  const command = parseCommand(
    ['list', '--project', 'foo', '--pull-request', '123', '--rule', 'typescript:S5148'],
    { SONAR_TOKEN: 'token' }
  );

  expect(command.command).toBe('list');
  const searchParams = buildListSearchParams(command, 2);

  expect(searchParams.get('projectKey')).toBe('foo');
  expect(searchParams.get('pullRequest')).toBe('123');
  expect(searchParams.get('ruleKey')).toBe('typescript:S5148');
  expect(searchParams.get('p')).toBe('2');
});

it('filterHotspots narrows by component substring', () => {
  const filtered = filterHotspots(
    [
      { key: '1', component: 'smart-village-app_sva-studio:apps/sva-studio-react/src/components/Sidebar.tsx', project: 'p' },
      { key: '2', component: 'smart-village-app_sva-studio:packages/auth-runtime/src/index.ts', project: 'p' },
    ],
    { filePathIncludes: 'apps/sva-studio-react' }
  );

  expect(filtered.map((entry) => entry.key)).toEqual(['1']);
});

it('formatListTable renders a stable tabular output', () => {
  const output = formatListTable([
    {
      key: 'hotspot-1',
      component: 'smart-village-app_sva-studio:apps/sva-studio-react/src/components/Sidebar.tsx',
      line: 167,
      project: 'smart-village-app_sva-studio',
      status: 'TO_REVIEW',
      vulnerabilityProbability: 'HIGH',
      ruleKey: 'typescript:S5148',
    },
  ]);

  expect(output).toMatch(/key\tstatus\tprobability\trule\tlocation/);
  expect(output).toMatch(/hotspot-1\tTO_REVIEW\tHIGH\ttypescript:S5148\tsmart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx:167/);
});

it('formatListCsv escapes fields for spreadsheet export', () => {
  const output = formatListCsv([
    {
      key: 'hotspot-1',
      component: 'smart-village-app_sva-studio:apps/sva-studio-react/src/components/Sidebar.tsx',
      line: 167,
      project: 'smart-village-app_sva-studio',
      status: 'TO_REVIEW',
      vulnerabilityProbability: 'HIGH',
      ruleKey: 'typescript:S5148',
      message: 'Use rel="noopener"',
    },
  ]);

  expect(output).toMatch(/key,status,probability,rule,component,line,message/);
  expect(output).toMatch(/hotspot-1,TO_REVIEW,HIGH,typescript:S5148,smart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx,167,"Use rel=""noopener"""/);
});

it('parseCommand parses bulk-review options', () => {
  const command = parseCommand(
    ['bulk-review', '--hotspot', 'AX1', '--hotspot', 'AX2', '--resolution', 'SAFE', '--comment', 'Begründung'],
    { SONAR_TOKEN: 'token' }
  );

  expect(command.command).toBe('bulk-review');
  expect(command.hotspotKeys).toEqual(['AX1', 'AX2']);
  expect(command.resolution).toBe('SAFE');
  expect(command.comment).toBe('Begründung');
});

it('parseCommand parses issues:list options', () => {
  const command = parseCommand(
    ['issues:list', '--statuses', 'OPEN,CONFIRMED', '--types', 'BUG,VULNERABILITY', '--file-path-includes', 'packages/server-runtime', '--csv'],
    { SONAR_TOKEN: 'token' }
  );

  expect(command.command).toBe('issues:list');
  expect(command.statuses).toBe('OPEN,CONFIRMED');
  expect(command.types).toBe('BUG,VULNERABILITY');
  expect(command.filePathIncludes).toBe('packages/server-runtime');
  expect(command.output).toBe('csv');
});

it('buildIssueSearchParams includes supported filters', () => {
  const command = parseCommand(
    ['issues:list', '--project', 'foo', '--statuses', 'OPEN', '--types', 'BUG', '--rules', 'typescript:S112'],
    { SONAR_TOKEN: 'token' }
  );

  expect(command.command).toBe('issues:list');
  const searchParams = buildIssueSearchParams(command, 3);
  expect(searchParams.get('projects')).toBe('foo');
  expect(searchParams.get('issueStatuses')).toBe('OPEN');
  expect(searchParams.get('types')).toBe('BUG');
  expect(searchParams.get('rules')).toBe('typescript:S112');
  expect(searchParams.get('p')).toBe('3');
});

it('filterIssues narrows by component substring', () => {
  const filtered = filterIssues(
    [
      { key: 'i1', component: 'smart-village-app_sva-studio:packages/server-runtime/src/logger/index.server.ts', project: 'p' },
      { key: 'i2', component: 'smart-village-app_sva-studio:packages/routing/src/protected.routes.ts', project: 'p' },
    ],
    { filePathIncludes: 'packages/server-runtime' }
  );

  expect(filtered.map((entry) => entry.key)).toEqual(['i1']);
});

it('formatIssueTable renders a stable tabular output', () => {
  const output = formatIssueTable([
    {
      key: 'issue-1',
      component: 'smart-village-app_sva-studio:packages/server-runtime/src/logger/index.server.ts',
      line: 44,
      project: 'smart-village-app_sva-studio',
      status: 'OPEN',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      rule: 'typescript:S112',
    },
  ]);

  expect(output).toMatch(/key\tstatus\tseverity\ttype\trule\tlocation/);
  expect(output).toMatch(/issue-1\tOPEN\tMAJOR\tCODE_SMELL\ttypescript:S112\tsmart-village-app_sva-studio:packages\/server-runtime\/src\/logger\/index\.server\.ts:44/);
});

it('formatIssueCsv escapes fields for export', () => {
  const output = formatIssueCsv([
    {
      key: 'issue-1',
      component: 'smart-village-app_sva-studio:packages/server-runtime/src/logger/index.server.ts',
      line: 44,
      project: 'smart-village-app_sva-studio',
      status: 'OPEN',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      rule: 'typescript:S112',
      message: 'Avoid "any"',
    },
  ]);

  expect(output).toMatch(/key,status,severity,type,rule,component,line,message/);
  expect(output).toMatch(/issue-1,OPEN,MAJOR,CODE_SMELL,typescript:S112,smart-village-app_sva-studio:packages\/server-runtime\/src\/logger\/index\.server\.ts,44,"Avoid ""any"""/);
});
