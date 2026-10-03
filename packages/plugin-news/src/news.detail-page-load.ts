import * as React from 'react';
import type { UseFormReset } from 'react-hook-form';
import {
  alignHostMediaReferencesByOrder,
  listHostMediaReferencesByTarget,
  toDatetimeLocalValue,
} from '@sva/plugin-sdk';
import {
  mainserverContentMediaToUsages,
  type ContentMediaUsage,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { getNewsDetail } from './news.api.js';
import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { mapNewsItemToDetailFormValues } from './news.detail-form.js';
import {
  resolveNewsErrorMessage,
  type PluginTranslator,
  type StatusMessage,
} from './news.detail-page.helpers.js';
import type { NewsContentItem, NewsDetailFormValues, NewsPrincipalControl } from './news.types.js';

type NewsDetailLoadOptions = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: NewsPrincipalControl;
  pt: PluginTranslator;
  reset: UseFormReset<NewsDetailFormValues>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  setScheduledPublicationInput: React.Dispatch<React.SetStateAction<string>>;
  setInvalidScheduledPublicationInput: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadedItem: React.Dispatch<React.SetStateAction<NewsContentItem | null>>;
  setResourceAccess: React.Dispatch<React.SetStateAction<Readonly<Record<string, boolean>>>>;
  loadedItem: NewsContentItem | null;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
}>;

export const useNewsDetailLoad = ({
  mode,
  contentId,
  principalControl,
  pt,
  reset,
  setIsLoading,
  setStatusMessage,
  setMediaUsages,
  setRequiresReferenceSync,
  setScheduledPublicationInput,
  setInvalidScheduledPublicationInput,
  setLoadedItem,
  setResourceAccess,
  loadedItem,
  actingPrincipalType,
  setActingPrincipalType,
}: NewsDetailLoadOptions) => {
  const editLoadRequestIdRef = React.useRef(0);
  const loadedPrincipalTypeRef = React.useRef<MainserverPrincipalType | null>(null);
  React.useEffect(() => {
    if (principalControl) {
      setActingPrincipalType(principalControl.value);
    }
  }, [principalControl]);

  React.useEffect(() => {
    if (mode !== 'edit') {
      return;
    }

    if (!contentId) {
      setIsLoading(false);
      setStatusMessage({ source: 'load', text: pt('messages.missingContent') });
      return;
    }

    const requestId = ++editLoadRequestIdRef.current;
    let active = true;

    const loadPrincipalType = principalControl?.value ?? 'user';
    void getNewsDetail(contentId, loadPrincipalType)
      .then(async (detail) => {
        if (!active || requestId !== editLoadRequestIdRef.current) {
          return;
        }
        const item = detail.data;

        const references = await listHostMediaReferencesByTarget({
          fetch: globalThis.fetch.bind(globalThis),
          targetType: NEWS_CONTENT_TYPE,
          targetId: contentId,
        }).catch(() => []);
        if (!active || requestId !== editLoadRequestIdRef.current) {
          return;
        }
        const nextValues = mapNewsItemToDetailFormValues(item);
        reset(nextValues);
        setMediaUsages(
          mainserverContentMediaToUsages(
            nextValues.contentMedia,
            alignHostMediaReferencesByOrder({
              itemCount: nextValues.contentMedia.length,
              role: 'gallery_item',
              references,
            })
          )
        );
        setRequiresReferenceSync(references.length > 0);
        setScheduledPublicationInput(toDatetimeLocalValue(nextValues.scheduledPublicationAt));
        setInvalidScheduledPublicationInput(false);
        setLoadedItem(item);
        setResourceAccess(detail.access);
        loadedPrincipalTypeRef.current = loadPrincipalType;
      })
      .catch((error: unknown) => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setStatusMessage({
            source: 'load',
            text: resolveNewsErrorMessage(pt, error, 'messages.loadError'),
          });
        }
      })
      .finally(() => {
        if (active && requestId === editLoadRequestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, mode, pt, reset]);

  React.useEffect(() => {
    if (
      mode !== 'edit' ||
      !contentId ||
      !loadedItem ||
      loadedPrincipalTypeRef.current === actingPrincipalType
    ) {
      return;
    }
    let active = true;
    void getNewsDetail(contentId, actingPrincipalType)
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
