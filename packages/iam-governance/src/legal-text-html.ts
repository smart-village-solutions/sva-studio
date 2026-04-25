import { createHash } from 'node:crypto';
export { sanitizeLegalTextHtml } from './legal-text-sanitize-html.js';

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
