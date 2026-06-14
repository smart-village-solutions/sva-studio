# Public Waste Email Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-ready slice of the public waste email reminder service with Waste-owned output configuration, a central mail transport in `interfaces`, and a resource-efficient outbox-based backend flow.

**Architecture:** Waste remains the owner of reminder business rules, public signup, DOI, and subscription persistence. Technical mail transport is modeled as a central external interface type and referenced from Waste output settings. The implementation should land in thin vertical slices: shared contracts first, then interfaces transport config, then Waste output config, then public signup flow and outbox materialization.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, Nx, pnpm, OpenSpec, existing Waste host facade, external interface registry, Vitest, Playwright

---

### Task 1: Shared Contracts And Config Shape

**Files:**
- Modify: `packages/core/src/external-interfaces-contract.ts`
- Modify: `packages/core/src/waste-management-settings-public-config.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/external-interfaces-contract.test.ts`
- Test: `packages/core/src/waste-management-settings-public-config.test.ts`

- [ ] **Step 1: Write the failing core contract tests**

```ts
// packages/core/src/external-interfaces-contract.test.ts
it('accepts mail transport as a supported external interface type', () => {
  expect(externalInterfaceContract.isTypeKey('mail_transport')).toBe(true);
});

// packages/core/src/waste-management-settings-public-config.test.ts
it('reads and writes waste email reminder output config', () => {
  const next = buildWasteManagementPublicConfig({}, {
    selected: true,
    calendarWebUrl: 'https://demo.abfallkalender.example',
    emailReminderConfig: {
      enabled: true,
      publicSignupEnabled: true,
      transportId: 'mail-transport-1',
      fromName: 'Landkreis Musterstadt',
      fromEmail: 'abfall@example.org',
      privacyPolicyUrl: 'https://example.org/privacy',
      imprintUrl: 'https://example.org/imprint',
      consentLabel: 'Ich stimme der Datenverarbeitung zu.',
      consentVersion: '2026-06-14',
      doiTokenTtlHours: 48,
      pendingSubscriptionTtlHours: 72,
      materializationLookaheadDays: 7,
    },
  });

  expect(readWasteManagementEmailReminderConfig(next)?.transportId).toBe('mail-transport-1');
});
```

- [ ] **Step 2: Run core tests to verify they fail**

Run: `pnpm nx run core:test:unit --testFiles=packages/core/src/external-interfaces-contract.test.ts --testFiles=packages/core/src/waste-management-settings-public-config.test.ts`

Expected: FAIL because `mail_transport` and the email reminder config helpers do not exist yet.

- [ ] **Step 3: Implement the minimal contract additions**

