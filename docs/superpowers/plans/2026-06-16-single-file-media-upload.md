# Single-File Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervollstaendige den bestehenden Media-Upload-Vertrag im Frontend, sodass `/admin/media` eine einzelne Datei ueber `initialize -> PUT -> complete` hochlaedt und anschliessend direkt in die Asset-Detailansicht navigiert.

**Architecture:** Der bestehende Backend-Vertrag bleibt unveraendert: `initialize upload` erzeugt `pending`-Asset und `uploadSession`, der Browser laedt direkt an die signierte URL, `complete upload` validiert und finalisiert das Asset. Im Frontend wird ein klar getrennter Upload-Orchestrator eingefuehrt, der API-Client, Browser-Upload, Logging, Fehlerzustand und Navigation zusammenhaelt, ohne die Bibliotheksseite mit Netzlogik zu ueberladen.

**Tech Stack:** TypeScript strict mode, React 19, TanStack Router, Vitest, Testing Library, Nx, bestehende IAM-Media-API, Browser `fetch`/`XMLHttpRequest` fuer Single-File-Upload, i18n-Ressourcen in `de` und `en`

---

## File Structure

- `apps/sva-studio-react/src/lib/iam-api.ts`
  - Bestehenden Media-API-Client um `completeMediaUpload(...)` und die zugehoerige Response erweitern
- `apps/sva-studio-react/src/lib/iam-api.media.test.ts`
  - Verifiziert Request-Form, URL und Payload des neuen `complete`-Clients
- `apps/sva-studio-react/src/hooks/use-media.ts`
  - Enthaelt den neuen Frontend-Orchestrator fuer `initialize -> PUT -> complete`
- `apps/sva-studio-react/src/hooks/use-media.test.tsx`
  - Deckt Upload-Orchestrierung, Logging, getrennte Fehlerphasen und Erfolgspfad ab
- `apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx`
  - Bindet Dateiauswahl an den Upload-Orchestrator und rendert Upload-Zustaende
- `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
  - Hae ngt Erfolg/Navigation und Seiteneinbindung des neuen Upload-States an
- `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
  - Testet Bibliotheks-Upload-UI und Fehler-/Ladezustaende
- `apps/sva-studio-react/src/i18n/resources/de/media.resources.ts`
  - Neue Texte fuer Uploading, Finalizing und Fehlerfaelle
- `apps/sva-studio-react/src/i18n/resources/en/media.resources.ts`
  - Englische Spiegelung der neuen Texte
- `apps/sva-studio-react/e2e/media-management.spec.ts`
  - Happy Path und mindestens ein Fehlerpfad fuer den neuen Enduser-Upload

### Task 1: API Client Fuer Upload-Completion

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Test: `apps/sva-studio-react/src/lib/iam-api.media.test.ts`

- [ ] **Step 1: Write the failing API-client test for upload completion**

Add a new test case in `apps/sva-studio-react/src/lib/iam-api.media.test.ts` that verifies a `POST` request to `/api/v1/iam/media/upload-sessions/upload-1/complete` with no body and the standard IAM headers.

```ts
it('completes a media upload session', async () => {
  fetchMock.mockResolvedValue(
    createJsonResponse({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        status: 'processed',
      },
    })
  );

  await completeMediaUpload('upload-1');

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/iam/media/upload-sessions/upload-1/complete',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Accept: 'application/json',
      }),
    })
  );
});
```

- [ ] **Step 2: Run the focused API test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/sva-studio-react/src/lib/iam-api.media.test.ts
```

Expected: FAIL because `completeMediaUpload` does not exist yet.

- [ ] **Step 3: Add the response type and API client**

Extend `apps/sva-studio-react/src/lib/iam-api.ts` with a dedicated response type and client function near `initializeMediaUpload`.

```ts
export type CompleteMediaUploadResponse = Readonly<{
  assetId: string;
  uploadSessionId: string;
  status: string;
}>;

export const completeMediaUpload = async (
  uploadSessionId: string
): Promise<ApiItemResponse<CompleteMediaUploadResponse>> =>
  requestJson<ApiItemResponse<CompleteMediaUploadResponse>>(
    `/api/v1/iam/media/upload-sessions/${uploadSessionId}/complete`,
    {
      method: 'POST',
      headers: IAM_HEADERS,
    }
  );
