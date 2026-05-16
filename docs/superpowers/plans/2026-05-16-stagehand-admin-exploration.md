# Stagehand Admin Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine lokal ausführbare, nicht CI-blockende Stagehand-Explorationsschicht für echte Admin-IAM-Flows mit erstem Pilot für Benutzer-, Rollen- und Rechteinspektion bereitstellen.

**Architecture:** Die Implementierung ergänzt `apps/sva-studio-react` um eine separate `stagehand/`-Struktur mit klarer Trennung zwischen Runtime, Missions-Registry und Reporting. Bestehende deterministische Gates bleiben unverändert; die neue Schicht verwendet einen eigenen Env-Vertrag, ein eigenes Nx-Target und erzeugt eigenständige Artefakte.

**Tech Stack:** Nx, TypeScript Strict Mode, Vitest über `@nx/vitest:test`, `nx:run-commands`, `@browserbasehq/stagehand`, vorhandene lokale IAM-Acceptance-Kontrakte und Markdown/JSON-Artefakte.

---

## Dateistruktur

- Create: `apps/sva-studio-react/stagehand/runtime/config.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/config.test.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/types.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/readiness.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/auth.ts`
- Create: `apps/sva-studio-react/stagehand/missions/definitions.ts`
- Create: `apps/sva-studio-react/stagehand/missions/registry.ts`
- Create: `apps/sva-studio-react/stagehand/missions/registry.test.ts`
- Create: `apps/sva-studio-react/stagehand/missions/admin-users-overview.ts`
- Create: `apps/sva-studio-react/stagehand/missions/admin-user-permissions-inspection.ts`
- Create: `apps/sva-studio-react/stagehand/missions/admin-role-management-navigation.ts`
- Create: `apps/sva-studio-react/stagehand/reporting/report.ts`
- Create: `apps/sva-studio-react/stagehand/reporting/report.test.ts`
- Create: `apps/sva-studio-react/stagehand/index.ts`
- Create: `apps/sva-studio-react/stagehand/cli.ts`
- Modify: `apps/sva-studio-react/package.json`
- Modify: `apps/sva-studio-react/project.json`
- Modify: `docs/development/app-e2e-integration-testing.md`
- Create: `docs/development/stagehand-admin-exploration.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`

### Task 1: Runtime-Kontrakt und Nx-Integration

**Files:**
- Create: `apps/sva-studio-react/stagehand/runtime/types.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/config.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/config.test.ts`
- Modify: `apps/sva-studio-react/package.json`
- Modify: `apps/sva-studio-react/project.json`

- [ ] **Step 1: Write the failing config tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseStagehandAdminConfig } from './config.js';

