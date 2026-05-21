import {
  parsePublicWasteConfig,
  type PublicWasteConfig,
} from './public-waste-config.server.js';

export type PublicWasteBootstrapState =
  | {
      readonly status: 'ready';
      readonly config: PublicWasteConfig;
    }
  | {
      readonly status: 'error';
      readonly reason: 'missing_config' | 'invalid_config';
      readonly title: string;
      readonly message: string;
    };

const INVALID_CONFIG_ERROR = 'public_waste_config_invalid';

export const resolvePublicWasteBootstrapState = (rawConfig: unknown): PublicWasteBootstrapState => {
  if (rawConfig === undefined || rawConfig === null) {
    return {
      status: 'error',
      reason: 'missing_config',
      title: 'Konfiguration fehlt',
      message: 'Für diese öffentliche Abfallkalender-App wurde noch keine Server-Konfiguration hinterlegt.',
    };
  }

  try {
    return {
      status: 'ready',
      config: parsePublicWasteConfig(rawConfig),
    };
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_CONFIG_ERROR) {
      return {
        status: 'error',
        reason: 'invalid_config',
        title: 'Konfiguration ist ungültig',
        message: 'Die Server-Konfiguration der öffentlichen Abfallkalender-App ist unvollständig oder fehlerhaft.',
      };
    }

    throw error;
  }
};

export const readPublicWasteBootstrapStateFromEnvironment = (input: {
  readonly rawConfigJson?: string | undefined;
} = {}): PublicWasteBootstrapState => {
  const rawConfigJson = input.rawConfigJson ?? process.env.PUBLIC_WASTE_CONFIG_JSON;

  if (!rawConfigJson) {
    return resolvePublicWasteBootstrapState(undefined);
  }

  try {
    return resolvePublicWasteBootstrapState(JSON.parse(rawConfigJson) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        status: 'error',
        reason: 'invalid_config',
        title: 'Konfiguration ist ungültig',
        message: 'Die Server-Konfiguration der öffentlichen Abfallkalender-App konnte nicht gelesen werden.',
      };
    }

    throw error;
  }
};
