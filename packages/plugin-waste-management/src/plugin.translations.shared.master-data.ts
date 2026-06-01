import {
  createCrudActions,
  createCrudDialog,
  createCrudMessages,
  type CrudActionsCopy,
  type CrudDialogCopy,
  type CrudMessagesCopy,
} from './plugin.translations.shared.base.js';

type MasterDataTabsCopy = Readonly<{
  ariaLabel: string;
  fractions: string;
  locations: string;
}>;

type MasterDataEntityCopy = Readonly<{
  title: string;
  description: string;
  actions: CrudActionsCopy;
  fields: Readonly<Record<string, string>>;
  dialog: CrudDialogCopy;
  messages: CrudMessagesCopy;
  meta?: Readonly<Record<string, string>>;
}>;

type MasterDataFractionsCopy = Readonly<{
  title: string;
  description: string;
  color: string;
  containerSize: string;
  table: Readonly<Record<string, string>>;
  actions: Readonly<CrudActionsCopy & { delete: string }>;
  fields: Readonly<Record<string, string>>;
  filters: Readonly<{
    open: string;
    reset: string;
    title: string;
    description: string;
    statusLabel: string;
    apply: string;
    cancel: string;
    status: Readonly<Record<'all' | 'active' | 'inactive', string>>;
  }>;
  createView: MasterDataFractionsCreateViewCopy;
  translationBadge: string;
  dialog: CrudDialogCopy;
  deleteDialog: Readonly<Record<string, string>>;
  messages: Readonly<CrudMessagesCopy & { deleteSuccess: string; deleteError: string; deleteForbidden: string; deleteConflict: string }>;
}>;

type MasterDataFractionsCreateViewCopy = Readonly<{
  title: string;
  description: string;
  colorPickerLabel: string;
  sections: Readonly<{
    basics: string;
    basicsHint: string;
    presentation: string;
    presentationHint: string;
    visibility: string;
    visibilityHint: string;
  }>;
  fieldHints: Readonly<{
    name: string;
    description: string;
    translationDe: string;
    translationEn: string;
    containerSize: string;
    color: string;
    active: string;
  }>;
  statusHints: Readonly<{
    active: string;
    inactive: string;
  }>;
  validation: Readonly<{
    nameRequired: string;
    colorRequired: string;
  }>;
  meta: Readonly<{
    descriptionCounter: string;
  }>;
  actions: Readonly<{
    backToList: string;
    cancel: string;
    savePrimary: string;
  }>;
  preview: Readonly<{
    title: string;
    description: string;
    placeholderName: string;
    placeholderDescription: string;
    placeholderContainerSize: string;
    tableTitle: string;
    tableBody: string;
  }>;
  help: Readonly<{
    title: string;
    body: string;
  }>;
}>;

type CollectionLocationsBulkCopy = Readonly<{
  actions: Readonly<{
    openAssign: string;
    selectAllFiltered: string;
    cancel: string;
    assign: string;
    saving: string;
  }>;
  fields: Readonly<Record<string, string>>;
  dialog: Readonly<Record<string, string>>;
  selectedTitle: string;
  meta: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
}>;

type CollectionLocationsAssignmentEditorCopy = Readonly<{
  title: string;
  description: string;
  empty: string;
  actions: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
}>;

type CollectionLocationsCopy = Readonly<{
  title: string;
  description: string;
  actions: Readonly<CrudActionsCopy & { copy: string; delete: string }>;
  fields: Readonly<Record<string, string>>;
  dialog: CrudDialogCopy;
  meta: Readonly<Record<string, string>>;
  messages: Readonly<
    CrudMessagesCopy & { deleteSuccess: string; deleteError: string; deleteForbidden: string; deleteConflict: string }
  >;
  assignmentEditor: CollectionLocationsAssignmentEditorCopy;
  bulk: CollectionLocationsBulkCopy;
}>;

type WasteManagementMasterDataCopy<TLocationsWorkspace> = Readonly<{
  meta: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
  tabs: MasterDataTabsCopy;
  locationsWorkspace: TLocationsWorkspace;
  fractions: MasterDataFractionsCopy;
  regions: MasterDataEntityCopy;
  cities: MasterDataEntityCopy;
  streets: MasterDataEntityCopy;
  houseNumbers: MasterDataEntityCopy;
  collectionLocations: CollectionLocationsCopy;
}>;

export const createMasterDataTabs = (ariaLabel: string, fractions: string, locations: string) =>
  ({
    ariaLabel,
    fractions,
    locations,
  }) as const;

export const createMasterDataEntityTranslations = <const TCopy extends MasterDataEntityCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: createCrudDialog(copy.dialog),
    messages: createCrudMessages(copy.messages),
    ...(copy.meta ?? {}),
  }) as const;

export const createMasterDataFractionsTranslations = <const TCopy extends MasterDataFractionsCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    color: copy.color,
    containerSize: copy.containerSize,
    table: copy.table,
    actions: copy.actions,
    fields: copy.fields,
    filters: copy.filters,
    createView: copy.createView,
    translationBadge: copy.translationBadge,
    dialog: createCrudDialog(copy.dialog),
    deleteDialog: copy.deleteDialog,
    messages: copy.messages,
  }) as const;

export const createCollectionLocationsBulkTranslations = <const TCopy extends CollectionLocationsBulkCopy>(copy: TCopy) =>
  ({
    actions: copy.actions,
    fields: copy.fields,
    dialog: copy.dialog,
    selectedTitle: copy.selectedTitle,
    meta: copy.meta,
    messages: copy.messages,
  }) as const;

export const createCollectionLocationsAssignmentEditorTranslations = <
  const TCopy extends CollectionLocationsAssignmentEditorCopy,
>(
  copy: TCopy,
) =>
  ({
    title: copy.title,
    description: copy.description,
    empty: copy.empty,
    actions: copy.actions,
    meta: copy.meta,
    messages: copy.messages,
  }) as const;

export const createCollectionLocationsTranslations = <const TCopy extends CollectionLocationsCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: createCrudDialog(copy.dialog),
    meta: copy.meta,
    messages: createCrudMessages(copy.messages),
    assignmentEditor: createCollectionLocationsAssignmentEditorTranslations(copy.assignmentEditor),
    bulk: createCollectionLocationsBulkTranslations(copy.bulk),
  }) as const;

export const createWasteManagementMasterDataTranslations = <
  const TLocationsWorkspace,
  const TCopy extends WasteManagementMasterDataCopy<TLocationsWorkspace>,
>(
  copy: TCopy,
) =>
  ({
    masterData: {
      meta: copy.meta,
      messages: copy.messages,
      tabs: copy.tabs,
      locationsWorkspace: copy.locationsWorkspace,
      fractions: createMasterDataFractionsTranslations(copy.fractions),
      regions: createMasterDataEntityTranslations(copy.regions),
      cities: createMasterDataEntityTranslations(copy.cities),
      streets: createMasterDataEntityTranslations(copy.streets),
      houseNumbers: createMasterDataEntityTranslations(copy.houseNumbers),
      collectionLocations: createCollectionLocationsTranslations(copy.collectionLocations),
    },
  }) as const;
