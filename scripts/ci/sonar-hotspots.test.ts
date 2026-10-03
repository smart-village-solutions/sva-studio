import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';

import {
  buildIssueSearchParams,
  buildListSearchParams,
  type BulkReviewOptions,
  filterIssues,
  formatIssueCsv,
  formatIssueTable,
  filterHotspots,
  fetchHotspots,
  fetchIssues,
  formatListCsv,
  formatListTable,
  type IssueListOptions,
  type ListOptions,
  parseCommand,
  reviewHotspot,
} from './sonar-hotspots.ts';

afterEach(() => vi.unstubAllGlobals());

it('fetchHotspots sends the Bearer token and pages until the API total is reached', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          paging: { pageSize: 1, total: 2 },
          hotspots: [{ key: 'first', component: 'apps/first.ts', project: 'project' }],
        }),
        { status: 200 }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          paging: { pageSize: 1, total: 2 },
          hotspots: [{ key: 'second', component: 'apps/second.ts', project: 'project' }],
        }),
        { status: 200 }
      )
    );
  vi.stubGlobal('fetch', fetchMock);

  const options = expectListCommand(
    parseCommand(['list', '--page-size', '1', '--max-pages', '3', '--branch', 'main'], {
      SONAR_TOKEN: 'test-token',
    })
  );
  const hotspots = await fetchHotspots(options);

  expect(hotspots.map((item) => item.key)).toEqual(['first', 'second']);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('p'))).toEqual([
    '1',
    '2',
  ]);
  expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer test-token' });
});

it('fetchIssues applies local component filtering and stops at maxPages', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        paging: { pageSize: 2, total: 20 },
        issues: [
          { key: 'match', component: 'packages/core/src/index.ts', project: 'project' },
          { key: 'other', component: 'apps/app/src/index.ts', project: 'project' },
        ],
      }),
      { status: 200 }
    )
  );
  vi.stubGlobal('fetch', fetchMock);

  const options = expectIssueListCommand(
    parseCommand(
      [
        'issues:list',
        '--page-size',
        '2',
        '--max-pages',
        '1',
        '--file-path-includes',
        'packages/core',
      ],
      { SONAR_TOKEN: 'test-token' }
    )
  );
  expect((await fetchIssues(options)).map((item) => item.key)).toEqual(['match']);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('issueStatuses')).toBe(
    'OPEN,CONFIRMED'
  );
});

it('reviewHotspot preserves form encoding and reports non-success API responses', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response('rejected', { status: 403 }));
  vi.stubGlobal('fetch', fetchMock);
  const command = parseCommand(
    ['review', '--hotspot', 'AX1', '--resolution', 'SAFE', '--comment', 'ok'],
    { SONAR_TOKEN: 'test-token' }
  );
  expect(command.command).toBe('review');
  if (command.command !== 'review') throw new Error('Expected review command');

  await reviewHotspot(command);
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://sonarcloud.io/api/hotspots/change_status');
  expect(new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body)).get('comment')).toBe('ok');
  await expect(reviewHotspot(command)).rejects.toThrow('SonarCloud API Fehler 403: rejected');
});

it('CLI exits with code 1 for a missing token and code 0 for help', () => {
  const script = fileURLToPath(new URL('./sonar-hotspots.ts', import.meta.url));
  const env = { ...process.env, SONAR_TOKEN: '', SONARQUBE_TOKEN: '' };
  const missingToken = spawnSync(process.execPath, ['--import', 'tsx', script, 'list'], {
    env,
    encoding: 'utf8',
  });
  const help = spawnSync(process.execPath, ['--import', 'tsx', script, '--help'], {
    env,
    encoding: 'utf8',
  });
  expect(missingToken.status).toBe(1);
  expect(missingToken.stderr).toContain('SONAR_TOKEN oder SONARQUBE_TOKEN ist erforderlich.');
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('SonarCloud Hotspots und Issues');
});

it('parseCommand ignores a leading double dash from pnpm forwarding', () => {
  const command = expectBulkReviewCommand(
    parseCommand(
      ['--', 'bulk-review', '--hotspot', 'AX1', '--resolution', 'SAFE', '--comment', 'ok'],
      {
        SONAR_TOKEN: 'token',
      }
    )
  );

  expect(command.command).toBe('bulk-review');
  expect(command.hotspotKeys).toEqual(['AX1']);
});