```

- [ ] **Step 4: Re-run the focused API test**

Run:

```bash
pnpm exec vitest run apps/sva-studio-react/src/lib/iam-api.media.test.ts
```

Expected: PASS with the new `completeMediaUpload` case green.

- [ ] **Step 5: Commit the API-client slice**

```bash
git add apps/sva-studio-react/src/lib/iam-api.ts apps/sva-studio-react/src/lib/iam-api.media.test.ts
git commit -m "feat: add media upload completion api client"
```

### Task 2: Upload-Orchestrator Hook Mit Logging Und Fehlerphasen

**Files:**
- Modify: `apps/sva-studio-react/src/hooks/use-media.ts`
- Test: `apps/sva-studio-react/src/hooks/use-media.test.tsx`

- [ ] **Step 1: Write failing hook tests for the new orchestration flow**

Add tests in `apps/sva-studio-react/src/hooks/use-media.test.tsx` for:
- success path `initialize -> put -> complete`
- initialize failure
- PUT failure
- complete failure

Model the probe with a dedicated hook result instead of reusing `useCreateMediaUpload`.

```tsx
it('uploads a single file through initialize put and complete', async () => {
  initializeMediaUploadMock.mockResolvedValue({
    data: {
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      uploadUrl: 'https://uploads.example.test/asset-1',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2026-06-16T12:00:00.000Z',
      status: 'pending',
      initializedAt: '2026-06-16T11:00:00.000Z',
    },
  });
  completeMediaUploadMock.mockResolvedValue({
    data: {
      assetId: 'asset-1',
      uploadSessionId: 'upload-1',
      status: 'processed',
    },
  });
  uploadTransportMock.mockResolvedValue(undefined);

  render(<SingleFileUploadProbe />);

  fireEvent.change(screen.getByTestId('file-input'), {
    target: { files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })] },
  });

  await waitFor(() => {
    expect(screen.getByTestId('upload-status').textContent).toBe('success');
  });
});
```

- [ ] **Step 2: Run the focused hook test file to verify the new cases fail**

Run:

```bash
pnpm exec vitest run apps/sva-studio-react/src/hooks/use-media.test.tsx
```

Expected: FAIL because `completeMediaUpload` and the new upload hook/orchestrator do not exist.

- [ ] **Step 3: Introduce a focused single-file upload result model**

Add a new result type in `use-media.ts` that keeps orchestration state separate from the existing `useCreateMediaUpload`.

```ts
type SingleFileUploadPhase =
  | 'idle'
  | 'initializing'
  | 'uploading'
  | 'finalizing'
  | 'success'
  | 'error';

