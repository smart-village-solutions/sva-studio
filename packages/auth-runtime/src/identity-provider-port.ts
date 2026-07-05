type IdentityWritableAttributes = Readonly<Record<string, string | readonly string[]>>;
type IdentityReadableAttributes = Readonly<Record<string, readonly string[]>>;

type IdentityUserProfileFields = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
};

type IdentityListWindow = {
  readonly first?: number;
  readonly max?: number;
};

type IdentitySearchQuery = {
  readonly search?: string;
};

type IdentityRoleMutationFields = {
  readonly description?: string;
  readonly attributes: IdentityManagedRoleAttributes;
};

export type CreateIdentityUserInput = IdentityUserProfileFields & {
  readonly email: string;
  readonly attributes?: IdentityWritableAttributes;
};

export type UpdateIdentityUserInput = IdentityUserProfileFields & {
  readonly attributes?: IdentityWritableAttributes;
};

export type IdentityUser = {
  readonly externalId: string;
};

export type IdentityUserListQuery = IdentityListWindow &
  IdentitySearchQuery & {
    readonly email?: string;
    readonly username?: string;
    readonly enabled?: boolean;
  };

export type IdentityListedUser = IdentityUser &
  IdentityUserProfileFields & {
    readonly attributes?: IdentityReadableAttributes;
  };

export type IdentityManagedRoleAttributes = {
  readonly managedBy: 'studio';
  readonly instanceId: string;
  readonly roleKey: string;
  readonly displayName: string;
};

export type CreateIdentityRoleInput = IdentityRoleMutationFields & {
  readonly externalName: string;
};

export type UpdateIdentityRoleInput = IdentityRoleMutationFields;

export type IdentityRole = {
  readonly id?: string;
  readonly externalName: string;
  readonly description?: string;
  readonly attributes?: IdentityReadableAttributes;
  readonly composite?: boolean;
  readonly clientRole?: boolean;
  readonly containerId?: string;
};

export type IdentityRoleListQuery = IdentityListWindow & IdentitySearchQuery;

export type IdentityUserAttributes = IdentityReadableAttributes;

export type ExecuteActionsEmailInput = {
  readonly actions: readonly string[];
  readonly clientId?: string;
  readonly lifespan?: number;
  readonly redirectUri?: string;
};

export interface IdentityProviderPort {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  executeActionsEmail?(externalId: string, input: ExecuteActionsEmailInput): Promise<void>;
  updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  deleteUser(externalId: string): Promise<void>;
  listUsers(query?: IdentityUserListQuery): Promise<readonly IdentityListedUser[]>;
  getUserAttributes(externalId: string, attributeNames?: readonly string[]): Promise<IdentityUserAttributes>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
  assignRealmRoles?(externalId: string, roles: readonly string[]): Promise<void>;
  removeRealmRoles?(externalId: string, roles: readonly string[]): Promise<void>;
  listUserRoleNames(externalId: string): Promise<readonly string[]>;
  countUsers?(query?: Omit<IdentityUserListQuery, 'first' | 'max'>): Promise<number>;
  listRoles(query?: IdentityRoleListQuery): Promise<readonly IdentityRole[]>;
  countRoles?(query?: Omit<IdentityRoleListQuery, 'first' | 'max'>): Promise<number>;
  getRoleByName(externalName: string): Promise<IdentityRole | null>;
  createRole(input: CreateIdentityRoleInput): Promise<IdentityRole>;
  updateRole(externalName: string, input: UpdateIdentityRoleInput): Promise<IdentityRole>;
  deleteRole(externalName: string): Promise<void>;
}
