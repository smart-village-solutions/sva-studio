import {
  dispatchSvaMainserverGenericItemsRequest,
  dispatchSvaMainserverJobsRequest,
  dispatchSvaMainserverConstructionSitesRequest,
  dispatchSvaMainserverVouchersRequest,
} from '@sva/sva-mainserver/server';

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server.js';

export const dispatchMainserverGenericItemsRequest = async (
  request: Request
): Promise<Response | null> => {
  const response =
    (await dispatchSvaMainserverJobsRequest(request)) ??
    (await dispatchSvaMainserverConstructionSitesRequest(request)) ??
    (await dispatchSvaMainserverVouchersRequest(request)) ??
    (await dispatchSvaMainserverGenericItemsRequest(request));
  if (response) {
    const pathname = new URL(request.url).pathname;
    const contentType = pathname.startsWith('/api/v1/mainserver/jobs')
      ? 'jobs.job'
      : pathname.startsWith('/api/v1/mainserver/construction-sites')
        ? 'construction-sites.construction-site'
        : pathname.startsWith('/api/v1/mainserver/vouchers')
          ? 'vouchers.voucher'
          : pathname.startsWith('/api/v1/mainserver/projects')
            ? 'projects.project'
            : pathname.startsWith('/api/v1/mainserver/faqs')
              ? 'faq.faq'
              : pathname.startsWith('/api/v1/mainserver/cockpit-cards')
                ? 'cockpit-cards.cockpit-card'
                : 'generic-items.generic-item';
    const complete = await refreshProjectionAfterMainserverMutation(request, response, contentType);
    if (contentType === 'jobs.job' && complete === false) return partialJobResponse(response);
  }
  return response;
};

async function partialJobResponse(response: Response): Promise<Response> {
  const body = (await response.clone().json()) as {
    data: Record<string, unknown>;
    meta?: Record<string, unknown>;
  };
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return Response.json(
    {
      ...body,
      data: { ...body.data, reconciliationRequired: true },
      meta: { ...body.meta, reconciliationStatus: 'reconciliation_required' },
    },
    { status: 202, headers }
  );
}
