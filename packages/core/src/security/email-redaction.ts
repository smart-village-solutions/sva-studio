const isEmailLocalChar = (character: string): boolean => /[A-Za-z0-9._%+-]/.test(character);

const isEmailDomainChar = (character: string): boolean => /[A-Za-z0-9.-]/.test(character);

const isLikelyDomain = (domain: string): boolean => {
  const labels = domain.split('.');
  if (labels.length < 2) {
    return false;
  }

  const topLevelLabel = labels[labels.length - 1] ?? '';
  return labels.every((label) => /^[A-Za-z0-9-]+$/.test(label) && label.length > 0) && /^[A-Za-z]{2,}$/.test(topLevelLabel);
};

export const maskEmailAddresses = (value: string): string => {
  let next = '';
  let cursor = 0;

  while (cursor < value.length) {
    const atIndex = value.indexOf('@', cursor);
    if (atIndex === -1) {
      next += value.slice(cursor);
      break;
    }

    let localStart = atIndex - 1;
    while (localStart >= cursor) {
      const localCharacter = value[localStart];
      if (!localCharacter || !isEmailLocalChar(localCharacter)) {
        break;
      }
      localStart -= 1;
    }
    localStart += 1;

    let domainEnd = atIndex + 1;
    while (domainEnd < value.length) {
      const domainCharacter = value[domainEnd];
      if (!domainCharacter || !isEmailDomainChar(domainCharacter)) {
        break;
      }
      domainEnd += 1;
    }

    const localPart = value.slice(localStart, atIndex);
    const domainPart = value.slice(atIndex + 1, domainEnd);

    if (localPart.length === 0 || !isLikelyDomain(domainPart)) {
      next += value.slice(cursor, atIndex + 1);
      cursor = atIndex + 1;
      continue;
    }

    next += value.slice(cursor, localStart);
    next += `${localPart[0]}***@${domainPart}`;
    cursor = domainEnd;
  }

  return next;
};