```ts
// packages/core/src/external-interfaces-contract.ts
const externalInterfaceTypeKeys = ['sva_mainserver', 's3', 'supabase', 'mail_transport'] as const;
const externalInterfaceCategories = ['api', 'object_storage', 'database', 'feed'] as const;
const externalInterfaceStatusCheckKinds = ['none', 'sva_mainserver', 's3', 'supabase', 'mail_transport'] as const;

export type MailTransportConfig =
  | Readonly<{
      transportId: string;
      displayName: string;
      transportType: 'smtp';
      host: string;
      port: number;
      securityMode: 'none' | 'starttls' | 'tls';
      authMode: 'none' | 'basic';
      secretRef: string;
      enabled: boolean;
    }>
  | Readonly<{
      transportId: string;
      displayName: string;
      transportType: 'provider_api';
      endpoint: string;
      mode: string;
      securityMode: 'none' | 'starttls' | 'tls';
      authMode: 'none' | 'basic';
      secretRef: string;
      enabled: boolean;
    }>;

export type MailDispatchPayload = Readonly<{
  dispatchId: string;
  transportId: string;
  templateKey: string;
  messageKind: 'transactional';
  addresses: readonly { kind: 'to' | 'cc' | 'bcc' | 'reply_to'; email: string; displayName?: string }[];
  templatePayload: Readonly<Record<string, string | number | boolean | null>>;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, string>>;
}>;

// packages/core/src/waste-management-settings-public-config.ts
const WASTE_EMAIL_REMINDER_CONFIG_KEY = 'emailReminderConfig';

export type WasteManagementEmailReminderConfig = Readonly<{
  enabled: boolean;
  publicSignupEnabled: boolean;
  transportId: string;
  publicBaseUrl: string;
  doiConfirmPath: string;
  unsubscribePath: string;
  signupSuccessPath?: string;
  activationSuccessPath?: string;
  unsubscribeSuccessPath?: string;
  invalidTokenPath?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  serviceLabel?: string;
  privacyPolicyUrl: string;
  imprintUrl: string;
  consentLabel: string;
  consentVersion: string;
  doiSubjectTemplate: string;
  doiIntroText: string;
  doiButtonLabel: string;
  doiSuccessHeadline: string;
  doiSuccessBody: string;
  doiErrorHeadline: string;
  doiErrorBody: string;
  reminderSubjectTemplate: string;
  reminderIntroTemplate: string;
  unsubscribeLinkLabel: string;
  unsubscribeSuccessHeadline: string;
  unsubscribeSuccessBody: string;
  maxSubscriptionsPerEmailAndLocation: number;
  signupRateLimitPerIpPerHour: number;
  signupRateLimitPerEmailPerHour: number;
  doiTokenTtlHours: number;
  pendingSubscriptionTtlHours: number;
  materializationLookaheadDays: number;
}>;

export const readWasteManagementEmailReminderConfig = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteManagementEmailReminderConfig | undefined => {
  const value = publicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.transportId !== 'string' ||
    typeof record.fromName !== 'string' ||
    typeof record.fromEmail !== 'string' ||
    typeof record.privacyPolicyUrl !== 'string' ||
    typeof record.imprintUrl !== 'string' ||
    typeof record.consentLabel !== 'string' ||
    typeof record.consentVersion !== 'string'
  ) {
    return undefined;
  }
  return {
    enabled: record.enabled === true,
    publicSignupEnabled: record.publicSignupEnabled === true,
    transportId: record.transportId,
    fromName: record.fromName,
    fromEmail: record.fromEmail,
    ...(typeof record.replyToEmail === 'string' ? { replyToEmail: record.replyToEmail } : {}),
    ...(typeof record.serviceLabel === 'string' ? { serviceLabel: record.serviceLabel } : {}),
    privacyPolicyUrl: record.privacyPolicyUrl,
    imprintUrl: record.imprintUrl,
    consentLabel: record.consentLabel,
    consentVersion: record.consentVersion,
    doiTokenTtlHours: typeof record.doiTokenTtlHours === 'number' ? record.doiTokenTtlHours : 48,
    pendingSubscriptionTtlHours:
      typeof record.pendingSubscriptionTtlHours === 'number' ? record.pendingSubscriptionTtlHours : 72,
    materializationLookaheadDays:
      typeof record.materializationLookaheadDays === 'number' ? record.materializationLookaheadDays : 7,
  };
};
```

- [ ] **Step 4: Run core tests to verify they pass**

Run: `pnpm nx run core:test:unit --testFiles=packages/core/src/external-interfaces-contract.test.ts --testFiles=packages/core/src/waste-management-settings-public-config.test.ts`

Expected: PASS.

Task 1 note:
- This slice establishes the shared baseline contract, not a temporary mini-shape. Required and optional fields should follow the current OpenSpec/design, including semantic validation for URLs, paths, emails, booleans, and bounded guardrail fields.

### Task 2: Central Mail Transport In Interfaces

**Files:**
- Modify: `apps/sva-studio-react/src/lib/instance-interfaces.ts`
- Modify: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.dialogs.tsx`
- Modify: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.ts`
- Modify: `packages/core/src/external-interfaces-contract.ts`
- Modify: `packages/data/migrations/0041_iam_external_interface_registry.sql`
- Test: `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.controller.test.ts`

