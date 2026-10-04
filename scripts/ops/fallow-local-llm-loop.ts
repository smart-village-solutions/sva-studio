#!/usr/bin/env node
/** Bounded, local-model cleanup of Fallow unused exports. Never merges a PR. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Finding = { path: string; export_name: string; line: number; is_type_only: boolean; is_re_export: boolean; actions: { type: string; auto_fixable: boolean }[] };
type Group = { id: string; project: string; path: string; findings: Finding[] };
type Edit = { path: string; line: number; name: string; old: string; replacement: string };
type Decision = { decision: 'apply' | 'skip'; reason: string; edits: Edit[] };
type RunRecord = { base: string; status: string; reason?: string; pr?: number; branch?: string; at: string };
type WorkflowRun = { workflowName: string; status: string; conclusion: string };
type ExistingPr = { number: number; state: string; isDraft: boolean };

class RejectedGroup extends Error {}
class FailedCi extends Error {}
class NeedsOperator extends Error {}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateRoot = process.env.SVA_FALLOW_STATE_DIR || join(homedir(), '.local/state/sva-fallow-loop');
const apiUrl = process.env.SVA_LLAMA_URL || 'http://127.0.0.1:8080/v1/chat/completions';
const maxPrs = 2;
const maxHours = 8;
const groupBudgetHours = 6;

function command(cwd: string, file: string, args: string[], timeout = 300_000, allowed = [0]): string {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (file === 'pnpm') { delete env.GH_TOKEN; delete env.GITHUB_TOKEN; }
  const run = spawnSync(file, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024, env });
  if (run.error || !allowed.includes(run.status ?? -1)) throw new Error(`${file} ${args.join(' ')}: ${(run.error?.message || run.stderr || run.stdout).slice(0, 600)}`);
  return run.stdout.trim();
}

export function selectGroups(input: unknown): Group[] {
  const envelope = input as { kind?: string; unused_exports?: Finding[] };
  if (envelope.kind !== 'dead-code' || !Array.isArray(envelope.unused_exports)) throw new Error('Unexpected Fallow JSON');
  const byFile = new Map<string, Finding[]>();
  for (const f of envelope.unused_exports) {
    if (!/^apps\/[a-z0-9-]+\/src\/(?:lib|components\/ui)\/[a-z0-9./-]+\.tsx?$/.test(f.path)) continue;
    if (f.path.split('/').includes('..')) continue;
    if (/\/(auth|iam|plugins?|routes?|server|security|contracts?)\b/i.test(f.path) || /(?:auth|iam|plugin|security|permission|authorization|interfaces-api|map-geocoding-api|\.server\.|(?:^|\/)i18n\.|react-dom-server-compat)/i.test(f.path) || /(?:^|\/)index\./.test(f.path)) continue;
    if (f.is_type_only || f.is_re_export || !/^[A-Za-z_$][\w$]*$/.test(f.export_name)) continue;
    if (!f.actions?.some((a) => a.type === 'remove-export' && a.auto_fixable)) continue;
    byFile.set(f.path, [...(byFile.get(f.path) || []), f]);
  }
  return [...byFile].filter(([, fs]) => fs.length >= 2 && fs.length <= 6 && new Set(fs.map((f) => f.line)).size === fs.length).map(([path, findings]) => ({
    id: createHash('sha256').update(path + ':' + findings.map((f) => f.export_name).sort().join(',')).digest('hex').slice(0, 12),
    project: path.split('/')[1], path, findings: findings.sort((a, b) => a.line - b.line),
  })).sort((a, b) => a.path.localeCompare(b.path));
}

export function eligibleGroups(groups: Group[], blockedPaths: Set<string>, completedForBase: Set<string>): Group[] {
  return groups.filter((group) => !blockedPaths.has(group.path) && !completedForBase.has(group.id));
}

export function completedForBase(record: RunRecord | undefined, base: string): boolean {
  return record?.base === base && ['ci-green', 'rejected', 'ci-failed', 'pr-closed', 'needs-operator'].includes(record.status);
}

export function workflowRunState(runs: WorkflowRun[]): 'pending' | 'failed' | 'passed' {
  const ci = runs.find((run) => run.workflowName === 'CI Gates (PR)');
  if (!ci || ci.status !== 'completed') return 'pending';
  return ci.conclusion === 'success' ? 'passed' : 'failed';
}

export function validateDecision(group: Group, response: unknown, files: Map<string, string>): Map<string, string> {
  const d = response as Decision;
  if (!d || d.decision !== 'apply' || !Array.isArray(d.edits) || d.edits.length !== group.findings.length || typeof d.reason !== 'string') throw new Error('Model skipped or returned incomplete edits');
  const out = new Map(files);
  const seen = new Set<string>();
  for (const edit of d.edits) {
    const key = `${edit.path}:${edit.line}:${edit.name}`;
    if (seen.has(key) || !group.findings.some((f) => `${f.path}:${f.line}:${f.export_name}` === key)) throw new Error('Edit outside selected findings');
    seen.add(key);
    const original = out.get(edit.path);
    if (original === undefined || typeof edit.old !== 'string' || typeof edit.replacement !== 'string') throw new Error('Edit outside allowed files');
    const lines = original.split('\n');
    const at = edit.line - 1;
    if (lines[at] !== edit.old) throw new Error('Stale declaration');
    const declaration = /^\s*export\s+(?:const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)\b/.exec(edit.old)?.[1] === edit.name;
    const named = edit.old.trim() === `${edit.name},`
      && lines.slice(Math.max(0, at - 20), at).some((line) => /^export \{$/.test(line))
      && lines.slice(at + 1, at + 20).some((line) => /^\};$/.test(line));
    if (declaration) {
      if (edit.replacement !== edit.old.replace(/^(\s*)export\s+/, '$1')) throw new Error('Only removal of export keyword is allowed');
    } else if (named) {
      if (edit.replacement !== '') throw new Error('Named export line must be removed');
    } else throw new Error('Unsupported declaration');
    lines[at] = edit.replacement;
    out.set(edit.path, lines.join('\n'));
  }
  return out;
}

function scan(cwd: string): { kind: string; unused_exports: Finding[] } {
  const raw = command(cwd, 'pnpm', ['exec', 'fallow', 'dead-code', '--unused-exports', '--format', 'json', '--quiet', '--explain'], 300_000, [0, 1]);
  const value = JSON.parse(raw);
  if (value.error || value.kind !== 'dead-code') throw new Error('Fallow scan failed');
  return value;
}

export function externalSymbolReferences(cwd: string, group: Group): string[] {
  const names = new Set(group.findings.map((finding) => finding.export_name));
  const matches = new Set(group.findings.flatMap((finding) =>
    command(cwd, 'git', ['grep', '--no-index', '-l', '-w', '-F', '--', finding.export_name, 'apps', 'packages', 'scripts'], 30_000, [0, 1]).split('\n').filter(Boolean)
  ));
  matches.delete(group.path);
  if (!matches.size) return [];

  const configPath = join(cwd, 'apps', group.project, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(`Cannot read TypeScript config for ${group.project}`);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  if (parsed.errors.length) throw new Error(`Cannot parse TypeScript config for ${group.project}`);
  const program = ts.createProgram([group.path, ...matches].map((path) => join(cwd, path)), parsed.options);
  const checker = program.getTypeChecker();
  const target = program.getSourceFile(join(cwd, group.path));
  const module = target && checker.getSymbolAtLocation(target);
  if (!module) throw new Error(`Cannot resolve export module ${group.path}`);
  const unalias = (symbol: ts.Symbol): ts.Symbol => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const exports = new Map(checker.getExportsOfModule(module).map((symbol) => [symbol.name, unalias(symbol)]));
  if ([...names].some((name) => !exports.has(name))) throw new Error(`Cannot resolve selected exports in ${group.path}`);

  return [...matches].filter((path) => {
    const source = program.getSourceFile(join(cwd, path));
    if (!source) return true;
    let referenced = false;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && names.has(node.text)) {
        const symbol = checker.getSymbolAtLocation(node);
        if (!symbol || unalias(symbol) === exports.get(node.text)) referenced = true;
      } else if (ts.isStringLiteralLike(node) && names.has(node.text)) {
        referenced = true;
      }
      if (!referenced) ts.forEachChild(node, visit);
    };
    visit(source);
    return referenced;
  });
}

async function askModel(group: Group, files: Map<string, string>): Promise<Decision> {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(apiUrl).hostname)) throw new Error('Model endpoint must be local');
  const snippets = group.findings.map((f) => {
    const lines = files.get(f.path)!.split('\n');
    return { path: f.path, name: f.export_name, line: f.line, old: lines[f.line - 1], context: lines.slice(Math.max(0, f.line - 12), f.line + 2) };
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(apiUrl, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      model: 'local', temperature: 0, max_tokens: 650, stream: false,
      response_format: { type: 'json_object', schema: { type: 'object', properties: { decision: { enum: ['apply', 'skip'] }, reason: { type: 'string' }, edits: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, line: { type: 'integer' }, name: { type: 'string' }, old: { type: 'string' }, replacement: { type: 'string' } }, required: ['path', 'line', 'name', 'old', 'replacement'] } } }, required: ['decision', 'reason', 'edits'] } },
      messages: [{ role: 'system', content: 'Review one coherent group of Fallow unused exports. If all are safe, return apply with one edit per finding: exact old line and replacement. For a declaration, remove only the export keyword. For a named entry in an export {...} block, set replacement to empty string. Otherwise skip. Never invent lines.' }, { role: 'user', content: JSON.stringify(snippets) }],
    }) });
    if (!response.ok) throw new Error(`llama-server HTTP ${response.status}`);
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    return JSON.parse(body.choices?.[0]?.message?.content || 'null');
  } finally { clearTimeout(timer); }
}

async function waitForModelReady(): Promise<void> {
  const endpoint = new URL('/health', apiUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) throw new Error('Model endpoint must be local');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let status = 0;
    try { status = (await fetch(endpoint, { signal: AbortSignal.timeout(5_000) })).status; } catch { /* Server may still be starting. */ }
    if (status === 200) return;
    if (status !== 0 && status !== 503) throw new Error(`llama-server health HTTP ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error('llama-server did not become ready within five minutes');
}

function record(id: string, data: RunRecord): void {
  mkdirSync(join(stateRoot, 'results'), { recursive: true });
  const path = join(stateRoot, 'results', `${id}.json`);
  writeFileSync(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  command(stateRoot, 'mv', [`${path}.tmp`, path]);
}

function previous(id: string): RunRecord | undefined {
  const path = join(stateRoot, 'results', `${id}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

function openPrFiles(): Map<string, Set<string>> {
  const prs = JSON.parse(command(root, 'gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefName'])) as { number: number; headRefName: string }[];
  const files = new Map<string, Set<string>>();
  for (const pr of prs) {
    const names = command(root, 'gh', ['api', `repos/{owner}/{repo}/pulls/${pr.number}/files`, '--paginate', '--jq', '.[].filename']);
    for (const name of names.split('\n').filter(Boolean)) files.set(name, new Set([...(files.get(name) || []), pr.headRefName]));
  }
  return files;
}

