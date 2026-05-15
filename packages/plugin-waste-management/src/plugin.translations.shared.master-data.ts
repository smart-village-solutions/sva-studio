import {
  createCrudActions,
  createCrudDialog,
  createCrudMessages,
  createOptionalSection,
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
  translationBadge: string;
  dialog: CrudDialogCopy;
  deleteDialog: Readonly<Record<string, string>>;
  messages: Readonly<CrudMessagesCopy & { deleteSuccess: string; deleteError: string; deleteForbidden: string; deleteConflict: string }>;
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

type CollectionLocationsCopy = Readonly<{
  title: string;
  description: string;
  actions: CrudActionsCopy;
  fields: Readonly<Record<string, string>>;
  dialog: CrudDialogCopy;
  meta: Readonly<Record<string, string>>;
  messages: CrudMessagesCopy;
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
  createOptionalSection(
    {
      title: copy.title,
      description: copy.description,
      actions: createCrudActions(copy.actions),
      fields: copy.fields,
      dialog: createCrudDialog(copy.dialog),
      messages: createCrudMessages(copy.messages),
    } as const,
    'meta',
    copy.meta,
  );

export const createMasterDataFractionsTranslations = <const TCopy extends MasterDataFractionsCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    color: copy.color,
    containerSize: copy.containerSize,
    table: copy.table,
    actions: copy.actions,
    fields: copy.fields,
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

export const createCollectionLocationsTranslations = <const TCopy extends CollectionLocationsCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: createCrudDialog(copy.dialog),
    meta: copy.meta,
    messages: createCrudMessages(copy.messages),
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
