import test from 'node:test';
import assert from 'node:assert/strict';

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

test('parseCommand ignores a leading double dash from pnpm forwarding', () => {
  const command = parseCommand(['--', 'bulk-review', '--hotspot', 'AX1', '--resolution', 'SAFE', '--comment', 'ok'], {
    SONAR_TOKEN: 'token',
  });

  assert.equal(command.command, 'bulk-review');
  assert.deepEqual(command.hotspotKeys, ['AX1']);
});

test('parseCommand parses list options with filters', () => {
  const command = parseCommand(
    ['list', '--project', 'foo', '--branch', 'main', '--status', 'TO_REVIEW', '--file-path-includes', 'apps/foo', '--json'],
    { SONAR_TOKEN: 'token' }
  );

  assert.equal(command.command, 'list');
  assert.equal(command.projectKey, 'foo');
  assert.equal(command.branch, 'main');
  assert.equal(command.status, 'TO_REVIEW');
  assert.equal(command.filePathIncludes, 'apps/foo');
  assert.equal(command.output, 'json');
});

test('buildListSearchParams includes supported filters', () => {
  const command = parseCommand(
    ['list', '--project', 'foo', '--pull-request', '123', '--rule', 'typescript:S5148'],
    { SONAR_TOKEN: 'token' }
  );

  assert.equal(command.command, 'list');
  const searchParams = buildListSearchParams(command, 2);

  assert.equal(searchParams.get('projectKey'), 'foo');
  assert.equal(searchParams.get('pullRequest'), '123');
  assert.equal(searchParams.get('ruleKey'), 'typescript:S5148');
  assert.equal(searchParams.get('p'), '2');
});

test('filterHotspots narrows by component substring', () => {
  const filtered = filterHotspots(
    [
      { key: '1', component: 'smart-village-app_sva-studio:apps/sva-studio-react/src/components/Sidebar.tsx', project: 'p' },
      { key: '2', component: 'smart-village-app_sva-studio:packages/auth/src/index.ts', project: 'p' },
    ],
    { filePathIncludes: 'apps/sva-studio-react' }
  );

  assert.deepEqual(
    filtered.map((entry) => entry.key),
    ['1']
  );
});

test('formatListTable renders a stable tabular output', () => {
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

  assert.match(output, /key\tstatus\tprobability\trule\tlocation/);
  assert.match(output, /hotspot-1\tTO_REVIEW\tHIGH\ttypescript:S5148\tsmart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx:167/);
});

test('formatListCsv escapes fields for spreadsheet export', () => {
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

  assert.match(output, /key,status,probability,rule,component,line,message/);
  assert.match(output, /hotspot-1,TO_REVIEW,HIGH,typescript:S5148,smart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx,167,"Use rel=""noopener"""/);
});

test('parseCommand parses bulk-review options', () => {
  const command = parseCommand(
    ['bulk-review', '--hotspot', 'AX1', '--hotspot', 'AX2', '--resolution', 'SAFE', '--comment', 'Begründung'],
    { SONAR_TOKEN: 'token' }
  );

  assert.equal(command.command, 'bulk-review');
  assert.deepEqual(command.hotspotKeys, ['AX1', 'AX2']);
  assert.equal(command.resolution, 'SAFE');
  assert.equal(command.comment, 'Begründung');
});

test('parseCommand parses issues:list options', () => {
  const command = parseCommand(
    ['issues:list', '--statuses', 'OPEN,CONFIRMED', '--types', 'BUG,VULNERABILITY', '--file-path-includes', 'packages/sdk', '--csv'],
    { SONAR_TOKEN: 'token' }
  );

  assert.equal(command.command, 'issues:list');
  assert.equal(command.statuses, 'OPEN,CONFIRMED');
  assert.equal(command.types, 'BUG,VULNERABILITY');
  assert.equal(command.filePathIncludes, 'packages/sdk');
  assert.equal(command.output, 'csv');
});

test('buildIssueSearchParams includes supported filters', () => {
  const command = parseCommand(
    ['issues:list', '--project', 'foo', '--statuses', 'OPEN', '--types', 'BUG', '--rules', 'typescript:S112'],
    { SONAR_TOKEN: 'token' }
  );

  assert.equal(command.command, 'issues:list');
  const searchParams = buildIssueSearchParams(command, 3);
  assert.equal(searchParams.get('projects'), 'foo');
  assert.equal(searchParams.get('issueStatuses'), 'OPEN');
  assert.equal(searchParams.get('types'), 'BUG');
  assert.equal(searchParams.get('rules'), 'typescript:S112');
  assert.equal(searchParams.get('p'), '3');
});

test('filterIssues narrows by component substring', () => {
  const filtered = filterIssues(
    [
      { key: 'i1', component: 'smart-village-app_sva-studio:packages/sdk/src/logger/index.server.ts', project: 'p' },
      { key: 'i2', component: 'smart-village-app_sva-studio:packages/routing/src/protected.routes.ts', project: 'p' },
    ],
    { filePathIncludes: 'packages/sdk' }
  );

  assert.deepEqual(filtered.map((entry) => entry.key), ['i1']);
});

test('formatIssueTable renders a stable tabular output', () => {
  const output = formatIssueTable([
    {
      key: 'issue-1',
      component: 'smart-village-app_sva-studio:packages/sdk/src/logger/index.server.ts',
      line: 44,
      project: 'smart-village-app_sva-studio',
      status: 'OPEN',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      rule: 'typescript:S112',
    },
  ]);

  assert.match(output, /key\tstatus\tseverity\ttype\trule\tlocation/);
  assert.match(output, /issue-1\tOPEN\tMAJOR\tCODE_SMELL\ttypescript:S112\tsmart-village-app_sva-studio:packages\/sdk\/src\/logger\/index\.server\.ts:44/);
});

test('formatIssueCsv escapes fields for export', () => {
  const output = formatIssueCsv([
    {
      key: 'issue-1',
      component: 'smart-village-app_sva-studio:packages/sdk/src/logger/index.server.ts',
      line: 44,
      project: 'smart-village-app_sva-studio',
      status: 'OPEN',
      severity: 'MAJOR',
      type: 'CODE_SMELL',
      rule: 'typescript:S112',
      message: 'Avoid "any"',
    },
  ]);

  assert.match(output, /key,status,severity,type,rule,component,line,message/);
  assert.match(output, /issue-1,OPEN,MAJOR,CODE_SMELL,typescript:S112,smart-village-app_sva-studio:packages\/sdk\/src\/logger\/index\.server\.ts,44,"Avoid ""any"""/);
});
