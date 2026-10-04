import type { IamContentOwnershipTarget } from '@sva/core';
import {
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import {
  ContentOwnershipPanel,
  ContentOwnershipSlotsProvider,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import React from 'react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';
import {
  readStringParam,
  resolveMainserverDetailUrl,
  resolveOwnershipTransferError,
  ownershipPanelLabels,
  useMainserverResourcePrincipalControl,
  type MainserverResolvedOwner,
} from './mainserver-resource-principal';

export const MainserverResourcePrincipalBoundary = ({
  children,
  contentType,
}: Readonly<{
  children: (control: MainserverPrincipalControlModel) => React.ReactNode;
  contentType: string;
}>) => {
  const { user } = useAuth();
  const resolution = useMainserverResourcePrincipalControl(contentType);
  const mutationCapabilities = useMainserverMutationCapabilities();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const contentId = readStringParam(params.contentId, readStringParam(params.id));
  const [resolvedOwner, setResolvedOwner] = React.useState<MainserverResolvedOwner | null>(null);
  const [transferAuthorized, setTransferAuthorized] = React.useState(false);
  React.useEffect(() => setResolvedOwner(null), [contentId, contentType]);
  const transferSupported = contentId !== undefined && contentType !== 'surveys.survey';
  const transferCapabilityConfirmed = mutationCapabilities.enabledActions.includes(
    'content.transferOwnership'
  );
  const actingPrincipalType =
    resolution.kind === 'ready' ? resolution.control.value : ('user' as const);
  const baseUrl = contentId
    ? `/api/v1/mainserver/content-ownership/${encodeURIComponent(
        contentType
      )}/${encodeURIComponent(contentId)}`
    : undefined;
  const loadOwnershipTargets = React.useCallback(
    async ({
      type,
      page,
      pageSize,
      search,
    }: {
      readonly type: 'account' | 'organization';
      readonly page: number;
      readonly pageSize: number;
      readonly search?: string;
    }) => {
      if (!baseUrl) throw new Error('content_transfer_content_id_missing');
      const query = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
      if (search) query.set('q', search);
      const response = await requestMainserverJson<{
        readonly data: readonly IamContentOwnershipTarget[];
        readonly pagination: Readonly<{ total: number }>;
        readonly currentOwner: MainserverResolvedOwner;
      }>({
        url: `${baseUrl}/targets?${query.toString()}`,
        init: { headers: createMainserverReadHeaders(actingPrincipalType) },
      });
      setResolvedOwner(response.currentOwner);
      return { items: response.data, total: response.pagination.total };
    },
    [actingPrincipalType, baseUrl]
  );
  React.useEffect(() => {
    if (resolution.kind !== 'ready' || !contentId) {
      setTransferAuthorized(false);
      return;
    }
    setTransferAuthorized(false);
    let active = true;
    void requestMainserverJson<{
      readonly data: Readonly<{ canTransfer: boolean }>;
      readonly currentOwner: MainserverResolvedOwner;
    }>({
      url: `${baseUrl}/authorization`,
      init: { headers: createMainserverReadHeaders(actingPrincipalType) },
    }).then(
      (response) => {
        if (!active) return;
        setResolvedOwner(response.currentOwner);
        setTransferAuthorized(response.data.canTransfer);
      },
      () => active && setTransferAuthorized(false)
    );
    return () => {
      active = false;
    };
  }, [contentId, actingPrincipalType, baseUrl, resolution.kind, user?.id]);
  if (resolution.kind === 'loading') {
    return <StudioLoadingState>{t('content.principal.resourceLoading')}</StudioLoadingState>;
  }
  if (resolution.kind === 'error') {
    return (
      <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
        <AlertDescription>{t('content.principal.resourceUnavailable')}</AlertDescription>
      </Alert>
    );
  }

  const panel = (
    <ContentOwnershipPanel
      currentOwner={
        resolvedOwner
          ? {
              principal: resolvedOwner.principal,
              principalResolution: resolvedOwner.principalResolution,
              displayName: resolvedOwner.displayName,
            }
          : resolution.owner
      }
      supported={transferSupported && transferCapabilityConfirmed}
      canTransfer={transferAuthorized}
      labels={ownershipPanelLabels()}
      loadTargets={loadOwnershipTargets}
      resolveTransferError={resolveOwnershipTransferError}
      onTransfer={async (target) => {
        if (!baseUrl || !contentId) throw new Error('content_transfer_content_id_missing');
        await requestMainserverJson({
          url: `${baseUrl}/transfer`,
          init: {
            method: 'POST',
            headers: createMainserverMutationHeaders(actingPrincipalType),
            body: JSON.stringify({ targetPrincipal: target.principal }),
          },
        });
        try {
          const detail = await requestMainserverJson<{
            readonly data: Readonly<{
              dataProvider?: Readonly<{ id?: string; name?: string }> | null;
            }>;
          }>({
            url: resolveMainserverDetailUrl(contentType, contentId),
            init: { headers: createMainserverReadHeaders(actingPrincipalType) },
          });
          const confirmedName =
            detail.data.dataProvider?.name?.trim() || detail.data.dataProvider?.id?.trim();
          if (!confirmedName) throw new Error('content_transfer_owner_missing');
          setResolvedOwner({
            principal: target.principal,
            principalResolution: 'resolved',
            displayName: confirmedName,
          });
        } catch {
          await navigate({ to: '/content' });
        }
      }}
    />
  );
  return (
    <ContentOwnershipSlotsProvider value={{ panel }}>
      {children(resolution.control)}
    </ContentOwnershipSlotsProvider>
  );
};
