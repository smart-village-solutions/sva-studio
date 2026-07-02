# Survey GraphQL Adapter Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das bestehende Studio-Survey-Modell so an die aktuell abgelegte Mainserver-GraphQL-API anpassen, dass Reads, Writes und Moderationspfade gegen `SurveyPoll` stabil funktionieren, ohne die Plugin-Oberfläche sofort fachlich umzubauen.

**Architecture:** Wir halten die Studio-Domäne vorerst stabil und führen einen expliziten Adapter zwischen Studio-Modell und Mainserver-Snapshot ein. Native GraphQL-Felder werden direkt gemappt, fehlende Studio-Felder werden zunächst kontrolliert in `payload` serialisiert bzw. aus `payload` gelesen, und nicht mehr unterstützte Input-Formen werden aus den Moderations- und Mutationspfaden entfernt.

**Tech Stack:** TypeScript strict, Zod, Vitest, Nx, `@sva/plugin-surveys`, `@sva/sva-mainserver`

---

## Vorab: Verantwortete Dateien

**Modify**
- `packages/sva-mainserver/src/generated/surveys.ts`
- `packages/sva-mainserver/src/types.ts`
- `packages/sva-mainserver/src/server/service-internals/survey-operations.ts`
- `packages/sva-mainserver/src/server/service-internals/survey-mappers.ts`
- `packages/sva-mainserver/src/server/surveys-route.ts`
- `packages/sva-mainserver/src/server/surveys-route-helpers.ts`
- `packages/plugin-surveys/src/surveys.api.ts`
- `packages/plugin-surveys/src/surveys.types.ts`
- `packages/plugin-surveys/src/surveys.mutation.types.ts`
- `packages/plugin-surveys/tests/surveys.api.test.ts`
- `packages/sva-mainserver/src/server/service-internals/survey-mappers.test.ts`
- `packages/sva-mainserver/src/server/service.test.ts`
- `packages/sva-mainserver/src/server/surveys-route.test.ts`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- `docs/architecture/11-risks-and-technical-debt.md`

**Create**
- `packages/sva-mainserver/src/server/service-internals/survey-payload-contract.ts`
- optional: `docs/adr/`-Eintrag nur wenn im Verlauf entschieden wird, dass `payload` dauerhaft kanonische Ablage für Studio-only-Felder bleibt

---

### Task 1: Zielvertrag und Adaptergrenze festschreiben

**Files:**
- Create: `packages/sva-mainserver/src/server/service-internals/survey-payload-contract.ts`
- Modify: `packages/sva-mainserver/src/types.ts`
- Test: `packages/sva-mainserver/src/server/service-internals/survey-mappers.test.ts`

- [x] **Step 1: Failing Test für Payload-gestützte Studio-Zusatzfelder ergänzen**

```ts
it('reads studio-only survey fields from payload when the GraphQL snapshot does not expose them natively', () => {
  const item = mapSurveyItem({
    id: 'survey-1',
    title: { de: 'Titel' },
    shortDescription: { de: 'Kurz' },
    description: { de: 'Lang' },
    status: 'ACTIVE',
    targetAreaIds: ['ta-1'],
    isAnonymous: true,
    questionCount: 0,
    questions: [],
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T11:00:00Z',
    payload: {
      startAt: '2026-07-10T08:00:00Z',
      endAt: '2026-07-20T18:00:00Z',
      resultVisibility: 'AFTER_SURVEY_END',
      showResultsInApp: true,
      privacyNotice: { de: 'Datenschutz' },
      transparencyNotice: { de: 'Transparenz' },
    },
  });

  expect(item.resultVisibility).toBe('AFTER_SURVEY_END');
  expect(item.showResultsInApp).toBe(true);
  expect(item.privacyNotice).toEqual({ de: 'Datenschutz' });
});
```

- [x] **Step 2: Nur den betroffenen Test laufen lassen und roten Stand bestätigen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/survey-mappers.test.ts`
Expected: FAIL mit Schema-/Mapping-Abweichung für `payload` oder fehlende Felder

- [x] **Step 3: Minimale Payload-Contract-Datei anlegen**

```ts
import { z } from 'zod';

export const surveyPayloadContractSchema = z.object({
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  resultVisibility: z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']).nullish(),
  showResultsInApp: z.boolean().nullish(),
  privacyNotice: z.record(z.string(), z.string()).nullish(),
  transparencyNotice: z.record(z.string(), z.string()).nullish(),
}).strict();

