import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@sva/studio-ui-react';

import { NewsDetailTargetingDialog } from './news.detail-targeting-dialog.js';
import {
  findStaleWasteLocationKeys,
  resolveNewsWasteTargetOptions,
  wasteLocationKeyId,
} from './news.waste-targeting.js';
import type { NewsDetailFormValues, WasteLocationKey } from './news.types.js';
import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';
import type { WasteTargetingAvailability } from './news.waste-payload.js';

const emptyOverview: WasteManagementMasterDataOverview = {
  fractions: [],
  regions: [],
  cities: [],
  streets: [],
  houseNumbers: [],
  collectionLocations: [],
  locationTourLinks: [],
};

export type NewsTargetingTranslator = (
  key: string,
  variables?: Readonly<Record<string, string | number>>
) => string;

type TargetingSummaryProps = Readonly<{
  selected: readonly WasteLocationKey[];
  staleIds: ReadonlySet<string>;
  pt: NewsTargetingTranslator;
  onRemove?: (key: WasteLocationKey) => void;
}>;

const targetingSummaryPageSize = 25;

function TargetingSummary({ selected, staleIds, pt, onRemove }: TargetingSummaryProps) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(selected.length / targetingSummaryPageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = selected.slice(
    (currentPage - 1) * targetingSummaryPageSize,
    currentPage * targetingSummaryPageSize
  );

  if (selected.length === 0) {
    return <p className="text-sm text-muted-foreground">{pt('targeting.globalHint')}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
        {visible.map((key) => {
          const targetId = wasteLocationKeyId(key);
          const targetLabel = `${key.street}, ${key.zip} ${key.city}`;
          return (
            <li
              key={targetId}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{targetLabel}</span>
                {staleIds.has(targetId) ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {pt('targeting.stale')}
                  </span>
                ) : null}
              </span>
              {onRemove ? (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  aria-label={pt('targeting.actions.removeTarget', { address: targetLabel })}
                  onClick={() => onRemove(key)}
                >
                  {pt('actions.remove')}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end text-sm">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            {pt('targeting.actions.previous')}
          </Button>
          <span role="status" aria-live="polite" aria-atomic="true">
            {pt('targeting.summary.pageStatus', {
              page: currentPage,
              pageCount,
            })}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            {pt('targeting.actions.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NewsDetailTargetingSection({
  overview,
  pt,
  readOnly = false,
  availability = 'available',
  onLoadOverview,
}: Readonly<{
  overview: WasteManagementMasterDataOverview | null;
  pt: NewsTargetingTranslator;
  readOnly?: boolean;
  availability?: WasteTargetingAvailability;
  onLoadOverview?: () => Promise<boolean>;
}>) {
  const { control, setValue } = useFormContext<NewsDetailFormValues>();
  const selected = useWatch({ control, name: 'wasteLocationKeys' }) ?? [];
  const resolvedOverview = overview ?? emptyOverview;
  const options = React.useMemo(
    () => resolveNewsWasteTargetOptions(resolvedOverview),
    [resolvedOverview]
  );
  const staleIds = React.useMemo(
    () =>
      overview === null
        ? new Set<string>()
        : new Set(findStaleWasteLocationKeys(selected, options).map(wasteLocationKeyId)),
    [options, overview, selected]
  );

  const applySelection = (nextSelection: readonly WasteLocationKey[]) => {
    setValue('wasteLocationKeys', [...nextSelection], { shouldDirty: true });
  };

  const removeSelectedTarget = (key: WasteLocationKey) => {
    const targetId = wasteLocationKeyId(key);
    setValue(
      'wasteLocationKeys',
      selected.filter((entry) => wasteLocationKeyId(entry) !== targetId),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }
    );
  };

  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{pt('targeting.card.title')}</p>
        <p className="text-sm text-muted-foreground">{pt('targeting.card.description')}</p>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{pt('targeting.card.sentReadOnly')}</p>
        ) : null}
      </div>
      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
        {selected.length === 0 ? (
          <>
            <p className="text-sm font-medium">{pt('targeting.mode.global')}</p>
            <TargetingSummary selected={selected} staleIds={staleIds} pt={pt} />
          </>
        ) : (
          <details className="group rounded-lg border border-border/60 bg-background">
            <summary className="cursor-pointer select-none px-3 py-3 text-sm font-medium marker:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{pt('targeting.mode.targeted', { count: selected.length })}</span>
                {staleIds.size > 0 ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {pt('targeting.summary.staleCount', { count: staleIds.size })}
                  </span>
                ) : null}
              </span>
            </summary>
            <div className="border-t border-border/60 p-3">
              <TargetingSummary
                selected={selected}
                staleIds={staleIds}
                pt={pt}
                onRemove={readOnly ? undefined : removeSelectedTarget}
              />
            </div>
          </details>
        )}
        {readOnly ? null : (
          <NewsDetailTargetingDialog
            overview={resolvedOverview}
            options={options}
            selected={selected}
            pt={pt}
            onApply={applySelection}
            availability={availability}
            onBeforeOpen={onLoadOverview}
          />
        )}
      </div>
    </div>
  );
}
