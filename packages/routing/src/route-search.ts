export type IamRouteTab = 'rights' | 'governance' | 'dsr';
export type RoleDetailRouteTab = 'general' | 'permissions' | 'assignments' | 'sync';

export const normalizeIamTab = (value: unknown): IamRouteTab => {
  if (value === 'governance' || value === 'dsr') {
    return value;
  }

  return 'rights';
};

export const normalizeRoleDetailTab = (value: unknown): RoleDetailRouteTab => {
  if (value === 'permissions' || value === 'assignments' || value === 'sync') {
    return value;
  }

  return 'general';
};
