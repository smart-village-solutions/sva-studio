import { useServerFn } from '@tanstack/react-start';
import React from 'react';
import { useStudioSaveFeedback } from '@sva/studio-ui-react';

import { t } from '../../i18n';
import { readErrorMessage } from '../../lib/error-message-utils';
import {
  deleteInstanceInterfaceServerFn,
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
  const message = readErrorMessage(error, fallback);

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
    case 'supabase_requires_waste_management_module':
      return t('interfaces.errors.supabaseRequiresWasteManagementModule');
    case 'secret_unreadable':
      return t('interfaces.errors.secretUnreadable');
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
) => ({
  instanceId,
  draft: editState.draft,
  ...(editState.mode === 'edit' && editState.entry.type !== 'mainserver'
    ? { existingId: editState.entry.id }
    : {}),
});

const useServerFnRefs = () => {
  const listInterfaces = useServerFn(listInstanceInterfacesServerFn);
  const saveMainserver = useServerFn(saveSvaMainserverInterfaceSettings);
  const upsertInterface = useServerFn(upsertInstanceInterfaceServerFn);
  const deleteInterface = useServerFn(deleteInstanceInterfaceServerFn);
  const listInterfacesRef = React.useRef(listInterfaces);
  const saveMainserverRef = React.useRef(saveMainserver);
  const upsertInterfaceRef = React.useRef(upsertInterface);
  const deleteInterfaceRef = React.useRef(deleteInterface);
  listInterfacesRef.current = listInterfaces;
  saveMainserverRef.current = saveMainserver;
  upsertInterfaceRef.current = upsertInterface;
  deleteInterfaceRef.current = deleteInterface;

  return {
    listInterfacesRef,
    saveMainserverRef,
    upsertInterfaceRef,
    deleteInterfaceRef,
  };
};

export const useInterfacesPageController = () => {
  const { listInterfacesRef, saveMainserverRef, upsertInterfaceRef, deleteInterfaceRef } =
    useServerFnRefs();
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [instanceId, setInstanceId] = React.useState('');
  const [interfaces, setInterfaces] = React.useState<readonly InstanceInterface[]>([]);
  const [availableTypes, setAvailableTypes] =
    React.useState<readonly InstanceInterfaceType[]>(DEFAULT_AVAILABLE_TYPES);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerType, setPickerType] = React.useState<InstanceInterfaceType>('s3');
  const [editState, setEditState] = React.useState<EditState>({ mode: 'closed' });
  const [pendingDelete, setPendingDelete] = React.useState<InstanceInterface | null>(null);
  const saveFeedback = useStudioSaveFeedback();

  const refresh = React.useCallback(
    async (reportError = true) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await listInterfacesRef.current();
        if (!isInstanceInterfacesResponse(result)) {
          throw new Error('invalid_interfaces_payload');
        }

        const nextAvailableTypes =
          result.availableTypes.length > 0 ? result.availableTypes : DEFAULT_AVAILABLE_TYPES;
        setInstanceId(result.instanceId);
        setInterfaces(result.entries);
        setAvailableTypes(nextAvailableTypes);
        setPickerType((current) =>
          nextAvailableTypes.includes(current) ? current : (nextAvailableTypes[0] ?? 's3')
        );
        return result;
      } catch (error) {
        if (reportError) {
          setErrorMessage(
            translateInterfacesErrorMessage(error, t('interfaces.messages.loadError'))
          );
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [listInterfacesRef]
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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
      savedEntry ??=
        refreshed?.entries.find((entry) =>
          editState.mode === 'edit' ? entry.id === editState.entry.id : entry.type === draft.type
        ) ?? null;
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

  const onConfirmDelete = async () => {
    if (!pendingDelete) {
      setPendingDelete(null);
      return;
    }

    setErrorMessage(null);
    try {
      const result = await deleteInterfaceRef.current({
        data: { instanceId, id: pendingDelete.id },
      });
      if (!result.deleted) {
        throw new Error('interface_not_found');
      }
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      setErrorMessage(translateInterfacesErrorMessage(error, t('interfaces.messages.saveError')));
      setPendingDelete(null);
    }
  };

  return {
    availableTypes,
    editState,
    errorMessage,
    instanceId,
    interfaces,
    isLoading,
    saveErrorMessage,
    saveStatus: saveFeedback.status,
    pendingDelete,
    pickerOpen,
    pickerType,
    refresh,
    setEditState,
    setPendingDelete,
    setPickerOpen,
    setPickerType,
    markDraftDirty: saveFeedback.markDirty,
    onConfirmDelete,
    onConfirmType,
    onSaveDraft,
  };
};
