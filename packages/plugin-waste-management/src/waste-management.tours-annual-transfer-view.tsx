import type { WasteAnnualTourTransferTourPreview } from '@sva/plugin-sdk';
import { Button, Checkbox, Input } from '@sva/studio-ui-react';

import type { WasteAnnualTransferController } from './waste-management.tours-annual-transfer-controller.js';

type Translate = (key: string, values?: Record<string, string | number>) => string;

const classificationKey = (classification: WasteAnnualTourTransferTourPreview['classification']) =>
  classification === 'transferable'
    ? 'tours.annualTransfer.transferable'
    : classification === 'already-effective'
      ? 'tours.annualTransfer.alreadyEffective'
      : 'tours.annualTransfer.blocked';

const AnnualTourCard = ({ tour, controller, translate }: Readonly<{
  tour: WasteAnnualTourTransferTourPreview;
  controller: WasteAnnualTransferController;
  translate: Translate;
}>) => {
  const selectable = tour.classification === 'transferable';
  const checked = controller.selectedTourIds.includes(tour.sourceTourId);
  return <section className="space-y-2 rounded-lg border p-4">
    <div className="flex items-start gap-3">
      {selectable ? <Checkbox
        id={`annual-transfer-${tour.sourceTourId}`}
        checked={checked}
        disabled={controller.step === 'confirm' || controller.loading}
        onChange={(event) => { const selected = event.currentTarget.checked; controller.setSelectedTourIds((current) => selected ? [...current, tour.sourceTourId] : current.filter((id) => id !== tour.sourceTourId)); }}
        aria-label={translate('tours.annualTransfer.selectTour', { name: tour.name })}
      /> : null}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{tour.name}</h3>
        <p className="text-sm font-medium">{translate(classificationKey(tour.classification))}</p>
        {tour.classification === 'already-effective' ? <p className="text-sm text-muted-foreground">{translate('tours.annualTransfer.alreadyEffectiveReason')}</p> : null}
        {tour.classification === 'blocked' ? <p className="text-sm text-muted-foreground">{translate('tours.annualTransfer.blockedReason')}</p> : null}
        {tour.sourcePeriod?.firstDate && tour.firstTargetDate ? <p className="text-sm text-muted-foreground">{translate('tours.annualTransfer.dateExample', { source: tour.sourcePeriod.firstDate, target: tour.firstTargetDate })}</p> : null}
      </div>
    </div>
    {tour.replacementResourceIds.map((resourceId, index) => <label key={resourceId} className="grid gap-1 text-sm font-medium" htmlFor={`replacement-${resourceId}`}>
      {translate('tours.annualTransfer.replacementDate', { name: `${tour.name} ${index + 1}` })}
      <Input id={`replacement-${resourceId}`} type="date" min={`${controller.preview?.targetYear}-01-01`} max={`${controller.preview?.targetYear}-12-31`} value={controller.replacementDates[resourceId] ?? ''} disabled={controller.step === 'confirm' || controller.loading} onChange={(event) => { const replacementDate = event.currentTarget.value; controller.setReplacementDates((current) => ({ ...current, [resourceId]: replacementDate })); }} />
    </label>)}
    {checked && tour.conflicts.length > 0 ? <label className="flex items-start gap-2 text-sm" htmlFor={`conflict-${tour.sourceTourId}`}>
      <Checkbox id={`conflict-${tour.sourceTourId}`} checked={controller.acknowledgedConflictTourIds.includes(tour.sourceTourId)} disabled={controller.step === 'confirm' || controller.loading} onChange={(event) => { const acknowledged = event.currentTarget.checked; controller.setAcknowledgedConflictTourIds((current) => acknowledged ? [...current, tour.sourceTourId] : current.filter((id) => id !== tour.sourceTourId)); }} />
      {translate('tours.annualTransfer.acknowledgeConflict', { name: tour.name })}
    </label> : null}
  </section>;
};

export const AnnualTransferPreview = ({ controller, translate }: Readonly<{
  controller: WasteAnnualTransferController;
  translate: Translate;
}>) => controller.preview ? <div ref={controller.summaryRef} tabIndex={-1} className="space-y-5" aria-live="polite">
  <p className="rounded-lg border bg-muted/30 p-3 text-sm font-medium">{translate('tours.annualTransfer.summary', { selected: controller.selectedTourIds.length, relationships: controller.preview.summary.relationships })}</p>
  {controller.preview.tours.length === 0 ? <p>{translate('tours.annualTransfer.noTours')}</p> : controller.preview.tours.map((tour) => <AnnualTourCard key={tour.sourceTourId} tour={tour} controller={controller} translate={translate} />)}
</div> : null;

export const AnnualTransferFooter = ({ controller, translate, close }: Readonly<{
  controller: WasteAnnualTransferController;
  translate: Translate;
  close: () => void;
}>) => <>
  <Button type="button" variant="secondary" disabled={controller.loading} onClick={close}>{translate(controller.step === 'result' ? 'tours.annualTransfer.close' : 'tours.annualTransfer.cancel')}</Button>
  {controller.step === 'preview' && Object.keys(controller.replacementDates).length > 0 ? <Button type="button" variant="secondary" disabled={controller.loading} onClick={() => void controller.loadPreview()}>{translate('tours.annualTransfer.refreshPreview')}</Button> : null}
  {controller.step === 'confirm' ? <Button type="button" variant="secondary" disabled={controller.loading} onClick={() => controller.setStep('preview')}>{translate('tours.annualTransfer.back')}</Button> : null}
  {controller.step !== 'result' ? <Button type="submit" disabled={controller.loading || (controller.step !== 'source' && controller.selectedTourIds.length === 0) || controller.unacknowledgedConflict}>{translate(controller.loading ? (controller.step === 'source' ? 'tours.annualTransfer.loading' : 'tours.annualTransfer.creating') : controller.step === 'source' ? 'tours.annualTransfer.loadPreview' : controller.step === 'preview' ? 'tours.annualTransfer.review' : 'tours.annualTransfer.confirm')}</Button> : null}
</>;
