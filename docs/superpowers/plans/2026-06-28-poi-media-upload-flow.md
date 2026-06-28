# POI Media Upload Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Medium hochladen` in the POI editor follow the same upload phases as the media library and finish by attaching the uploaded image to the POI `mediaContents`.

**Architecture:** Keep `plugin-poi` decoupled from app-only media hooks. `PoiDetailPage` continues to provide an `onUploadFile` adapter backed by `uploadHostMediaFile`, while `PoiDetailMediaTab` owns UI state, error presentation, and appending the returned asset as a POI media entry.

**Tech Stack:** React, TypeScript, `react-hook-form`, `@sva/plugin-sdk`, `@sva/studio-ui-react`, Vitest, Testing Library, Nx/pnpm.

---

## File Structure

- Modify `packages/plugin-poi/src/poi.detail-media-tab.tsx`
  - Owns the media entry UI, media library dialog, upload button, upload phase state, and error display.
  - Add an upload phase union, error state, supported image MIME validation, and a small status renderer mirroring the media library states.
- Modify `packages/plugin-poi/src/poi.detail-page.tsx`
  - Keep the `uploadHostMediaFile` adapter.
  - Treat "uploaded but not found after asset refresh" as a hard upload failure by throwing an error instead of returning `null`.
- Modify `packages/plugin-poi/src/plugin.translations.de.ts`
  - Add German upload phase/error texts under existing `actions`/`messages`.
- Modify `packages/plugin-poi/src/plugin.translations.en.ts`
  - Add English upload phase/error texts under existing `actions`/`messages`.
- Modify `packages/plugin-poi/tests/poi.detail-page.test.tsx`
  - Add integration-style tests for successful upload-to-POI assignment and upload failure behavior.
- Optionally modify `packages/plugin-poi/tests/poi.pages.test.tsx`
  - Only if existing page-level assertions need the new labels. Do not broaden coverage unnecessarily.

## Task 1: Add Failing Tests For Upload Success And Failure

**Files:**
- Modify: `packages/plugin-poi/tests/poi.detail-page.test.tsx`

- [ ] **Step 1: Add translations used by the new upload states**

In the `labels` object in `packages/plugin-poi/tests/poi.detail-page.test.tsx`, keep the existing media labels and add these keys near the other `poi.actions`/`poi.messages` entries:

```ts
'poi.messages.mediaUploadInitializing': 'Upload wird vorbereitet.',
'poi.messages.mediaUploadUploading': 'Medium wird hochgeladen.',
'poi.messages.mediaUploadFinalizing': 'Upload wird abgeschlossen.',
'poi.messages.mediaUploadSuccess': 'Medium wurde hochgeladen und zugeordnet.',
'poi.messages.mediaUploadError': 'Das Medium konnte nicht hochgeladen werden.',
'poi.messages.mediaUploadUnsupportedType': 'Nur JPG, PNG und WebP können hochgeladen werden.',
```

- [ ] **Step 2: Add a success test that uploads and saves a POI image**

Add this test after `creates poi items with selected library images in mediaContents` in `packages/plugin-poi/tests/poi.detail-page.test.tsx`:

```ts
it('uploads media files and assigns the uploaded image to created poi items', async () => {
  const uploadedFile = new File(['image-bytes'], 'upload-rathaus.webp', { type: 'image/webp' });

  vi.mocked(uploadHostMediaFile).mockResolvedValueOnce({
    assetId: 'asset-uploaded',
    uploadSessionId: 'upload-session-1',
  } as never);
  vi.mocked(listHostMediaAssets)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
      {
        id: 'asset-uploaded',
        fileName: 'upload-rathaus.webp',
        mimeType: 'image/webp',
        previewUrl: 'https://cdn.example.test/upload-rathaus.webp',
        metadata: { title: 'Upload Rathaus', copyright: 'Stadt Musterhausen' },
      },
    ] as never);
  vi.mocked(createPoi).mockResolvedValueOnce({
    id: 'poi-created',
    name: 'Neuer POI',
  } as never);

  render(<PoiDetailPage mode="create" instanceId="de-musterhausen" />);

  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
  switchSection('content');
  fireEvent.change(screen.getByLabelText('Medium hochladen'), { target: { files: [uploadedFile] } });

  await waitFor(() => {
    expect(vi.mocked(uploadHostMediaFile)).toHaveBeenCalledWith({
      fetch: expect.any(Function),
      file: uploadedFile,
      mediaType: 'image',
      visibility: 'public',
      instanceId: 'de-musterhausen',
    });
    expect(screen.getByText('Medium wurde hochgeladen und zugeordnet.')).toBeTruthy();
    expect(screen.getByDisplayValue('https://cdn.example.test/upload-rathaus.webp')).toBeTruthy();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

  await waitFor(() => {
    expect(vi.mocked(createPoi)).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaContents: [
          expect.objectContaining({
            captionText: 'Upload Rathaus',
            copyright: 'Stadt Musterhausen',
            contentType: 'image',
            sourceUrl: {
              url: 'https://cdn.example.test/upload-rathaus.webp',
              description: 'upload-rathaus.webp',
            },
          }),
        ],
      })
    );
  });
});
```