function projectTarget(cwd: string, project: string, target: string): boolean {
  const info = JSON.parse(command(cwd, 'pnpm', ['exec', 'nx', 'show', 'project', project, '--json'])) as { targets?: Record<string, unknown> };
  return Boolean(info.targets?.[target]);
}

function existingPr(branch: string): ExistingPr | undefined {
  const prs = JSON.parse(command(root, 'gh', ['pr', 'list', '--state', 'all', '--head', branch, '--limit', '10', '--json', 'number,state,isDraft'])) as ExistingPr[];
  return prs[0];
}

function waitForPublishedChecks(cwd: string, number: number, finalHead: string): void {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const checks = spawnSync('gh', ['pr', 'checks', String(number), '--json', 'name'], { cwd, encoding: 'utf8', timeout: 30_000 });
    if ((checks.status === 0 || checks.status === 8) && JSON.parse(checks.stdout || '[]').length > 0) break;
    if (attempt === 5) throw new Error(`No GitHub checks appeared for PR #${number}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
  }
  const checksDeadline = Date.now() + 3_600_000;
  while (Date.now() < checksDeadline) {
    const runs = JSON.parse(command(cwd, 'gh', ['run', 'list', '--commit', finalHead, '--json', 'workflowName,status,conclusion', '--limit', '100'])) as WorkflowRun[];
    const state = workflowRunState(runs);
    if (state === 'failed') throw new FailedCi(`GitHub Actions failed for PR #${number}`);
    if (state === 'passed') break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
  }
  if (Date.now() >= checksDeadline) throw new Error(`GitHub Actions did not finish for PR #${number}`);
  const checks = spawnSync('gh', ['pr', 'checks', String(number), '--watch', '--fail-fast'], { cwd, encoding: 'utf8', timeout: 3_600_000 });
  if (checks.error || checks.status !== 0) {
    const raw = command(cwd, 'gh', ['pr', 'checks', String(number), '--json', 'name,state'], 30_000, [0, 1, 8]);
    const current = JSON.parse(raw) as { state: string }[];
    if (current.some((check) => ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(check.state))) throw new FailedCi(`GitHub checks failed for PR #${number}`);
    throw new Error(`gh pr checks ${number}: ${(checks.error?.message || checks.stderr || checks.stdout).slice(0, 600)}`);
  }
  const finalChecks = JSON.parse(command(cwd, 'gh', ['pr', 'checks', String(number), '--json', 'name,state'], 30_000, [0, 1, 8])) as { state: string }[];
  if (finalChecks.some((check) => ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(check.state))) throw new FailedCi(`GitHub checks failed for PR #${number}`);
  if (!finalChecks.length || finalChecks.some((check) => !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(check.state))) throw new Error(`GitHub checks not terminal for PR #${number}`);
  const verifiedHead = JSON.parse(command(cwd, 'gh', ['pr', 'view', String(number), '--json', 'headRefOid'])) as { headRefOid: string };
  if (verifiedHead.headRefOid !== finalHead) throw new Error('PR head changed during checks');
}

