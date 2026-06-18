export const pickInitials = (displayName: string) => {
  const parts = displayName
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'NA';
  }

  return parts.map((entry) => entry.charAt(0).toUpperCase()).join('');
};
