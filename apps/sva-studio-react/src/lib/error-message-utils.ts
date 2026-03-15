export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const extractMessageFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directKeys = ['message', 'error', 'detail', 'title', 'statusText'] as const;
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  const nestedKeys = ['data', 'cause', 'response', 'body'] as const;
  for (const key of nestedKeys) {
    const nested = extractMessageFromUnknown(value[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

export const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const extracted = extractMessageFromUnknown(error);
  if (extracted) {
    return extracted;
  }

  return fallback;
};

export const extractErrorDiagnostics = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const causeMessage = extractMessageFromUnknown((error as Error & { cause?: unknown }).cause);

    return {
      error_type: error.constructor.name,
      error_message: error.message,
      ...(causeMessage ? { error_cause_message: causeMessage } : {}),
    };
  }

  const extracted = extractMessageFromUnknown(error);

  return {
    error_type: typeof error,
    error_message: extracted ?? String(error),
  };
};