export function publish(cwd: string, group: Group, branch: string, base: string): number {
  command(cwd, 'git', ['add', '--', group.path]);
  if (command(cwd, 'git', ['diff', '--cached', '--name-only'])) command(cwd, 'git', ['commit', '-m', `fix(${group.project}): remove unused local exports`]);
  command(cwd, 'git', ['push', 'origin', `HEAD:${branch}`], 120_000);
  const title = `fix(${group.project}): remove unused local exports`;
  const body = `## Scope\n\nRemove ${group.findings.length} Fallow reported exports in \`${group.path}\`. The declarations and values remain available inside the file.\n\n## Checks\n\n- Exact declaration edits and cross-repository references checked\n- Fallow findings disappeared\n- Project unit/type gates and file placement passed\n\nDraft for manual semantic review. No automatic merge.`;
  const pr = existingPr(branch);
  const prUrl = pr ? '' : command(cwd, 'gh', ['pr', 'create', '--draft', '--base', 'main', '--head', branch, '--title', title, '--body', body], 120_000);
  const number = pr?.number ?? Number(prUrl.match(/\/(\d+)\s*$/)?.[1]);
  if (!Number.isInteger(number)) throw new Error(`Could not parse PR URL: ${prUrl}`);
  record(group.id, { base, status: 'pr-opened', pr: number, branch, at: new Date().toISOString() });
  const entry = `docs/changelog/entries/pr-${number}.json`;
  mkdirSync(join(cwd, 'docs/changelog/entries'), { recursive: true });
  if (!existsSync(join(cwd, entry))) writeFileSync(join(cwd, entry), `${JSON.stringify({ prNumber: number, body: 'Allgemeine Verbesserungen' }, null, 2)}\n`);
  command(cwd, 'git', ['add', '--', entry]);
  if (command(cwd, 'git', ['diff', '--cached', '--name-only'])) command(cwd, 'git', ['commit', '-m', `docs: add changelog entry for PR #${number}`]);
  command(cwd, 'git', ['push', 'origin', `HEAD:${branch}`], 120_000);
  command(cwd, 'gh', ['pr', 'edit', String(number), '--add-label', 'local-llm']);
  const finalHead = command(cwd, 'git', ['rev-parse', 'HEAD']);
  const prHead = JSON.parse(command(cwd, 'gh', ['pr', 'view', String(number), '--json', 'headRefOid'])) as { headRefOid: string };
  if (prHead.headRefOid !== finalHead) throw new Error('PR head differs from published commit');
  waitForPublishedChecks(cwd, number, finalHead);
  record(group.id, { base, status: 'ci-green', pr: number, branch, at: new Date().toISOString() });
  return number;
}

