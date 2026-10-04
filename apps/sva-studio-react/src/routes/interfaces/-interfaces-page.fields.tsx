import { t } from '../../i18n';
import type { InstanceInterfaceDraft } from '../../lib/instance-interfaces';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const MainserverFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'mainserver' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-graphql">{t('interfaces.form.graphqlBaseUrl')}</Label>
      <Input
        id="mainserver-graphql"
        type="url"
        value={draft.config.graphqlBaseUrl}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, graphqlBaseUrl: event.currentTarget.value },
          })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="mainserver-oauth">{t('interfaces.form.oauthTokenUrl')}</Label>
      <Input
        id="mainserver-oauth"
        type="url"
        value={draft.config.oauthTokenUrl}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, oauthTokenUrl: event.currentTarget.value },
          })
        }
      />
    </div>
  </>
);

export const S3Fields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 's3' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="s3-endpoint">{t('interfaces.forms.s3.endpoint')}</Label>
      <Input
        id="s3-endpoint"
        type="url"
        value={draft.config.endpoint}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, endpoint: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="s3-region">{t('interfaces.forms.s3.region')}</Label>
        <Input
          id="s3-region"
          value={draft.config.region}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, region: event.currentTarget.value } })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="s3-bucket">{t('interfaces.forms.s3.bucket')}</Label>
        <Input
          id="s3-bucket"
          value={draft.config.bucket}
          onChange={(event) =>
            onChange({ ...draft, config: { ...draft.config, bucket: event.currentTarget.value } })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-access-key">{t('interfaces.forms.s3.accessKeyId')}</Label>
      <Input
        id="s3-access-key"
        value={draft.config.accessKeyId}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, accessKeyId: event.currentTarget.value },
          })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="s3-secret-key">{t('interfaces.forms.s3.secretAccessKey')}</Label>
      <Input
        id="s3-secret-key"
        type="password"
        value={draft.config.secretAccessKey}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, secretAccessKey: event.currentTarget.value },
          })
        }
      />
    </div>
    <Label htmlFor="s3-path-style" className="flex items-center gap-3">
      <Checkbox
        id="s3-path-style"
        checked={draft.config.forcePathStyle}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, forcePathStyle: event.currentTarget.checked },
          })
        }
      />
      <span>{t('interfaces.forms.s3.forcePathStyle')}</span>
    </Label>
  </>
);

export const SupabaseFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'supabase' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="supabase-project">{t('interfaces.forms.supabase.projectUrl')}</Label>
      <Input
        id="supabase-project"
        type="url"
        value={draft.config.projectUrl}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, projectUrl: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="supabase-schema">{t('interfaces.forms.supabase.schemaName')}</Label>
        <Input
          id="supabase-schema"
          value={draft.config.schemaName}
          onChange={(event) =>
            onChange({
              ...draft,
              config: { ...draft.config, schemaName: event.currentTarget.value },
            })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="supabase-db">{t('interfaces.forms.supabase.databaseUrl')}</Label>
        <Input
          id="supabase-db"
          value={draft.config.databaseUrl}
          onChange={(event) =>
            onChange({
              ...draft,
              config: { ...draft.config, databaseUrl: event.currentTarget.value },
            })
          }
        />
      </div>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="supabase-key">{t('interfaces.forms.supabase.serviceRoleKey')}</Label>
      <Input
        id="supabase-key"
        type="password"
        value={draft.config.serviceRoleKey}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, serviceRoleKey: event.currentTarget.value },
          })
        }
      />
    </div>
  </>
);

export const PostgresqlFields = ({
  draft,
  onChange,
}: {
  draft: Extract<InstanceInterfaceDraft, { type: 'postgresql' }>;
  onChange: (next: InstanceInterfaceDraft) => void;
}) => (
  <div className="grid gap-2 md:grid-cols-2">
    <div className="grid gap-2">
      <Label htmlFor="postgresql-schema">{t('interfaces.forms.postgresql.schemaName')}</Label>
      <Input
        id="postgresql-schema"
        value={draft.config.schemaName}
        onChange={(event) =>
          onChange({ ...draft, config: { ...draft.config, schemaName: event.currentTarget.value } })
        }
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="postgresql-db">{t('interfaces.forms.postgresql.databaseUrl')}</Label>
      <Input
        id="postgresql-db"
        type="password"
        value={draft.config.databaseUrl}
        onChange={(event) =>
          onChange({
            ...draft,
            config: { ...draft.config, databaseUrl: event.currentTarget.value },
          })
        }
      />
    </div>
  </div>
);
