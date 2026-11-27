import type { CatalogValue } from '@sva/core';
import { z } from 'zod';

export const translateStaticHtml = async (
  translate: (values: readonly CatalogValue[], signal: AbortSignal) => Promise<CatalogValue[]>,
  html: string,
  signal: AbortSignal
): Promise<string[]> => {
  // Mainserver sends one paragraph per visible text node and reapplies the result to its original DOM.
  const paragraphs = Array.from(html.matchAll(/<p>([^<>]+)<\/p>/gu), ([, text]) =>
    text!.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
  );
  const [result] = await translate([paragraphs], signal);
  const translated = z.array(z.string().trim().min(1)).length(paragraphs.length).safeParse(result);
  if (!translated.success) throw new Error('deepl_invalid_response');
  return [
    translated.data
      .map(
        (text) =>
          `<p>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`
      )
      .join(''),
  ];
};
