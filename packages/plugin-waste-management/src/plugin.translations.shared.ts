type TranslationSection = Readonly<Record<string, unknown>>;

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

type MergeTranslationSections<TSections extends readonly TranslationSection[]> = UnionToIntersection<TSections[number]>;

export type CrudActionsCopy = Readonly<{
  openCreate: string;
  edit: string;
  cancel: string;
  create: string;
  save: string;
  saving: string;
}>;

export type CrudDialogCopy = Readonly<{
  createTitle: string;
  createDescription: string;
  editTitle: string;
  editDescription: string;
}>;

export type CrudMessagesCopy = Readonly<{
  createSuccess: string;
  updateSuccess: string;
  saveError: string;
  saveForbidden: string;
}>;

export type WasteManagementTabCardCopy = readonly [
  title: string,
  body: string,
  emptyTitle: string,
  emptyBody: string,
];

type WasteManagementTabsCopy = Readonly<{
  ariaLabel: string;
  fractions: WasteManagementTabCardCopy;
  tours: WasteManagementTabCardCopy;
  locations: WasteManagementTabCardCopy;
  scheduling: WasteManagementTabCardCopy;
  tools: WasteManagementTabCardCopy;
  settings: WasteManagementTabCardCopy;
}>;

type WasteManagementSettingsCopy = Readonly<{
  groupTitle: string;
  groupDescription: string;
  technical: Readonly<{
    title: string;
    description: string;
  }>;
  fields: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
  actions: Readonly<{
    save: string;
    saving: string;
  }>;
  messages: Readonly<{
    loading: string;
    loadError: string;
    loadForbidden: string;
    saveSuccess: string;
    saveError: string;
    saveForbidden: string;
  }>;
}>;

type WasteManagementOverviewCopy = Readonly<{
  messages: Readonly<Record<string, string>>;
  sections: Readonly<Record<string, string>>;
  technicalTable: Readonly<Record<string, string>>;
  auditTable: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
  outcome: Readonly<Record<string, string>>;
}>;

type WasteManagementLocationsWorkspaceCopy = Readonly<{
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  emptyRegions: string;
  emptyCities: string;
  emptyStreets: string;
  emptyHouseNumbers: string;
  actions: Readonly<Record<string, string>>;
  filters: Readonly<Record<string, string>>;
  table: Readonly<Record<string, string>>;
}>;

type WasteManagementToolsCopy = Readonly<{
  imports: Readonly<{
    title: string;
    description: string;
    profileLabel: string;
    blobRefLabel: string;
    sourceFormatLabel: string;
    sourceFormats: Readonly<Record<string, string>>;
    dryRunLabel: string;
    templateColumns: string;
  }>;
  migrations: Readonly<{
    title: string;
    description: string;
    schemaLabel: string;
    versionLabel: string;
  }>;
  seed: Readonly<{
    title: string;
    description: string;
  }>;
  reset: Readonly<{
    title: string;
    description: string;
    tokenLabel: string;
    confirmTitle: string;
    confirmDescription: string;
    confirmCancel: string;
    confirmAction: string;
  }>;
  actions: Readonly<Record<string, string>>;
  messages: Readonly<Record<string, string>>;
  meta: Readonly<Record<string, string>>;
}>;

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
  dialog: CrudDialogCopy;
  meta: Readonly<Record<string, string>>;
  table: Readonly<Record<string, string>>;
  recurrence: Readonly<Record<string, string>>;
  customDatesTitle: string;
  messages: Readonly<Record<string, string>>;
  assignments?: WasteManagementToursAssignmentsCopy;
  yearCalendar?: WasteManagementToursYearCalendarCopy;
}>;

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

const createTabCard = <const TCopy extends WasteManagementTabCardCopy>(copy: TCopy) => {
  const [title, body, emptyTitle, emptyBody] = copy;

  return {
    title,
    body,
    emptyTitle,
    emptyBody,
  } as const;
};

const createOptionalSection = <
  const TBase extends Readonly<Record<string, unknown>>,
  const TKey extends string,
  const TValue extends Readonly<Record<string, unknown>> | undefined,
>(
  base: TBase,
  key: TKey,
  value: TValue,
) => {
  if (value === undefined) {
    return base;
  }

  return {
    ...base,
    [key]: value,
  } as const;
};

export const createCrudActions = <const TCopy extends CrudActionsCopy>(copy: TCopy) => ({ ...copy }) as const;

export const createCrudDialog = <const TCopy extends CrudDialogCopy>(copy: TCopy) => ({ ...copy }) as const;

export const createCrudMessages = <const TCopy extends CrudMessagesCopy>(copy: TCopy) => ({ ...copy }) as const;

