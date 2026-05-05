const SAFE_BLANK_TARGET_REL = 'noopener noreferrer';

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'u',
  'ul',
]);

const DISCARD_WITH_CONTENT_TAGS = new Set(['script', 'style']);

const collapseWhitespace = (value: string): string => {
  let collapsed = '';
  let previousWasWhitespace = true;

  for (const character of value) {
    const isWhitespace = character.trim().length === 0;
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        collapsed += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    collapsed += character;
    previousWasWhitespace = false;
  }

  return previousWasWhitespace ? collapsed.trimEnd() : collapsed;
};

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
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
};

const sanitizeBrowserHtml = (value: string): string => {
  const template = document.createElement('template');
  template.innerHTML = value;

  const sanitizeNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const sourceElement = node as HTMLElement;
    const tagName = sourceElement.tagName.toLowerCase();

    if (DISCARD_WITH_CONTENT_TAGS.has(tagName)) {
      return null;
    }

    const sanitizedChildren = document.createDocumentFragment();

    for (const child of Array.from(sourceElement.childNodes)) {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) {
        sanitizedChildren.appendChild(sanitizedChild);
      }
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      return sanitizedChildren;
    }

    const element = document.createElement(tagName);

    if (tagName === 'a') {
      const href = sourceElement.getAttribute('href');
      if (href && isAllowedHref(href)) {
        element.setAttribute('href', href);
      }

      const target = sourceElement.getAttribute('target');
      if (target) {
        element.setAttribute('target', target);
      }

      const rel = target === '_blank'
        ? SAFE_BLANK_TARGET_REL
        : sourceElement.getAttribute('rel');
      if (rel) {
        element.setAttribute('rel', rel);
      }
    }

    element.appendChild(sanitizedChildren);
    return element;
  };

  const sanitizedRoot = document.createDocumentFragment();
  for (const child of Array.from(template.content.childNodes)) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      sanitizedRoot.appendChild(sanitizedChild);
    }
  }

  const container = document.createElement('div');
  container.appendChild(sanitizedRoot);
  return container.innerHTML;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizeWithoutBrowserDom = (value: string): string => {
  const plainText = collapseWhitespace(value);
  if (!plainText) {
    return '<p></p>';
  }

  return `<p>${escapeHtml(plainText)}</p>`;
};

export const sanitizeLegalTextHtml = (value: string): string => {
  const sanitized = collapseWhitespace(
    typeof document === 'undefined' ? sanitizeWithoutBrowserDom(value) : sanitizeBrowserHtml(value)
  );

  return sanitized.length > 0 ? sanitized : '<p></p>';
};
