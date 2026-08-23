import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

import {
  useWasteAnnualTransferController,
  wasteAnnualCurrentYear,
} from './waste-management.tours-annual-transfer-controller.js';
import {
  AnnualTransferFooter,
  AnnualTransferPreview,
} from './waste-management.tours-annual-transfer-view.js';
import type { WasteAnnualTourTransferResult } from '@sva/plugin-sdk';

export const WasteToursAnnualTransferDialog = ({
  open,
  onOpenChange,
  onCreated,
  onShowResult,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
  onShowResult: (result: WasteAnnualTourTransferResult) => void;
}>) => {
  const translate = usePluginTranslation('wasteManagement');
  const controller = useWasteAnnualTransferController({ open, onCreated, translate });
  return <Dialog open={open} onOpenChange={(next) => !controller.loading && onOpenChange(next)}>
    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
      <form className="space-y-5" onSubmit={controller.submit}>
        <DialogHeader>
          <DialogTitle>{translate('tours.annualTransfer.title')}</DialogTitle>
          <DialogDescription>{translate('tours.annualTransfer.description')}</DialogDescription>
        </DialogHeader>
        {controller.step !== 'result' ? <p className="text-sm font-medium" aria-live="polite">{translate('tours.annualTransfer.steps', { current: controller.step === 'source' ? 1 : controller.step === 'preview' ? 2 : 3 })}</p> : null}
        {controller.error ? <div ref={controller.summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-destructive p-3">{controller.error}</div> : null}
        {controller.step === 'source' ? <div className="space-y-3">
          <label className="grid gap-1 text-sm font-medium" htmlFor="waste-annual-transfer-source-year">
            {translate('tours.annualTransfer.sourceYear')}
            <select id="waste-annual-transfer-source-year" className="h-10 rounded-md border border-input bg-background px-3" value={controller.sourceYear} disabled={controller.loading} onChange={(event) => controller.setSourceYear(Number(event.currentTarget.value))}>
              <option value={wasteAnnualCurrentYear()}>{wasteAnnualCurrentYear()}</option>
              <option value={wasteAnnualCurrentYear() - 1}>{wasteAnnualCurrentYear() - 1}</option>
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{translate('tours.annualTransfer.targetYear', { year: controller.sourceYear + 1 })}</p>
        </div> : null}
        {controller.step === 'preview' || controller.step === 'confirm' ? <AnnualTransferPreview controller={controller} translate={translate} /> : null}
        {controller.step === 'result' && controller.result ? <div ref={controller.summaryRef} tabIndex={-1} role="status" className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">{translate('tours.annualTransfer.result', { count: controller.result.createdCount, year: controller.result.targetYear })}</p>
          <Button type="button" onClick={() => onShowResult(controller.result as WasteAnnualTourTransferResult)}>{translate('tours.annualTransfer.showResult')}</Button>
        </div> : null}
        <DialogFooter><AnnualTransferFooter controller={controller} translate={translate} close={() => onOpenChange(false)} /></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
};
