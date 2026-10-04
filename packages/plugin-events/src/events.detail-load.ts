import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { listEventCategories, getEventDetail } from './events.api.js';
import { alignHostMediaReferencesByOrder, listHostMediaReferencesByTarget } from '@sva/plugin-sdk';
import {
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { EVENTS_CONTENT_TYPE } from './events.constants.js';
import {
  mapEventItemToDetailFormValues,
  type EventsDetailFormValues,
} from './events.detail-form.js';
import type { EventsStatusMessage } from './events.detail-save.js';
import { eventsErrorMessage } from './events.detail-save.js';
import type { EventCategoryOption, EventContentItem } from './events.types.js';
import { usePluginTranslation, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import type { MainserverPrincipalType } from '@sva/studio-ui-react';

export const useEventsDetailCategories = (
  pt: ReturnType<typeof usePluginTranslation>,
  refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>
) => {
  const [categoryOptions, setCategoryOptions] = React.useState<readonly EventCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  React.useEffect(() => {
    void listEventCategories()
      .then((categories) => {
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((loadError: unknown) => {
        setCategoryOptions([]);
        setCategoryOptionsError(
          eventsErrorMessage(pt, loadError, 'messages.categoryOptionsLoadError')
        );
      })
      .finally(() => setCategoryOptionsLoading(false));
    void refreshMediaAssets();
  }, [pt, refreshMediaAssets]);
  return { categoryOptions, categoryOptionsLoading, categoryOptionsError };
};

export const useEventsPrincipalAccess = (
  mode: 'create' | 'edit',
  contentId: string | undefined,
  loadedItem: EventContentItem | null,
  actingPrincipalType: MainserverPrincipalType,
  loadedPrincipalTypeRef: React.MutableRefObject<MainserverPrincipalType | undefined>,
  setResourceAccess: React.Dispatch<React.SetStateAction<Readonly<Record<string, boolean>>>>
) => {
  React.useEffect(() => {
    if (
      mode !== 'edit' ||
      !contentId ||
      !loadedItem ||
      loadedPrincipalTypeRef.current === actingPrincipalType
    )
      return;
    let active = true;
    void getEventDetail(contentId, actingPrincipalType)
      .then((detail) => {
        if (!active) return;
        setResourceAccess(detail.access);
        loadedPrincipalTypeRef.current = actingPrincipalType;
      })
      .catch(() => {
        if (active) setResourceAccess({});
      });
    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, loadedItem, mode]);
};

export const useEventsDetailLoad = (
  context: LoadItemContext &
    Readonly<{
      actingPrincipalType: MainserverPrincipalType;
      refreshMediaAssets: () => Promise<readonly HostMediaAssetListItem[]>;
    }>
) => {
  const item = useEventsDetailItem(context);
  const categories = useEventsDetailCategories(context.pt, context.refreshMediaAssets);
  useEventsPrincipalAccess(
    context.mode,
    context.contentId,
    item.loadedItem,
    context.actingPrincipalType,
    item.loadedPrincipalTypeRef,
    item.setResourceAccess
  );
  return {
    loading: item.loading,
    deviations: item.deviations,
    loadedItem: item.loadedItem,
    resourceAccess: item.resourceAccess,
    ...categories,
  };
};

export type LoadItemContext = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
  methods: UseFormReturn<EventsDetailFormValues>;
  pt: ReturnType<typeof usePluginTranslation>;
  setStatus: Dispatch<SetStateAction<EventsStatusMessage | null>>;
  setMediaUsages: Dispatch<SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: Dispatch<SetStateAction<boolean>>;
  setMediaReferencesReady: Dispatch<SetStateAction<boolean>>;
}>;

const loadMediaReferences = (
  context: LoadItemContext,
  nextValues: EventsDetailFormValues,
  active: () => boolean
) => {
  void listHostMediaReferencesByTarget({
    fetch: globalThis.fetch.bind(globalThis),
    targetType: EVENTS_CONTENT_TYPE,
    targetId: context.contentId as string,
  })
    .then((references) => {
      if (!active()) return;
      if (!context.methods.getFieldState('content.mediaContents').isDirty) {
        context.setMediaUsages(
          mainserverContentMediaToUsages(
            nextValues.content.mediaContents,
            alignHostMediaReferencesByOrder({
              itemCount: nextValues.content.mediaContents.length,
              role: 'gallery_item',
              references,
            })
          )
        );
      }
      context.setRequiresReferenceSync(
        (current) =>
          current ||
          references.length > 0 ||
          context.methods.getFieldState('content.mediaContents').isDirty
      );
      context.setMediaReferencesReady(true);
    })
    .catch(() => {
      if (active())
        context.setStatus({ kind: 'error', text: context.pt('messages.mediaReferenceLoadError') });
    });
};

export const useEventsDetailItem = (context: LoadItemContext) => {
  const [loading, setLoading] = React.useState(context.mode === 'edit');
  const [deviations, setDeviations] = React.useState<readonly { fieldGroup: string }[]>([]);
  const [loadedItem, setLoadedItem] = React.useState<EventContentItem | null>(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const loadedPrincipalTypeRef = React.useRef<MainserverPrincipalType | undefined>(undefined);
  const { reset } = context.methods;
  React.useEffect(() => {
    if (context.mode !== 'edit' || !context.contentId) return;
    let active = true;
    const principal = context.principalControl?.value ?? 'user';
    void getEventDetail(context.contentId, principal)
      .then((detail) => {
        if (!active) return;
        const item = detail.data;
        setDeviations(detail.deviations);
        setResourceAccess(detail.access);
        loadedPrincipalTypeRef.current = principal;
        const nextValues = mapEventItemToDetailFormValues(item);
        reset(nextValues);
        context.setMediaUsages(mainserverContentMediaToUsages(nextValues.content.mediaContents));
        context.setRequiresReferenceSync(false);
        setLoadedItem(item);
        setLoading(false);
        loadMediaReferences(context, nextValues, () => active);
      })
      .catch((loadError) => {
        if (active) {
          context.setStatus({
            kind: 'error',
            text: eventsErrorMessage(context.pt, loadError, 'messages.missingContent'),
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [context.contentId, context.mode, reset]);
  return {
    loading,
    deviations,
    loadedItem,
    resourceAccess,
    setResourceAccess,
    loadedPrincipalTypeRef,
  };
};
