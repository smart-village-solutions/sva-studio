export type CreateIdentityUserInput = {
  readonly username?: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
};

export type UpdateIdentityUserInput = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
};

export type IdentityUser = {
  readonly externalId: string;
};

export type IdentityUserListQuery = {
  readonly first?: number;
  readonly max?: number;
  readonly search?: string;
  readonly email?: string;
  readonly username?: string;
  readonly enabled?: boolean;
};

export type IdentityListedUser = {
  readonly externalId: string;
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type IdentityManagedRoleAttributes = {
  readonly managedBy: 'studio';
  readonly instanceId: string;
  readonly roleKey: string;
  readonly displayName: string;
};

export type CreateIdentityRoleInput = {
  readonly externalName: string;
  readonly description?: string;
  readonly attributes: IdentityManagedRoleAttributes;
};

export type UpdateIdentityRoleInput = {
  readonly description?: string;
  readonly attributes: IdentityManagedRoleAttributes;
};

export type IdentityRole = {
  readonly id?: string;
  readonly externalName: string;
  readonly description?: string;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
  readonly composite?: boolean;
  readonly clientRole?: boolean;
  readonly containerId?: string;
};

export type IdentityUserAttributes = Readonly<Record<string, readonly string[]>>;

export interface IdentityProviderPort {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  listUsers(query?: IdentityUserListQuery): Promise<readonly IdentityListedUser[]>;
  getUserAttributes(externalId: string, attributeNames?: readonly string[]): Promise<IdentityUserAttributes>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
  listUserRoleNames(externalId: string): Promise<readonly string[]>;
  countUsers?(query?: Omit<IdentityUserListQuery, 'first' | 'max'>): Promise<number>;
  listRoles(): Promise<readonly IdentityRole[]>;
  getRoleByName(externalName: string): Promise<IdentityRole | null>;
  createRole(input: CreateIdentityRoleInput): Promise<IdentityRole>;
  updateRole(externalName: string, input: UpdateIdentityRoleInput): Promise<IdentityRole>;
  deleteRole(externalName: string): Promise<void>;
}
