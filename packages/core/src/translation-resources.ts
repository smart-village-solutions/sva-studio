export type TranslationResourceNode =
  string | undefined | { readonly [key: string]: TranslationResourceNode };

export type TranslationResourceKey<Resource> = {
  [Key in keyof Resource & (string | number)]-?: NonNullable<Resource[Key]> extends string
    ? `${Key}`
    : NonNullable<Resource[Key]> extends object
      ? `${Key}.${TranslationResourceKey<NonNullable<Resource[Key]>>}`
      : never;
}[keyof Resource & (string | number)];

export type TranslationVariables = Readonly<Record<string, string | number>>;

const readTranslationValue = (
  resource: TranslationResourceNode,
  key: string
): string | undefined => {
  const segments = key.split('.');
  let pointer: unknown = resource;

  for (const segment of segments) {
    if (
      !pointer ||
      typeof pointer !== 'object' ||
      !Object.prototype.hasOwnProperty.call(pointer, segment)
    ) {
      return undefined;
    }

    pointer = (pointer as Record<string, unknown>)[segment];
  }

  return typeof pointer === 'string' ? pointer : undefined;
};

const interpolate = (message: string, variables?: TranslationVariables): string => {
  if (!variables) {
    return message;
  }

  return message.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variableName: string) => {
    const value = variables[variableName];
    return value === undefined ? match : String(value);
  });
};

export const translateResource = (
  resource: TranslationResourceNode,
  fallback: TranslationResourceNode,
  key: string,
  variables?: TranslationVariables
): string => {
  const message = readTranslationValue(resource, key) || readTranslationValue(fallback, key);
  return message ? interpolate(message, variables) : key;
};