function prepareGroupWorktree(branch: string, base: string, remote: string): string {
  const worktree = join(stateRoot, 'worktrees', branch.replaceAll('/', '-'));
  mkdirSync(dirname(worktree), { recursive: true });
  const dirty = existsSync(worktree) && Boolean(command(worktree, 'git', ['status', '--porcelain']));
  const retries = readdirSync(dirname(worktree)).filter((name) => name.startsWith(`${branch.replaceAll('/', '-')}-retry`)).sort();
  const executionWorktree = dirty ? join(dirname(worktree), retries.at(-1) || `${branch.replaceAll('/', '-')}-retry`) : worktree;
  if (dirty && existsSync(executionWorktree) && command(executionWorktree, 'git', ['status', '--porcelain'])) {
    throw new NeedsOperator(`Both preserved worktrees require operator review: ${worktree}, ${executionWorktree}`);
  }
  if (remote) {
    command(root, 'git', ['fetch', 'origin', branch], 120_000);
    if (existsSync(executionWorktree)) command(executionWorktree, 'git', ['reset', '--hard', remote.split('\t')[0]!]);
    else command(root, 'git', ['worktree', 'add', '--detach', executionWorktree, remote.split('\t')[0]!]);
  } else if (existsSync(executionWorktree)) command(executionWorktree, 'git', ['reset', '--hard', base]);
  else command(root, 'git', ['worktree', 'add', '--detach', executionWorktree, base]);
  return executionWorktree;
}

