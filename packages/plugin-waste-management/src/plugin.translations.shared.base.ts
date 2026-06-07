export type TranslationSection = Readonly<Record<string, unknown>>;

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

export const createTabCard = <const TCopy extends WasteManagementTabCardCopy>(copy: TCopy) => {
  const [title, body, emptyTitle, emptyBody] = copy;

  return {
    title,
    body,
    emptyTitle,
    emptyBody,
  } as const;
};

export const createOptionalSection = <
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

const isTranslationRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const mergeTranslationSection = (
  target: Record<string, unknown>,
  source: TranslationSection,
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (isTranslationRecord(current) && isTranslationRecord(value)) {
      target[key] = mergeTranslationSection({ ...current }, value);
      continue;
    }

    target[key] = value;
  }

  return target;
};

export const createWasteManagementPluginTranslationLocale = <const TSections extends readonly TranslationSection[]>(
  sections: TSections,
) =>
  ({
    wasteManagement: sections.reduce<Record<string, unknown>>(
      (mergedSections, section) => mergeTranslationSection(mergedSections, section),
      {},
    ) as MergeTranslationSections<TSections>,
  }) as const;
