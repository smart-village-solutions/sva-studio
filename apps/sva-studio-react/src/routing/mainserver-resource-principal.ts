import type { IamContentOwnerPrincipal } from '@sva/core';
import {
  createMainserverReadHeaders,
  MainserverApiError,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import type {
  ContentOwnershipPanelLabels,
  MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useParams } from '@tanstack/react-router';
import React from 'react';
import { t } from '../i18n';
import { getContent } from '../lib/iam-api';
import { useMainserverPrincipalControl } from './mainserver-principal-control';

export const readStringParam = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

export type MainserverResourcePrincipalResolution =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{
      kind: 'ready';
      control: MainserverPrincipalControlModel;
      owner: Readonly<{
        displayName: string;
      }>;
    }>;

export type MainserverResolvedOwner = Readonly<{
  principal?: IamContentOwnerPrincipal;
  principalResolution: 'resolved' | 'unresolved' | 'failed';
  displayName: string;
}>;

export const resolveMainserverDetailUrl = (contentType: string, contentId: string): string => {
  const collections: Readonly<Record<string, string>> = {
    'news.article': 'news',
    'events.event-record': 'events',
    'poi.point-of-interest': 'poi',
    'generic-items.generic-item': 'generic-items',
    'faq.faq': 'faqs',
    'cockpit-cards.cockpit-card': 'cockpit-cards',
    'projects.project': 'projects',
    'surveys.survey': 'surveys',
  };
  const collection = collections[contentType] ?? 'generic-items';
  return `/api/v1/mainserver/${collection}/${encodeURIComponent(contentId)}`;
};

export const resolveOwnershipTransferError = (error: unknown): string => {
  if (!(error instanceof MainserverApiError)) return t('content.ownership.error');
  const key =
    error.code === 'content_transfer_permission_missing'
      ? 'permissionMissing'
      : error.code === 'content_transfer_target_invalid'
        ? 'targetInvalid'
        : error.code === 'content_transfer_target_credentials_missing'
          ? 'credentialsMissing'
          : error.code === 'content_transfer_target_verification_failed'
            ? 'targetVerificationFailed'
            : error.code === 'content_transfer_type_unsupported'
              ? 'unsupported'
              : error.code === 'content_transfer_reconciliation_required'
                ? 'reconciliationRequired'
                : error.code === 'content_transfer_provider_rejected'
                  ? 'providerRejected'
                  : error.code.includes('binding') ||
                      error.code === 'content_transfer_source_changed'
                    ? 'bindingInvalid'
                    : 'error';
  return t(`content.ownership.${key}`);
};

export const ownershipPanelLabels = (): ContentOwnershipPanelLabels => ({
  title: t('content.ownership.title'),
  currentOwner: t('content.ownership.currentOwner'),
  ownerUnresolved: t('content.ownership.ownerUnresolved'),
  ownerResolutionFailed: t('content.ownership.ownerResolutionFailed'),
  account: t('content.ownership.account'),
  organization: t('content.ownership.organization'),
  verificationRequired: t('content.ownership.verificationRequired'),
  transferUnavailable: t('content.ownership.transferUnavailable'),
  transferForbidden: t('content.ownership.transferForbidden'),
  transferAction: t('content.ownership.transferAction'),
  dialogTitle: t('content.ownership.dialogTitle'),
  dialogDescription: t('content.ownership.dialogDescription'),
  targetOwner: t('content.ownership.targetOwner'),
  targetPlaceholder: t('content.ownership.targetPlaceholder'),
  search: t('content.ownership.search'),
  loading: t('content.ownership.loading'),
  loadError: t('content.ownership.loadError'),
  noTargets: t('content.ownership.noTargets'),
  refineSearch: t('content.ownership.refineSearch'),
  confirmation: t('content.ownership.confirmation'),
  accessWarning: t('content.ownership.accessWarning'),
  authorEffect: t('content.ownership.mainserverAuthorEffect'),
  cancel: t('content.ownership.cancel'),
  confirm: t('content.ownership.confirm'),
  transferring: t('content.ownership.transferring'),
  success: t('content.ownership.success'),
  transferError: t('content.ownership.error'),
});

export const useMainserverResourcePrincipalControl = (
  contentType: string
): MainserverResourcePrincipalResolution => {
  const params = useParams({ strict: false });
  const contentId = readStringParam(params.contentId, readStringParam(params.id)) || undefined;
  const editorPrincipalResolution = useMainserverPrincipalControl();
  const editorPrincipal =
    editorPrincipalResolution.kind === 'ready'
      ? editorPrincipalResolution.control.value
      : undefined;
  const editorPrincipalLabel =
    editorPrincipalResolution.kind === 'ready'
      ? editorPrincipalResolution.control.kind === 'fixed'
        ? editorPrincipalResolution.control.label
        : editorPrincipalResolution.control.options.find(
            (option) => option.value === editorPrincipalResolution.control.value
          )?.label
      : undefined;
  const editorPrincipalFallback = React.useRef({
    principal: editorPrincipal,
    label: editorPrincipalLabel,
  });
  if (editorPrincipal) {
    editorPrincipalFallback.current = {
      principal: editorPrincipal,
      label: editorPrincipalLabel,
    };
  }
  const [resolution, setResolution] = React.useState<MainserverResourcePrincipalResolution>({
    kind: 'loading',
  });

  React.useEffect(() => {
    if (!contentId) {
      setResolution({ kind: 'error' });
      return;
    }

    let active = true;
    setResolution({ kind: 'loading' });

    void getContent(contentId, { contentType })
      .then(async ({ data }) => {
        if (!active) {
          return;
        }

        const principal =
          data.credentialSource === 'organization' || data.credentialSource === 'user'
            ? data.credentialSource
            : editorPrincipalFallback.current.principal;
        if (principal !== 'organization' && principal !== 'user') {
          setResolution({ kind: 'error' });
          return;
        }

        const detail = await requestMainserverJson<{
          readonly data: Readonly<{
            dataProvider?: Readonly<{ id?: string; name?: string }> | null;
          }>;
        }>({
          url: resolveMainserverDetailUrl(contentType, contentId),
          init: { headers: createMainserverReadHeaders(principal) },
        });
        if (!active) return;
        const currentDataProviderName =
          detail.data.dataProvider?.name?.trim() || detail.data.dataProvider?.id?.trim();
        if (!currentDataProviderName) {
          setResolution({ kind: 'error' });
          return;
        }

        setResolution({
          kind: 'ready',
          control: {
            kind: 'fixed',
            value: principal,
            label:
              data.sourceDataProviderName?.trim() ||
              editorPrincipalFallback.current.label ||
              t(
                principal === 'organization'
                  ? 'content.principal.organization'
                  : 'content.principal.user'
              ),
          },
          owner: {
            displayName: currentDataProviderName,
          },
        });
      })
      .catch(() => {
        if (active) {
          setResolution({ kind: 'error' });
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, contentType, editorPrincipal]);

  return resolution;
};
