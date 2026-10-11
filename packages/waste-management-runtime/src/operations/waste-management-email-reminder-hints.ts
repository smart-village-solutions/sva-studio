import { convertRichTextHtmlToPlainText } from '@sva/core';

export const buildReminderHintText = (hints: readonly string[] | undefined): string =>
  Array.from(
    new Set(
      (hints ?? [])
        .map((hint) => convertRichTextHtmlToPlainText(hint))
        .filter((hint) => hint.length > 0)
    )
  ).join('\n\n');
