import { createHash } from 'node:crypto';
export { sanitizeLegalTextHtml } from './sanitize-html.shared.js';

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