- [ ] **Step 1: Write the failing interfaces UI test**

```tsx
// apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx
it('supports creating a mail transport interface', async () => {
  render(<InterfacesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
  expect(screen.getByText('Mail-Transport')).toBeTruthy();
});
```

- [ ] **Step 2: Run the interfaces test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`

Expected: FAIL because `mail transport` is not an available interface type.

- [ ] **Step 3: Add the new interface type and form fields**

```ts
// apps/sva-studio-react/src/lib/instance-interfaces.ts
export type InstanceInterfaceType = 'mainserver' | 's3' | 'supabase' | 'mailTransport';

export type InstanceInterfaceMailTransportConfig = Readonly<{
  host: string;
  port: string;
  securityMode: 'none' | 'starttls' | 'tls';
  authMode: 'none' | 'basic';
  username: string;
  secretRef: string;
  fromEmailDefault: string;
  fromNameDefault: string;
  replyToDefault: string;
  maxBatchSize: string;
  rateLimitPerMinute: string;
}>;
```

```tsx
// apps/sva-studio-react/src/routes/interfaces/-interfaces-page.dialogs.tsx
const MailTransportFields = ({ draft, onChange }: { ... }) => (
  <>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="mail-host">{t('interfaces.forms.mailTransport.host')}</Label>
        <Input id="mail-host" value={draft.config.host} onChange={...} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mail-port">{t('interfaces.forms.mailTransport.port')}</Label>
        <Input id="mail-port" value={draft.config.port} onChange={...} />
      </div>
    </div>
  </>
);
```

- [ ] **Step 4: Extend the server-side interface contract**

```ts
// packages/sva-mainserver/src/server/interfaces-contract.ts
if (draft.type === 'mailTransport') {
  // validate host, port, securityMode, secretRef
}
```

- [ ] **Step 5: Run targeted unit and type tests**

Run: `pnpm nx run sva-studio-react:test:unit --testFiles=apps/sva-studio-react/src/routes/interfaces/-interfaces-page.test.tsx`

Run: `pnpm nx affected --target=test:types --base=origin/main`

Expected: PASS.

### Task 3: Waste Output Card For Email Reminder Config

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.data.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.output.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.output.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.output-panel.test.tsx`
- Test: `apps/sva-studio-react/e2e/waste-management-plugin.spec.ts`

- [ ] **Step 1: Write the failing output panel test**

```tsx
// packages/plugin-waste-management/tests/waste-management.output-panel.test.tsx
it('renders the email reminder card in the output tab', async () => {
  render(<WasteOutputPanel />);
  expect(await screen.findByText('output.emailReminder.title')).toBeTruthy();
  expect(screen.getByLabelText('output.emailReminder.fields.transportId')).toBeTruthy();
});
```

- [ ] **Step 2: Run the Waste output panel test to verify it fails**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=packages/plugin-waste-management/tests/waste-management.output-panel.test.tsx`

Expected: FAIL because the card and translation keys do not exist yet.

- [ ] **Step 3: Extend the output panel state and rendering**

```tsx
// packages/plugin-waste-management/src/waste-management.output-panel.tsx
const [emailReminderConfig, setEmailReminderConfig] = useState<WasteOutputEmailReminderFormState>(emptyEmailReminderFormState);

useEffect(() => {
  setEmailReminderConfig(toEmailReminderFormState(settings?.emailReminderConfig));
}, [settings?.emailReminderConfig]);
```

```tsx
// packages/plugin-waste-management/src/waste-management.output-panel.parts.tsx
<section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
  <div className="space-y-1">
    <h3 className="text-sm font-semibold">{translate('output.emailReminder.title')}</h3>
    <p className="text-sm text-muted-foreground">{translate('output.emailReminder.description')}</p>
  </div>
  <StudioField id="waste-email-reminder-enabled" label={translate('output.emailReminder.fields.enabled')}>
    <Switch ... />
  </StudioField>
