import { meilisearchInterfaceDraftSchema } from '../../lib/instance-interface-meilisearch';
import { useServerFn } from '@tanstack/react-start';
import React from 'react';
import { useStudioSaveFeedback, useStudioTableQuery } from '@sva/studio-ui-react';

import { t } from '../../i18n';
import { readErrorMessage } from '../../lib/error-message-utils';
import { getStudioPermissionDenialMessage } from '../../lib/studio-permission-denial-message';
import {
  checkDeepLInterfaceServerFn,
  listInstanceInterfacesServerFn,
  saveSvaMainserverInterfaceSettings,
  upsertInstanceInterfaceServerFn,
} from '../../lib/interfaces-api';
import {
  createEmptyInstanceInterfaceDraft,
  type InstanceInterface,
  type InstanceInterfaceDraft,
  type InstanceInterfaceType,
} from '../../lib/instance-interfaces';
import { useInterfaceDeletion, useMailInterfaceTest } from './-interfaces-page.actions';

export const DEFAULT_AVAILABLE_TYPES: readonly InstanceInterfaceType[] = [
  'mainserver',
  's3',
  'postgresql',
  'mailTransport',
  'mapGeocoding',
];

export const isInstanceInterfacesResponse = (
  value: unknown
): value is Readonly<{
  instanceId: string;
  availableTypes: readonly InstanceInterfaceType[];
  entries: readonly InstanceInterface[];
}> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    instanceId?: unknown;
    availableTypes?: unknown;
    entries?: unknown;
  };

  return (
    typeof candidate.instanceId === 'string' &&
    Array.isArray(candidate.availableTypes) &&
    Array.isArray(candidate.entries)
  );
};

export type EditState =
  | { mode: 'closed' }
  | { mode: 'create'; type: InstanceInterfaceType; draft: InstanceInterfaceDraft }
  | { mode: 'edit'; entry: InstanceInterface; draft: InstanceInterfaceDraft };

export const draftFromEntry = (entry: InstanceInterface): InstanceInterfaceDraft => {
  if (entry.type === 'meilisearch')
    return {
      type: 'meilisearch',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, apiKey: '' },
    };
  if (entry.type === 'deepl')
    return {
      type: 'deepl',
      name: entry.name,
      enabled: entry.enabled,
      config: {
        plan: entry.config.plan,
        englishVariant: entry.config.englishVariant,
        selectedLocales: entry.config.selectedLocales,
        revision: entry.config.revision,
        apiKey: '',
      },
    };
  if (entry.type === 'mainserver') {
    return {
      type: 'mainserver',
      name: entry.name,
      enabled: entry.enabled,
      config: entry.config,
    };
  }
  if (entry.type === 's3') {
    return {
      type: 's3',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, secretAccessKey: '' },
    };
  }
  if (entry.type === 'mailTransport') {
    return {
      type: 'mailTransport',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, password: '' },
    };
  }
  if (entry.type === 'mapGeocoding') {
    return {
      type: 'mapGeocoding',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, apiKey: '' },
    };
  }
  if (entry.type === 'postgresql') {
    return {
      type: 'postgresql',
      name: entry.name,
      enabled: entry.enabled,
      config: { ...entry.config, databaseUrl: '' },
    };
  }
  return {
    type: 'supabase',
    name: entry.name,
    enabled: entry.enabled,
    config: { ...entry.config, serviceRoleKey: '' },
  };
};

