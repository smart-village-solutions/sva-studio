export type OrganizationMainserverCredentialRow = {
  readonly mainserver_application_id: string | null;
  readonly mainserver_application_secret_ciphertext: string | null;
};

export type OrganizationMainserverCredentialState = {
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecretSet: boolean;
};

export const buildOrganizationMainserverSecretAad = (organizationId: string): string =>
  `iam.organization_mainserver_credentials.mainserver_application_secret:${organizationId}`;

export const projectOrganizationMainserverCredentialState = (
  row: OrganizationMainserverCredentialRow
): OrganizationMainserverCredentialState => ({
  mainserverApplicationId: row.mainserver_application_id ?? undefined,
  mainserverApplicationSecretSet: Boolean(row.mainserver_application_secret_ciphertext),
});
