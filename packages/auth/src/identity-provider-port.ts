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

export interface IdentityProviderPort {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  updateUser(externalId: string, input: UpdateIdentityUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
}
