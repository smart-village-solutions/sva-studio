# Categories Plugin Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `plugin-categories` workspace plugin that owns the `/categories` Studio page, while keeping the technical Mainserver categories endpoint in the existing host integration.

**Architecture:** Move categories UI ownership into a dedicated workspace plugin and keep `packages/sva-mainserver` as the technical owner of the host-side categories endpoint. The app shell only binds `/categories` to the plugin page; the plugin loads `/api/v1/mainserver/categories`, flattens the hierarchical payload into table rows, and renders the read-only Studio table with disabled future actions.

**Tech Stack:** React, TypeScript, Nx workspace libraries, Vitest, `@sva/plugin-sdk`, `@sva/studio-ui-react`, existing Mainserver host endpoint

---

## File Structure

### New files

- `packages/plugin-categories/package.json`
  - Workspace package definition using `workspace:*` dependencies.
- `packages/plugin-categories/project.json`
  - Nx targets for build, lint, unit tests, and type tests.
- `packages/plugin-categories/plugin.manifest.json`
  - Plugin metadata for the host.
- `packages/plugin-categories/tsconfig.json`
  - Plugin TypeScript base config.
- `packages/plugin-categories/tsconfig.lib.json`
  - Plugin library build config.
- `packages/plugin-categories/vitest.config.ts`
  - Plugin test configuration.
- `packages/plugin-categories/src/index.ts`
  - Public plugin exports.
- `packages/plugin-categories/src/plugin.tsx`
  - Plugin definition and translations binding.
- `packages/plugin-categories/src/plugin.translations.ts`
  - Plugin-local German and English labels/messages.
- `packages/plugin-categories/src/categories.types.ts`
  - Plugin types for raw categories and flat table rows.
- `packages/plugin-categories/src/categories.api.ts`
  - Host-endpoint client for `/api/v1/mainserver/categories`.
- `packages/plugin-categories/src/categories.pages.tsx`
  - `CategoriesPage` route component.
- `packages/plugin-categories/tests/plugin.test.ts`
  - Plugin definition smoke tests.
- `packages/plugin-categories/tests/categories.api.test.ts`
  - Endpoint client and flattening tests.
- `packages/plugin-categories/tests/categories.pages.test.tsx`
  - UI tests for loading, rows, empty state, error state, and disabled actions.

### Modified files

- `packages/sva-mainserver/src/server/news-route.ts`
  - Remove categories endpoint handling from the news route.
- `packages/sva-mainserver/src/server/news-route.test.ts`
  - Stop testing categories through the news route contract.
- `packages/sva-mainserver/src/server/categories-route.ts`
  - New host-side categories route boundary.
- `packages/sva-mainserver/src/server/categories-route.test.ts`
  - Dedicated categories route tests.
- `packages/sva-mainserver/src/index.server.ts`
  - Export the new categories route dispatcher.
- `apps/sva-studio-react/src/lib/mainserver-categories-api.server.ts`
  - Thin app adapter delegating to the new host-side categories dispatcher.
- `apps/sva-studio-react/src/lib/mainserver-categories-api.server.test.ts`
  - Adapter delegation test.
- `apps/sva-studio-react/package.json`
  - Add the new workspace plugin dependency.
- `apps/sva-studio-react/tsconfig.json`
  - Register the workspace path alias for `@sva/plugin-categories`.
- `apps/sva-studio-react/project.json`
  - Include the new plugin sources in relevant cached app inputs.
- `apps/sva-studio-react/plugin-catalog.json`
  - Register the workspace plugin in the Studio plugin catalog.
- `apps/sva-studio-react/src/server.ts`
  - Wire the new categories route adapter into the Studio server entry.
- `apps/sva-studio-react/src/server.test.ts`
  - Assert categories requests are dispatched through the new adapter.
- `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
  - Replace the placeholder binding with the plugin page.
- `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
  - Stop expecting `/categories` to be a placeholder and assert the plugin route.
- `packages/data/migrations/0054_iam_categories_permissions.sql`
  - Additive Backfill-Migration für bestehende lokale IAM-Datenbanken, damit `categories.*` ohne Datenverlust ergänzt wird.

