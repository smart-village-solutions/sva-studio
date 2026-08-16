#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import {
  applySchemaStatements,
  applyWasteSchemaGrantStatements,
} from '../../apps/sva-studio-react/src/lib/waste-management-operations.schema.js';
import { requiredWasteTables } from '../../apps/sva-studio-react/src/lib/waste-management-operations.schema-contract.js';

export const wasteSchemaRolePlaceholders = {
  appRole: 'waste_manifest_app',
  ownerRole: 'waste_manifest_owner',
  publicAppRole: 'waste_manifest_public',
} as const;

export const buildWasteSchemaManifest = () => ({
  grantStatements: applyWasteSchemaGrantStatements('public', wasteSchemaRolePlaceholders),
  requiredTables: [...requiredWasteTables],
  rolePlaceholders: wasteSchemaRolePlaceholders,
  schemaName: 'public',
  schemaStatements: applySchemaStatements('public'),
  version: 1,
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(buildWasteSchemaManifest())}\n`);
}
