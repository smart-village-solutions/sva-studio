const toAdminRoutePath = (basePath: string) => `/admin/${basePath}` as const;
const toAdminCreateRoutePath = (basePath: string) => `${basePath}/new`;
const toAdminHistoryRoutePath = (detailPath: string) => `${detailPath}/history`;

const adminDetailParamNameByBinding = {
  contentDetail: 'id',
  adminUserDetail: 'userId',
  adminOrganizationDetail: 'organizationId',
  adminInstanceDetail: 'instanceId',
  adminRoleDetail: 'roleId',
  adminGroupDetail: 'groupId',
  adminLegalTextDetail: 'legalTextVersionId',
  media: 'mediaId',
  adminMedia: 'mediaId',
} as const;

const getDetailParamName = (bindingKey: string): string =>
  adminDetailParamNameByBinding[bindingKey as keyof typeof adminDetailParamNameByBinding] ??
  adminDetailParamNameByBinding.contentDetail;

export const getAdminDetailRoutePath = (basePath: string, bindingKey: string): string =>
  `${basePath}/$${getDetailParamName(bindingKey)}`;

export {
  adminDetailParamNameByBinding,
  toAdminCreateRoutePath,
  toAdminHistoryRoutePath,
  toAdminRoutePath,
};
