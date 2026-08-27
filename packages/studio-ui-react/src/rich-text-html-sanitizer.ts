import DOMPurify from 'dompurify';
import {
  RICH_TEXT_ALLOWED_SCHEMES,
  RICH_TEXT_ALLOWED_TAGS,
} from '@sva/core/rich-text-html-policy';

const SAFE_BLANK_TARGET_REL = 'noopener noreferrer';
let browserPurifier: ReturnType<typeof DOMPurify> | undefined;

const isAllowedHref = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return false;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, 'https://studio.smart-village.app');
    return RICH_TEXT_ALLOWED_SCHEMES.some((scheme) => parsed.protocol === `${scheme}:`);
  } catch {
    return false;
  }
};

const normalizeAllowedAttributes = (value: string): string => {
  const template = document.createElement('template');
  template.innerHTML = value;

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    if (element.tagName.toLowerCase() === 'a') {
      const href = element.getAttribute('href');
      if (href && !isAllowedHref(href)) {
        element.removeAttribute('href');
      }

      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', SAFE_BLANK_TARGET_REL);
      } else {
        element.removeAttribute('target');
        element.removeAttribute('rel');
      }
    } else {
      element.removeAttribute('href');
      element.removeAttribute('target');
      element.removeAttribute('rel');
    }

    if (element.tagName.toLowerCase() === 'ol') {
      const start = element.getAttribute('start');
      if (start && !/^-?\d+$/.test(start)) {
        element.removeAttribute('start');
      }
    } else {
      element.removeAttribute('start');
    }
  }

  return template.innerHTML;
};

export const sanitizeRichTextEditorHtml = (value: string): string => {
  if (typeof document === 'undefined') {
    return value;
  }

  browserPurifier ??= DOMPurify(window);
  const sanitized = browserPurifier.sanitize(value, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'start'],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });

  return normalizeAllowedAttributes(sanitized);
};
