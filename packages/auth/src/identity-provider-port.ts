export type CreateIdentityUserInput = {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
};

export type UpdateIdentityUserInput = {
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
};

export type IdentityUser = {
  readonly externalId: string;
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

export interface IdentityProviderPort {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
  listUserRoleNames(externalId: string): Promise<readonly string[]>;
  listRoles(): Promise<readonly IdentityRole[]>;
  getRoleByName(externalName: string): Promise<IdentityRole | null>;
  createRole(input: CreateIdentityRoleInput): Promise<IdentityRole>;
  updateRole(externalName: string, input: UpdateIdentityRoleInput): Promise<IdentityRole>;
  deleteRole(externalName: string): Promise<void>;
}
