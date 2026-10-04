import { ExternalInterfaceRuntimeError } from '@sva/server-runtime';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { ResolvedExternalInterface } from '@sva/core';
import { normalizeOutboundHttpUrl } from '@sva/auth-runtime/server';
import {
  createRuntimeError,
  shouldAllowPrivateInterfaceHealthcheckTargets,
} from './instance-interface-healthcheck-common.server.js';

const readS3Config = (resolvedInterface: ResolvedExternalInterface) => {
  const endpoint =
    typeof resolvedInterface.publicConfig.endpoint === 'string'
      ? resolvedInterface.publicConfig.endpoint.trim()
      : '';
  if (!endpoint) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt die Endpoint-URL.'
    );
  }

  const bucket =
    typeof resolvedInterface.publicConfig.bucket === 'string'
      ? resolvedInterface.publicConfig.bucket.trim()
      : '';
  if (!bucket) {
    throw createRuntimeError(
      'bucket_missing',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt der Bucket.'
    );
  }

  const accessKeyId =
    typeof resolvedInterface.publicConfig.accessKeyId === 'string'
      ? resolvedInterface.publicConfig.accessKeyId.trim()
      : '';
  if (!accessKeyId) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt die Access-Key-ID.'
    );
  }

  const secretAccessKey = resolvedInterface.secretConfig.secretAccessKey?.trim();
  if (!secretAccessKey) {
    throw createRuntimeError(
      'secret_missing',
      resolvedInterface.instanceId,
      's3',
      'Für diese S3-Schnittstelle fehlt der Secret Access Key.'
    );
  }

  const region =
    typeof resolvedInterface.publicConfig.region === 'string' &&
    resolvedInterface.publicConfig.region.trim().length > 0
      ? resolvedInterface.publicConfig.region.trim()
      : 'us-east-1';
  const forcePathStyle = resolvedInterface.publicConfig.forcePathStyle === true;

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle,
  };
};

export const verifyS3Connection = async (
  resolvedInterface: ResolvedExternalInterface
): Promise<void> => {
  const config = readS3Config(resolvedInterface);
  const normalizedEndpoint = await normalizeOutboundHttpUrl(config.endpoint, {
    allowHttp: true,
    allowPrivateHosts: shouldAllowPrivateInterfaceHealthcheckTargets(),
  });
  if (!normalizedEndpoint) {
    throw createRuntimeError(
      'connection_failed',
      resolvedInterface.instanceId,
      's3',
      'Der S3-Endpoint zeigt auf einen privaten oder lokalen Host. Setze SVA_ALLOW_PRIVATE_INTERFACE_HEALTHCHECK_TARGETS=true nur für bewusst interne Admin-Ziele.'
    );
  }
  const client = new S3Client({
    endpoint: normalizedEndpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: config.bucket,
      })
    );
  } catch (error) {
    throw mapS3Error(error, resolvedInterface.instanceId);
  }
};

const readS3ErrorDetails = (error: unknown) => {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : undefined;
  const metadata =
    typeof error === 'object' && error !== null && '$metadata' in error
      ? Reflect.get(error, '$metadata')
      : undefined;
  const httpStatusCode =
    typeof metadata === 'object' && metadata !== null && 'httpStatusCode' in metadata
      ? Number(Reflect.get(metadata, 'httpStatusCode'))
      : undefined;
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

  return { name, httpStatusCode, code };
};

const mapS3Error = (error: unknown, instanceId: string): ExternalInterfaceRuntimeError => {
  if (error instanceof ExternalInterfaceRuntimeError) {
    return error;
  }

  const { name, httpStatusCode, code } = readS3ErrorDetails(error);

  if (name === 'NotFound' || httpStatusCode === 404) {
    return createRuntimeError(
      'bucket_missing',
      instanceId,
      's3',
      'Der konfigurierte S3-Bucket wurde am Endpoint nicht gefunden.'
    );
  }

  if (
    name === 'InvalidAccessKeyId' ||
    name === 'SignatureDoesNotMatch' ||
    name === 'AccessDenied' ||
    httpStatusCode === 401 ||
    httpStatusCode === 403
  ) {
    return createRuntimeError(
      's3_auth_failed',
      instanceId,
      's3',
      'Die S3-Zugangsdaten wurden vom Endpoint abgelehnt.'
    );
  }

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN'
  ) {
    return createRuntimeError(
      's3_endpoint_unreachable',
      instanceId,
      's3',
      'Der konfigurierte S3-Endpoint ist nicht erreichbar.',
      true
    );
  }

  return createRuntimeError(
    'connection_failed',
    instanceId,
    's3',
    error instanceof Error ? error.message : 'Die S3-Prüfung ist fehlgeschlagen.',
    true
  );
};
