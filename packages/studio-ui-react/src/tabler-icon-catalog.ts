// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Ambient vendor types have no runtime JS module to import.
/// <reference path="../types/tabler-icons.d.ts" preserve="true" />
/** Reuse Tabler's shipped metadata; glyph modules remain lazy. */
import names from '@tabler/icons-react/dist/esm/icons-list.mjs';
export const tablerIconNames: readonly string[] = names.filter((name) => !name.endsWith('-filled'));
export const tablerIconExports: Readonly<Record<string, string>> = Object.fromEntries(
  tablerIconNames.map((name) => [
    name,
    'Icon' +
      name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(''),
  ])
);
export const isTablerIconName = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(tablerIconExports, name);
