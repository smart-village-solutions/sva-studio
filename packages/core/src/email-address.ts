const isWhitespaceCodePoint = (character: string): boolean => /\s/u.test(character);

const isDomainLabelCharacter = (character: string): boolean => {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }

  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122) ||
    codePoint === 45
  );
};

const hasWhitespace = (value: string): boolean => {
  for (const character of value) {
    if (isWhitespaceCodePoint(character)) {
      return true;
    }
  }

  return false;
};

const isValidDomainLabel = (label: string): boolean => {
  if (label.length === 0 || label.startsWith('-') || label.endsWith('-')) {
    return false;
  }

  for (const character of label) {
    if (!isDomainLabelCharacter(character)) {
      return false;
    }
  }

  return true;
};

export const isPlausibleEmailAddress = (value: string): boolean => {
  if (value.length === 0 || hasWhitespace(value)) {
    return false;
  }

  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@') || atIndex === value.length - 1) {
    return false;
  }

  const localPart = value.slice(0, atIndex);
  const domainPart = value.slice(atIndex + 1);
  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.') ||
    localPart.includes('..') ||
    domainPart.includes('..')
  ) {
    return false;
  }

  const domainLabels = domainPart.split('.');
  if (domainLabels.length < 2) {
    return false;
  }

  return domainLabels.every(isValidDomainLabel);
};