type UseSingleFileMediaUploadResult = {
  readonly phase: SingleFileUploadPhase;
  readonly error: IamHttpError | Error | null;
  readonly assetId: string | null;
  readonly uploadSessionId: string | null;
  readonly uploadFile: (file: File) => Promise<{ assetId: string } | null>;
  readonly reset: () => void;
};
```

- [ ] **Step 4: Implement the upload transport and orchestration logic**

Add a small internal transport in `use-media.ts` and a new hook such as `useSingleFileMediaUpload`.

```ts
const putFileToSignedUrl = async (input: {
  uploadUrl: string;
  method: string;
  headers: Readonly<Record<string, string>>;
  file: File;
}) => {
  const response = await fetch(input.uploadUrl, {
    method: input.method,
    headers: input.headers,
    body: input.file,
  });

  if (!response.ok) {
    throw new Error(`media_upload_put_failed:${response.status}`);
  }
};
```

```ts
const uploadFile = React.useCallback(async (file: File) => {
  setPhase('initializing');
  setError(null);

  const initialized = await initializeMediaUpload({
    mediaType: file.type.startsWith('image/') ? 'image' : undefined,
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    visibility: 'protected',
  });

  setAssetId(initialized.data.assetId);
  setUploadSessionId(initialized.data.uploadSessionId);
  setPhase('uploading');

  await putFileToSignedUrl({
    uploadUrl: initialized.data.uploadUrl,
    method: initialized.data.method,
    headers: initialized.data.headers,
    file,
  });

  setPhase('finalizing');
  const completed = await completeMediaUpload(initialized.data.uploadSessionId);
  setPhase('success');
  return { assetId: completed.data.assetId };
}, []);
```

- [ ] **Step 5: Add phase-specific logging and error mapping**

Use the existing browser-operation logger in `use-media.ts` to emit separate events for initialize, PUT, complete, and success. Keep URLs and file content out of logs.

```ts
logBrowserOperationStart(mediaLogger, 'media_upload_put_started', {
  operation: 'put_media_upload',
  asset_id: initialized.data.assetId,
  upload_session_id: initialized.data.uploadSessionId,
});
```

```ts
logBrowserOperationFailure(mediaLogger, 'media_upload_complete_failed', resolvedError, {
  operation: 'complete_media_upload',
  asset_id: currentAssetId,
  upload_session_id: currentUploadSessionId,
});
```

- [ ] **Step 6: Re-run the focused hook tests**

Run:

```bash
pnpm exec vitest run apps/sva-studio-react/src/hooks/use-media.test.tsx
```

Expected: PASS for the new orchestration coverage, including separated error phases.

- [ ] **Step 7: Commit the hook slice**

```bash
git add apps/sva-studio-react/src/hooks/use-media.ts apps/sva-studio-react/src/hooks/use-media.test.tsx
git commit -m "feat: orchestrate single file media upload"
```

### Task 3: Bibliotheks-UI An Den Upload-Flow Anschliessen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources/de/media.resources.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources/en/media.resources.ts`
- Test: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`

- [ ] **Step 1: Write failing UI tests for file selection and state feedback**

Extend `-media-library-page.test.tsx` to cover:
- hidden file input triggered from the CTA
- visible upload state text for `uploading` and `finalizing`
- phase-specific error rendering

```tsx
it('shows the upload progress state inside the intake shelf', () => {
  useSingleFileMediaUploadMock.mockReturnValue({
    phase: 'uploading',
    error: null,
    assetId: 'asset-1',
    uploadSessionId: 'upload-1',
    uploadFile: vi.fn(),
    reset: vi.fn(),
  });

  render(<MediaLibraryPage />);

  expect(screen.getByText('Datei wird hochgeladen …')).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused library-page tests to verify failure**

Run:

```bash
pnpm exec vitest run --config apps/sva-studio-react/vitest.routes.config.ts apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx
```

Expected: FAIL because the intake shelf does not yet use the new hook or status copy.

- [ ] **Step 3: Wire the upload hook into the media library page**

Keep network orchestration out of the shelf component. Instantiate the hook in `-media-library-page.tsx` and pass down focused props.

```tsx
const singleFileUpload = useSingleFileMediaUpload();

<MediaIntakeShelf
  phase={singleFileUpload.phase}
  error={singleFileUpload.error}
  onFileSelected={(file) => void singleFileUpload.uploadFile(file)}
/>
```

- [ ] **Step 4: Extend the intake shelf with hidden file input and phase UI**

Modify `-media-intake-shelf.tsx` to:
- keep the main CTA
- add a hidden single-file input
- translate the CTA click into `input.click()`
- show upload/finalizing/error copy beneath the CTA

```tsx
const inputRef = React.useRef<HTMLInputElement | null>(null);

<input
  ref={inputRef}
  hidden
  accept="image/jpeg,image/png,image/webp"
  data-testid="media-upload-input"
  type="file"
  onChange={(event) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    event.currentTarget.value = '';
  }}
/>
```

```tsx
{phase === 'uploading' ? <p>{t('media.library.upload.uploading')}</p> : null}
{phase === 'finalizing' ? <p>{t('media.library.upload.finalizing')}</p> : null}
{phase === 'error' && error ? <p>{t('media.library.upload.error')}</p> : null}
```

- [ ] **Step 5: Add the new i18n keys**

Extend both locale files with focused upload state keys.

```ts
upload: {
  uploading: 'Datei wird hochgeladen …',
  finalizing: 'Upload wird abgeschlossen …',
  error: 'Der Upload konnte nicht abgeschlossen werden.',
}
```

- [ ] **Step 6: Navigate to the detail page after success**

Use TanStack Router navigation in `-media-library-page.tsx` to move into `/admin/media/$mediaId` once the hook resolves successfully.

```tsx
const navigate = useNavigate();

const handleFileSelected = async (file: File) => {
  const result = await singleFileUpload.uploadFile(file);
  if (result) {
    await navigate({ to: '/admin/media/$mediaId', params: { mediaId: result.assetId } });
  }
};
```

- [ ] **Step 7: Re-run the focused library UI test**

Run:

```bash
pnpm exec vitest run --config apps/sva-studio-react/vitest.routes.config.ts apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx
```

Expected: PASS with CTA, input handling, state feedback, and navigation behavior covered.

- [ ] **Step 8: Commit the UI slice**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx apps/sva-studio-react/src/i18n/resources/de/media.resources.ts apps/sva-studio-react/src/i18n/resources/en/media.resources.ts
git commit -m "feat: connect media library intake to upload flow"
```

### Task 4: End-To-End Nachweis Und Dokumentation

**Files:**
- Modify: `apps/sva-studio-react/e2e/media-management.spec.ts`
- Modify: `docs/guides/media-management.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`

- [ ] **Step 1: Write or update the E2E happy path**

Extend `apps/sva-studio-react/e2e/media-management.spec.ts` so the test no longer stops at upload initialization. Mock the signed upload endpoint and the `complete` endpoint.

```ts
await page.route('https://uploads.example.test/**', async (route) => {
  await route.fulfill({ status: 200, body: '' });
});
```

```ts
if (path === '/api/v1/iam/media/upload-sessions/upload-1/complete' && method === 'POST') {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        status: 'processed',
      },
    }),
  });
  return;
}
```

- [ ] **Step 2: Add one end-to-end error-path check**

Add a second E2E case where the signed `PUT` upload fails and verify that the user stays on `/admin/media` with a visible upload error.

```ts
await page.route('https://uploads.example.test/**', async (route) => {
  await route.fulfill({ status: 500, body: '' });
});