</section>
```

- [ ] **Step 4: Save the Waste output config through existing settings update flow**

```ts
// packages/plugin-waste-management/src/waste-management.output-panel.tsx
const result = await updateWasteManagementSettings({
  ...existingSettingsPayload,
  emailReminderConfig: toApiEmailReminderConfig(emailReminderConfig),
});
```

- [ ] **Step 5: Run panel and e2e tests**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=packages/plugin-waste-management/tests/waste-management.output-panel.test.tsx`

Run: `pnpm nx run sva-studio-react:e2e --grep "Ausgabe"`

Expected: PASS.

### Task 4: Waste Settings Persistence And Output API

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-write-support.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Modify: `packages/data-repositories/src/integrations/external-interfaces.server.ts`
- Test: `packages/auth-runtime/src/waste-management/core/settings-shared.test.ts`
- Test: `packages/auth-runtime/src/waste-management/core/settings-write-support.test.ts`

- [ ] **Step 1: Write the failing auth-runtime settings test**

```ts
// packages/auth-runtime/src/waste-management/core/settings-shared.test.ts
it('maps email reminder config from external interface public config', async () => {
  const result = mapWasteSettingsFromExternalInterfaces([...mailTransportRecord, ...selectedWasteRecord]);
  expect(result.emailReminderConfig?.transportId).toBe('mail-transport-1');
});
```

- [ ] **Step 2: Run the Waste settings tests to verify they fail**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/waste-management/core/settings-shared.test.ts --testFiles=packages/auth-runtime/src/waste-management/core/settings-write-support.test.ts`

Expected: FAIL because the email reminder config is not part of Waste settings yet.

- [ ] **Step 3: Map and validate the email reminder output config**

```ts
// packages/auth-runtime/src/waste-management/core/settings-shared.ts
const emailReminderConfig = readWasteManagementEmailReminderConfig(record.publicConfig);

return {
  ...baseSettings,
  ...(emailReminderConfig ? { emailReminderConfig } : {}),
};
```

```ts
// packages/auth-runtime/src/waste-management/core/settings-write-support.ts
if (input.emailReminderConfig?.enabled && !input.emailReminderConfig.transportId) {
  return createApiError(409, 'invalid_request', 'Für den E-Mail-Erinnerungsdienst ist ein Mail-Transport erforderlich.', requestId);
}
```

- [ ] **Step 4: Run the settings tests to verify they pass**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=packages/auth-runtime/src/waste-management/core/settings-shared.test.ts --testFiles=packages/auth-runtime/src/waste-management/core/settings-write-support.test.ts`

Expected: PASS.

### Task 5: Public Signup, DOI, And Unsubscribe Vertical Slice

**Files:**
- Modify: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Create: `apps/public-waste-calendar-web/src/routes/email-reminders.tsx`
- Create: `apps/public-waste-calendar-web/src/routes/email-reminders.confirm.tsx`
- Create: `apps/public-waste-calendar-web/src/routes/email-reminders.unsubscribe.tsx`
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-app.tsx`
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-selection-header.tsx`
- Create: `apps/public-waste-calendar-web/src/lib/public-waste-email-reminders.ts`
- Test: `apps/public-waste-calendar-web/src/routes/index.test.tsx`

- [ ] **Step 1: Write the failing public waste route test**

```tsx
// apps/public-waste-calendar-web/src/routes/index.test.tsx
it('shows the email reminder setup action after location resolution', async () => {
  render(<PublicWasteIndexPage />);
  expect(await screen.findByRole('button', { name: 'E-Mail-Erinnerung einrichten' })).toBeTruthy();
});
```

- [ ] **Step 2: Run the public waste route test to verify it fails**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=apps/public-waste-calendar-web/src/routes/index.test.tsx`

Expected: FAIL because no reminder CTA or routes exist.

- [ ] **Step 3: Implement the minimal public reminder routes**

```tsx
// apps/public-waste-calendar-web/src/components/public-waste-selection-header.tsx
<button type="button" onClick={onOpenEmailReminders}>
  E-Mail-Erinnerung einrichten
