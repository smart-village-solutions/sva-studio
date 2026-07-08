type ErrorLike = {
  readonly message?: unknown;
  readonly type?: unknown;
};

export const readFieldError = <T extends ErrorLike>(value: unknown): T | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as T) : undefined;
};