export const translateInterfacesErrorMessage = (error: unknown, fallback: string): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
  const message = readErrorMessage(error, fallback);

  if (message.startsWith('deepl_') || message === 'interface_conflict')
    return t(`interfaces.deepl.errors.${message}`);
  if (message.startsWith('meilisearch_')) return t(`interfaces.meilisearch.errors.${message}`);
  switch (message) {
    case 'invalid_interfaces_payload':
      return t('interfaces.messages.loadError');
    case 'custom_interfaces_not_supported':
      return t('interfaces.errors.customInterfacesNotSupported');
    case 'interface_not_found':
      return t('interfaces.errors.interfaceNotFound');
    case 'interface_instance_mismatch':
      return t('interfaces.errors.interfaceInstanceMismatch');
    case 'interface_type_change_not_supported':
      return t('interfaces.errors.interfaceTypeChangeNotSupported');
    case 'interface_type_not_registered':
      return t('interfaces.errors.interfaceTypeNotRegistered');
    case 'supabase_requires_waste_management_module':
      return t('interfaces.errors.supabaseRequiresWasteManagementModule');
    case 'secret_unreadable':
      return t('interfaces.errors.secretUnreadable');
    case 'mail_test_disabled':
      return t('interfaces.mailTest.errors.disabled');
    case 'mail_test_recipient_missing':
      return t('interfaces.mailTest.errors.recipientMissing');
    case 'mail_test_invalid_config':
      return t('interfaces.mailTest.errors.invalidConfig');
    case 'mail_test_secret_missing':
      return t('interfaces.mailTest.errors.secretMissing');
    case 'forbidden':
      return t('interfaces.errors.forbidden');
    case 'invalid_config':
      return t('interfaces.errors.invalidConfig');
    default:
      return message;
  }
};

export const buildUpsertPayload = (
  instanceId: string,
  editState: Extract<EditState, { mode: 'create' | 'edit' }>
) => {
  const { draft } = editState;
  if (draft.type === 'meilisearch' && !meilisearchInterfaceDraftSchema.safeParse(draft).success)
    throw new Error('meilisearch_invalid_config');
  return {
    instanceId,
    draft,
    ...(editState.mode === 'edit' && editState.entry.type !== 'mainserver'
      ? { existingId: editState.entry.id }
      : {}),
  };
};

const useServerFnRefs = () => {
  const checkDeepL = useServerFn(checkDeepLInterfaceServerFn);
  const listInterfaces = useServerFn(listInstanceInterfacesServerFn);
  const saveMainserver = useServerFn(saveSvaMainserverInterfaceSettings);
  const upsertInterface = useServerFn(upsertInstanceInterfaceServerFn);
  const listInterfacesRef = React.useRef(listInterfaces);
  const saveMainserverRef = React.useRef(saveMainserver);
  const upsertInterfaceRef = React.useRef(upsertInterface);
  listInterfacesRef.current = listInterfaces;
  saveMainserverRef.current = saveMainserver;
  upsertInterfaceRef.current = upsertInterface;

  return {
    checkDeepL,
    listInterfacesRef,
    saveMainserverRef,
    upsertInterfaceRef,
  };
};

const EMPTY_INTERFACES: readonly InstanceInterface[] = [];

function findSavedInterface(
  entries: readonly InstanceInterface[],
  edit: Exclude<EditState, { mode: 'closed' }>
) {
  return (
    entries.find((entry) =>
      edit.mode === 'edit' ? entry.id === edit.entry.id : entry.type === edit.draft.type
    ) ?? null
  );
}

async function readInterfaces(read: () => Promise<unknown>) {
  const result = await read();
  if (!isInstanceInterfacesResponse(result)) throw new Error('invalid_interfaces_payload');
  return result;
}

