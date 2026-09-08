export type SsfTenantRecord = Readonly<{
  instanceId: string;
  status: 'prepared';
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}>;
