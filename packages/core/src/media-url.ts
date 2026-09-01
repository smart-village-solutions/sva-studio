const sensitiveMediaUrlQueryKeys = new Set([
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-security-token',
  'x-amz-expires',
  'x-goog-signature',
  'googleaccessid',
  'awsaccesskeyid',
  'signature',
  'token',
  'expires',
  'sig',
  'se',
  'sp',
  'sv',
]);

const isPersistableMediaUrlForProtocols = (
  value: string,
  protocols: ReadonlySet<string>
): boolean => {
  try {
    const url = new URL(value);
    if (!protocols.has(url.protocol) || url.username || url.password) return false;
    return [...url.searchParams.keys()].every(
      (key) => sensitiveMediaUrlQueryKeys.has(key.toLowerCase()) === false
    );
  } catch {
    return false;
  }
};

const httpsProtocols = new Set(['https:']);
const manualMediaProtocols = new Set(['http:', 'https:']);

export const isPersistableMediaAssetUrl = (value: string): boolean =>
  isPersistableMediaUrlForProtocols(value, httpsProtocols);

export const isPersistableManualMediaUrl = (value: string): boolean =>
  isPersistableMediaUrlForProtocols(value, manualMediaProtocols);

export type ManualMediaUrlInspection =
  | Readonly<{ kind: 'empty'; value: '' }>
  | Readonly<{ kind: 'https'; value: string }>
  | Readonly<{
      kind: 'upgrade';
      value: string;
      httpsCandidate: string;
      httpFallback: boolean;
    }>
  | Readonly<{ kind: 'invalid'; value: string }>;

const explicitSchemePattern = /^[a-z][a-z\d+.-]*:/iu;
const protocolFreeHostWithPortPattern = /^[a-z\d.-]+:\d+(?:[/?#]|$)/iu;

export const inspectManualMediaUrl = (input: string): ManualMediaUrlInspection => {
  const value = input.trim();
  if (value.length === 0) return { kind: 'empty', value: '' };

  const hasExplicitScheme =
    explicitSchemePattern.test(value) && !protocolFreeHostWithPortPattern.test(value);
  if (!hasExplicitScheme) {
    const httpsCandidate = `https://${value}`;
    return isPersistableMediaAssetUrl(httpsCandidate)
      ? { kind: 'upgrade', value, httpsCandidate, httpFallback: false }
      : { kind: 'invalid', value };
  }

  if (!isPersistableManualMediaUrl(value)) return { kind: 'invalid', value };
  const parsed = new URL(value);
  if (parsed.protocol === 'https:') return { kind: 'https', value };
  parsed.protocol = 'https:';
  return {
    kind: 'upgrade',
    value,
    httpsCandidate: parsed.toString(),
    httpFallback: true,
  };
};
