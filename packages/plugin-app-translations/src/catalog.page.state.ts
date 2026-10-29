import { useRef, useState, useSyncExternalStore } from 'react';
import {
  type CatalogOverview,
  type CatalogEditorData,
  type CatalogRelease,
} from '@sva/plugin-sdk/app-translations';
import { catalogSealIssues } from './catalog.editor.js';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  MainserverApiError,
} from '@sva/plugin-sdk';
import { requestCatalog } from './catalog.api.js';
import { useCatalogLanguages } from './catalog.languages.js';
export const useCatalogDocumentState = () => {
  const [overview, setOverview] = useState<CatalogOverview | null>(null);
  const [contractId, setContractId] = useState('');
  const [data, setData] = useState<CatalogEditorData | null>(null);
  const [previews, setPreviews] = useState<Record<string, ReleasePreview>>({});
  const [baseId, setBaseId] = useState('');
  const [choosingBase, setChoosingBase] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [sealIssues, setSealIssues] = useState<Awaited<ReturnType<typeof catalogSealIssues>>>([]);
  const downloadController = useRef<AbortController | null>(null);
  return {
    overview,
    setOverview,
    contractId,
    setContractId,
    data,
    setData,
    previews,
    setPreviews,
    baseId,
    setBaseId,
    choosingBase,
    setChoosingBase,
    dirty,
    setDirty,
    busy,
    setBusy,
    error,
    setError,
    downloadingId,
    setDownloadingId,
    notice,
    setNotice,
    sealIssues,
    setSealIssues,
    downloadController,
  };
};

export const useCatalogInteractionState = () => {
  const [requestedSelection, setRequestedSelection] = useState<{ locale: string; key: string }>();
  const [reload, setReload] = useState(0);
  const [job, setJob] = useState<TranslationJob>(null);
  const [recentJobId, setRecentJobId] = useState<string | null>(null);
  const [translationCounts, setTranslationCounts] = useState<Record<string, number> | null>(null);
  const [jobVersion, setJobVersion] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  return {
    requestedSelection,
    setRequestedSelection,
    reload,
    setReload,
    job,
    setJob,
    recentJobId,
    setRecentJobId,
    translationCounts,
    setTranslationCounts,
    jobVersion,
    setJobVersion,
    editorVersion,
    setEditorVersion,
  };
};

const basisDetails = (
  overview: CatalogOverview | null,
  contractId: string,
  baseId: string,
  baseReleaseId?: string | null
) => {
  const selectedBase = overview?.bases.find((base) => base.id === baseId);
  const existingDraft = overview?.catalogs.find((row) => row.contractId === contractId);
  const currentBaseId = baseReleaseId ?? existingDraft?.baseReleaseId;
  const currentBase = overview?.bases.find((base) => base.id === currentBaseId);
  const availableBases =
    overview?.bases.filter(
      (base) => !existingDraft || (base.contractId === contractId && base.id !== currentBaseId)
    ) ?? [];
  return { selectedBase, existingDraft, currentBaseId, currentBase, availableBases };
};

export const useCatalogPageModel = (platform: boolean, sourceOnly: boolean) => {
  const state = { ...useCatalogDocumentState(), ...useCatalogInteractionState() };
  const { overview, job, recentJobId, translationCounts } = state;
  const languages = useCatalogLanguages();
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const jobActive = Boolean(job && ['queued', 'running', 'retrying'].includes(job.status));
  const hasMissingTranslations = Object.values(translationCounts ?? {}).some((count) => count > 0);
  const showJobProgress = jobActive || job?.id === recentJobId || hasMissingTranslations;
  const permissionNamespace = sourceOnly ? 'app-texts' : 'app-translations';
  const ready = sourceOnly || overview?.setup?.ready === true;
  const canWrite =
    ready &&
    (platform || access.permissionActions.includes(`${permissionNamespace}.catalog.write`));
  const canPublish =
    ready &&
    (platform || access.permissionActions.includes(`${permissionNamespace}.catalog.publish`));
  const catalog = <T>(
    operation: Readonly<Record<string, unknown>>,
    scope?: CatalogOverview['scope'],
    signal?: AbortSignal
  ) => requestCatalog<T>(operation, scope, signal, sourceOnly ? 'source' : 'translations');
  return {
    ...state,
    ...languages,
    platform,
    sourceOnly,
    ready,
    canWrite,
    canPublish,
    catalog,
    jobActive,
    hasMissingTranslations,
    showJobProgress,
    ...basisDetails(overview, state.contractId, state.baseId, state.data?.draft.baseReleaseId),
  };
};
export type CatalogPageModel = ReturnType<typeof useCatalogPageModel>;

export const draftDetails = (model: CatalogPageModel) => {
  const { overview, contractId, data, dirty, busy, canPublish, jobActive, sourceOnly } = model;
  const releases =
    overview?.releases.filter((release) => !contractId || release.contractId === contractId) ?? [];
  const locales = sourceOnly ? ['de'] : (data?.draft.supportedLocales ?? []);
  const savedDraftRelease = releases.find(
    (release) =>
      release.draftRevision === data?.draft.draftRevision &&
      release.supportedLocales.length === locales.length &&
      locales.every((locale) => release.supportedLocales.includes(locale))
  );
  const draftStatus = dirty
    ? 'draftUnsaved'
    : jobActive
      ? 'draftTranslating'
      : savedDraftRelease
        ? 'draftSealed'
        : 'draftUnsealed';
  const canSeal = canPublish && !busy && !dirty && !jobActive && !savedDraftRelease;
  return { releases, savedDraftRelease, draftStatus, canSeal };
};

export type CatalogPageViewModel = CatalogPageModel & {
  mutate: (operation: Record<string, unknown>) => Promise<boolean>;
  translate: (options: Record<string, unknown>) => Promise<boolean>;
  importFile: (file: File | undefined) => Promise<void>;
  applyBase: () => Promise<void>;
  seal: () => Promise<void>;
  reloadCatalog: () => void;
  downloadTexts: (id: string) => Promise<void>;
  loadPreview: (id: string) => Promise<void>;
};

export type ReleasePreview =
  { status: 'loading' } | { status: 'ready'; release: CatalogRelease } | { status: 'error' };

export type TranslationJob = {
  id: string;
  status: string;
  progress?: {
    completedSteps: number;
    totalSteps: number;
    details?: { locale?: string; translated?: number; skipped?: number };
  };
  error?: string;
} | null;
export const errorCode = (error: unknown) =>
  error instanceof MainserverApiError ? error.code : 'catalog_unavailable';