export const useInterfacesPageController = () => {
  const { checkDeepL, listInterfacesRef, saveMainserverRef, upsertInterfaceRef } =
    useServerFnRefs();
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerType, setPickerType] = React.useState<InstanceInterfaceType>('s3');
  const [editState, setEditState] = React.useState<EditState>({ mode: 'closed' });
  const list = useStudioTableQuery(['interfaces'], () => readInterfaces(listInterfacesRef.current));
  const instanceId = list.data?.instanceId ?? '';
  const interfaces = list.data?.entries ?? EMPTY_INTERFACES;
  const availableTypes = list.data?.availableTypes.length
    ? list.data.availableTypes
    : DEFAULT_AVAILABLE_TYPES;
  const isLoading = list.state === 'loading';
  const [reportRefreshError, setReportRefreshError] = React.useState(true);
  const errorMessage =
    reportRefreshError && list.error
      ? translateInterfacesErrorMessage(list.error, t('interfaces.messages.loadError'))
      : null;
  const { mailTestPendingId, mailTestResult, onTestMail } = useMailInterfaceTest(
    instanceId,
    translateInterfacesErrorMessage
  );
  const [deepLChecking, setDeepLChecking] = React.useState(false);
  const [deepLCheckFailed, setDeepLCheckFailed] = React.useState(false);
  const saveFeedback = useStudioSaveFeedback();

  const refresh = React.useCallback(
    async (reportError = true) => {
      setReportRefreshError(reportError);
      return (await list.refresh()) ?? null;
    },
    [list.refresh]
  );

  React.useEffect(() => {
    setPickerType((current) =>
      availableTypes.includes(current) ? current : (availableTypes[0] ?? 's3')
    );
  }, [availableTypes]);

  const deletion = useInterfaceDeletion(instanceId, refresh, translateInterfacesErrorMessage);

  const onConfirmType = () => {
    saveFeedback.reset();
    setSaveErrorMessage(null);
    setEditState({
      mode: 'create',
      type: pickerType,
      draft: createEmptyInstanceInterfaceDraft(pickerType),
    });
    setPickerOpen(false);
  };

  const onSaveDraft = async () => {
    if (editState.mode === 'closed') {
      return;
    }

    setDeepLCheckFailed(false);
    const operationId = saveFeedback.beginSaving();
    try {
      const draft = editState.draft;
      let savedEntry: InstanceInterface | null = null;
      if (draft.type === 'mainserver') {
        await saveMainserverRef.current({
          data: {
            graphqlBaseUrl: draft.config.graphqlBaseUrl,
            oauthTokenUrl: draft.config.oauthTokenUrl,
            enabled: draft.enabled,
          },
        });
      } else {
        savedEntry = await upsertInterfaceRef.current({
          data: buildUpsertPayload(instanceId, editState),
        });
      }
      const refreshed = await refresh(false);
      if (!refreshed) {
        throw new Error(t('interfaces.messages.refreshAfterSaveError'));
      }
      savedEntry ??= findSavedInterface(refreshed.entries, editState);
      if (savedEntry) {
        setEditState({ mode: 'edit', entry: savedEntry, draft: draftFromEntry(savedEntry) });
      }
      setSaveErrorMessage(null);
      saveFeedback.markSaved(operationId);
    } catch (error) {
      setSaveErrorMessage(
        translateInterfacesErrorMessage(error, t('interfaces.messages.saveError'))
      );
      saveFeedback.markFailed(operationId);
    }
  };

  const onCheckDeepL = async () => {
    if (editState.mode !== 'edit' || editState.entry.type !== 'deepl') return;
    setDeepLChecking(true);
    setDeepLCheckFailed(false);
    setSaveErrorMessage(null);
    try {
      const result = await checkDeepL({ data: { id: editState.entry.id } });
      const updated = await refresh(false);
      if (!updated) throw new Error(t('interfaces.deepl.refreshFailed'));
      const entry = updated?.entries.find((item) => item.id === editState.entry.id);
      if (entry)
        setEditState((current) =>
          current.mode === 'edit' && current.entry.id === entry.id ? { ...current, entry } : current
        );
      if (!result.ok) {
        setDeepLCheckFailed(true);
        setSaveErrorMessage(
          t(`interfaces.deepl.errors.${result.errorCode ?? 'deepl_unavailable'}`)
        );
      }
    } catch (error) {
      setDeepLCheckFailed(true);
      setSaveErrorMessage(
        translateInterfacesErrorMessage(error, t('interfaces.deepl.checkFailed'))
      );
    } finally {
      setDeepLChecking(false);
    }
  };
  return {
    deepLChecking,
    onRetryForm: deepLCheckFailed ? onCheckDeepL : onSaveDraft,
    onCheckDeepL,
    availableTypes,
    editState,
    errorMessage,
    instanceId,
    interfaces,
    isLoading,
    ...deletion,
    mailTestPendingId,
    mailTestResult,
    saveErrorMessage,
    saveStatus: saveFeedback.status,
    pickerOpen,
    pickerType,
    refresh,
    setEditState,
    setPickerOpen,
    setPickerType,
    markDraftDirty: saveFeedback.markDirty,
    onTestMail,
    onConfirmType,
    onSaveDraft,
  };
};