export type SurveyPayloadContract = z.infer<typeof surveyPayloadContractSchema>;
```

- [x] **Step 4: `types.ts` so schärfen, dass die interne Survey-Domäne Payload-gestützte Felder bewusst trägt**

```ts
export type SvaMainserverSurveyPayloadBackedFields = {
  readonly startAt?: string;
  readonly endAt?: string;
  readonly resultVisibility: SvaMainserverSurveyResultVisibility;
  readonly showResultsInApp: boolean;
  readonly privacyNotice?: SvaMainserverLocalizedText;
  readonly transparencyNotice?: SvaMainserverLocalizedText;
};
```

- [x] **Step 5: Test erneut laufen lassen und grün ziehen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/survey-mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sva-mainserver/src/server/service-internals/survey-payload-contract.ts packages/sva-mainserver/src/types.ts packages/sva-mainserver/src/server/service-internals/survey-mappers.test.ts
git commit -m "feat: define survey payload adapter contract"
```

### Task 2: Read-Queries vom Wunschmodell auf den echten `SurveyPoll`-Snapshot umstellen

**Files:**
- Modify: `packages/sva-mainserver/src/generated/surveys.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/survey-operations.ts`
- Test: `packages/sva-mainserver/src/server/service.test.ts`

- [x] **Step 1: Failing Test für die aktuelle Query-Signatur ergänzen**

```ts
it('queries surveys with snapshot-compatible arguments instead of SurveyFilterInput', async () => {
  await service.listSurveys({
    instanceId: 'i1',
    keycloakSubject: 'u1',
    page: 1,
    pageSize: 10,
    includeArchived: true,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: expect.stringContaining('"operationName":"SvaMainserverSurveysList"'),
    }),
  );
});
```

- [x] **Step 2: Betroffenen Service-Test isoliert rot laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts -t "queries surveys with snapshot-compatible arguments"`
Expected: FAIL, weil noch `filter` statt nativer Query-Args verwendet wird

- [x] **Step 3: `generated/surveys.ts` auf Snapshot-Felder und Signaturen reduzieren**

```ts
const surveyFields = `
  id
  title
  shortDescription
  description
  status
  targetAreaIds
  isAnonymous
  questions {
    ${surveyQuestionFields}
  }
  questionCount
  participationCount
  submissionCount
  payload
  createdAt
  updatedAt
  publishedAt
  archivedAt
`;

export const svaMainserverSurveysListDocument = `
  query SvaMainserverSurveysList($ids: [ID!], $ongoing: Boolean, $archived: Boolean, $order: SurveyPollsOrder) {
    surveys(ids: $ids, ongoing: $ongoing, archived: $archived, order: $order) {
      ${surveyListFields}
    }
  }
`;
```

- [x] **Step 4: `survey-operations.ts` auf native Query-Args umbauen**

```ts
variables: {
  ...(input.ids?.length ? { ids: [...input.ids] } : {}),
  ...(input.ongoingOnly === undefined ? {} : { ongoing: input.ongoingOnly }),
  archived: input.includeArchived === true,
  order: 'updatedAt_DESC',
}
```

- [x] **Step 5: Service-Test erneut laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts -t "queries surveys with snapshot-compatible arguments"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sva-mainserver/src/generated/surveys.ts packages/sva-mainserver/src/server/service-internals/survey-operations.ts packages/sva-mainserver/src/server/service.test.ts
git commit -m "fix: align survey read queries with snapshot schema"
```

### Task 3: Read-Mapper an `SurveyPoll` plus `payload` anpassen

**Files:**
- Modify: `packages/sva-mainserver/src/server/service-internals/survey-mappers.ts`
- Test: `packages/sva-mainserver/src/server/service-internals/survey-mappers.test.ts`

- [x] **Step 1: Zusätzliche Failing Tests für `SurveyPoll`-Mapping ergänzen**

```ts
it('derives studio survey schedule fields from SurveyPoll payload', () => {
  // payload-driven startAt/endAt/resultVisibility
});

it('falls back to sane defaults when optional SurveyPoll payload fields are absent', () => {
  // resultVisibility NONE, showResultsInApp false
});
```