await expect(page.getByText('Der Upload konnte nicht abgeschlossen werden.')).toBeVisible();
await expect(page).toHaveURL(/\/admin\/media/);
```

- [ ] **Step 3: Run the focused media E2E spec**

Run:

```bash
pnpm nx run sva-studio-react:test:e2e --grep "media management"
```

Expected: PASS for the media upload happy path and the explicit upload failure path.

- [ ] **Step 4: Update the user-facing and architecture docs**

Document the completed front-end flow in `docs/guides/media-management.md` and add a short architecture note that the browser now completes the signed upload flow through `initialize -> PUT -> complete`.

```md
1. Datei in `/admin/media` auswählen
2. Studio initialisiert den Upload im Host
3. Browser lädt die Datei an den signierten Storage-Pfad
4. Host validiert und finalisiert das Asset
5. Studio öffnet direkt die Mediendetailansicht
```

- [ ] **Step 5: Run the smallest relevant verification suite**

Run:

```bash
pnpm exec vitest run apps/sva-studio-react/src/lib/iam-api.media.test.ts
pnpm exec vitest run apps/sva-studio-react/src/hooks/use-media.test.tsx
pnpm exec vitest run --config apps/sva-studio-react/vitest.routes.config.ts apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx
pnpm nx run sva-studio-react:test:e2e --grep "media management"
```

Expected: PASS across API, hook, route UI, and media E2E coverage.

- [ ] **Step 6: Commit docs and verification slice**

```bash
git add apps/sva-studio-react/e2e/media-management.spec.ts docs/guides/media-management.md docs/architecture/05-building-block-view.md docs/architecture/08-cross-cutting-concepts.md
git commit -m "docs: describe single file media upload flow"
```

## Self-Review

- Spec coverage:
  - direkter Single-File-Upload aus `/admin/media`: Task 2 und Task 3
  - Minimalpersistenz ueber bestehenden Vertrag: Task 2 nutzt bewusst `initialize -> PUT -> complete`
  - getrennte Fehlerpfade: Task 2 und Task 3
  - Logging: Task 2
  - Testabdeckung und Doku: Task 4
- Placeholder scan:
  - keine `TBD`-/`TODO`-Platzhalter im Plan
  - alle Schritte nennen konkrete Dateien und Kommandos
- Type consistency:
  - `CompleteMediaUploadResponse`, `useSingleFileMediaUpload`, `phase`, `assetId`, `uploadSessionId` werden im ganzen Plan konsistent verwendet

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-16-single-file-media-upload.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
