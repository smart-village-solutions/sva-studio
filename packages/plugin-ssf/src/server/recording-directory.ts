import type { PluginServerExecutionHandler } from '@sva/plugin-sdk';
import { SSF_RECORDING_PERMISSION_IDS } from '../constants.js';
import {
  createSsfRecordingDirectory,
  type SsfPluginServerCapabilities,
} from '../recording-directory.js';
import { jsonResponse, readCorrelationId } from './responses.js';

export const createSsfRecordingDirectoryHandler =
  (capabilities?: SsfPluginServerCapabilities): PluginServerExecutionHandler =>
  async (context) => {
    const correlationId = readCorrelationId(context.request);
    try {
      if (context.scope !== 'service' || !capabilities)
        throw new Error('ssf_recording_directory_authority_missing');
      const subjects = await capabilities.readPermissionDirectorySubjects({
        instanceId: context.tenant.instanceId,
        permissionIds: SSF_RECORDING_PERMISSION_IDS,
      });
      return jsonResponse(
        200,
        createSsfRecordingDirectory(context.tenant.instanceId, subjects),
        correlationId
      );
    } catch {
      return jsonResponse(
        503,
        {
          contractVersion: '2.0',
          error: {
            code: 'recording_directory_unavailable',
            message: 'Recording directory is unavailable.',
            retryable: true,
            correlationId,
          },
        },
        correlationId
      );
    }
  };