- [ ] **Step 2: Mapper-Tests rot laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/survey-mappers.test.ts`
Expected: FAIL mit `invalid_response` oder falschen Default-Werten

- [x] **Step 3: `surveySchema` von Wunschfeldern auf Snapshot plus `payload` umbauen**

```ts
const surveySchema = z.object({
  id: z.string().min(1),
  title: localizedTextSchema,
  shortDescription: localizedTextSchema.nullish(),
  description: localizedTextSchema.nullish(),
  status: surveyStatusSchema,
  targetAreaIds: z.array(z.string()).nullish(),
  isAnonymous: z.boolean().nullish(),
  questions: z.array(surveyQuestionSchema).nullish(),
  questionCount: z.number().int().nullish(),
  participationCount: z.number().int().nullish(),
  submissionCount: z.number().int().nullish(),
  results: surveyResultsSchema.nullish(),
  payload: z.unknown().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  archivedAt: z.string().nullish(),
});
```

- [x] **Step 4: `payload` sicher parsen und Studio-Domäne daraus ergänzen**

```ts
const parsedPayload = surveyPayloadContractSchema.safeParse(survey.payload);
const payloadFields = parsedPayload.success ? parsedPayload.data : {};

resultVisibility: payloadFields.resultVisibility ?? 'NONE',
showResultsInApp: payloadFields.showResultsInApp === true,
...(payloadFields.startAt ? { startAt: payloadFields.startAt } : {}),
```

- [x] **Step 5: Mapper-Tests erneut laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/survey-mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sva-mainserver/src/server/service-internals/survey-mappers.ts packages/sva-mainserver/src/server/service-internals/survey-mappers.test.ts
git commit -m "fix: map surveypoll responses into studio survey model"
```

### Task 4: Write-Adapter auf Snapshot-Inputs und `payload`-Serialisierung umstellen

**Files:**
- Modify: `packages/sva-mainserver/src/server/service-internals/survey-operations.ts`
- Modify: `packages/plugin-surveys/src/surveys.api.ts`
- Modify: `packages/plugin-surveys/src/surveys.mutation.types.ts`
- Test: `packages/plugin-surveys/tests/surveys.api.test.ts`
- Test: `packages/sva-mainserver/src/server/service.test.ts`

- [ ] **Step 1: Failing Tests für Write-Mapping ergänzen**

```ts
it('serializes studio-only survey fields into payload for create and update', async () => {
  await createSurvey({
    title: 'Titel',
    status: 'ACTIVE',
    startAt: '2026-07-10T08:00:00Z',
    endAt: '2026-07-20T18:00:00Z',
    resultVisibility: 'AFTER_SURVEY_END',
    showResultsInApp: true,
    isAnonymous: true,
  });

  expect(createBodyMock).toHaveBeenCalledWith(expect.objectContaining({
    payload: expect.objectContaining({
      startAt: '2026-07-10T08:00:00Z',
      resultVisibility: 'AFTER_SURVEY_END',
    }),
  }));
});
```

- [ ] **Step 2: Plugin-API-Tests isoliert rot laufen lassen**

Run: `pnpm nx run plugin-surveys:test:unit --testFiles=tests/surveys.api.test.ts`
Expected: FAIL, weil derzeit direkte Top-Level-Felder statt `payload` erwartet werden

- [x] **Step 3: `survey-operations.ts` Write-Builders auf Snapshot-Input reduzieren**

```ts
const buildSurveyCoreInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.title !== undefined ? { title: survey.title } : {}),
  ...(survey.shortDescription !== undefined ? { shortDescription: survey.shortDescription } : {}),
  ...(survey.description !== undefined ? { description: survey.description } : {}),
  ...(survey.status ? { status: survey.status } : {}),
  ...(survey.startAt || survey.endAt
    ? { date: { startDate: survey.startAt ?? null, endDate: survey.endAt ?? null } }
    : {}),
});
```

- [x] **Step 4: Studio-only-Felder in einen zentralen `payload`-Block serialisieren**

```ts
const buildSurveyPayloadInput = (survey: SvaMainserverSurveyInput) => ({
  payload: {
    ...(survey.startAt === undefined ? {} : { startAt: survey.startAt ?? null }),
    ...(survey.endAt === undefined ? {} : { endAt: survey.endAt ?? null }),
    ...(survey.resultVisibility === undefined ? {} : { resultVisibility: survey.resultVisibility }),
    ...(survey.showResultsInApp === undefined ? {} : { showResultsInApp: survey.showResultsInApp }),
    ...(survey.privacyNotice === undefined ? {} : { privacyNotice: survey.privacyNotice ?? null }),
    ...(survey.transparencyNotice === undefined ? {} : { transparencyNotice: survey.transparencyNotice ?? null }),
  },
});
```