### Existing files to consult while implementing

- `packages/plugin-news/src/plugin.tsx`
  - Reference plugin definition and exports structure.
- `packages/plugin-news/project.json`
  - Reference Nx target setup for a plugin library.
- `packages/plugin-news/tests/news.pages.test.tsx`
  - Reference page test layout and translation strategy.
- `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.tsx`
  - Reference `StudioDataTable` wiring.
- `apps/sva-studio-react/src/server.ts`
  - Reference how host adapters are dispatched before the app handler.
- `packages/sva-mainserver/src/generated/categories.ts`
  - Confirms the fields available from the Mainserver categories query.

---

### Task 1: Create the `plugin-categories` workspace package scaffold

**Files:**
- Create: `packages/plugin-categories/package.json`
- Create: `packages/plugin-categories/project.json`
- Create: `packages/plugin-categories/plugin.manifest.json`
- Create: `packages/plugin-categories/tsconfig.json`
- Create: `packages/plugin-categories/tsconfig.lib.json`
- Create: `packages/plugin-categories/vitest.config.ts`
- Create: `packages/plugin-categories/src/index.ts`
- Create: `packages/plugin-categories/src/plugin.tsx`
- Create: `packages/plugin-categories/src/plugin.translations.ts`
- Test: `packages/plugin-categories/tests/plugin.test.ts`

- [ ] **Step 1: Write the failing plugin smoke test**

```ts
import { describe, expect, it } from 'vitest';

import { pluginCategories } from '../src/index.js';

describe('plugin-categories', () => {
  it('exposes a stable plugin definition', () => {
    expect(pluginCategories.pluginId).toBe('categories');
    expect(pluginCategories.displayName).toBe('Kategorien');
    expect(pluginCategories.translations.de).toBeTruthy();
    expect(pluginCategories.translations.en).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the new plugin test target and verify it fails**

Run:

```bash
pnpm nx run plugin-categories:test:unit
```

Expected:
- FAIL because `plugin-categories` does not exist yet

- [ ] **Step 3: Scaffold the plugin package files using the existing plugin shape**

```json
{
  "name": "@sva/plugin-categories",
  "version": "0.0.1",
  "type": "module",
  "files": ["dist", "plugin.manifest.json"],
  "main": "src/index.ts",
  "types": "src/index.ts",
  "module": "src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./plugin.manifest.json": {
      "default": "./plugin.manifest.json"
    }
  },
  "dependencies": {
    "@sva/plugin-sdk": "workspace:*",
    "@sva/studio-ui-react": "workspace:*"
  },
  "peerDependencies": {
    "@tanstack/react-router": "^1.170.8",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitest/coverage-v8": "^4.1.5",
    "jsdom": "^29.1.0",
    "tooling-testing": "workspace:*",
    "vitest": "^4.1.5"
  }
}
```

```json
{
  "name": "plugin-categories",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/plugin-categories/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"],
      "options": {
        "command": "tsc -p packages/plugin-categories/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "lintFilePatterns": [
          "packages/plugin-categories/src/**/*.{ts,tsx,js,jsx}",
          "packages/plugin-categories/tests/**/*.{ts,tsx,js,jsx}"
        ]
      }
    },
    "test:unit": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "packages/plugin-categories",
        "command": "pnpm exec tsx ../../scripts/ci/run-vitest-target.ts tests --reporter=verbose --config vitest.config.ts --passWithNoTests"
      }
    },
    "test:types": {
      "executor": "nx:run-commands",
      "dependsOn": ["^build"],
      "options": {
        "command": "tsc -p packages/plugin-categories/tsconfig.lib.json --noEmit"
      }
    }
  },
  "tags": ["scope:plugin", "type:lib"]
}
```

```json
{
  "pluginId": "categories",
  "version": "0.0.1",
  "sdkVersion": "0.0.1",
  "hostCompatibility": {
    "studioVersionRange": "^0.0.1",
    "requiredCapabilities": ["routing", "navigation", "iam"]
  },
  "entryPoints": {
    "browser": "./dist/index.js"
  }
}
```

```ts
import type { PluginDefinition } from '@sva/plugin-sdk';

