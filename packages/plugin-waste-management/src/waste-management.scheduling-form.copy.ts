type WasteSchedulingFormVariant = 'global' | 'tour';
type WasteSchedulingFormMode = 'create' | 'edit';

type WasteSchedulingFormCopy = Readonly<{
  titleKey: string;
  descriptionKey: string;
  cancelKey: string;
  submitKey: string;
  savingKey: string;
}>;

const schedulingFormCopy = {
  global: {
    create: {
      titleKey: 'scheduling.global.dialog.createTitle',
      descriptionKey: 'scheduling.global.dialog.createDescription',
      cancelKey: 'scheduling.global.actions.cancel',
      submitKey: 'scheduling.global.actions.create',
      savingKey: 'scheduling.global.actions.saving',
    },
    edit: {
      titleKey: 'scheduling.global.dialog.editTitle',
      descriptionKey: 'scheduling.global.dialog.editDescription',
      cancelKey: 'scheduling.global.actions.cancel',
      submitKey: 'scheduling.global.actions.save',
      savingKey: 'scheduling.global.actions.saving',
    },
  },
  tour: {
    create: {
      titleKey: 'scheduling.tour.dialog.createTitle',
      descriptionKey: 'scheduling.tour.dialog.createDescription',
      cancelKey: 'scheduling.tour.actions.cancel',
      submitKey: 'scheduling.tour.actions.create',
      savingKey: 'scheduling.tour.actions.saving',
    },
    edit: {
      titleKey: 'scheduling.tour.dialog.editTitle',
      descriptionKey: 'scheduling.tour.dialog.editDescription',
      cancelKey: 'scheduling.tour.actions.cancel',
      submitKey: 'scheduling.tour.actions.save',
      savingKey: 'scheduling.tour.actions.saving',
    },
  },
} as const satisfies Record<WasteSchedulingFormVariant, Record<WasteSchedulingFormMode, WasteSchedulingFormCopy>>;

export const resolveWasteSchedulingFormCopy = (
  variant: WasteSchedulingFormVariant,
  mode: WasteSchedulingFormMode,
) => schedulingFormCopy[variant][mode];