- [x] **Step 5: `surveys.api.ts`-Tests und Service-Tests grün ziehen**

Run: `pnpm nx run plugin-surveys:test:unit --testFiles=tests/surveys.api.test.ts`
Expected: PASS

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts -t "lists, reads, updates results and moderates surveys with typed GraphQL variables"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sva-mainserver/src/server/service-internals/survey-operations.ts packages/plugin-surveys/src/surveys.api.ts packages/plugin-surveys/src/surveys.mutation.types.ts packages/plugin-surveys/tests/surveys.api.test.ts packages/sva-mainserver/src/server/service.test.ts
git commit -m "fix: serialize studio survey write fields into snapshot-compatible inputs"
```

### Task 5: Freitext-Moderation auf erlaubte Snapshot-Mutationen begrenzen

**Files:**
- Modify: `packages/sva-mainserver/src/server/service-internals/survey-operations.ts`
- Modify: `packages/sva-mainserver/src/server/surveys-route.ts`
- Test: `packages/sva-mainserver/src/server/surveys-route.test.ts`

- [x] **Step 1: Failing Test für nicht mehr erlaubtes `delete` in `SurveyFreeTextInput` ergänzen**

```ts
it('does not send unsupported delete flags for free-text moderation mutations', async () => {
  await dispatchSvaMainserverSurveysRequest(
    createRequest('https://studio.test/api/v1/mainserver/surveys/s1/free-text-responses/f1', {
      method: 'DELETE',
    }),
  );

  expect(updateSvaMainserverSurveyMock).not.toHaveBeenCalledWith(
    expect.objectContaining({
      survey: expect.objectContaining({
        freeTextResponses: [expect.objectContaining({ delete: true })],
      }),
    }),
  );
});
```

- [ ] **Step 2: Route-Test rot laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/surveys-route.test.ts -t "does not send unsupported delete flags for free-text moderation mutations"`
Expected: FAIL

- [x] **Step 3: DELETE-Moderation auf sicheren Fallback umstellen**

```ts
// Option A: DELETE-Endpunkt vorübergehend 501/409 mit klarer Fehlermeldung
return errorJson(501, 'unsupported_operation', 'Freitext-Löschung wird vom aktuellen Mainserver-Schema nicht unterstützt.');
```

- [x] **Step 4: Release-/Statuswechsel-Pfad weiter über `status: PUBLIC` halten**

```ts
freeTextResponses: [{ id: input.freeTextResponseId, status: 'PUBLIC' }]
```

