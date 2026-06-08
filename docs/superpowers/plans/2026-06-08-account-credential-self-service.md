# Account Credential Self-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passwort-Aenderungen fuer angemeldete Nutzer sicher ueber Keycloak-Self-Service in das Studio integrieren; die E-Mail-Aenderung bleibt bis zur Keycloak-seitigen Freischaltung von `UPDATE_EMAIL` ausgeblendet.

**Architecture:** Das Studio behaelt Profilstammdaten lokal unter `/account` und fuehrt sichtbare Credential-Aktionen ueber einen neuen serverseitigen Auth-Pfad `/auth/account-action` in Keycloak-AIA. Zunaechst startet nur der Menueeintrag fuer die Passwortaenderung diesen Pfad direkt; die bestehende Account-Seite unter `/account` zeigt nach Rueckkehr eine kleine Studio-owned Statusmeldung.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, shadcn/ui, `@sva/auth-runtime`, Keycloak OIDC AIA, Nx, Vitest

---

## File Structure

- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Modify: `apps/sva-studio-react/src/components/Header.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx`
- Modify: `packages/auth-runtime/src/auth-server/login.ts`
- Modify: `packages/auth-runtime/src/auth-route-handlers.ts`
- Modify: login-state or callback support files referenced by `auth-route-handlers.ts`
- Modify: `packages/auth-runtime/src/auth-route-handlers.test.ts`
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`

### Task 1: Auth-Runtime AIA-Einstieg vorbereiten

**Files:**
- Modify: `packages/auth-runtime/src/auth-server/login.ts`
- Modify: `packages/auth-runtime/src/auth-route-handlers.ts`
- Modify: zugehoerige Login-State-/Callback-Dateien in `packages/auth-runtime/src/`
- Test: `packages/auth-runtime/src/auth-route-handlers.test.ts`

- [ ] **Step 1: Failing Tests fuer neuen Account-Action-Auth-Pfad schreiben**

Ergaenze Tests fuer:

- valid action `update-password` erzeugt Redirect mit `kc_action=UPDATE_PASSWORD`
- valid action `update-email` erzeugt Redirect mit `kc_action=UPDATE_EMAIL`
- ungueltige action ergibt `400 invalid_request`
- Rueckkehrziel wird mit vorhandenem Sanitizer normalisiert

Beispieltest:

```ts
it('starts update-password through a canonical account-action route', async () => {
  const { accountActionHandler } = await import('./auth-route-handlers.js');

  const response = await accountActionHandler(
    new Request('https://studio.example.org/auth/account-action?action=update-password&returnTo=%2Faccount')
  );

  expect(response.status).toBe(302);
  expect(response.headers.get('Location')).toContain('kc_action=UPDATE_PASSWORD');
});
```

- [ ] **Step 2: Testlauf fuer Auth-Handler verifizieren**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/auth-route-handlers.test.ts
```

Expected:

```text
FAIL  packages/auth-runtime/src/auth-route-handlers.test.ts
```

- [ ] **Step 3: Login-URL-Builder um `kcAction` erweitern**

Fuehre einen optionalen Parameter im Login-Builder ein, damit `/auth/login` und `/auth/account-action` denselben Mechanismus verwenden koennen:

```ts
export const createLoginUrl = async (input?: {
  returnTo?: string;
  silent?: boolean;
  reauth?: boolean;
  kcAction?: 'UPDATE_PASSWORD' | 'UPDATE_EMAIL';
  authConfig?: AuthConfig;
}) => {
  // ...
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: authConfig.redirectUri,
    scope: authConfig.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    ...(input?.kcAction ? { kc_action: input.kcAction } : {}),
    ...(input?.silent ? { prompt: 'none' } : {}),
    ...(freshReauthRequested ? { prompt: 'login', max_age: '0' } : {}),
  });
};
```

- [ ] **Step 4: Neuen Handler `/auth/account-action` implementieren**

In `auth-route-handlers.ts` einen dedizierten Handler einfuehren:

```ts
const mapAccountActionToKcAction = (
  action: string | null
): 'UPDATE_PASSWORD' | 'UPDATE_EMAIL' | null => {
  if (action === 'update-password') return 'UPDATE_PASSWORD';
  if (action === 'update-email') return 'UPDATE_EMAIL';
  return null;
};
```

```ts
export const accountActionHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const kcAction = mapAccountActionToKcAction(url.searchParams.get('action'));
  if (!kcAction) {
    return toJsonErrorResponse(400, 'invalid_request', 'Unbekannte Account-Aktion.');
  }

  const returnTo = await sanitizeReturnTo(request, url.searchParams.get('returnTo'));
  const authConfig = await resolveAuthConfigForRequest(request);
  const { url: loginUrl } = await createLoginUrl({
    authConfig,
    kcAction,
    reauth: true,
    returnTo,
  });

  return createRedirectResponse(loginUrl);
};
```

- [ ] **Step 5: Rueckkehrstatus im Login-State und Callback mitfuehren**

Erweitere den gespeicherten Login-State um eine optionale Kennzeichnung:

```ts
type AccountActionIntent = 'update-password' | 'update-email';
```

```ts
const loginState = {
  // bestehende Felder
  accountActionIntent: input?.kcAction === 'UPDATE_PASSWORD'
    ? 'update-password'
    : input?.kcAction === 'UPDATE_EMAIL'
      ? 'update-email'
      : undefined,
};
```

Im Callback den finalen Redirect adaptieren:

```ts
const redirectTarget = new URL(effectiveLoginState?.returnTo ?? '/', request.url);
if (effectiveLoginState?.accountActionIntent === 'update-password') {
  redirectTarget.searchParams.set('accountAction', 'password-updated');
}
if (effectiveLoginState?.accountActionIntent === 'update-email') {
  redirectTarget.searchParams.set('accountAction', 'email-update-finished');
}
```

Wenn `kc_action_status=cancelled` anliegt:

```ts
redirectTarget.searchParams.set('accountAction', 'cancelled');
redirectTarget.searchParams.set('accountActionType', effectiveLoginState.accountActionIntent);
```

- [ ] **Step 6: Auth-Handler-Tests erneut ausfuehren**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/auth-route-handlers.test.ts
```

Expected:

```text
PASS  packages/auth-runtime/src/auth-route-handlers.test.ts
```

- [ ] **Step 7: Commit fuer Auth-Runtime vorbereiten**

```bash
git add packages/auth-runtime/src/auth-server/login.ts packages/auth-runtime/src/auth-route-handlers.ts packages/auth-runtime/src/auth-route-handlers.test.ts
git commit -m "feat: add keycloak account action auth flow"
```

### Task 2: Rueckkehrstatus auf der Account-Seite einfuehren

**Files:**
- Modify: `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Test: `apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx`

- [ ] **Step 1: Failing UI-Tests fuer Rueckkehrstatus auf `/account` schreiben**

Beispieltests:

```ts
it('shows a success status after returning from password update', async () => {
  mockRouterSearch({ accountAction: 'password-updated' });
  render(<AccountProfilePage />);
  expect(screen.getByRole('status')).toHaveTextContent(/passwort wurde aktualisiert/i);
});
```

- [ ] **Step 2: UI-Test gezielt fehlschlagen lassen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/account/-account-profile-page.test.tsx
```

Expected:

```text
FAIL  apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx
```

- [ ] **Step 3: Statusmeldung in die bestehende Account-Seite integrieren**

Beispielstruktur:

```tsx
const accountAction = search.accountAction;

const accountActionMessage =
  accountAction === 'password-updated'
    ? t('account.messages.passwordUpdated')
    : accountAction === 'email-update-finished'
      ? t('account.messages.emailUpdateFinished')
      : accountAction === 'cancelled'
        ? t('account.messages.accountActionCancelled')
        : null;