import { pluginCategoriesTranslations } from './plugin.translations.js';

export const pluginCategories: PluginDefinition = {
  pluginId: 'categories',
  displayName: 'Kategorien',
  translations: pluginCategoriesTranslations,
};
```

```ts
export const pluginCategoriesTranslations = {
  de: {
    categories: {
      navigation: {
        title: 'Kategorien',
      },
    },
  },
  en: {
    categories: {
      navigation: {
        title: 'Categories',
      },
    },
  },
} as const;
```

```ts
export { pluginCategories } from './plugin.js';
```

- [ ] **Step 4: Run the plugin smoke test and verify it passes**

Run:

```bash
pnpm nx run plugin-categories:test:unit --testFiles=tests/plugin.test.ts
```

Expected:
- PASS for the plugin definition test

- [ ] **Step 5: Commit the plugin scaffold**

```bash
git add packages/plugin-categories/package.json packages/plugin-categories/project.json packages/plugin-categories/plugin.manifest.json packages/plugin-categories/tsconfig.json packages/plugin-categories/tsconfig.lib.json packages/plugin-categories/vitest.config.ts packages/plugin-categories/src/index.ts packages/plugin-categories/src/plugin.tsx packages/plugin-categories/src/plugin.translations.ts packages/plugin-categories/tests/plugin.test.ts
git commit -m "feat: scaffold categories workspace plugin"
```

---

### Task 2: Move the host-side categories endpoint out of the news route

**Files:**
- Create: `packages/sva-mainserver/src/server/categories-route.ts`
- Create: `packages/sva-mainserver/src/server/categories-route.test.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.test.ts`
- Modify: `packages/sva-mainserver/src/index.server.ts`

- [ ] **Step 1: Write the failing dedicated categories route test**

```ts
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorizeContentPrimitiveForUser: vi.fn(),
  listSvaMainserverCategories: vi.fn(),
  withAuthenticatedUser: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('./service.js', () => ({
  listSvaMainserverCategories: state.listSvaMainserverCategories,
}));

import { dispatchSvaMainserverCategoriesRequest } from './categories-route.js';

describe('categories-route', () => {
  it('lists categories through a dedicated route boundary', async () => {
    const ctx = {
      user: {
        id: 'subject-1',
        instanceId: 'de-musterhausen',
        activeOrganizationId: '11111111-1111-1111-8111-111111111111',
      },
    };

    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
    state.authorizeContentPrimitiveForUser.mockResolvedValue({
      ok: true,
      actor: { instanceId: 'de-musterhausen', keycloakSubject: 'subject-1' },
      permissions: [],
    });
    state.listSvaMainserverCategories.mockResolvedValue([{ id: 'cat-1', name: 'Allgemein', children: [] }]);

    const response = await dispatchSvaMainserverCategoriesRequest(
      new Request('https://studio.test/api/v1/mainserver/categories'),
    );

    await expect(response?.json()).resolves.toEqual({
      data: [{ id: 'cat-1', name: 'Allgemein', children: [] }],
    });
  });
});
```

- [ ] **Step 2: Run the focused server-side test and verify it fails**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/categories-route.test.ts
```

Expected:
- FAIL because the dedicated categories route file does not exist yet

- [ ] **Step 3: Implement the dedicated categories route and remove categories handling from `news-route.ts`**

