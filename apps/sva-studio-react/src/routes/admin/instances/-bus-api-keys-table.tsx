import type { InstanceBusKey } from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { Badge } from '../../../components/ui/badge';
import { t } from '../../../i18n';
import type { BusKeysModel } from './-bus-api-keys-state';
const prefix = 'admin.instances.busKeys.';
const keyStatus = (key: InstanceBusKey) =>
  key.expiresAt && Date.parse(key.expiresAt) <= Date.now()
    ? 'expired'
    : key.revoked
      ? 'revoked'
      : 'active';
const inclusiveDate = (value: string) => {
  const date = new Date(value);
  if (date.toISOString().slice(11) !== '00:00:00.000Z') return undefined;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const BusKeysTable = ({ model }: { model: BusKeysModel }) => {
  const { loading, keys, busy, status, mutate, revokeButtonRef, setRevoking } = model;
  return (
    <>
      {loading ? (
        <p role="status">{t(`${prefix}loading`)}</p>
      ) : (
        <>
          {keys.length === 0 ? (
            <p>{t(`${prefix}empty`)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t(`${prefix}title`)}</caption>
                <thead>
                  <tr>
                    {[
                      'keyId',
                      'contact',
                      'createdBy',
                      'createdAt',
                      'validThrough',
                      'status',
                      'actions',
                    ].map((field) => (
                      <th key={field} scope="col" className="p-2">
                        {t(`${prefix}${field}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.keyId} className="border-t border-border">
                      <th scope="row" className="p-2 font-mono font-normal">
                        {key.keyId}
                      </th>
                      <td className="p-2">{key.contact ?? t(`${prefix}missing`)}</td>
                      <td className="p-2">{key.createdBy ?? t(`${prefix}missing`)}</td>
                      <td className="p-2">
                        <time dateTime={key.createdAt}>{key.createdAt}</time>
                      </td>
                      <td className="p-2">
                        {key.expiresAt ? (
                          <>
                            {inclusiveDate(key.expiresAt) ? (
                              <span className="block">{inclusiveDate(key.expiresAt)}</span>
                            ) : null}
                            <time
                              dateTime={key.expiresAt}
                              className="text-xs text-muted-foreground"
                            >
                              {key.expiresAt}
                            </time>
                          </>
                        ) : (
                          t(`${prefix}noExpiry`)
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{t(`${prefix}${keyStatus(key)}`)}</Badge>
                      </td>
                      <td className="p-2">
                        {key.revoked ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || status !== 'active' || keyStatus(key) === 'expired'}
                            onClick={() => void mutate('activate', key.keyId)}
                          >
                            {t(`${prefix}activate`)}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            variant="destructive"
                            onClick={(event) => {
                              revokeButtonRef.current = event.currentTarget;
                              setRevoking(key.keyId);
                            }}
                          >
                            {t(`${prefix}revoke`)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
};
