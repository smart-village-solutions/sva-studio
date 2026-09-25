type OwnershipModule = Readonly<Record<string, unknown>>;

export const workspaceOwnershipModules = {
  ...import.meta.glob(
    [
      '../../../../packages/plugin-*/src/generic-item-ownership.ts',
      '!../../../../packages/plugin-ssf/src/**',
    ],
    { eager: true }
  ),
} as Record<string, OwnershipModule>;

export const nodeOwnershipModules: Record<string, OwnershipModule> = {};
