import {
  validateCatalogManifest,
  type CatalogDraft,
  type CatalogEditorData,
  type CatalogOverview,
  type CatalogRelease,
} from '@sva/plugin-sdk/app-translations';
import { catalogSealIssues } from './catalog.editor.js';
import {
  type CatalogPageModel,
  draftDetails,
  errorCode,
  type TranslationJob,
} from './catalog.page.state.js';
export const mutate = async (
  model: CatalogPageModel,
  operation: Record<string, unknown>
): Promise<boolean> => {
  const {
    overview,
    setOverview,

    setContractId,
    setData,
    setPreviews,
    setDirty,
    busy,
    setBusy,
    setError,
    setNotice,
    setSealIssues,

    catalog,
  } = model;

  if (!overview || busy) return false;
  setBusy(true);
  setError('');
  setNotice('');
  try {
    const result = await catalog<CatalogDraft | CatalogRelease>(operation, overview.scope);
    const nextContract = 'manifest' in result ? result.manifest.contractId : result.contractId;
    const nextData = await catalog<CatalogEditorData>(
      { operation: 'read', contractId: nextContract },
      overview.scope
    );
    const nextOverview = await catalog<CatalogOverview>({ operation: 'overview' }, overview.scope);
    setOverview(nextOverview);
    setContractId(nextContract);
    setData(nextData);
    setDirty(false);
    if ('state' in result && result.state === 'sealed')
      setPreviews((current) => ({
        ...current,
        [result.id]: { status: 'ready', release: result },
      }));
    setSealIssues([]);
    setNotice('state' in result && result.state === 'sealed' ? 'sealed' : 'saved');
    return true;
  } catch (reason) {
    setError(errorCode(reason));
    return false;
  } finally {
    setBusy(false);
  }
};

export const translate = async (model: CatalogPageModel, options: Record<string, unknown>) => {
  const {
    overview,
    contractId,
    data,
    dirty,
    busy,
    setBusy,
    setError,
    setNotice,
    setJob,
    setRecentJobId,
    setJobVersion,
    catalog,
    jobActive,
  } = model;

  if (!overview || !data || busy || dirty || jobActive) return false;
  setBusy(true);
  setError('');
  setNotice('');
  try {
    const current = await catalog<TranslationJob>(
      {
        operation: 'translate',
        contractId,
        expectedRevision: data.draft.draftRevision,
        ...options,
      },
      overview.scope
    );
    setJob(current);
    if (current) {
      setRecentJobId(current.id);
      setJobVersion((value) => value + 1);
    } else setNotice('nothingToTranslate');
    return true;
  } catch (reason) {
    setError(errorCode(reason));
    return false;
  } finally {
    setBusy(false);
  }
};

export const importFile = async (model: CatalogPageModel, file: File | undefined) => {
  const { overview, setError } = model;

  if (!file || !overview) return;
  if (file.size > 1048576) {
    setError('invalid_catalog');
    return;
  }
  try {
    const manifest = validateCatalogManifest(JSON.parse(await file.text()));
    const revision =
      overview.catalogs.find((row) => row.contractId === manifest.contractId)?.draftRevision ?? '0';
    await mutate(model, {
      operation: 'import',
      manifest,
      expectedRevision: revision,
      locales: ['de'],
    });
  } catch {
    setError('invalid_catalog');
  }
};

export const applyBase = async (model: CatalogPageModel) => {
  const { contractId, data, setBaseId, setChoosingBase, selectedBase, existingDraft } = model;

  if (!selectedBase || (existingDraft && !data)) return;
  const saved = await mutate(
    model,
    existingDraft && data
      ? {
          operation: 'changeBase',
          contractId,
          expectedRevision: data.draft.draftRevision,
          baseReleaseId: selectedBase.id,
          locales: ['de'],
        }
      : {
          operation: 'createMunicipal',
          baseReleaseId: selectedBase.id,
          locales: ['de'],
        }
  );
  if (saved) {
    setChoosingBase(false);
    setBaseId('');
  }
};

export const seal = async (model: CatalogPageModel) => {
  const { contractId, data, setBusy, setSealIssues, sourceOnly } = model;

  if (!data || !draftDetails(model).canSeal) return;
  setBusy(true);
  try {
    const issues = await catalogSealIssues(data, sourceOnly);
    setSealIssues(issues);
    if (issues.length) return;
    await mutate(model, {
      operation: 'seal',
      contractId,
      expectedRevision: data.draft.draftRevision,
    });
  } finally {
    setBusy(false);
  }
};

export const reloadCatalog = (model: CatalogPageModel) => {
  const { setReload, setEditorVersion } = model;

  setEditorVersion((value) => value + 1);
  setReload((value) => value + 1);
};