export async function runGroup(group: Group, base: string): Promise<boolean> {
  const branch = `automation/fallow-${group.id}-${base.slice(0, 8)}`;
  const remote = command(root, 'git', ['ls-remote', '--heads', 'origin', branch]);
  const pr = existingPr(branch);
  if (pr && (pr.state !== 'OPEN' || !pr.isDraft)) {
    record(group.id, { base, status: 'pr-closed', pr: pr.number, branch, at: new Date().toISOString() });
    return false;
  }
  let publishing = Boolean(remote);
  try {
    const executionWorktree = prepareGroupWorktree(branch, base, remote);
    if (!remote) {
      command(executionWorktree, 'pnpm', ['install', '--frozen-lockfile'], 600_000);
      const content = readFileSync(join(executionWorktree, group.path), 'utf8');
      const files = new Map([[group.path, content]]);
      const decision = await askModel(group, files);
      let changed: Map<string, string>;
      try { changed = validateDecision(group, decision, files); }
      catch (error) { throw new RejectedGroup(String(error)); }
      const refs = externalSymbolReferences(executionWorktree, group);
      if (refs.length) throw new RejectedGroup(`Selected exports have external references: ${refs.join(', ')}`);
      writeFileSync(join(executionWorktree, group.path), changed.get(group.path)!);
      command(executionWorktree, 'git', ['diff', '--check']);
      const delta = command(executionWorktree, 'git', ['diff', '--numstat']);
      if (!delta || delta.split('\n').some((line) => !line.endsWith(`\t${group.path}`))) throw new RejectedGroup('Diff escaped selected file');
      const after = scan(executionWorktree);
      if (group.findings.some((f) => after.unused_exports.some((a) => a.path === f.path && a.export_name === f.export_name))) throw new RejectedGroup('Fallow finding remains');
      for (const target of ['test:unit', 'test:types']) if (projectTarget(executionWorktree, group.project, target)) command(executionWorktree, 'pnpm', ['nx', 'run', `${group.project}:${target}`], 1_800_000);
      command(executionWorktree, 'pnpm', ['check:file-placement'], 120_000);
    }
    publishing = true;
    const pr = publish(executionWorktree, group, branch, base);
    console.log(`Draft PR #${pr}: ${group.path}`);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const status = error instanceof RejectedGroup ? 'rejected' : error instanceof FailedCi ? 'ci-failed' : error instanceof NeedsOperator ? 'needs-operator' : 'failed';
    record(group.id, { base, status, reason, branch, pr: previous(group.id)?.pr, at: new Date().toISOString() });
    console.error(`${group.path}: ${reason}`);
    if (publishing) throw error;
    return false;
  }
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry-run');
  mkdirSync(stateRoot, { recursive: true });
  const lock = join(stateRoot, 'lock');
  try { mkdirSync(lock); } catch {
    const pidPath = join(lock, 'pid');
    if (!existsSync(pidPath)) throw new Error(`Another run holds ${lock}`);
    const pid = Number(readFileSync(pidPath, 'utf8'));
    try { process.kill(pid, 0); throw new Error(`Another run holds ${lock} (PID ${pid})`); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      rmSync(lock, { recursive: true, force: true });
      mkdirSync(lock);
    }
  }
  writeFileSync(join(lock, 'pid'), String(process.pid));
  const onTerm = () => { rmSync(lock, { recursive: true, force: true }); process.exit(143); };
  process.once('SIGTERM', onTerm);
  const latestGroupStart = Date.now() + (maxHours - groupBudgetHours) * 3_600_000;
  try {
    command(root, 'git', ['fetch', 'origin', 'main'], 120_000);
    const base = command(root, 'git', ['rev-parse', 'origin/main']);
    const scanDir = join(stateRoot, 'scan');
    if (existsSync(scanDir)) command(root, 'git', ['worktree', 'remove', '--force', scanDir]);
    command(root, 'git', ['worktree', 'add', '--detach', scanDir, base]);
    let groups: Group[];
    try {
      command(scanDir, 'pnpm', ['install', '--frozen-lockfile'], 600_000);
      groups = selectGroups(scan(scanDir));
    } finally { command(root, 'git', ['worktree', 'remove', '--force', scanDir]); }
    if (!dry) command(root, 'gh', ['auth', 'status']);
    const openFiles = dry ? new Map<string, Set<string>>() : openPrFiles();
    const blocked = new Set(groups.filter((g) => {
      const heads = openFiles.get(g.path);
      return heads && (heads.size > 1 || !heads.has(`automation/fallow-${g.id}-${base.slice(0, 8)}`));
    }).map((g) => g.path));
    const completed = new Set(groups.filter((g) => completedForBase(previous(g.id), base)).map((g) => g.id));
    const eligible = eligibleGroups(groups, blocked, completed);
    if (dry) { console.log(JSON.stringify({ base, groups: eligible.map((g) => ({ id: g.id, project: g.project, path: g.path, names: g.findings.map((f) => f.export_name) })) }, null, 2)); return; }
    if (eligible.length > 0) await waitForModelReady();
    let published = 0;
    for (const group of eligible) {
      if (published >= maxPrs || Date.now() >= latestGroupStart) break;
      if (await runGroup(group, base)) published += 1;
    }
    console.log(`Run complete: ${published} Draft PR(s)`);
  } finally { process.off('SIGTERM', onTerm); rmSync(lock, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