- [x] **Step 5: Route-Test erneut laufen lassen**

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/surveys-route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sva-mainserver/src/server/service-internals/survey-operations.ts packages/sva-mainserver/src/server/surveys-route.ts packages/sva-mainserver/src/server/surveys-route.test.ts
git commit -m "fix: constrain survey free-text moderation to supported snapshot mutations"
```

### Task 6: Plugin-Roundtrip und Editor-Verhalten gegen den Adapter absichern

**Files:**
- Modify: `packages/plugin-surveys/src/surveys.types.ts`
- Modify: `packages/plugin-surveys/src/surveys.api.ts`
- Test: `packages/plugin-surveys/tests/surveys.editor.shared.test.ts`
- Test: `packages/plugin-surveys/tests/surveys.editor-logic.test.tsx`

- [ ] **Step 1: Failing Roundtrip-Test ergänzen**

```ts
it('roundtrips payload-backed survey metadata through load and save flows', async () => {
  // geladenes SurveyItem mit payload-gestützten Feldern
  // Formwerte bleiben stabil
  // Update-Request serialisiert wieder in payload/date
});
```

- [ ] **Step 2: Betroffene Plugin-Tests rot laufen lassen**

Run: `pnpm nx run plugin-surveys:test:unit --testFiles=tests/surveys.editor.shared.test.ts --testFiles=tests/surveys.editor-logic.test.tsx`
Expected: FAIL bei verlorenen Meta-/Schedule-Feldern

- [ ] **Step 3: Plugin-Typen nur dort anpassen, wo der Adapter explizite Stabilität braucht**

```ts
export type SurveyContentItem = Readonly<{
  // bestehende Studio-Felder bleiben erhalten
  // keine GraphQL-Leaks ins Plugin einführen
}>;
```

- [ ] **Step 4: Tests erneut laufen lassen**

Run: `pnpm nx run plugin-surveys:test:unit --testFiles=tests/surveys.editor.shared.test.ts --testFiles=tests/surveys.editor-logic.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-surveys/src/surveys.types.ts packages/plugin-surveys/src/surveys.api.ts packages/plugin-surveys/tests/surveys.editor.shared.test.ts packages/plugin-surveys/tests/surveys.editor-logic.test.tsx
git commit -m "test: preserve studio survey editor roundtrip through graphql adapter"
```

### Task 7: End-to-End-Gates und Architekturdoku nachziehen

**Files:**
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

- [x] **Step 1: Architekturdoku aktualisieren**

```md
- Survey-Integration verwendet einen expliziten GraphQL-Adapter zwischen Studio-Domäne und Mainserver-`SurveyPoll`.
- Studio-only-Felder werden bis zu einer Mainserver-Schema-Erweiterung kontrolliert im Survey-`payload` serialisiert.
- Moderationsmutationen sind auf die vom Snapshot erlaubten `SurveyFreeTextInput`-Operationen begrenzt.
```

- [x] **Step 2: Kleinsten relevanten Unit-Gate-Pfad ausführen**

Run: `pnpm nx run plugin-surveys:test:unit --testFiles=tests/surveys.api.test.ts --testFiles=tests/surveys.editor.shared.test.ts --testFiles=tests/surveys.editor-logic.test.tsx`
Expected: PASS

Run: `pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/survey-mappers.test.ts --testFiles=src/server/service.test.ts --testFiles=src/server/surveys-route.test.ts`
Expected: PASS

- [x] **Step 3: Type-Gates ausführen**

Run: `pnpm nx run plugin-surveys:test:types`
Expected: PASS

Run: `pnpm nx run sva-mainserver:test:types`
Expected: PASS

- [x] **Step 4: Server-Runtime-Gate für Mainserver-Paket ausführen**

Run: `pnpm nx run sva-mainserver:check:runtime`
Expected: PASS

- [x] **Step 5: Optionalen erweiterten Survey-Scope messen**

Run: `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main`
Expected: transparenter Scope; nur bei kleinem Scope weiter mit affected-Run

- [ ] **Step 6: Abschluss-Commit**

```bash
git add docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md docs/architecture/08-cross-cutting-concepts.md docs/architecture/11-risks-and-technical-debt.md
git commit -m "docs: document survey graphql adapter contract"
```

## Hinweise und Risiken

- `payload` ist hier bewusst Übergangs- und Adapterfläche, nicht automatisch langfristig kanonisches Fachmodell.
- Wenn der Mainserver später echte Felder für `resultVisibility`, `showResultsInApp`, `privacyNotice` oder `transparencyNotice` bekommt, muss der Adapter schrittweise von `payload` zurück auf native Felder migriert werden.
- Der DELETE-Pfad für Freitextantworten ist mit dem aktuellen Snapshot nicht sauber abbildbar; eine temporäre Deaktivierung ist besser als ein scheinbar erfolgreicher, aber ungültiger Mutationspfad.
- `SurveyPoll.date` muss vor der Umsetzung konkret gegen die echte `DateInput`-/`Date`-Struktur geprüft werden; falls sie nicht `startDate`/`endDate` nutzt, ist Task 4 auf die tatsächlichen Snapshot-Felder anzupassen.

## Self-Review

- Spec coverage: Der Plan deckt Read-Vertrag, Write-Vertrag, Moderation, Plugin-Roundtrip, Tests und Doku ab.
- Placeholder scan: Es gibt keine `TODO`-/`TBD`-Platzhalter; offene Unsicherheit zu `DateInput` ist explizit als Prüfpunkt ausgewiesen.
- Type consistency: Alle Tasks verwenden konsistent `SurveyPoll`, `payload`, `freeTextResponses`, `resultVisibility`, `showResultsInApp`.

Plan complete and saved to `docs/superpowers/plans/2026-07-02-survey-graphql-adapter-alignment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