export const createMasterDataTabs = (ariaLabel: string, fractions: string, locations: string) =>
  ({
    ariaLabel,
    fractions,
    locations,
  }) as const;

export const createSchedulingScopeTranslations = <const TCopy extends WasteManagementSchedulingScopeCopy>(copy: TCopy) =>
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

export const createToursAssignmentsTranslations = <const TCopy extends WasteManagementToursAssignmentsCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    actions: createCrudActions(copy.actions),
    fields: copy.fields,
    dialog: copy.dialog,
    meta: copy.meta,
    messages: createCrudMessages(copy.messages),
  }) as const;

export const createToursYearCalendarTranslations = <const TCopy extends WasteManagementToursYearCalendarCopy>(copy: TCopy) =>
  ({
    title: copy.title,
    description: copy.description,
    descriptionFallback: copy.descriptionFallback,
    actions: copy.actions,
    meta: copy.meta,
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

export const createWasteManagementTabsTranslations = <const TCopy extends WasteManagementTabsCopy>(copy: TCopy) =>
  ({
    tabs: {
      ariaLabel: copy.ariaLabel,
      fractions: createTabCard(copy.fractions),
      tours: createTabCard(copy.tours),
      locations: createTabCard(copy.locations),
      scheduling: createTabCard(copy.scheduling),
      tools: createTabCard(copy.tools),
      settings: createTabCard(copy.settings),
    },
  }) as const;

export const createWasteManagementSettingsTranslations = <const TCopy extends WasteManagementSettingsCopy>(copy: TCopy) =>
  ({
    settings: {
      groupTitle: copy.groupTitle,
      groupDescription: copy.groupDescription,
      technical: copy.technical,
      fields: copy.fields,
      meta: copy.meta,
      actions: copy.actions,
      messages: copy.messages,
    },
  }) as const;

export const createWasteManagementOverviewTranslations = <const TCopy extends WasteManagementOverviewCopy>(copy: TCopy) =>
  ({
    overview: {
      messages: copy.messages,
      sections: copy.sections,
      technical: {
        table: copy.technicalTable,
      },
      audit: {
        table: copy.auditTable,
      },
      meta: copy.meta,
      outcome: copy.outcome,
    },
  }) as const;

export const createWasteManagementLocationsWorkspaceTranslations = <
  const TCopy extends WasteManagementLocationsWorkspaceCopy,
>(
  copy: TCopy,
) =>
  ({
    title: copy.title,
    description: copy.description,
    emptyTitle: copy.emptyTitle,
    emptyBody: copy.emptyBody,
    emptyRegions: copy.emptyRegions,
    emptyCities: copy.emptyCities,
    emptyStreets: copy.emptyStreets,
    emptyHouseNumbers: copy.emptyHouseNumbers,
    actions: copy.actions,
    filters: copy.filters,
    table: copy.table,
  }) as const;

export const createWasteManagementToolsTranslations = <const TCopy extends WasteManagementToolsCopy>(copy: TCopy) =>
  ({
    tools: {
      imports: copy.imports,
      migrations: copy.migrations,
      seed: copy.seed,
      reset: copy.reset,
      actions: copy.actions,
      messages: copy.messages,
      meta: copy.meta,
    },
  }) as const;

export const createWasteManagementSchedulingTranslations = <const TCopy extends WasteManagementSchedulingCopy>(copy: TCopy) =>
  ({
    scheduling: {
      global: createSchedulingScopeTranslations(copy.global),
      tour: createSchedulingScopeTranslations(copy.tour),
      meta: copy.meta,
      reasonTypes: copy.reasonTypes,
      followUpModes: copy.followUpModes,
      messages: copy.messages,
      table: copy.table,
    },
  }) as const;

export const createWasteManagementToursTranslations = <const TCopy extends WasteManagementToursCopy>(copy: TCopy) =>
  ({
    tours: createOptionalSection(
      createOptionalSection(
        {
          actions: createCrudActions(copy.actions),
          fields: copy.fields,
          dialog: createCrudDialog(copy.dialog),
          meta: copy.meta,
          table: copy.table,
          recurrence: copy.recurrence,
          customDates: {
            title: copy.customDatesTitle,
          },
          messages: copy.messages,
        } as const,
        'assignments',
        copy.assignments,
      ),
      'yearCalendar',
      copy.yearCalendar,
    ),
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

export const createWasteManagementPluginTranslationLocale = <const TSections extends readonly TranslationSection[]>(
  sections: TSections,
) =>
  ({
    wasteManagement: Object.assign({}, ...sections) as MergeTranslationSections<TSections>,
  }) as const;