</button>
```

```ts
// apps/public-waste-calendar-web/src/lib/public-waste-email-reminders.ts
export type PublicWasteEmailReminderSignupInput = Readonly<{
  locationKey: string;
  email: string;
  items: readonly { fractionId: string; slotIds: readonly string[] }[];
  consentAccepted: boolean;
}>;
```

- [ ] **Step 4: Run the public waste tests**

Run: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=apps/public-waste-calendar-web/src/routes/index.test.tsx`

Expected: PASS for the first slice with CTA and route wiring.

### Task 6: Outbox Schema And Reminder Materialization

**Files:**
- Create: `packages/data/migrations/00xx_waste_email_reminders.sql`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Create: `packages/data-repositories/src/waste-management/email-reminders.ts`
- Create: `packages/auth-runtime/src/waste-management/email-reminders/materialize.ts`
- Test: `packages/data-repositories/src/waste-management/email-reminders.test.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
// packages/data-repositories/src/waste-management/email-reminders.test.ts
it('deduplicates reminder outbox entries by subscription, fraction, slot, and pickup date', async () => {
  const repo = createWasteEmailReminderRepository(fakeDb);
  await repo.enqueueReminder(job);
  await repo.enqueueReminder(job);
  expect(fakeDb.insertedRows).toHaveLength(1);
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `pnpm nx run data-repositories:test:unit --testFiles=packages/data-repositories/src/waste-management/email-reminders.test.ts`

Expected: FAIL because the repository and migration do not exist yet.

- [ ] **Step 3: Implement the outbox persistence**

```sql
CREATE TABLE waste_email_reminder_outbox (
  id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL,
  fraction_id uuid NOT NULL,
  slot_id text NOT NULL,
  pickup_date date NOT NULL,
  send_at timestamptz NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_waste_email_reminder_outbox_status_send_at
  ON waste_email_reminder_outbox(status, send_at);
```

- [ ] **Step 4: Run repository and schema-relevant tests**

Run: `pnpm nx run data-repositories:test:unit --testFiles=packages/data-repositories/src/waste-management/email-reminders.test.ts`

Run: `pnpm check:file-placement`

Expected: PASS.

### Task 7: Minimal Verification And Documentation Closure

**Files:**
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `openspec/changes/add-public-waste-email-reminders/tasks.md`

- [ ] **Step 1: Update architecture docs for the implemented slice**

```md
## Waste email reminders
- Waste output tab owns public reminder business configuration.
- Interfaces owns the mail transport configuration and secret references.
- Reminder delivery uses Waste outbox materialization and a central mail transport integration.
```

- [ ] **Step 2: Run the smallest relevant final gate**

Run: `pnpm nx affected --target=test:unit --base=origin/main`

Run: `pnpm nx affected --target=test:types --base=origin/main`

Expected: PASS.

- [ ] **Step 3: Mark OpenSpec implementation checklist items that are actually done**

```md
## 1. Spezifikation und Architekturvertrag
- [x] 1.1 Delta-Spezifikationen für `public-waste-calendar` und `waste-management` anlegen
```

- [ ] **Step 4: Re-run strict spec validation**

Run: `openspec validate add-public-waste-email-reminders --strict`

Expected: PASS.

---

## Self-Review

Spec coverage:
- `public-waste-calendar`: covered by Tasks 5 and 6
- `waste-management`: covered by Tasks 3 and 4
- `external-interface-registry`: covered by Tasks 1 and 2
- output-card detail model: covered by Task 3
- transport and outbox model: covered by Tasks 2 and 6

Placeholder scan:
- No `TBD`, `TODO`, or indirect “similar to” references are left in task steps.

Type consistency:
- Contract naming is aligned around `mail_transport`, `transportId`, `emailReminderConfig`, and `dedupe_key`.
