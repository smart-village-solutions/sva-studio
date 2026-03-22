import { createHash } from 'node:crypto';

const SCRIPT_OPEN_TOKEN = '<script';
const SCRIPT_CLOSE_TOKEN = '</script';

const findTagEnd = (value: string, start: number): number => {
  let quote: '"' | "'" | null = null;

  for (let index = start; index < value.length; index += 1) {
    const current = value[index];
    if (quote) {
      if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }

    if (current === '>') {
      return index;
    }
  }

  return -1;
};

const stripScriptTags = (value: string): string => {
  let sanitized = value;

  while (true) {
    const normalized = sanitized.toLowerCase();
    const scriptStart = normalized.indexOf(SCRIPT_OPEN_TOKEN);
    if (scriptStart === -1) {
      return sanitized;
    }

    const openStart = normalized.lastIndexOf('<', scriptStart);
    if (openStart === -1) {
      return sanitized;
    }

    const openEnd = findTagEnd(sanitized, openStart);
    if (openEnd === -1) {
      return sanitized.slice(0, openStart);
    }

    const closeStart = normalized.indexOf(SCRIPT_CLOSE_TOKEN, openEnd + 1);
    if (closeStart === -1) {
      return sanitized.slice(0, openStart);
    }

    const closeOpen = normalized.lastIndexOf('<', closeStart);
    const closeEnd = findTagEnd(sanitized, closeOpen === -1 ? closeStart : closeOpen);
    if (closeEnd === -1) {
      return sanitized.slice(0, openStart);
    }

    sanitized = `${sanitized.slice(0, openStart)}${sanitized.slice(closeEnd + 1)}`;
  }
};

type ParsedAttribute = {
  hasValue: boolean;
  name: string;
  quote: '"' | "'" | null;
  value: string;
};

const parseAttributes = (value: string): ParsedAttribute[] => {
  const attributes: ParsedAttribute[] = [];
  let index = 0;

  while (index < value.length) {
    while (index < value.length && /\s/.test(value[index]!)) {
      index += 1;
    }

    if (index >= value.length) {
      break;
    }

    let nameEnd = index;
    while (nameEnd < value.length && !/[\s=/]/.test(value[nameEnd]!)) {
      nameEnd += 1;
    }

    const name = value.slice(index, nameEnd);
    index = nameEnd;

    while (index < value.length && /\s/.test(value[index]!)) {
      index += 1;
    }

    if (value[index] !== '=') {
      attributes.push({ hasValue: false, name, quote: null, value: '' });
      continue;
    }

    index += 1;
    while (index < value.length && /\s/.test(value[index]!)) {
      index += 1;
    }

    const quoteCandidate = value[index];
    if (quoteCandidate === '"' || quoteCandidate === "'") {
      const quote = quoteCandidate;
      index += 1;
      const valueStart = index;
      while (index < value.length && value[index] !== quote) {
        index += 1;
      }
      attributes.push({
        hasValue: true,
        name,
        quote,
        value: value.slice(valueStart, index),
      });
      if (value[index] === quote) {
        index += 1;
      }
      continue;
    }

    const valueStart = index;
    while (index < value.length && !/\s/.test(value[index]!)) {
      index += 1;
    }
    attributes.push({
      hasValue: true,
      name,
      quote: null,
      value: value.slice(valueStart, index),
    });
  }

  return attributes;
};

const sanitizeAttribute = (attribute: ParsedAttribute): string | null => {
  const normalizedName = attribute.name.toLowerCase();
  if (normalizedName.startsWith('on')) {
    return null;
  }

  if (!attribute.hasValue) {
    return attribute.name;
  }

  let nextValue = attribute.value;
  if ((normalizedName === 'href' || normalizedName === 'src') && nextValue.trimStart().toLowerCase().startsWith('javascript:')) {
    nextValue = '#';
  }

  if (attribute.quote) {
    return `${attribute.name}=${attribute.quote}${nextValue}${attribute.quote}`;
  }

  return `${attribute.name}="${nextValue}"`;
};

const sanitizeTag = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith('!') || trimmed.startsWith('?') || trimmed.startsWith('/')) {
    return `<${value}>`;
  }

  const selfClosing = trimmed.endsWith('/');
  const normalized = selfClosing ? trimmed.slice(0, -1).trimEnd() : trimmed;
  const firstWhitespace = normalized.search(/\s/);
  const tagName = firstWhitespace === -1 ? normalized : normalized.slice(0, firstWhitespace);
  const attributesSource = firstWhitespace === -1 ? '' : normalized.slice(firstWhitespace + 1);
  const sanitizedAttributes = parseAttributes(attributesSource)
    .map(sanitizeAttribute)
    .filter((attribute): attribute is string => attribute !== null);
  const attributes = sanitizedAttributes.length > 0 ? ` ${sanitizedAttributes.join(' ')}` : '';
  const selfClosingSuffix = selfClosing ? ' /' : '';

  return `<${tagName}${attributes}${selfClosingSuffix}>`;
};

const sanitizeMarkup = (value: string): string => {
  let sanitized = '';
  let index = 0;

  while (index < value.length) {
    const tagStart = value.indexOf('<', index);
    if (tagStart === -1) {
      sanitized += value.slice(index);
      break;
    }

    sanitized += value.slice(index, tagStart);
    const tagEnd = findTagEnd(value, tagStart);
    if (tagEnd === -1) {
      sanitized += value.slice(tagStart);
      break;
    }

    sanitized += sanitizeTag(value.slice(tagStart + 1, tagEnd));
    index = tagEnd + 1;
  }

  return sanitized;
};

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const sanitizeLegalTextHtml = (value: string): string => {
  const sanitized = collapseWhitespace(sanitizeMarkup(stripScriptTags(value)));
  return sanitized.length > 0 ? sanitized : '<p></p>';
};

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
