import {
  getWasteManagementImportCatalogEntry,
  wasteManagementOperationsContract,
} from '@sva/waste-management-contracts';
import { z } from 'zod';
import { wasteManagementOperationSchemas } from '../http-operation-schemas.js';
import { startToolJob } from './operations-job-support.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';

const { startInitializeSchema, startMigrationsSchema, startImportSchema, startExportSchema } =
  wasteManagementOperationSchemas;

export const wasteManagementJobHandlers = {
  startWasteManagementInitializeInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.settings.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/initialize',
      schema: startInitializeSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      auditActionId: 'waste-management.initialize.started',
      toPayload: (data) => ({
        operation: 'initialize-data-source',
        targetSchema: typeof data.targetSchema === 'string' ? data.targetSchema : undefined,
      }),
    }),
  startWasteManagementMigrationsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.settings.manage',
      endpoint: 'POST:/api/v1/waste-management/tools/migrations',
      schema: startMigrationsSchema,
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      auditActionId: 'waste-management.migrations.started',
      toPayload: (data) => ({
        operation: 'apply-migrations',
        targetSchema: typeof data.targetSchema === 'string' ? data.targetSchema : undefined,
        requestedByVersion:
          typeof data.requestedByVersion === 'string' ? data.requestedByVersion : undefined,
      }),
    }),
  startWasteManagementImportInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.import.execute',
      endpoint: 'POST:/api/v1/waste-management/tools/imports',
      schema: startImportSchema.superRefine((value, refinementCtx) => {
        if (!wasteManagementOperationsContract.isImportProfileId(value.importProfileId)) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Unbekanntes Waste-Importprofil.',
            path: ['importProfileId'],
          });
          return;
        }

        if (!getWasteManagementImportCatalogEntry(value.importProfileId)) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Für das Importprofil fehlt ein fachlicher Katalogeintrag.',
            path: ['importProfileId'],
          });
          return;
        }

        if (!wasteManagementOperationsContract.isImportSourceFormat(value.sourceFormat)) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Unbekanntes Waste-Importformat.',
            path: ['sourceFormat'],
          });
          return;
        }

        const catalogEntry = getWasteManagementImportCatalogEntry(value.importProfileId);
        if (catalogEntry && !catalogEntry.sourceFormats.includes(value.sourceFormat)) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Das Waste-Importprofil unterstützt dieses Quellformat nicht.',
            path: ['sourceFormat'],
          });
        }
      }),
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
      auditActionId: 'waste-management.import.started',
      toPayload: (data) => ({
        operation: 'import-data',
        importProfileId: data.importProfileId,
        sourceFormat: data.sourceFormat,
        dryRun: data.dryRun === true,
        blobRef: data.blobRef,
        delimiterOverride:
          typeof data.delimiterOverride === 'string' ? data.delimiterOverride : undefined,
      }),
    }),
  startWasteManagementExportInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> =>
    startToolJob(request, ctx, deps, {
      requiredPermission: 'waste-management.export.execute',
      endpoint: 'POST:/api/v1/waste-management/tools/exports',
      schema: startExportSchema.superRefine((value, refinementCtx) => {
        if (value.targetFormat === 'application/json' && value.profileIds.length !== 1) {
          refinementCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'JSON-Exporte benötigen genau ein Profil.',
            path: ['profileIds'],
          });
        }
      }),
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.exportData,
      auditActionId: 'waste-management.export.started',
      toPayload: (data) => ({
        operation: 'export-data',
        profileIds: data.profileIds,
        targetFormat: data.targetFormat,
      }),
    }),
};