- [ ] **Step 3: Add a failure test that leaves mediaContents unchanged**

Add this test directly after the success test:

```ts
it('keeps poi mediaContents unchanged when media upload fails', async () => {
  const failedFile = new File(['image-bytes'], 'broken-rathaus.png', { type: 'image/png' });

  vi.mocked(uploadHostMediaFile).mockRejectedValueOnce(new Error('upload boom'));

  render(<PoiDetailPage mode="create" />);

  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
  switchSection('content');
  fireEvent.change(screen.getByLabelText('Medium hochladen'), { target: { files: [failedFile] } });

  await waitFor(() => {
    expect(screen.getByText('Das Medium konnte nicht hochgeladen werden.')).toBeTruthy();
  });

  expect(screen.queryByDisplayValue('broken-rathaus.png')).toBeNull();
});
```

- [ ] **Step 4: Run the new tests and confirm they fail**

Run:

```bash
pnpm exec vitest run tests/poi.detail-page.test.tsx --config vitest.config.ts --reporter=verbose
```

from:

```bash
packages/plugin-poi
```

Expected result: the new success test fails because the file input has no accessible label or the success state is not rendered yet; the failure test fails because upload errors are not displayed yet.

## Task 2: Add Upload State And Accessible Upload Input

**Files:**
- Modify: `packages/plugin-poi/src/poi.detail-media-tab.tsx`
- Modify: `packages/plugin-poi/src/plugin.translations.de.ts`
- Modify: `packages/plugin-poi/src/plugin.translations.en.ts`

- [ ] **Step 1: Add upload phase and supported file helpers**

Near the existing helper constants in `packages/plugin-poi/src/poi.detail-media-tab.tsx`, add:

```ts
type MediaUploadPhase = 'idle' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error';

const acceptedUploadMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isSupportedUploadFile = (file: File): boolean => acceptedUploadMimeTypes.has(file.type);

const uploadPhaseMessageKey = (phase: MediaUploadPhase): string | null => {
  switch (phase) {
    case 'initializing':
      return 'messages.mediaUploadInitializing';
    case 'uploading':
      return 'messages.mediaUploadUploading';
    case 'finalizing':
      return 'messages.mediaUploadFinalizing';
    case 'success':
      return 'messages.mediaUploadSuccess';
    case 'error':
      return 'messages.mediaUploadError';
    case 'idle':
      return null;
  }
};
```

- [ ] **Step 2: Replace the boolean upload state with phase and error state**

In `PoiDetailMediaTab`, replace:

```ts
const [uploading, setUploading] = React.useState(false);
```

with:

```ts
const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
const [uploadPhase, setUploadPhase] = React.useState<MediaUploadPhase>('idle');
const [uploadErrorKey, setUploadErrorKey] = React.useState<string | null>(null);
const uploadMessageKey = uploadErrorKey ?? uploadPhaseMessageKey(uploadPhase);
const uploadBusy =
  uploadPhase === 'initializing' || uploadPhase === 'uploading' || uploadPhase === 'finalizing';
```

- [ ] **Step 3: Update `handleUploadChange` to run explicit phases**

Replace the current `handleUploadChange` callback with:

```ts
const handleUploadChange = React.useCallback(
  async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!isSupportedUploadFile(file)) {
      setUploadPhase('error');
      setUploadErrorKey('messages.mediaUploadUnsupportedType');
      return;
    }

    setUploadPhase('initializing');
    setUploadErrorKey(null);
    try {
      setUploadPhase('uploading');
      const asset = await onUploadFile(file);
      setUploadPhase('finalizing');
      append(mediaContentFromAsset(asset));
      setUploadPhase('success');
    } catch {
      setUploadPhase('error');
      setUploadErrorKey('messages.mediaUploadError');
    }
  },
  [append, onUploadFile]
);
```

This assumes Task 3 changes `onUploadFile` to reject when no asset is available after refresh.

- [ ] **Step 4: Replace the label-wrapped file input with a button and accessible hidden input**

Replace the current upload label block:

```tsx
<label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground">
  {uploading ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
  <input className="sr-only" type="file" accept="image/*" onChange={(event) => void handleUploadChange(event)} />
</label>
```

with:

```tsx
<input
  ref={uploadInputRef}
  aria-label={pt('actions.uploadMedia')}
  className="sr-only"
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={(event) => void handleUploadChange(event)}
/>
<Button
  type="button"
  variant="outline"
  disabled={uploadBusy}
  onClick={() => uploadInputRef.current?.click()}
>
  {uploadBusy ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
</Button>
```

- [ ] **Step 5: Render upload status below the action row**

Immediately after the action row `</div>` that contains the three media buttons, add:

```tsx
{uploadMessageKey ? (
  <p
    className={`text-sm font-medium ${
      uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'
    }`}
  >
    {pt(uploadMessageKey)}
  </p>
) : null}
```

- [ ] **Step 6: Add production translations**

In `packages/plugin-poi/src/plugin.translations.de.ts`, add these message keys in the existing `messages` object:

```ts
mediaUploadInitializing: 'Upload wird vorbereitet.',
mediaUploadUploading: 'Medium wird hochgeladen.',
mediaUploadFinalizing: 'Upload wird abgeschlossen.',
mediaUploadSuccess: 'Medium wurde hochgeladen und zugeordnet.',
mediaUploadError: 'Das Medium konnte nicht hochgeladen werden.',
mediaUploadUnsupportedType: 'Nur JPG, PNG und WebP können hochgeladen werden.',
```

In `packages/plugin-poi/src/plugin.translations.en.ts`, add:

```ts
mediaUploadInitializing: 'Preparing upload.',
mediaUploadUploading: 'Uploading media.',
mediaUploadFinalizing: 'Finalizing upload.',
mediaUploadSuccess: 'Media was uploaded and assigned.',
mediaUploadError: 'The media upload failed.',
mediaUploadUnsupportedType: 'Only JPG, PNG, and WebP can be uploaded.',
```

- [ ] **Step 7: Run the POI detail-page tests**

Run:

```bash
pnpm exec vitest run tests/poi.detail-page.test.tsx --config vitest.config.ts --reporter=verbose
```

from:

```bash
packages/plugin-poi
```

Expected result: the failure test should pass; the success test may still fail if `PoiDetailPage.uploadMediaFile` returns `null` when the refreshed asset is not found.

## Task 3: Make The Page Adapter Fail Closed When The Uploaded Asset Cannot Be Resolved

**Files:**
- Modify: `packages/plugin-poi/src/poi.detail-page.tsx`
- Test: `packages/plugin-poi/tests/poi.detail-page.test.tsx`

- [ ] **Step 1: Change the upload callback return contract**

In `packages/plugin-poi/src/poi.detail-page.tsx`, replace the end of `uploadMediaFile`:

```ts
const assets = await refreshMediaAssets();
return assets.find((asset) => asset.id === uploaded.assetId) ?? null;
```

with:

```ts
const assets = await refreshMediaAssets();
const uploadedAsset = assets.find((asset) => asset.id === uploaded.assetId);
if (!uploadedAsset) {
  throw new Error('poi_media_uploaded_asset_not_found');
}
return uploadedAsset;
```

- [ ] **Step 2: Tighten the media tab prop type**

In `packages/plugin-poi/src/poi.detail-media-tab.tsx`, change the prop type:

```ts
onUploadFile: (file: File) => Promise<HostMediaAssetListItem | null>;
```

to:

