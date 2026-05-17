import { describe, expect, it } from 'vitest';

import { resolveWasteSchedulingFormCopy } from '../src/waste-management.scheduling-form.copy.js';

describe('resolveWasteSchedulingFormCopy', () => {
  it('returns static global create copy keys', () => {
    expect(resolveWasteSchedulingFormCopy('global', 'create')).toEqual({
      titleKey: 'scheduling.global.dialog.createTitle',
      descriptionKey: 'scheduling.global.dialog.createDescription',
      cancelKey: 'scheduling.global.actions.cancel',
      submitKey: 'scheduling.global.actions.create',
      savingKey: 'scheduling.global.actions.saving',
    });
  });

  it('returns static tour edit copy keys', () => {
    expect(resolveWasteSchedulingFormCopy('tour', 'edit')).toEqual({
      titleKey: 'scheduling.tour.dialog.editTitle',
      descriptionKey: 'scheduling.tour.dialog.editDescription',
      cancelKey: 'scheduling.tour.actions.cancel',
      submitKey: 'scheduling.tour.actions.save',
      savingKey: 'scheduling.tour.actions.saving',
    });
  });
});