```

- [ ] **Step 4: Statusmeldungen und i18n-Keys einfuehren**

Ergaenze i18n-Keys wie:

```ts
account: {
  messages: {
    passwordUpdated: 'Das Passwort wurde aktualisiert.',
    emailUpdateFinished: 'Die E-Mail-Aenderung wurde abgeschlossen.',
    accountActionCancelled: 'Die Aktion wurde abgebrochen.',
  },
}
```

- [ ] **Step 5: Bestehende Account-Seite als Rueckkehrziel verwenden**

Stelle sicher, dass der neue Auth-Pfad immer mit `returnTo=/account` arbeitet und die bestehende Seite den Studio-owned Status auswertet.

- [ ] **Step 6: UI-Tests erneut ausfuehren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/account/-account-profile-page.test.tsx
```

Expected:

```text
PASS  apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx
```

- [ ] **Step 7: Commit fuer Account-Rueckkehrstatus vorbereiten**

```bash
git add apps/sva-studio-react/src/routes/account/-account-profile-page.tsx apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: show account action return status"
```

### Task 3: Header-Kontomenue aktivieren

**Files:**
- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Test: `apps/sva-studio-react/src/components/Header.test.tsx`

- [ ] **Step 1: Failing Tests fuer aktive Menueeintraege schreiben**

Beispieltest:

```ts
it('links password and email menu items directly to account action flows', async () => {
  render(<Header />);
  fireEvent.click(screen.getByRole('button', { name: /kontomenue/i }));
  expect(screen.getByRole('link', { name: /passwort aendern/i })).toHaveAttribute('href', '/auth/account-action?action=update-password&returnTo=%2Faccount');
  expect(screen.getByRole('link', { name: /e-mail aendern/i })).toHaveAttribute('href', '/auth/account-action?action=update-email&returnTo=%2Faccount');
});
```

- [ ] **Step 2: Header-Testlauf fehlschlagen lassen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/components/Header.test.tsx
```

Expected:

```text
FAIL  apps/sva-studio-react/src/components/Header.test.tsx
```

- [ ] **Step 3: Deaktivierte Menuepunkte durch echte Links ersetzen**

Ersetze:

```tsx
{ id: 'password', label: t('shell.header.changePassword'), disabled: true },
{ id: 'email', label: t('shell.header.changeEmail'), disabled: true },
```

durch:

```tsx
{ id: 'password', label: t('shell.header.changePassword'), href: '/auth/account-action?action=update-password&returnTo=%2Faccount' },
{ id: 'email', label: t('shell.header.changeEmail'), href: '/auth/account-action?action=update-email&returnTo=%2Faccount' },
```

- [ ] **Step 4: Header-Tests erneut ausfuehren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/components/Header.test.tsx
```

Expected:

```text
PASS  apps/sva-studio-react/src/components/Header.test.tsx
```

- [ ] **Step 5: Commit fuer Header-Verdrahtung vorbereiten**

```bash
git add apps/sva-studio-react/src/components/Header.tsx apps/sva-studio-react/src/components/Header.test.tsx
git commit -m "feat: enable account credential menu actions"
```

### Task 4: Architektur- und Regression-Absicherung

**Files:**
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`

- [ ] **Step 1: Runtime- und Sicherheitsvertrag dokumentieren**

Dokumentiere:

- Keycloak bleibt Mutationsort fuer Credentials
- `/auth/account-action` ist der kanonische Studio-Einstieg
- `/account` ist das Rueckkehrziel fuer die UI-Statusmeldung
- frische Re-Authentisierung ist Pflicht

- [ ] **Step 2: Doku-Checks lokal verifizieren**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/auth-route-handlers.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/account/-account-security-page.test.tsx --testFiles=src/components/Header.test.tsx
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:

```text
PASS  auth-runtime targeted tests
PASS  sva-studio-react targeted tests
PASS  affected unit test set
```

- [ ] **Step 3: Optionaler Typ-Gate bei Routing-/Handler-Aenderungen**

Run:

```bash
pnpm nx affected --target=test:types --base=origin/main
```

Expected:

```text
PASS  affected type checks
```

- [ ] **Step 4: Abschliessenden Commit vorbereiten**

```bash
git add docs/architecture/04-solution-strategy.md docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md docs/architecture/08-cross-cutting-concepts.md docs/architecture/09-architecture-decisions.md
git commit -m "docs: specify keycloak credential self-service flow"
```
