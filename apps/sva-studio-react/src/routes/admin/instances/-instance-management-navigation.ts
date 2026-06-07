export type InstanceManagementView = 'betrieb' | 'doctor' | 'einstellungen';

export const normalizeInstanceManagementView = (value: unknown): InstanceManagementView => {
  if (value === 'doctor' || value === 'einstellungen') {
    return value;
  }

  return 'betrieb';
};
