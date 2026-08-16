import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type WasteEmailReminderConfig = Readonly<Record<string, unknown>> & {
  readonly publicBaseUrl: string;
};

type WasteSettingsRecord = Readonly<{
  instanceId: string;
  provider: 'postgresql';
  schemaName: string;
  enabled: boolean;
  selectedInterfaceId?: string;
  calendarWebUrl?: string;
  pdfBrandingAssetUrl?: string;
  pdfContactBlock?: string;
  emailReminderConfig?: WasteEmailReminderConfig;
  holidayStateCode?: string;
  customRecurrencePresets?: readonly (Readonly<Record<string, unknown>> & {
    readonly id: string;
    readonly name: string;
    readonly intervalDays: number;
  })[];
}>;

type CutoverDeps = Readonly<{
  fetch: typeof fetch;
  resolveSessionCookie: (command: readonly string[]) => Promise<string>;
}>;

type CutoverResult = Readonly<{
  changed: boolean;
  instanceId: string;
  previousCalendarWebUrl: string;
  previousReminderPublicBaseUrl: string;
  targetBaseUrl: string;
}>;

const execFileAsync = promisify(execFile);

const defaultDeps: CutoverDeps = {
  fetch: globalThis.fetch.bind(globalThis),
  resolveSessionCookie: async ([executable, ...args]) => {
    if (!executable) throw new Error('STUDIO_WASTE_SESSION_COOKIE_COMMAND ist leer.');
    return (
      await execFileAsync(executable, args, {
        encoding: 'utf8',
        maxBuffer: 16_384,
        timeout: 10_000,
      })
    ).stdout.trim();
  },
};

const requireEnvValue = (env: NodeJS.ProcessEnv, key: string): string => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} fehlt.`);
  return value;
};

const parseCommand = (raw: string): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      return parsed;
    }
  } catch {
    // Fall through to the stable, non-secret error below.
  }
  throw new Error('STUDIO_WASTE_SESSION_COOKIE_COMMAND muss ein JSON-String-Array sein.');
};

const normalizeBaseUrl = (raw: string, key: string): string => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${key} ist ungueltig.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${key} muss eine HTTPS-URL ohne Credentials, Query oder Fragment sein.`);
  }
  return url.href.replace(/\/$/u, '');
};

const parseSettingsResponse = async (response: Response): Promise<WasteSettingsRecord> => {
  const payload = (await response.json()) as { readonly data?: unknown };
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Studio-API lieferte keine Waste-Einstellungen.');
  }
  return payload.data as WasteSettingsRecord;
};

const requestSettings = async (
  deps: CutoverDeps,
  baseUrl: string,
  sessionCookie: string,
  init?: RequestInit
): Promise<WasteSettingsRecord> => {
  const endpoint = `${baseUrl}/api/v1/waste-management/settings`;
  const response = await deps.fetch(endpoint, {
    ...init,
    headers: {
      Accept: 'application/json',
      Cookie: sessionCookie,
      Origin: new URL(baseUrl).origin,
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Studio-API ${response.status} beim Waste-Settings-Cutover.`);
  }
  return parseSettingsResponse(response);
};

export const buildWasteSettingsDomainCutoverInput = (
  current: WasteSettingsRecord,
  expectedInstanceId: string,
  targetBaseUrl: string
) => {
  if (current.instanceId !== expectedInstanceId) {
    throw new Error(
      `Waste-Instanz stimmt nicht ueberein: erwartet ${expectedInstanceId}, gefunden ${current.instanceId}.`
    );
  }
  if (current.provider !== 'postgresql') {
    throw new Error('Waste-Settings verwenden nicht den erwarteten PostgreSQL-Provider.');
  }
  if (!current.selectedInterfaceId) {
    throw new Error('Waste-Settings enthalten keine ausgewaehlte Schnittstelle.');
  }
  if (!current.emailReminderConfig) {
    throw new Error('Waste-Settings enthalten keine E-Mail-Erinnerungskonfiguration.');
  }

  return {
    provider: current.provider,
    schemaName: current.schemaName,
    enabled: current.enabled,
    selectedInterfaceId: current.selectedInterfaceId,
    calendarWebUrl: targetBaseUrl,
    pdfBrandingAssetUrl: current.pdfBrandingAssetUrl,
    pdfContactBlock: current.pdfContactBlock,
    emailReminderConfig: {
      ...current.emailReminderConfig,
      publicBaseUrl: targetBaseUrl,
    },
    holidayStateCode: current.holidayStateCode,
    customRecurrencePresets: (current.customRecurrencePresets ?? []).map(
      ({ createdAt: _createdAt, updatedAt: _updatedAt, ...preset }) => preset
    ),
    deletedPresetFallbacks: {},
  } as const;
};

export const cutoverWasteSettingsDomain = async (
  env: NodeJS.ProcessEnv = process.env,
  deps: CutoverDeps = defaultDeps
): Promise<CutoverResult> => {
  const studioBaseUrl = normalizeBaseUrl(
    requireEnvValue(env, 'STUDIO_WASTE_BASE_URL'),
    'STUDIO_WASTE_BASE_URL'
  );
  const targetBaseUrl = normalizeBaseUrl(
    requireEnvValue(env, 'PUBLIC_WASTE_TARGET_BASE_URL'),
    'PUBLIC_WASTE_TARGET_BASE_URL'
  );
  const expectedInstanceId = requireEnvValue(env, 'PUBLIC_WASTE_EXPECTED_INSTANCE_ID');
  const cookieCommand = parseCommand(
    requireEnvValue(env, 'STUDIO_WASTE_SESSION_COOKIE_COMMAND')
  );
  const sessionCookie = await deps.resolveSessionCookie(cookieCommand);
  if (!sessionCookie) throw new Error('Der Session-Cookie-Resolver lieferte keinen Wert.');

  const current = await requestSettings(deps, studioBaseUrl, sessionCookie);
  const input = buildWasteSettingsDomainCutoverInput(
    current,
    expectedInstanceId,
    targetBaseUrl
  );
  const previousCalendarWebUrl = current.calendarWebUrl ?? '';
  const previousReminderPublicBaseUrl = current.emailReminderConfig?.publicBaseUrl ?? '';
  const changed =
    previousCalendarWebUrl !== targetBaseUrl ||
    previousReminderPublicBaseUrl !== targetBaseUrl;

  if (changed) {
    await requestSettings(deps, studioBaseUrl, sessionCookie, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  const verified = await requestSettings(deps, studioBaseUrl, sessionCookie);
  if (
    verified.instanceId !== expectedInstanceId ||
    verified.calendarWebUrl !== targetBaseUrl ||
    verified.emailReminderConfig?.publicBaseUrl !== targetBaseUrl
  ) {
    throw new Error('Die beiden internen Waste-URLs konnten nicht verifiziert werden.');
  }

  return {
    changed,
    instanceId: verified.instanceId,
    previousCalendarWebUrl,
    previousReminderPublicBaseUrl,
    targetBaseUrl,
  };
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  cutoverWasteSettingsDomain()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
