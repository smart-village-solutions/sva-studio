type UserDisplayIdentity = {
  readonly id: string;
  readonly name?: string;
  readonly displayName?: string;
};

export const resolveUserDisplayName = (user: UserDisplayIdentity): string =>
  user.displayName?.trim() || user.name?.trim() || user.id;

export const resolveUserInitials = (value: string): string => {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return '';
  }

  const initials = normalizedValue
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || normalizedValue.slice(0, 2).toUpperCase();
};
