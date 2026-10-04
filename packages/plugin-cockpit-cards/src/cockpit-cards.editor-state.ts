import { zodResolver } from '@hookform/resolvers/zod';
import {
  hasContentLifecycleAccess,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  resolveContentVisibilityAction,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
} from '@sva/plugin-sdk';
import {
  addStudioDestructiveNavigationFeedback,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  useStudioSaveFeedback,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import {
  deleteCockpitCard,
  getCockpitCard,
  listCockpitCardCategories,
} from './cockpit-cards.api.js';
import { cockpitCardFormSchema } from './cockpit-cards.model.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';
import type { Tab } from './cockpit-cards.editor-view.js';

const defaults: CockpitCardFormValues = {
  heading: '',
  text: '',
  languageCode: 'de',
  sortWeight: 0,
  category: '',
  images: [],
  link: '',
  linkText: '',
  openInNewTab: false,
  visible: true,
};

export function useCockpitCardForm() {
  const form = useForm<CockpitCardFormValues>({
    defaultValues: defaults,
    resolver: zodResolver(cockpitCardFormSchema),
  });
  const link = form.watch('link');
  React.useEffect(() => {
    if (link.trim()) return;
    if (form.getValues('linkText')) form.setValue('linkText', '', { shouldDirty: true });
    if (form.getValues('openInNewTab')) form.setValue('openInNewTab', false, { shouldDirty: true });
  }, [form, link]);
  const saveFeedback = useStudioSaveFeedback();
  React.useEffect(() => {
    if (form.formState.isDirty) saveFeedback.markDirty();
  }, [form.formState.isDirty, saveFeedback.markDirty]);
  const [mediaSavePhaseKey, setMediaSavePhaseKey] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>('basis');
  return {
    form,
    link,
    saveFeedback,
    mediaSavePhaseKey,
    setMediaSavePhaseKey,
    mutationError,
    setMutationError,
    tab,
    setTab,
  };
}

export function useCockpitCardPrincipal(principalControl?: MainserverPrincipalControlModel) {
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  return { actingPrincipalType, setActingPrincipalType };
}

export function useCockpitCardAccess({
  mode,
  form,
  loadedItem,
  resourceAccess,
}: Readonly<{
  mode: 'create' | 'edit';
  form: UseFormReturn<CockpitCardFormValues>;
  loadedItem: Awaited<ReturnType<typeof getCockpitCard>> | null;
  resourceAccess: Readonly<Record<string, boolean>>;
}>) {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('cockpit-cards', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const nextVisible = form.watch('visible');
  const canSave =
    mode === 'create'
      ? accessCapabilities.canCreate
      : accessCapabilities.canUpdate &&
        loadedItem !== null &&
        hasContentLifecycleAccess(
          resolveContentVisibilityAction(loadedItem.visible, nextVisible),
          resourceAccess
        );
  const mediaCapabilities = React.useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent: canSave,
        permissionActions: sessionAccess.permissionActions,
      }),
    [canSave, sessionAccess.permissionActions]
  );
  return {
    accessCapabilities,
    canSave,
    canSelectMedia: mediaCapabilities.canSelect,
    canUploadMedia: mediaCapabilities.canUpload,
    canUpdateMedia: mediaCapabilities.canEditAssetMetadata,
  };
}

export function useCockpitCardCreatedFeedback(
  contentId: string | undefined,
  loading: boolean,
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>
) {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      loading ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'cockpit-cards', contentId)
    )
      return;
    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/cockpit-cards/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, location.state, navigate, saveFeedback]);
}

export function useCockpitCardDelete(
  contentId: string | undefined,
  actingPrincipalType: MainserverPrincipalType,
  pt: (key: string) => string
) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const deleteCard = async (detachLinkedContent = false) => {
    if (!contentId || deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    try {
      await (detachLinkedContent
        ? deleteCockpitCard(contentId, actingPrincipalType, true)
        : deleteCockpitCard(contentId, actingPrincipalType));
    } catch {
      setDeleteError(pt('messages.deleteError'));
      setDeletePending(false);
      return;
    }
    setDeleteDialogOpen(false);
    try {
      await navigate({
        to: '/admin/content',
        state: (previous) =>
          addStudioDestructiveNavigationFeedback(previous, 'cockpit-cards', contentId),
      });
    } catch {
      return;
    } finally {
      setDeletePending(false);
    }
  };
  return {
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePending,
    deleteError,
    setDeleteError,
    deleteCard,
  };
}

export function useCategories() {
  const [options, setOptions] = React.useState<readonly { id: string; name: string }[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  React.useEffect(() => {
    let active = true;
    void listCockpitCardCategories().then(
      (items) => {
        if (active) {
          setOptions(items);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, []);
  return { options, state };
}
