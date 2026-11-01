import React from 'react';
import { Button, Checkbox } from '@sva/studio-ui-react';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  getRootMainserverInterface,
  saveRootMainserverInterface,
  type RootMainserverInterface,
} from '../../../lib/iam-api-instances';
import { t } from '../../../i18n';

export const MainserverInterfaceCard = ({ instanceId }: { instanceId: string }) => {
  const [interfaceState, setInterfaceState] = React.useState<RootMainserverInterface | null>(null);
  const [loadedFor, setLoadedFor] = React.useState<string | null>(null);
  const currentInstanceId = React.useRef(instanceId);
  currentInstanceId.current = instanceId;
  const [graphqlBaseUrl, setGraphqlBaseUrl] = React.useState('');
  const [oauthTokenUrl, setOauthTokenUrl] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let current = true;
    setLoading(true);
    setSaving(false);
    setLoadedFor(null);
    setInterfaceState(null);
    setError(false);
    setSaved(false);
    void getRootMainserverInterface(instanceId)
      .then(({ data }) => {
        if (!current) return;
        setInterfaceState(data);
        setLoadedFor(instanceId);
        setGraphqlBaseUrl(data.config?.graphqlBaseUrl ?? '');
        setOauthTokenUrl(data.config?.oauthTokenUrl ?? '');
        setEnabled(data.config?.enabled ?? true);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [instanceId]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(false);
    setSaved(false);
    try {
      const { data } = await saveRootMainserverInterface(instanceId, {
        graphqlBaseUrl,
        oauthTokenUrl,
        enabled,
      });
      if (currentInstanceId.current !== instanceId) return;
      setInterfaceState(data);
      setGraphqlBaseUrl(data.config?.graphqlBaseUrl ?? '');
      setOauthTokenUrl(data.config?.oauthTokenUrl ?? '');
      setEnabled(data.config?.enabled ?? true);
      setSaved(true);
    } catch {
      if (currentInstanceId.current !== instanceId) return;
      setError(true);
      try {
        const { data } = await getRootMainserverInterface(instanceId);
        if (currentInstanceId.current !== instanceId) return;
        setInterfaceState(data);
        if (data.config) {
          setGraphqlBaseUrl(data.config.graphqlBaseUrl);
          setOauthTokenUrl(data.config.oauthTokenUrl);
          setEnabled(data.config.enabled);
        }
      } catch {
        // Preserve the submitted fields so the user can retry after the read failure.
      }
    } finally {
      if (currentInstanceId.current === instanceId) setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-4" aria-busy={loading || saving}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{t('admin.instances.mainserver.title')}</h3>
        {loadedFor === instanceId && interfaceState ? (
          <Badge variant="outline">
            {t(`admin.instances.mainserver.status.${interfaceState.status}`)}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.instances.mainserver.description')}</p>
      {loading ? <p>{t('content.messages.loading')}</p> : null}
      {error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{t('admin.instances.mainserver.error')}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? <p role="status">{t('admin.instances.mainserver.saved')}</p> : null}
      {!loading && loadedFor === instanceId ? (
        <form className="space-y-4" onSubmit={(event) => void save(event)}>
          <div className="space-y-2">
            <Label htmlFor="mainserver-graphql-url">
              {t('admin.instances.mainserver.graphqlBaseUrl')}
            </Label>
            <Input
              id="mainserver-graphql-url"
              type="url"
              required
              disabled={saving}
              maxLength={4096}
              value={graphqlBaseUrl}
              onChange={(event) => setGraphqlBaseUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mainserver-oauth-url">
              {t('admin.instances.mainserver.oauthTokenUrl')}
            </Label>
            <Input
              id="mainserver-oauth-url"
              type="url"
              required
              disabled={saving}
              maxLength={4096}
              value={oauthTokenUrl}
              onChange={(event) => setOauthTokenUrl(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="mainserver-enabled"
              disabled={saving}
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <Label htmlFor="mainserver-enabled">{t('admin.instances.mainserver.enabled')}</Label>
          </div>
          <Button type="submit" disabled={saving}>
            {t('admin.instances.mainserver.save')}
          </Button>
        </form>
      ) : null}
    </Card>
  );
};