```ts
import {
  authorizeContentPrimitiveForUser,
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import { json } from './content-route-helpers.js';
import { listSvaMainserverCategories } from './service.js';

const CATEGORY_COLLECTION_PATH = '/api/v1/mainserver/categories';
const logger = createSdkLogger({ component: 'sva-mainserver-categories-route', level: 'info' });

const matchCategoriesRoute = (request: Request) =>
  new URL(request.url).pathname === CATEGORY_COLLECTION_PATH;

const authorizeOrResponse = async (ctx: AuthenticatedRequestContext) => {
  const authorization = await authorizeContentPrimitiveForUser({
    ctx,
    action: 'news.read',
  });

  if (!authorization.ok) {
    return new Response(JSON.stringify({ error: authorization.error, message: authorization.message }), {
      status: authorization.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    instanceId: authorization.actor.instanceId,
    keycloakSubject: authorization.actor.keycloakSubject,
    activeOrganizationId: ctx.user.activeOrganizationId,
  };
};

export const dispatchSvaMainserverCategoriesRequest = async (request: Request): Promise<Response | null> => {
  if (matchCategoriesRoute(request) === false || request.method !== 'GET') {
    return null;
  }

  return withAuthenticatedUser(request, async (ctx) => {
    const actor = await authorizeOrResponse(ctx);
    if (actor instanceof Response) {
      return actor;
    }

    const data = await listSvaMainserverCategories(actor);
    logger.info('Mainserver categories listed', { count: data.length });
    return json({ data });
  });
};
```

Then delete the categories-specific match/handler blocks from `packages/sva-mainserver/src/server/news-route.ts` and remove the corresponding assertions from `packages/sva-mainserver/src/server/news-route.test.ts`.

Finally export the new dispatcher from `packages/sva-mainserver/src/index.server.ts`:

```ts
export { dispatchSvaMainserverCategoriesRequest } from './server/categories-route.js';
```

- [ ] **Step 4: Run the focused server route tests and verify they pass**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/categories-route.test.ts --testFiles=src/server/news-route.test.ts
```

Expected:
- PASS with categories handled by the dedicated route and news route tests still green

- [ ] **Step 5: Commit the host-side route split**

```bash
git add packages/sva-mainserver/src/server/categories-route.ts packages/sva-mainserver/src/server/categories-route.test.ts packages/sva-mainserver/src/server/news-route.ts packages/sva-mainserver/src/server/news-route.test.ts packages/sva-mainserver/src/index.server.ts
git commit -m "refactor: split categories route from news boundary"
```

---

### Task 3: Add the Studio host adapter and dispatch wiring for categories

**Files:**
- Create: `apps/sva-studio-react/src/lib/mainserver-categories-api.server.ts`
- Create: `apps/sva-studio-react/src/lib/mainserver-categories-api.server.test.ts`
- Modify: `apps/sva-studio-react/src/server.ts`
- Modify: `apps/sva-studio-react/src/server.test.ts`

- [ ] **Step 1: Write the failing adapter delegation test**

```ts
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dispatchSvaMainserverCategoriesRequest: vi.fn(),
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverCategoriesRequest: state.dispatchSvaMainserverCategoriesRequest,
}));

import { dispatchMainserverCategoriesRequest } from './mainserver-categories-api.server';

describe('mainserver categories app adapter', () => {
  it('delegates to the package categories route contract', async () => {
    const response = new Response('categories', { status: 200 });
    const request = new Request('https://studio.test/api/v1/mainserver/categories');
    state.dispatchSvaMainserverCategoriesRequest.mockResolvedValue(response);

    await expect(dispatchMainserverCategoriesRequest(request)).resolves.toBe(response);
    expect(state.dispatchSvaMainserverCategoriesRequest).toHaveBeenCalledWith(request);
  });
});
```

- [ ] **Step 2: Run the focused adapter test and verify it fails**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/mainserver-categories-api.server.test.ts
```

Expected:
- FAIL because the adapter file does not exist yet

- [ ] **Step 3: Implement the adapter and wire it into the Studio server entry**

```ts
import { dispatchSvaMainserverCategoriesRequest } from '@sva/sva-mainserver/server';

export const dispatchMainserverCategoriesRequest = dispatchSvaMainserverCategoriesRequest;
```

In `apps/sva-studio-react/src/server.ts`, add the categories adapter promise alongside the existing news/events/poi adapter promises and dispatch it before the app handler:

```ts
let dispatchMainserverCategoriesRequestPromise:
  | Promise<typeof import('./lib/mainserver-categories-api.server')['dispatchMainserverCategoriesRequest']>
  | null = null;

const getDispatchMainserverCategoriesRequest = async () => {
  dispatchMainserverCategoriesRequestPromise ??= import('./lib/mainserver-categories-api.server').then(
    (mod) => mod.dispatchMainserverCategoriesRequest,
  );
  return dispatchMainserverCategoriesRequestPromise;
};
```

```ts
const dispatchMainserverCategoriesRequest = await getDispatchMainserverCategoriesRequest();
const mainserverCategoriesResponse = await dispatchMainserverCategoriesRequest(request);

if (mainserverCategoriesResponse) {
  await logServerEntryDebug('Server entry mainserver categories route dispatched', {
    status: mainserverCategoriesResponse.status,
  });
  return mainserverCategoriesResponse;
}
```

Update `apps/sva-studio-react/src/server.test.ts` to mock and assert the categories dispatcher just like the existing news/events/poi route adapters.

- [ ] **Step 4: Run the focused server-entry tests and verify they pass**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/mainserver-categories-api.server.test.ts --testFiles=src/server.test.ts
```

Expected:
- PASS with categories requests dispatched through the new adapter

- [ ] **Step 5: Commit the Studio host wiring**

```bash
git add apps/sva-studio-react/src/lib/mainserver-categories-api.server.ts apps/sva-studio-react/src/lib/mainserver-categories-api.server.test.ts apps/sva-studio-react/src/server.ts apps/sva-studio-react/src/server.test.ts
git commit -m "feat: wire categories host adapter into studio server"
```

---

### Task 4: Implement the categories plugin client, flattening logic, and page

**Files:**
- Create: `packages/plugin-categories/src/categories.types.ts`
- Create: `packages/plugin-categories/src/categories.api.ts`
- Create: `packages/plugin-categories/src/categories.pages.tsx`
- Modify: `packages/plugin-categories/src/index.ts`
- Modify: `packages/plugin-categories/src/plugin.translations.ts`
- Test: `packages/plugin-categories/tests/categories.api.test.ts`
- Test: `packages/plugin-categories/tests/categories.pages.test.tsx`

- [ ] **Step 1: Write the failing plugin API and page tests**

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  flattenCategoriesForTable,
  listCategories,
  type CategoriesApiError,
  type CategoryTreeItem,
} from '../src/categories.api.js';

const sampleTree: readonly CategoryTreeItem[] = [
  {
    id: 'cat-service',
    name: 'Service',
    position: 1,
    tagList: 'amt, buerger',
    updatedAt: '2026-06-09T10:15:00.000Z',
    children: [
      {
        id: 'cat-office',
        name: 'Buergerbuero',
        position: 2,
        tagList: 'vor-ort',
        updatedAt: '2026-06-09T10:20:00.000Z',
        children: [],
      },
    ],
  },
];

describe('plugin-categories api', () => {
  it('flattens hierarchical categories into table rows', () => {
    expect(flattenCategoriesForTable(sampleTree)).toEqual([
      expect.objectContaining({ name: 'Service', hierarchyLabel: '—' }),
      expect.objectContaining({ name: 'Buergerbuero', hierarchyLabel: 'Service / Buergerbuero' }),
    ]);
  });

  it('loads categories from the host endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: sampleTree }),
    } as Response);

    await expect(listCategories(fetchMock as typeof fetch)).resolves.toEqual(sampleTree);
  });

  it('rejects malformed payloads with a typed error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { invalid: true } }),
    } as Response);

    await expect(listCategories(fetchMock as typeof fetch)).rejects.toMatchObject({
      code: 'invalid_categories_payload',
    } satisfies Partial<CategoriesApiError>);
  });
});
```

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listCategories: vi.fn(),
}));

vi.mock('../src/categories.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/categories.api.js')>('../src/categories.api.js');
  return {
    ...actual,
    listCategories: state.listCategories,
  };
});

import { CategoriesPage } from '../src/categories.pages.js';

