type IamUuid = string;
type IamInstanceId = string;

type PersonaKey =
  | 'system_admin';

type PersonaScope = 'instance' | 'org';
type MfaPolicy = 'required' | 'recommended' | 'optional';
type OrganizationType = 'county' | 'municipality' | 'district' | 'company' | 'agency' | 'other';
type ContentAuthorPolicy = 'org_only' | 'org_or_personal';
type OrganizationMembershipVisibility = 'internal' | 'external';
type GroupType = 'role_bundle';
type GroupMembershipOrigin = 'manual' | 'seed' | 'sync';
type GeoUnitType = 'country' | 'state' | 'county' | 'municipality' | 'district' | 'custom';

export type {
  ContentAuthorPolicy,
  GeoUnitType,
  GroupMembershipOrigin,
  GroupType,
  IamInstanceId,
  IamUuid,
  MfaPolicy,
  OrganizationMembershipVisibility,
  OrganizationType,
  PersonaKey,
  PersonaScope,
};
