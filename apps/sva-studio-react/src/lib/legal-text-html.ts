const SAFE_BLANK_TARGET_REL = 'noopener noreferrer';
const FALLBACK_EMPTY_HTML = '<p></p>';

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

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
const STRIP_WITH_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript']);

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

const createFallbackHtml = (value: string): string => {
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .trim();

  return escaped.length > 0 ? `<p>${escaped}</p>` : FALLBACK_EMPTY_HTML;
};

const sanitizeHref = (value: string): string | null => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  if (trimmedValue.startsWith('/')) {
    return trimmedValue;
  }

  try {
    const url = new URL(trimmedValue, 'https://sva.invalid');
    return ALLOWED_SCHEMES.has(url.protocol) ? trimmedValue : null;
  } catch {
    return null;
  }
};

const sanitizeNode = (node: Node, document: Document): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const sourceElement = node as HTMLElement;
  const tagName = sourceElement.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    if (STRIP_WITH_CONTENT_TAGS.has(tagName)) {
      return null;
    }

    const fragment = document.createDocumentFragment();
    for (const child of [...sourceElement.childNodes]) {
      const sanitizedChild = sanitizeNode(child, document);
      if (sanitizedChild) {
        fragment.appendChild(sanitizedChild);
      }
    }
    return fragment;
  }

  const element = document.createElement(tagName);
  if (tagName === 'a') {
    const sanitizedHref = sanitizeHref(sourceElement.getAttribute('href') ?? '');
    if (sanitizedHref) {
      element.setAttribute('href', sanitizedHref);
    }

    if (sourceElement.getAttribute('target') === '_blank') {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', SAFE_BLANK_TARGET_REL);
    }
  }

  for (const child of [...sourceElement.childNodes]) {
    const sanitizedChild = sanitizeNode(child, document);
    if (sanitizedChild) {
      element.appendChild(sanitizedChild);
    }
  }

  return element;
};

export const sanitizeLegalTextHtml = (value: string): string => {
  if (typeof globalThis.document === 'undefined' || typeof DOMParser === 'undefined') {
    return createFallbackHtml(collapseWhitespace(value));
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(value, 'text/html');
  const outputDocument = globalThis.document.implementation.createHTMLDocument('');
  const container = outputDocument.createElement('div');

  for (const node of [...parsedDocument.body.childNodes]) {
    const sanitizedNode = sanitizeNode(node, outputDocument);
    if (sanitizedNode) {
      container.appendChild(sanitizedNode);
    }
  }

  const sanitized = collapseWhitespace(container.innerHTML);
  return sanitized.length > 0 ? sanitized : FALLBACK_EMPTY_HTML;
};