describe('parseStagehandAdminConfig', () => {
  it('reads required env and falls back to IAM acceptance base url', () => {
    const config = parseStagehandAdminConfig({
      IAM_ACCEPTANCE_BASE_URL: 'http://127.0.0.1:3000',
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'acceptance-admin',
      IAM_ACCEPTANCE_ADMIN_PASSWORD: 'secret',
      OPENAI_API_KEY: 'sk-test',
    });

    expect(config.baseUrl).toBe('http://127.0.0.1:3000');
    expect(config.admin.username).toBe('acceptance-admin');
    expect(config.mission).toBe('admin-users-overview');
  });

  it('fails with a deterministic message when required env is missing', () => {
    expect(() => parseStagehandAdminConfig({})).toThrowError(
      /STAGEHAND_ADMIN_BASE_URL\|IAM_ACCEPTANCE_BASE_URL/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/runtime/config.test.ts`
Expected: FAIL because `config.ts` and `parseStagehandAdminConfig` do not exist yet.

- [ ] **Step 3: Write minimal config implementation**

```ts
export type StagehandMissionName =
  | 'admin-users-overview'
  | 'admin-user-permissions-inspection'
  | 'admin-role-management-navigation';

export type StagehandAdminConfig = {
  readonly admin: {
    readonly password: string;
    readonly username: string;
  };
  readonly baseUrl: string;
  readonly mission: StagehandMissionName;
  readonly openAiApiKey: string;
};

const readRequired = (env: NodeJS.ProcessEnv, key: string): string | null => {
  const value = env[key]?.trim();
  return value ? value : null;
};

export const parseStagehandAdminConfig = (env: NodeJS.ProcessEnv): StagehandAdminConfig => {
  const baseUrl = readRequired(env, 'STAGEHAND_ADMIN_BASE_URL') ?? readRequired(env, 'IAM_ACCEPTANCE_BASE_URL');
  const username = readRequired(env, 'STAGEHAND_ADMIN_USERNAME') ?? readRequired(env, 'IAM_ACCEPTANCE_ADMIN_USERNAME');
  const password = readRequired(env, 'STAGEHAND_ADMIN_PASSWORD') ?? readRequired(env, 'IAM_ACCEPTANCE_ADMIN_PASSWORD');
  const openAiApiKey = readRequired(env, 'OPENAI_API_KEY');

  const missing = [
    !baseUrl ? 'STAGEHAND_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL' : null,
    !username ? 'STAGEHAND_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME' : null,
    !password ? 'STAGEHAND_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD' : null,
    !openAiApiKey ? 'OPENAI_API_KEY' : null,
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    throw new Error(`Missing required stagehand env: ${missing.join(', ')}`);
  }

  return {
    admin: { username, password },
    baseUrl: baseUrl.replace(/\/+$/u, ''),
    mission: 'admin-users-overview',
    openAiApiKey,
  };
};
```

- [ ] **Step 4: Add dependency and target wiring**

```json
// apps/sva-studio-react/package.json
{
  "devDependencies": {
    "@browserbasehq/stagehand": "^3.4.0"
  }
}
```

```json
// apps/sva-studio-react/project.json
{
  "targets": {
    "test:explore:admin": {
      "executor": "nx:run-commands",
      "cache": false,
      "outputs": [
        "{workspaceRoot}/docs/reports/stagehand-admin-exploration"
      ],
      "options": {
        "cwd": "apps/sva-studio-react",
        "command": "bash ../../scripts/ci/run-workspace-node.sh --import tsx ./stagehand/cli.ts"
      }
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/runtime/config.test.ts`
Expected: PASS with `2 passed`.

### Task 2: Missions-Registry und Reporting

**Files:**
- Create: `apps/sva-studio-react/stagehand/missions/definitions.ts`
- Create: `apps/sva-studio-react/stagehand/missions/registry.ts`
- Create: `apps/sva-studio-react/stagehand/missions/registry.test.ts`
- Create: `apps/sva-studio-react/stagehand/reporting/report.ts`
- Create: `apps/sva-studio-react/stagehand/reporting/report.test.ts`

- [ ] **Step 1: Write the failing registry and report tests**

```ts
import { describe, expect, it } from 'vitest';
import { getStagehandMission, listStagehandMissions } from './registry.js';

describe('stagehand mission registry', () => {
  it('lists all pilot missions in a stable order', () => {
    expect(listStagehandMissions().map((mission) => mission.name)).toEqual([
      'admin-users-overview',
      'admin-user-permissions-inspection',
      'admin-role-management-navigation',
    ]);
  });

  it('returns the requested mission definition', () => {
    expect(getStagehandMission('admin-users-overview').startPath).toBe('/admin/users');
  });
});
```

```ts
import { describe, expect, it } from 'vitest';
import { renderStagehandMarkdownReport } from './report.js';

describe('renderStagehandMarkdownReport', () => {
  it('renders mission name, status and findings', () => {
    const markdown = renderStagehandMarkdownReport({
      generatedAt: '2026-05-16T10:00:00.000Z',
      mission: 'admin-users-overview',
      status: 'passed',
      findings: ['Benutzerliste sichtbar'],
      screenshots: [],
      transcriptPath: 'docs/reports/stagehand-admin-exploration/run.json',
    });

    expect(markdown).toContain('admin-users-overview');
    expect(markdown).toContain('passed');
    expect(markdown).toContain('Benutzerliste sichtbar');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/missions/registry.test.ts --testFiles=apps/sva-studio-react/stagehand/reporting/report.test.ts`
Expected: FAIL because registry and reporting modules do not exist yet.

- [ ] **Step 3: Write minimal registry and reporting implementation**

```ts
export type StagehandMissionDefinition = {
  readonly goal: string;
  readonly name: StagehandMissionName;
  readonly startPath: string;
};

const missions: readonly StagehandMissionDefinition[] = [
  {
    name: 'admin-users-overview',
    startPath: '/admin/users',
    goal: 'Pruefe Benutzerliste und Uebersichtsstatus.',
  },
  {
    name: 'admin-user-permissions-inspection',
    startPath: '/admin/users',
    goal: 'Pruefe Rollen, Rechte und sichtbare Herkunftsinformationen.',
  },
  {
    name: 'admin-role-management-navigation',
    startPath: '/admin/roles',
    goal: 'Pruefe Rollenliste, Rollenkontexte und zentrale Aktionen.',
  },
] as const;

export const listStagehandMissions = (): readonly StagehandMissionDefinition[] => missions;

export const getStagehandMission = (name: StagehandMissionName): StagehandMissionDefinition => {
  const mission = missions.find((entry) => entry.name === name);
  if (!mission) {
    throw new Error(`Unknown mission: ${name}`);
  }
  return mission;
};
```

```ts
export type StagehandMissionReport = {
  readonly findings: readonly string[];
  readonly generatedAt: string;
  readonly mission: StagehandMissionName;
  readonly screenshots: readonly string[];
  readonly status: 'failed' | 'passed';
  readonly transcriptPath: string;
};

export const renderStagehandMarkdownReport = (report: StagehandMissionReport): string => [
  '# Verifikationsbericht: Stagehand Admin Exploration',
  '',
  `- Zeitpunkt: ${report.generatedAt}`,
  `- Mission: ${report.mission}`,
  `- Status: ${report.status}`,
  `- Transcript: ${report.transcriptPath}`,
  '',
  '## Findings',
  '',
  ...report.findings.map((finding) => `- ${finding}`),
].join('\n');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/missions/registry.test.ts --testFiles=apps/sva-studio-react/stagehand/reporting/report.test.ts`
Expected: PASS with all tests green.

### Task 3: Erste Pilot-Mission und lokaler Runner

**Files:**
- Create: `apps/sva-studio-react/stagehand/runtime/readiness.ts`
- Create: `apps/sva-studio-react/stagehand/runtime/auth.ts`
- Create: `apps/sva-studio-react/stagehand/missions/admin-users-overview.ts`
- Create: `apps/sva-studio-react/stagehand/cli.ts`
- Create: `apps/sva-studio-react/stagehand/index.ts`
- Create: `docs/development/stagehand-admin-exploration.md`
- Modify: `docs/development/app-e2e-integration-testing.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`

- [ ] **Step 1: Write the failing mission-runner test**

```ts
import { describe, expect, it } from 'vitest';
import { createMissionPrompt } from './admin-users-overview.js';

describe('admin-users-overview mission', () => {
  it('pins the admin users route and success criteria', () => {
    const prompt = createMissionPrompt({
      startUrl: 'http://127.0.0.1:3000/admin/users',
    });

    expect(prompt).toContain('/admin/users');
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Forbidden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/missions/admin-users-overview.test.ts`
Expected: FAIL because mission module does not exist yet.

- [ ] **Step 3: Implement the minimal mission and CLI**

```ts
export const createMissionPrompt = (input: { startUrl: string }): string => `
Oeffne ${input.startUrl}.
Melde dich mit den bereitgestellten Admin-Credentials an, falls ein Login-Formular erscheint.
Pruefe, ob die Benutzerverwaltung sichtbar ist.
Scheitere, wenn du auf Login oder Forbidden landest.
Dokumentiere, ob eine Benutzerliste oder ein fachlich gueltiger Leerzustand sichtbar ist.
`;
```

```ts
import { Stagehand } from '@browserbasehq/stagehand';

const config = parseStagehandAdminConfig(process.env);
const mission = getStagehandMission(config.mission);
await assertStagehandReadiness(config.baseUrl);
const stagehand = new Stagehand({
  env: 'LOCAL',
  modelName: 'gpt-4.1-mini',
  modelClientOptions: {
    apiKey: config.openAiApiKey,
  },
});
await stagehand.init();
const page = stagehand.page;
await page.goto(`${config.baseUrl}${mission.startPath}`);
await stagehand.act(createMissionPrompt({ startUrl: `${config.baseUrl}${mission.startPath}` }));
```

- [ ] **Step 4: Document local usage**

```md
# Stagehand Admin Exploration

## Voraussetzungen

- laufende lokale Studio-App
- echter lokaler IAM-/Backend-Stack
- `OPENAI_API_KEY`
- `IAM_ACCEPTANCE_ADMIN_USERNAME` und `IAM_ACCEPTANCE_ADMIN_PASSWORD`

## Ausfuehrung

```bash
pnpm nx run sva-studio-react:test:explore:admin
```
```

- [ ] **Step 5: Run focused tests and type checks**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/stagehand/runtime/config.test.ts --testFiles=apps/sva-studio-react/stagehand/missions/registry.test.ts --testFiles=apps/sva-studio-react/stagehand/reporting/report.test.ts`
Expected: PASS.

Run: `pnpm nx run sva-studio-react:test:types`
Expected: PASS for the app target and no Stagehand type regressions.

- [ ] **Step 6: Run the local Stagehand target when secrets are available**

Run: `pnpm nx run sva-studio-react:test:explore:admin`
Expected: Mission starts against the local stack, writes a report under `docs/reports/stagehand-admin-exploration/`, and exits with a clear pass/fail status.
