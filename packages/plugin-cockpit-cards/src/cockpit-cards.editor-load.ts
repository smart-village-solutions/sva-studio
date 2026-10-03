import { alignHostMediaReferencesByOrder, listHostMediaReferencesByTarget } from '@sva/plugin-sdk';
import type { ContentMediaUsage, MainserverPrincipalType } from '@sva/studio-ui-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { getCockpitCard, getCockpitCardDetail } from './cockpit-cards.api.js';
import { COCKPIT_CARD_CONTENT_TYPE } from './cockpit-cards.constants.js';
import { cockpitCardMediaToUsages } from './cockpit-cards.content-media-adapter.js';
import { mapGenericItemToCockpitCardFormValues } from './cockpit-cards.model.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

export function useCockpitCardLoad({
  mode,
  contentId,
  actingPrincipalType,
  form,
  setMediaUsages,
  setRequiresReferenceSync,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  actingPrincipalType: MainserverPrincipalType;
  form: UseFormReturn<CockpitCardFormValues>;
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [error, setError] = React.useState(false);
  const [loadedItem, setLoadedItem] = React.useState<Awaited<
    ReturnType<typeof getCockpitCard>
  > | null>(null);
  const [resourceAccess, setResourceAccess] = React.useState<Readonly<Record<string, boolean>>>({});
  const loadedContentIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) return;
    let active = true;
    if (loadedContentIdRef.current === contentId) {
      void getCockpitCardDetail(contentId, actingPrincipalType).then(
        (detail) => {
          if (active) setResourceAccess(detail.access);
        },
        () => {
          if (active) setResourceAccess({});
        }
      );
      return () => {
        active = false;
      };
    }
    void Promise.all([
      getCockpitCardDetail(contentId, actingPrincipalType),
      listHostMediaReferencesByTarget({
        fetch: globalThis.fetch.bind(globalThis),
        targetType: COCKPIT_CARD_CONTENT_TYPE,
        targetId: contentId,
      }).catch(() => []),
    ])
      .then(
        ([detail, references]) => {
          if (!active) return;
          const item = detail.data;
          setResourceAccess(detail.access);
          const values = mapGenericItemToCockpitCardFormValues(item);
          form.reset(values);
          setMediaUsages(
            cockpitCardMediaToUsages(
              values.images,
              alignHostMediaReferencesByOrder({
                itemCount: values.images.length,
                role: 'gallery_item',
                references,
              })
            )
          );
          setRequiresReferenceSync(references.length > 0);
          setLoadedItem(item);
          loadedContentIdRef.current = contentId;
        },
        () => {
          if (active) setError(true);
        }
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [actingPrincipalType, contentId, form, mode, setMediaUsages, setRequiresReferenceSync]);
  return { loading, error, loadedItem, resourceAccess };
}
