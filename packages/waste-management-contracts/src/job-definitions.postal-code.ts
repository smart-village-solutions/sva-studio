import type { PluginJobTypeDefinition } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from './waste-management-operations-contract.js';

export const wastePostalCodeJobType = {
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.enrichPostalCodes,
  queue: wasteManagementOperationsContract.queueName,
  supportsCancellation: true,
  displayName: 'Fehlende Waste-Postleitzahlen ergänzen',
  progress: {
    phaseKeys: ['waste-management.enrich-postal-codes', 'waste-management.completed'],
    stepKeys: ['load-cities', 'resolve-postal-codes', 'complete-operation'],
  },
  result: {
    summaryKeys: ['durationMs'],
    detailKeys: [
      'cityCount',
      'missingCount',
      'resolvedCount',
      'updatedCount',
      'ambiguousCount',
      'notFoundCount',
      'failedCount',
      'skippedExistingCount',
      'providerRequestCount',
      'requestBudget',
      'budgetExhausted',
      'unprocessedCount',
    ],
  },
  errors: {
    detailKeys: ['failed-step', 'error-code'],
  },
} satisfies PluginJobTypeDefinition;
