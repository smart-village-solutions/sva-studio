import { createMainserverJsonRequestHeaders } from '@sva/plugin-sdk';

import {
  SSF_SYSTEM_CONFIGURATION_PATH,
  SSF_TENANT_CONFIGURATION_PATH,
  ssfEffectiveTenantConfigurationSchema,
  ssfSystemConfigurationInputSchema,
  ssfTenantConfigurationInputSchema,
  type SsfSystemConfigurationInput,
  type SsfTenantConfigurationInput,
  type SsfTenantConfigurationView,
} from './admin-contracts.js';

const requestJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`ssf_configuration_http_${response.status}`);
  return response.json();
};

export const readSsfSystemConfiguration = async (): Promise<SsfSystemConfigurationInput> =>
  ssfSystemConfigurationInputSchema.parse(await requestJson(SSF_SYSTEM_CONFIGURATION_PATH));

export const writeSsfSystemConfiguration = async (
  input: SsfSystemConfigurationInput
): Promise<SsfSystemConfigurationInput> =>
  ssfSystemConfigurationInputSchema.parse(
    await requestJson(SSF_SYSTEM_CONFIGURATION_PATH, {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    })
  );

export const readSsfTenantConfiguration = async (): Promise<SsfTenantConfigurationView> => {
  const value = (await requestJson(SSF_TENANT_CONFIGURATION_PATH)) as SsfTenantConfigurationView;
  return {
    system: ssfSystemConfigurationInputSchema.parse(value.system),
    overrides: ssfTenantConfigurationInputSchema.parse(value.overrides),
    effective: ssfEffectiveTenantConfigurationSchema.parse(value.effective),
  };
};

export const writeSsfTenantConfiguration = async (
  input: SsfTenantConfigurationInput
): Promise<SsfTenantConfigurationView> => {
  const value = (await requestJson(SSF_TENANT_CONFIGURATION_PATH, {
    method: 'PUT',
    headers: createMainserverJsonRequestHeaders(),
    body: JSON.stringify(input),
  })) as SsfTenantConfigurationView;
  return {
    system: ssfSystemConfigurationInputSchema.parse(value.system),
    overrides: ssfTenantConfigurationInputSchema.parse(value.overrides),
    effective: ssfEffectiveTenantConfigurationSchema.parse(value.effective),
  };
};
