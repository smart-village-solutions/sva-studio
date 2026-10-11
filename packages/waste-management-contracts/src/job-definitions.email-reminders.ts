import type { PluginJobTypeDefinition } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract } from './waste-management-operations-contract.js';

export const wasteEmailReminderJobTypes = [
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.materializeEmailReminders,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Abfall-E-Mail-Erinnerungen materialisieren',
    progress: {
      phaseKeys: ['waste-management.materialize-email-reminders', 'waste-management.completed'],
      stepKeys: ['load-reminder-state', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: [
        'activeSubscriptionCount',
        'createdOutboxCount',
        'duplicateOutboxCount',
        'skippedPickupCount',
      ],
    },
    errors: {
      detailKeys: ['failed-step'],
    },
  },
  {
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.processEmailReminderOutbox,
    queue: wasteManagementOperationsContract.queueName,
    displayName: 'Abfall-E-Mail-Erinnerungs-Outbox verarbeiten',
    progress: {
      phaseKeys: ['waste-management.process-email-reminder-outbox', 'waste-management.completed'],
      stepKeys: ['lease-outbox', 'complete-operation'],
    },
    result: {
      summaryKeys: ['durationMs'],
      detailKeys: ['leasedCount', 'sentCount', 'retryScheduledCount', 'failedCount', 'batchSize'],
    },
    errors: {
      detailKeys: ['failed-step', 'outboxId'],
    },
  },
] as const satisfies readonly PluginJobTypeDefinition[];
