import { resolveMainserverOwnershipTarget } from '@sva/auth-runtime/server';
import { z } from 'zod';

import type {
  SvaMainserverOwnershipTransferInput,
  SvaMainserverOwnershipTransferResult,
} from '../../types.js';
import type { ServiceContext } from './service-context.js';
import { toSvaMainserverError } from './shared.js';

const stagingMainserverOrigin = 'https://de-studio-sandbox.staging-server.smart-village.app';

export const isContentOwnershipTransferEnabled = (instanceId: string | undefined): boolean =>
  process.env.SVA_DEPLOYMENT_ENVIRONMENT === 'staging' && instanceId === 'de-studio-sandbox';

export const ownershipTransferWriteUnavailable = () =>
  toSvaMainserverError({
    code: 'content_transfer_write_unavailable',
    message: 'Der technische Mainserver-Zugang für die Inhaberübertragung ist nicht verfügbar.',
    statusCode: 503,
  });

const resourceTypes = {
  news: 'NEWS_ITEM',
  event: 'EVENT_RECORD',
  poi: 'POINT_OF_INTEREST',
  'generic-item': 'GENERIC_ITEM',
} as const;

const mutation = `
  mutation SvaMainserverTransferContentOwnership(
    $resourceType: ContentOwnershipResourceType!, $resourceId: ID!,
    $expectedSourceDataProviderId: ID!, $targetDataProviderId: ID!
  ) {
    transferContentOwnership(
      resourceType: $resourceType, resourceId: $resourceId,
      expectedSourceDataProviderId: $expectedSourceDataProviderId, targetDataProviderId: $targetDataProviderId
    ) { resourceType resourceId dataProviderId }
  }
`;

type TransferResponse = {
  readonly transferContentOwnership?: {
    readonly resourceType: string;
    readonly resourceId: string;
    readonly dataProviderId: string;
  } | null;
};

const transferErrorStatuses = new Map<string, number>([
  ['forbidden', 403],
  ['resource_not_found', 404],
  ['source_provider_mismatch', 409],
  ['provider_not_eligible', 409],
  ['invalid_source_provider', 409],
  ['invalid_target_provider', 409],
  ['same_provider', 409],
  ['identity_conflict', 409],
  ['dependent_provider_conflict', 409],
  ['attached_generic_item', 409],
  ['import_managed_resource', 409],
  ['transfer_conflict', 409],
  ['transfer_failed', 409],
]);

const disabledTransfer = () =>
  toSvaMainserverError({
    code: 'content_transfer_temporarily_disabled',
    message: 'content_transfer_temporarily_disabled',
    statusCode: 409,
  });

export const createContentOwnershipTransfer =
  ({
    loadValidatedInstanceConfig,
    executeOwnershipTransferGraphql,
  }: Pick<ServiceContext, 'loadValidatedInstanceConfig' | 'executeOwnershipTransferGraphql'>) =>
  async (
    input: SvaMainserverOwnershipTransferInput
  ): Promise<SvaMainserverOwnershipTransferResult> => {
    if (!isContentOwnershipTransferEnabled(input.instanceId)) {
      throw disabledTransfer();
    }

    const config = await loadValidatedInstanceConfig(input, 'load_instance_config').catch(() => {
      throw ownershipTransferWriteUnavailable();
    });
    if (
      config.graphqlBaseUrl !== `${stagingMainserverOrigin}/graphql` ||
      config.oauthTokenUrl !== `${stagingMainserverOrigin}/oauth/token`
    ) {
      throw disabledTransfer();
    }

    const organizationId = z
      .string()
      .uuid()
      .safeParse(process.env.SVA_MAINSERVER_OWNERSHIP_TRANSFER_ORGANIZATION_ID?.trim());
    if (!organizationId.success) throw ownershipTransferWriteUnavailable();

    const writer = await resolveMainserverOwnershipTarget({
      instanceId: input.instanceId,
      actorKeycloakSubject: input.keycloakSubject,
      principal: { type: 'organization', id: organizationId.data },
    }).catch(() => {
      throw ownershipTransferWriteUnavailable();
    });
    if (!writer.ok) throw ownershipTransferWriteUnavailable();

    const resourceType = resourceTypes[input.content.type];
    const response = await executeOwnershipTransferGraphql<TransferResponse>(
      {
        ...writer.target.connection,
        document: mutation,
        operationName: 'SvaMainserverTransferContentOwnership',
        allowRetry: false,
        variables: {
          resourceType,
          resourceId: input.content.id,
          expectedSourceDataProviderId: input.expectedSourceDataProviderId,
          targetDataProviderId: input.targetDataProviderId,
        },
        mapErrorCode: (code) => {
          const statusCode = transferErrorStatuses.get(code);
          return statusCode === undefined
            ? undefined
            : toSvaMainserverError({
                code: 'content_transfer_provider_rejected',
                message: 'Der Mainserver hat die Übertragung abgelehnt.',
                statusCode,
              });
        },
      },
      config
    );
    const record = response?.transferContentOwnership;
    if (
      !record ||
      record.resourceType !== resourceType ||
      record.resourceId !== input.content.id ||
      record.dataProviderId !== input.targetDataProviderId
    ) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'Der Mainserver hat den erwarteten Zielinhaber nicht bestätigt.',
        statusCode: 502,
      });
    }

    return {
      contentType: input.content.type,
      contentId: record.resourceId,
      sourceDataProviderId: input.expectedSourceDataProviderId,
      targetDataProviderId: record.dataProviderId,
    };
  };
