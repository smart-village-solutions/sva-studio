#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const workspaceRoots = ['apps', 'packages'].map((dir) => path.join(rootDir, dir));
const policyPath = path.join(rootDir, 'tooling/testing/coverage-policy.json');
const baselinePath = path.join(rootDir, 'tooling/testing/coverage-baseline.json');
const updateBaseline = process.argv.includes('--update-baseline');
const requireSummaries = process.env.COVERAGE_GATE_REQUIRE_SUMMARIES === '1';

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const findCoverageSummaries = (dir, results = []) => {
  if (!fs.existsSync(dir)) {
    return results;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.nx') {
        continue;
      }
      findCoverageSummaries(entryPath, results);
      continue;
    }
    if (entry.isFile() && entry.name === 'coverage-summary.json' && entryPath.includes(`${path.sep}coverage${path.sep}`)) {
      results.push(entryPath);
    }
  }
  return results;
};

const projectFromCoveragePath = (coverageSummaryPath) => {
  const normalized = coverageSummaryPath.split(path.sep).join('/');
  const marker = '/coverage/coverage-summary.json';
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  const projectRoot = normalized.slice(0, idx);
  return path.basename(projectRoot);
};

const toMetricValues = (summary) => {
  const total = summary.total ?? {};
  return {
    lines: Number(total.lines?.pct ?? 0),
    statements: Number(total.statements?.pct ?? 0),
    functions: Number(total.functions?.pct ?? 0),
    branches: Number(total.branches?.pct ?? 0),
  };
};

const mergeGlobal = (projectMetricsList) => {
  if (projectMetricsList.length === 0) {
    return { lines: 0, statements: 0, functions: 0, branches: 0 };
  }
  const totals = projectMetricsList.reduce(
    (acc, current) => ({
      lines: acc.lines + current.lines,
      statements: acc.statements + current.statements,
      functions: acc.functions + current.functions,
      branches: acc.branches + current.branches,
    }),
    { lines: 0, statements: 0, functions: 0, branches: 0 }
  );
  return {
    lines: totals.lines / projectMetricsList.length,
    statements: totals.statements / projectMetricsList.length,
    functions: totals.functions / projectMetricsList.length,
    branches: totals.branches / projectMetricsList.length,
  };
};

const formatPct = (value) => `${value.toFixed(2)}%`;

if (!fs.existsSync(policyPath)) {
  console.error(`Coverage policy not found: ${policyPath}`);
  process.exit(1);
}

const policy = readJson(policyPath);
const baseline = fs.existsSync(baselinePath)
  ? readJson(baselinePath)
  : { projects: {} };

const summaries = workspaceRoots.flatMap((dir) => findCoverageSummaries(dir));
if (summaries.length === 0) {
  const message = 'No coverage-summary.json files found.';
  if (requireSummaries) {
    console.error(`${message} Failing coverage gate because COVERAGE_GATE_REQUIRE_SUMMARIES=1.`);
    process.exit(1);
  }
  console.warn(`${message} Skipping coverage gate.`);
  process.exit(0);
}

const projects = {};
for (const summaryPath of summaries) {
  const projectName = projectFromCoveragePath(summaryPath);
  if (!projectName) continue;
  const summary = readJson(summaryPath);
  projects[projectName] = toMetricValues(summary);
}

if (updateBaseline) {
  const nextBaseline = { projects };
  fs.writeFileSync(baselinePath, JSON.stringify(nextBaseline, null, 2) + '\n', 'utf8');
  console.log(`Updated baseline at ${baselinePath}`);
  process.exit(0);
}

const metrics = policy.metrics ?? ['lines', 'statements', 'functions', 'branches'];
const exemptProjects = new Set(policy.exemptProjects ?? []);
const maxAllowedDrop = Number(policy.maxAllowedDropPctPoints ?? 0);
const errors = [];

const reportLines = [];
reportLines.push('## Coverage Summary');
reportLines.push('');
reportLines.push('| Project | Lines | Statements | Functions | Branches |');
reportLines.push('| --- | ---: | ---: | ---: | ---: |');

const activeProjects = Object.entries(projects).filter(([name]) => !exemptProjects.has(name));
const expectedProjects = Object.keys(policy.perProjectFloors ?? {}).filter(
  (name) => !exemptProjects.has(name)
);

for (const projectName of expectedProjects) {
  if (!projects[projectName]) {
    errors.push(`[${projectName}] missing coverage-summary.json`);
  }
}
for (const [name, values] of Object.entries(projects)) {
  reportLines.push(
    `| ${name} | ${formatPct(values.lines)} | ${formatPct(values.statements)} | ${formatPct(values.functions)} | ${formatPct(values.branches)} |`
  );
}

for (const [projectName, values] of activeProjects) {
  const floorConfig = policy.perProjectFloors?.[projectName] ?? policy.globalFloors ?? {};
  const baselineValues = baseline.projects?.[projectName] ?? null;
  for (const metric of metrics) {
    const floor = Number(floorConfig[metric] ?? policy.globalFloors?.[metric] ?? 0);
    const current = Number(values[metric] ?? 0);
    if (current < floor) {
      errors.push(
        `[${projectName}] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`
      );
    }
    if (baselineValues && typeof baselineValues[metric] === 'number') {
      const drop = Number(baselineValues[metric]) - current;
      if (drop > maxAllowedDrop) {
        errors.push(
          `[${projectName}] ${metric} dropped by ${drop.toFixed(2)}pp (allowed ${maxAllowedDrop.toFixed(2)}pp)`
        );
      }
    }
  }
}

const globalCoverage = mergeGlobal(activeProjects.map(([, values]) => values));
reportLines.push('');
reportLines.push(`Global coverage (avg): lines ${formatPct(globalCoverage.lines)}, statements ${formatPct(globalCoverage.statements)}, functions ${formatPct(globalCoverage.functions)}, branches ${formatPct(globalCoverage.branches)}`);

for (const metric of metrics) {
  const floor = Number(policy.globalFloors?.[metric] ?? 0);
  const current = Number(globalCoverage[metric] ?? 0);
  if (current < floor) {
    errors.push(`[global] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`);
  }
}

const summaryBody = reportLines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryBody, 'utf8');
}
console.log(summaryBody);

if (errors.length > 0) {
  console.error('Coverage gate failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Coverage gate passed.');
