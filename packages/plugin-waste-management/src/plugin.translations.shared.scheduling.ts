import {
  createCrudActions,
  createCrudDialog,
  createCrudMessages,
  createOptionalSection,
  type CrudActionsCopy,
  type CrudDialogCopy,
  type CrudMessagesCopy,
} from './plugin.translations.shared.base.js';

type WasteManagementSchedulingScopeCopy = Readonly<{
  title: string;
  description: string;
  cardTitle: string;
  table: Readonly<Record<string, string>>;
  actions: CrudActionsCopy;
  fields: Readonly<Record<string, string>>;
  dialog: CrudDialogCopy;
  messages: CrudMessagesCopy;
}>;

type WasteManagementSchedulingCopy = Readonly<{
  global: WasteManagementSchedulingScopeCopy;
  tour: WasteManagementSchedulingScopeCopy;
  assignments?: Readonly<Record<string, unknown>>;
  holidayRules?: Readonly<Record<string, unknown>>;
  actions: Readonly<Record<string, string>>;
  create: Readonly<Record<string, string>>;
  bulkDeleteDialog: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
  reasonTypes: Readonly<Record<string, string>>;
  followUpModes: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
  table: Readonly<Record<string, string>>;
}>;

type WasteManagementToursAssignmentsCopy = Readonly<{
  title: string;
  actions: CrudActionsCopy;
  fields: Readonly<Record<string, string>>;
  dialog: Readonly<{
    createTitle: string;
    editTitle: string;
    description: string;
    descriptionFallback: string;
  }>;
  meta: Readonly<Record<string, string>>;
  workspace?: Readonly<Record<string, string>>;
  messages: CrudMessagesCopy;
}>;

type WasteManagementToursYearCalendarCopy = Readonly<{
  title: string;
  description: string;
  descriptionFallback: string;
  actions: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
}>;

type WasteManagementToursCopy = Readonly<{
  actions: CrudActionsCopy;
  fields: Readonly<Record<string, string>>;
  filters?: Readonly<{
    open: string;
    reset: string;
    title: string;
    description: string;
    nameLabel: string;
    namePlaceholder: string;
    statusLabel: string;
    fractionLabel: string;
    fractionAll: string;
    firstDateFromLabel: string;
    firstDateToLabel: string;
    endDateFromLabel: string;
    endDateToLabel: string;
    cancel: string;
    apply: string;
    status: Readonly<{
      all: string;
      active: string;
      inactive: string;
    }>;
  }>;
  sections?: Readonly<Record<string, string>>;
  fieldHints?: Readonly<Record<string, string>>;
  statusHints?: Readonly<Record<string, string>>;
  dialog: CrudDialogCopy;
  meta: Readonly<Record<string, string>>;
  table: Readonly<Record<string, string>>;
  recurrence: Readonly<Record<string, string>>;
  customDates: Readonly<{
    title: string;
    description: string;
    empty: string;
    commentHint: string;
    actions: Readonly<Record<string, string>>;
    fields: Readonly<Record<string, string>>;
    assignmentSection?: Readonly<Record<string, string>>;
    messages?: Readonly<Record<string, string>>;
    dialog: Readonly<Record<string, string>>;
    meta: Readonly<Record<string, string>>;
  }>;
  deleteDialog?: Readonly<Record<string, string>>;
  statusDialog?: Readonly<Record<string, string>>;
  bulkDeleteDialog?: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
  assignments?: WasteManagementToursAssignmentsCopy;
  yearCalendar?: WasteManagementToursYearCalendarCopy;
}>;

const createSchedulingScopeTranslations = <const TCopy extends WasteManagementSchedulingScopeCopy>(
  copy: TCopy
) =>
  ({
    title: copy.title,
    description: copy.description,
    cardTitle: copy.cardTitle,
    table: copy.table,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: createCrudDialog(copy.dialog),
    messages: createCrudMessages(copy.messages),
  }) as const;

export const createToursAssignmentsTranslations = <
  const TCopy extends WasteManagementToursAssignmentsCopy,
>(
  copy: TCopy
) =>
  ({
    title: copy.title,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: copy.dialog,
    meta: copy.meta,
    workspace: copy.workspace,
    messages: createCrudMessages(copy.messages),
  }) as const;

export const createToursYearCalendarTranslations = <
  const TCopy extends WasteManagementToursYearCalendarCopy,
>(
  copy: TCopy
) =>
  ({
    title: copy.title,
    description: copy.description,
    descriptionFallback: copy.descriptionFallback,
    actions: copy.actions,
    meta: copy.meta,
  }) as const;

export const createWasteManagementSchedulingTranslations = <
  const TCopy extends WasteManagementSchedulingCopy,
>(
  copy: TCopy
) =>
  ({
    scheduling: {
      global: createSchedulingScopeTranslations(copy.global),
      tour: createSchedulingScopeTranslations(copy.tour),
      assignments: copy.assignments,
      holidayRules: copy.holidayRules,
      actions: copy.actions,
      create: copy.create,
      bulkDeleteDialog: copy.bulkDeleteDialog,
      meta: copy.meta,
      reasonTypes: copy.reasonTypes,
      followUpModes: copy.followUpModes,
      messages: copy.messages,
      table: copy.table,
    },
  }) as const;

export const createWasteManagementToursTranslations = <
  const TCopy extends WasteManagementToursCopy,
>(
  copy: TCopy
) =>
  ({
    tours: createOptionalSection(
      createOptionalSection(
        {
          actions: createCrudActions(copy.actions),
          fields: copy.fields,
          filters: copy.filters,
          sections: copy.sections,
          fieldHints: copy.fieldHints,
          statusHints: copy.statusHints,
          dialog: createCrudDialog(copy.dialog),
          meta: copy.meta,
          table: copy.table,
          recurrence: copy.recurrence,
          customDates: copy.customDates,
          deleteDialog: copy.deleteDialog,
          statusDialog: copy.statusDialog,
          bulkDeleteDialog: copy.bulkDeleteDialog,
          messages: copy.messages,
        } as const,
        'assignments',
        copy.assignments
      ),
      'yearCalendar',
      copy.yearCalendar
    ),
  }) as const;
