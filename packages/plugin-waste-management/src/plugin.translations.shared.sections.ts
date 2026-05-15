import { createTabCard, type WasteManagementTabCardCopy } from './plugin.translations.shared.base.js';

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
      technical: { table: copy.technicalTable },
      audit: { table: copy.auditTable },
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