describe('plugin-categories page', () => {
  beforeEach(() => {
    state.listCategories.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the flat categories table with disabled actions', async () => {
    state.listCategories.mockResolvedValue([
      {
        id: 'cat-service',
        name: 'Service',
        position: 1,
        tagList: 'amt, buerger',
        updatedAt: '2026-06-09T10:15:00.000Z',
        children: [],
      },
    ]);

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kategorien' })).toBeTruthy();
      expect(screen.getByRole('table', { name: 'Kategorien-Tabelle' })).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Neue Unterkategorie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDisabled();
  });

  it('renders the empty state and the blocking error state', async () => {
    state.listCategories.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);

    render(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText('Kategorien konnten nicht geladen werden.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));

    await waitFor(() => {
      expect(screen.getByText('Aktuell wurden keine Kategorien aus dem Mainserver geladen.')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run the focused plugin tests and verify they fail**

Run:

```bash
pnpm nx run plugin-categories:test:unit --testFiles=tests/categories.api.test.ts --testFiles=tests/categories.pages.test.tsx
```

Expected:
- FAIL because the plugin client and page files do not exist yet

- [ ] **Step 3: Implement plugin types, client, flattening, translations, and page**

```ts
export type CategoryTreeItem = Readonly<{
  id?: string;
  name: string;
  position?: number;
  tagList?: string;
  updatedAt?: string;
  children: readonly CategoryTreeItem[];
}>;

export type CategoryTableRow = Readonly<{
  id: string;
  actionTargetId: string;
  name: string;
  hierarchyLabel: string;
  position?: number;
  tagsDisplay: string;
  updatedAt?: string;
}>;
```

```ts
export class CategoriesApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'CategoriesApiError';
  }
}

export const flattenCategoriesForTable = (
  categories: readonly CategoryTreeItem[],
): readonly CategoryTableRow[] => {
  const rows: CategoryTableRow[] = [];

  const visit = (category: CategoryTreeItem, ancestors: readonly string[]) => {
    const path = [...ancestors, category.name];
    rows.push({
      id: category.id ?? path.join('>'),
      actionTargetId: category.id ?? '',
      name: category.name,
      hierarchyLabel: ancestors.length === 0 ? '—' : path.join(' / '),
      ...(category.position !== undefined ? { position: category.position } : {}),
      tagsDisplay: category.tagList?.trim() || '—',
      ...(category.updatedAt ? { updatedAt: category.updatedAt } : {}),
    });

    for (const child of category.children) {
      visit(child, path);
    }
  };

  for (const category of categories) {
    visit(category, []);
  }

  return rows;
};

export const listCategories = async (fetchImpl: typeof fetch = fetch): Promise<readonly CategoryTreeItem[]> => {
  const response = await fetchImpl('/api/v1/mainserver/categories', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new CategoriesApiError(`http_${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as { data?: unknown } | null;
  if (!payload || Array.isArray(payload.data) === false) {
    throw new CategoriesApiError('invalid_categories_payload');
  }

  return payload.data as readonly CategoryTreeItem[];
};
```

```tsx
import * as React from 'react';
import { Button, StudioDataTable, type StudioColumnDef, type StudioDataTableLabels } from '@sva/studio-ui-react';

import { flattenCategoriesForTable, listCategories, type CategoryTableRow } from './categories.api.js';
import { translatePluginKey } from '@sva/plugin-sdk';

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) =>
  translatePluginKey('categories', key, variables);

const tableLabels: StudioDataTableLabels = {
  selectionColumn: pt('table.columns.selection'),
  actionsColumn: pt('table.columns.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label) => label,
  selectRow: ({ label }) => label,
  selectMobileRow: ({ label }) => label,
};

const renderDisabledActions = () => (
  <div className="flex flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" disabled title={pt('actions.unavailable')}>
      {pt('actions.edit')}
    </Button>
    <Button type="button" size="sm" variant="outline" disabled title={pt('actions.unavailable')}>
      {pt('actions.createChild')}
    </Button>
    <Button type="button" size="sm" variant="destructive" disabled title={pt('actions.unavailable')}>
      {pt('actions.delete')}
    </Button>
  </div>
);

export const CategoriesPage = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<readonly CategoryTableRow[]>([]);

  const columns = React.useMemo<readonly StudioColumnDef<CategoryTableRow>[]>(() => [
    { id: 'name', header: pt('table.headerName'), cell: (row) => row.name },
    { id: 'id', header: pt('table.headerId'), cell: (row) => row.actionTargetId || '—' },
    { id: 'hierarchy', header: pt('table.headerHierarchy'), cell: (row) => row.hierarchyLabel },
    { id: 'position', header: pt('table.headerPosition'), cell: (row) => row.position ?? '—' },
    { id: 'tags', header: pt('table.headerTags'), cell: (row) => row.tagsDisplay },
    { id: 'updatedAt', header: pt('table.headerUpdatedAt'), cell: (row) => row.updatedAt ?? '—' },
  ], []);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const categories = await listCategories();
      setRows(flattenCategoriesForTable(categories));
    } catch {
      setRows([]);
      setErrorMessage(pt('messages.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{pt('page.title')}</h1>
        <p className="text-sm text-muted-foreground">{pt('page.subtitle')}</p>
        <p className="text-xs text-muted-foreground">{pt('messages.actionsHint')}</p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">{pt('messages.loadError')}</p>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={() => void load()}>
              {pt('actions.reload')}
            </Button>
          </div>
        </div>
      ) : null}

      <StudioDataTable
        ariaLabel={pt('table.ariaLabel')}
        labels={tableLabels}
        caption={pt('table.caption')}
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        selectionMode="none"
        isLoading={isLoading}
        loadingState={pt('messages.loading')}
        emptyState={<p className="text-sm text-muted-foreground">{pt('table.emptyState')}</p>}
        toolbarStart={<p className="text-xs uppercase tracking-wide text-muted-foreground">{pt('table.countLabel', { count: rows.length })}</p>}
        rowActions={() => renderDisabledActions()}
      />
    </div>
  );
};
```

Also extend `plugin.translations.ts` with the full page/table/action/message keys and export the page/client from `src/index.ts`.

- [ ] **Step 4: Run the plugin tests and verify they pass**

Run:

```bash
pnpm nx run plugin-categories:test:unit --testFiles=tests/plugin.test.ts --testFiles=tests/categories.api.test.ts --testFiles=tests/categories.pages.test.tsx
```

Expected:
- PASS for plugin smoke tests, client tests, and page rendering tests

- [ ] **Step 5: Commit the categories plugin functionality**

```bash
git add packages/plugin-categories/src/index.ts packages/plugin-categories/src/plugin.translations.ts packages/plugin-categories/src/categories.types.ts packages/plugin-categories/src/categories.api.ts packages/plugin-categories/src/categories.pages.tsx packages/plugin-categories/tests/categories.api.test.ts packages/plugin-categories/tests/categories.pages.test.tsx
git commit -m "feat: add categories plugin overview page"
```

---

### Task 5: Register the plugin in the app shell and bind `/categories`

**Files:**
- Modify: `apps/sva-studio-react/package.json`
- Modify: `apps/sva-studio-react/tsconfig.json`
- Modify: `apps/sva-studio-react/project.json`
- Modify: `apps/sva-studio-react/plugin-catalog.json`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`

- [ ] **Step 1: Write the failing route-binding assertion**

```tsx
vi.mock('@sva/plugin-categories', () => ({
  CategoriesPage: () => <div data-testid="categories-page" />,
}));

it('renders the concrete categories binding instead of the placeholder', async () => {
  const { appRouteBindings } = await import('./app-route-bindings');

  render(<appRouteBindings.categories />);

  expect(screen.getByTestId('categories-page')).toBeTruthy();
  expect(screen.queryByTestId('placeholder-page')).toBeNull();
});
```

Remove `categories` from the placeholder matrix:

```tsx
const cases: Array<[keyof typeof appRouteBindings, string]> = [
  ['app', 'Applications|App'],
  ['help', 'Help|Help'],
  ['support', 'Support|Support'],
  ['license', 'License|License'],
];
```

- [ ] **Step 2: Run the route-binding test and verify it fails**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- FAIL because the binding still points to the placeholder page

- [ ] **Step 3: Register and bind the plugin in the app shell**

Update the Studio app package metadata so the new workspace plugin is a first-class dependency:

- add `@sva/plugin-categories` to `apps/sva-studio-react/package.json`
- add the `@sva/plugin-categories` path alias to `apps/sva-studio-react/tsconfig.json`
- extend relevant cached inputs in `apps/sva-studio-react/project.json` so plugin source changes invalidate the app checks
- add the workspace plugin entry to `apps/sva-studio-react/plugin-catalog.json`

In `apps/sva-studio-react/src/routing/app-route-bindings.tsx`, import the new page and replace the placeholder binding:

```tsx
import { CategoriesPage } from '@sva/plugin-categories';
```

```tsx
categories: CategoriesPage,
```

Delete the old `CategoriesPlaceholderRoutePage` helper once it is no longer referenced.

- [ ] **Step 4: Run the route-binding test and verify it passes**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- PASS with the plugin page bound to `/categories`

- [ ] **Step 5: Commit the app-shell binding change**

```bash
git add apps/sva-studio-react/package.json apps/sva-studio-react/tsconfig.json apps/sva-studio-react/project.json apps/sva-studio-react/plugin-catalog.json apps/sva-studio-react/src/routing/app-route-bindings.tsx apps/sva-studio-react/src/routing/app-route-bindings.test.tsx
git commit -m "feat: bind categories route to workspace plugin"
```

---

### Task 6: Run the relevant verification gate

**Files:**
- Verify the files changed in Tasks 1-5

- [ ] **Step 1: Run the focused unit-test gate for the categories plugin work**

Run:

```bash
pnpm nx run plugin-categories:test:unit
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/categories-route.test.ts --testFiles=src/server/news-route.test.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/mainserver-categories-api.server.test.ts --testFiles=src/server.test.ts
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx
```

Expected:
- PASS for plugin, host-route, server-adapter, and route-binding coverage

- [ ] **Step 2: Run the affected type-test gate because a new workspace plugin and new server route were added**

Run:

```bash
pnpm nx affected --target=test:types --base=origin/main
```

Expected:
- PASS for affected TypeScript and runtime-type checks

- [ ] **Step 3: Run the affected unit-test gate required before commit/push**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:
- PASS for affected unit coverage in the workspace

- [ ] **Step 4: Confirm the working tree is clean after the verification gate**

```bash
git status --short
```

Expected:
- no unexpected unstaged or uncommitted changes remain beyond the categories-plugin scope

---

## Spec Coverage Check

- New workspace plugin instead of app-local feature:
  - Task 1 plugin scaffold
  - Task 4 plugin implementation
- Host endpoint stays in Mainserver integration:
  - Task 2 dedicated host categories route in `packages/sva-mainserver`
  - Task 3 Studio host adapter
- Categories route no longer owned by the news boundary:
  - Task 2 route split and news-route cleanup
- Plugin page owns fetch client, flattening, and table UI:
  - Task 4
- App remains shell and binds `/categories` only:
  - Task 5
- Flat table with `Name`, `ID`, `Hierarchie`, `Position`, `Tags`, `Aktualisiert`, `Aktionen`:
  - Task 4 page implementation
- Disabled actions `Bearbeiten`, `Neue Unterkategorie`, `Löschen`:
  - Task 4 page implementation and tests
- Loading, error, and empty states:
  - Task 4 page implementation and tests

No spec gap remains for the agreed plugin-oriented first iteration.

## Notes for the Implementer

- The plugin must not talk directly to GraphQL or import browser-side APIs from `@sva/sva-mainserver`.
- Keep the host endpoint path stable as `/api/v1/mainserver/categories`, even though the internal route ownership moves out of the news boundary.
- Do not accidentally reintroduce categories domain logic into `apps/sva-studio-react`; the app shell should only wire the route.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-09-categories-page.md`.
