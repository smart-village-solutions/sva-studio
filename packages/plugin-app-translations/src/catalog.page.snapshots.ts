import { type CatalogRelease } from '@sva/plugin-sdk/app-translations';
import { requestCatalogDownload } from './catalog.api.js';
import { type CatalogPageModel, errorCode } from './catalog.page.state.js';
export const downloadTexts = async (model: CatalogPageModel, releaseId: string) => {
  const { overview, setError, setDownloadingId, setNotice, downloadController, sourceOnly } = model;

  if (!overview) return;
  downloadController.current?.abort();
  const controller = new AbortController();
  downloadController.current = controller;
  setDownloadingId(releaseId);
  setError('');
  setNotice('');
  try {
    const blob = await requestCatalogDownload(
      releaseId,
      overview.scope,
      controller.signal,
      sourceOnly ? 'source' : 'translations'
    );
    if (controller.signal.aborted) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'texts.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice('downloadedTexts');
  } catch (cause) {
    if (!controller.signal.aborted) setError(errorCode(cause));
  } finally {
    if (!controller.signal.aborted) setDownloadingId(null);
  }
};

export const loadPreview = async (model: CatalogPageModel, id: string) => {
  const { overview, previews, setPreviews, setError, catalog } = model;

  if (!overview || previews[id]?.status === 'loading' || previews[id]?.status === 'ready') return;
  setPreviews((current) => ({ ...current, [id]: { status: 'loading' } }));
  try {
    const release = await catalog<CatalogRelease>(
      { operation: 'readRelease', releaseId: id },
      overview.scope
    );
    setPreviews((current) => ({ ...current, [id]: { status: 'ready', release } }));
  } catch (reason) {
    setPreviews((current) => ({ ...current, [id]: { status: 'error' } }));
    setError(errorCode(reason));
  }
};
