const createEmptyHtml = () => '<p></p>';

export const normalizeEditorHtml = (value: string) =>
  value.trim().length > 0 ? value : createEmptyHtml();

const SAFE_LINK_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel']);

export const normalizeLinkHref = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (!schemeMatch) {
    return `https://${trimmed}`;
  }

  return SAFE_LINK_PROTOCOLS.has(schemeMatch[1].toLowerCase()) ? trimmed : '';
};

import type { RichTextBlockTypeValue } from './rich-text-editor-types.js';

export const getHeadingLevel = (value: RichTextBlockTypeValue) =>
  value.startsWith('heading-')
    ? (Number(value.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6)
    : null;
