import { useRef } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import { IconX } from '@tabler/icons-react';

import {
  type MergeDialogProps,
  useWasteTourMergeController,
} from './waste-management.tours-merge-controller.js';
import {
  MergeAlert,
  MergeConflicts,
  MergeHiddenTours,
  MergeImpact,
  MergeTargetOptions,
} from './waste-management.tours-merge-dialog.parts.js';

type MergeController = ReturnType<typeof useWasteTourMergeController>;

const MergeFooter = ({
  controller,
  canConfirm,
}: {
  controller: MergeController;
  canConfirm: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const { activity, issue, conflicts, target, preview, close, request } = controller;
  const saving = activity === 'submit';
  const changeSelection = conflicts.length > 0 || issue === 'missing' || issue === 'forbidden';
  const canRefresh = issue && !changeSelection && target;
  return (
    <DialogFooter className="shrink-0 border-t border-border-subtle px-6 py-4">
      <Button type="button" variant="secondary" onClick={close} disabled={saving}>
        {pt('tours.merge.cancel')}
      </Button>
      {changeSelection ? (
        <Button type="button" variant="secondary" onClick={close}>
          {pt('tours.merge.reviewSelection')}
        </Button>
      ) : null}
      {canRefresh ? (
        <Button type="button" onClick={() => void request(target.id)}>
          {pt('tours.merge.refresh')}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={!canConfirm || saving}
          onClick={() => {
            if (canConfirm && target && preview) void request(target.id, preview.token);
          }}
        >
          {pt(saving ? 'tours.merge.saving' : 'tours.merge.confirm')}
        </Button>
      )}
    </DialogFooter>
  );
};

const MergeDialogHeader = ({
  titleRef,
  saving,
}: {
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  saving: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <DialogHeader className="relative shrink-0 px-6 pb-3 pt-6 pr-20">
      <DialogTitle ref={titleRef} tabIndex={-1}>
        {pt('tours.merge.open')}
      </DialogTitle>
      <DialogDescription>{pt('tours.merge.intro')}</DialogDescription>
      <DialogClose asChild>
        <Button
          type="button"
          variant="tertiary"
          disabled={saving}
          aria-label={pt('tours.merge.close')}
          className="absolute right-6 top-4 !mt-0 h-11 w-11 p-0"
        >
          <IconX aria-hidden className="h-5 w-5" />
        </Button>
      </DialogClose>
    </DialogHeader>
  );
};

export const WasteToursMergeDialog = (props: MergeDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const controller = useWasteTourMergeController(props);
  const { activity, options, target, conflicts, issue, preview, hidden, select, close } =
    controller;
  const saving = activity === 'submit';
  const impact = !issue && !conflicts.length && preview && target ? { preview, target } : null;
  const hiddenOptions = options.filter((tour) => hidden.has(tour.id));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="flex max-w-[44rem] flex-col overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          props.onRestoreFocus();
        }}
      >
        <MergeDialogHeader titleRef={titleRef} saving={saving} />
        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-3">
          {issue ? (
            <MergeAlert title={pt(`tours.merge.issues.${issue}.title`)} warning={issue === 'stale'}>
              <p>{pt(`tours.merge.issues.${issue}.detail`)}</p>
            </MergeAlert>
          ) : null}
          {conflicts.length ? (
            <MergeConflicts pt={pt} conflicts={conflicts} options={options} target={target} />
          ) : null}
          {hiddenOptions.length ? (
            <MergeHiddenTours pt={pt} hidden={hiddenOptions} resolvedTargetId={impact?.target.id} />
          ) : null}
          <MergeTargetOptions
            pt={pt}
            options={options}
            hidden={hidden}
            targetId={target?.id}
            saving={saving}
            onSelect={select}
          />
          {activity === 'preview' ? (
            <p role="status" className="text-sm">
              {pt('tours.merge.previewLoading')}
            </p>
          ) : null}
          {impact ? <MergeImpact pt={pt} {...impact} /> : null}
        </div>
        <MergeFooter controller={controller} canConfirm={!!impact} />
      </DialogContent>
    </Dialog>
  );
};