it('parseCommand parses list options with filters', () => {
  const command = expectListCommand(
    parseCommand(
      [
        'list',
        '--project',
        'foo',
        '--branch',
        'main',
        '--status',
        'TO_REVIEW',
        '--file-path-includes',
        'apps/foo',
        '--json',
      ],
      { SONAR_TOKEN: 'token' }
    )
  );

  expect(command.command).toBe('list');
  expect(command.projectKey).toBe('foo');
  expect(command.branch).toBe('main');
  expect(command.status).toBe('TO_REVIEW');
  expect(command.filePathIncludes).toBe('apps/foo');
  expect(command.output).toBe('json');
});

it('buildListSearchParams includes supported filters', () => {
  const command = expectListCommand(
    parseCommand(
      ['list', '--project', 'foo', '--pull-request', '123', '--rule', 'typescript:S5148'],
      { SONAR_TOKEN: 'token' }
    )
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
      {
        key: '1',
        component: 'smart-village-app_sva-studio:apps/sva-studio-react/src/components/Sidebar.tsx',
        project: 'p',
      },
      {
        key: '2',
        component: 'smart-village-app_sva-studio:packages/auth-runtime/src/index.ts',
        project: 'p',
      },
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
  expect(output).toMatch(
    /hotspot-1\tTO_REVIEW\tHIGH\ttypescript:S5148\tsmart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx:167/
  );
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
  expect(output).toMatch(
    /hotspot-1,TO_REVIEW,HIGH,typescript:S5148,smart-village-app_sva-studio:apps\/sva-studio-react\/src\/components\/Sidebar\.tsx,167,"Use rel=""noopener"""/
  );
});

it('parseCommand parses bulk-review options', () => {
  const command = expectBulkReviewCommand(
    parseCommand(
      [
        'bulk-review',
        '--hotspot',
        'AX1',
        '--hotspot',
        'AX2',
        '--resolution',
        'SAFE',
        '--comment',
        'Begründung',
      ],
      { SONAR_TOKEN: 'token' }
    )
  );

  expect(command.command).toBe('bulk-review');
  expect(command.hotspotKeys).toEqual(['AX1', 'AX2']);
  expect(command.resolution).toBe('SAFE');
  expect(command.comment).toBe('Begründung');
});

it('parseCommand parses issues:list options', () => {
  const command = expectIssueListCommand(
    parseCommand(
      [
        'issues:list',
        '--statuses',
        'OPEN,CONFIRMED',
        '--types',
        'BUG,VULNERABILITY',
        '--file-path-includes',
        'packages/server-runtime',
        '--csv',
      ],
      { SONAR_TOKEN: 'token' }
    )
  );

  expect(command.command).toBe('issues:list');
  expect(command.statuses).toBe('OPEN,CONFIRMED');
  expect(command.types).toBe('BUG,VULNERABILITY');
  expect(command.filePathIncludes).toBe('packages/server-runtime');
  expect(command.output).toBe('csv');
});

it('buildIssueSearchParams includes supported filters', () => {
  const command = expectIssueListCommand(
    parseCommand(
      [
        'issues:list',
        '--project',
        'foo',
        '--statuses',
        'OPEN',
        '--types',
        'BUG',
        '--rules',
        'typescript:S112',
      ],
      { SONAR_TOKEN: 'token' }
    )
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
      {
        key: 'i1',
        component:
          'smart-village-app_sva-studio:packages/server-runtime/src/logger/index.server.ts',
        project: 'p',
      },
      {
        key: 'i2',
        component: 'smart-village-app_sva-studio:packages/routing/src/protected.routes.ts',
        project: 'p',
      },
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
  expect(output).toMatch(
    /issue-1\tOPEN\tMAJOR\tCODE_SMELL\ttypescript:S112\tsmart-village-app_sva-studio:packages\/server-runtime\/src\/logger\/index\.server\.ts:44/
  );
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
  expect(output).toMatch(
    /issue-1,OPEN,MAJOR,CODE_SMELL,typescript:S112,smart-village-app_sva-studio:packages\/server-runtime\/src\/logger\/index\.server\.ts,44,"Avoid ""any"""/
  );
});

function expectListCommand(command: ReturnType<typeof parseCommand>): ListOptions {
  expect(command.command).toBe('list');
  return command as ListOptions;
}

function expectBulkReviewCommand(command: ReturnType<typeof parseCommand>): BulkReviewOptions {
  expect(command.command).toBe('bulk-review');
  return command as BulkReviewOptions;
}

function expectIssueListCommand(command: ReturnType<typeof parseCommand>): IssueListOptions {
  expect(command.command).toBe('issues:list');
  return command as IssueListOptions;
}