```ts
onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
```

If `packages/plugin-poi/src/poi.detail-content-tab.tsx` still declares the nullable return, change the optional prop fallback from `async () => null` to a throwing function:

```ts
const defaultUploadFile = async (): Promise<HostMediaAssetListItem> => {
  throw new Error('poi_media_upload_unavailable');
};
```

and use it as:

```ts
onUploadFile = defaultUploadFile,
```

- [ ] **Step 3: Add a missing-refreshed-asset test**

Add this test after the upload failure test in `packages/plugin-poi/tests/poi.detail-page.test.tsx`:

```ts
it('shows an upload error when the uploaded media asset is missing after refresh', async () => {
  const uploadedFile = new File(['image-bytes'], 'missing-rathaus.webp', { type: 'image/webp' });

  vi.mocked(uploadHostMediaFile).mockResolvedValueOnce({
    assetId: 'asset-missing',
    uploadSessionId: 'upload-session-1',
  } as never);
  vi.mocked(listHostMediaAssets).mockResolvedValue([] as never);

  render(<PoiDetailPage mode="create" />);

  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Neuer POI' } });
  switchSection('content');
  fireEvent.change(screen.getByLabelText('Medium hochladen'), { target: { files: [uploadedFile] } });

  await waitFor(() => {
    expect(screen.getByText('Das Medium konnte nicht hochgeladen werden.')).toBeTruthy();
  });

  expect(screen.queryByDisplayValue('missing-rathaus.webp')).toBeNull();
});
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/poi.detail-page.test.tsx tests/poi.detail-content-tab.test.tsx --config vitest.config.ts --reporter=verbose
```

from:

```bash
packages/plugin-poi
```

Expected result: all selected tests pass.

## Task 4: Run Package Gates And Commit

**Files:**
- Verify all modified POI files.

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
pnpm exec vitest run tests/poi.detail-page.test.tsx tests/poi.detail-content-tab.test.tsx tests/poi.detail-form.test.ts --config vitest.config.ts --reporter=verbose
```

from:

```bash
packages/plugin-poi
```

Expected: all selected tests pass.

- [ ] **Step 2: Run Nx unit target for plugin-poi**

Run:

```bash
pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-page.test.tsx --testFiles=tests/poi.detail-content-tab.test.tsx --testFiles=tests/poi.detail-form.test.ts
```

from repository root.

Expected: pass. If Nx runs broader tests and a clearly unrelated timeout occurs, record it and keep the direct Vitest result as the focused verification; do not ignore deterministic POI failures.

- [ ] **Step 3: Run plugin-poi type check if available**

Run:

```bash
pnpm nx show project plugin-poi --json
```

If the output lists a `test:types` target, run:

```bash
pnpm nx run plugin-poi:test:types
```

Expected: pass. If no `test:types` target exists, record that the package has no dedicated type target.

- [ ] **Step 4: Inspect staged diff and keep scope clean**

Run:

```bash
git diff --stat
git status --short
```

Expected: only POI media upload flow files plus the previously committed spec/plan should be relevant. Do not stage unrelated local docs or other dirty files unless they are required for this feature.

- [ ] **Step 5: Commit implementation**

Stage only the files touched by this plan:

```bash
git add \
  packages/plugin-poi/src/poi.detail-media-tab.tsx \
  packages/plugin-poi/src/poi.detail-page.tsx \
  packages/plugin-poi/src/poi.detail-content-tab.tsx \
  packages/plugin-poi/src/plugin.translations.de.ts \
  packages/plugin-poi/src/plugin.translations.en.ts \
  packages/plugin-poi/tests/poi.detail-page.test.tsx \
  packages/plugin-poi/tests/poi.detail-content-tab.test.tsx
git commit -m "feat: assign uploaded media to poi"
```

If `poi.detail-content-tab.tsx` or `poi.detail-content-tab.test.tsx` did not change during execution, omit them from `git add`.

## Self-Review

- Spec coverage: upload follows Mediathek-like phases, uses Plugin SDK, assigns uploaded asset to `mediaContents`, handles upload errors, keeps app hooks out of `plugin-poi`, and tests success/failure/save behavior.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: the plan moves `onUploadFile` from nullable return to throwing failure semantics and updates both caller and callee types.
