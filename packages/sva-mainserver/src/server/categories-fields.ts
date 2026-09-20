export const CATEGORY_POSITION_MAX = 2_147_483_647;
export const CATEGORY_ICON_NAME_MAX_LENGTH = 255;

const DATA_TYPE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
const ICON_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7E]+$/u;

export const isCategoryDataTypeIdentifier = (value: string): boolean =>
  DATA_TYPE_IDENTIFIER_PATTERN.test(value);

const isHttpIconUrl = (value: string): boolean => {
  if (!VISIBLE_ASCII_PATTERN.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isCategoryIconName = (value: string): boolean =>
  value.length <= CATEGORY_ICON_NAME_MAX_LENGTH &&
  (ICON_NAME_PATTERN.test(value) || isHttpIconUrl(value));
