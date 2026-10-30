import type {
  InstanceMailTemplate,
  EmailVerificationTemplate,
  ServerEmailVerificationTemplateState,
  MailTemplateKind,
  MailTemplateSource,
  MailTemplateSyncStatus,
} from '@sva/core';
import type { SqlExecutor } from '../iam/repositories/types.js';
import { queryRows, statement } from './repository-shared.js';
type Row = {
  instance_id: string;
  template_kind: MailTemplateKind;
  revision: number;
  template: MailTemplateSource | null;
  sync_status: MailTemplateSyncStatus;
  confirmed_realm: string | null;
  confirmed_texts: Record<string, string> | null;
};
const map = (r: Row): InstanceMailTemplate => ({
  instanceId: r.instance_id,
  kind: r.template_kind,
  revision: r.revision,
  template: r.template,
  syncStatus: r.sync_status,
  confirmedRealm: r.confirmed_realm,
  confirmedTexts: r.confirmed_texts,
});
export const createMailTemplateRepository = (db: SqlExecutor) => ({
  getServerEmailVerificationTemplate: async (): Promise<ServerEmailVerificationTemplateState> => {
    const rows = await queryRows<ServerEmailVerificationTemplateState>(
      db,
      statement(
        'SELECT revision, template FROM iam.server_account_invitation_templates WHERE template_key=$1;',
        ['email_verification']
      )
    );
    if (!rows[0]) throw new Error('server_email_verification_template_missing');
    return rows[0];
  },
  saveServerEmailVerificationTemplate: async (input: {
    expectedRevision: number;
    template: EmailVerificationTemplate | null;
    actorId: string;
  }): Promise<ServerEmailVerificationTemplateState> => {
    const rows = await queryRows<ServerEmailVerificationTemplateState>(
      db,
      statement(
        `
UPDATE iam.server_account_invitation_templates
SET revision=revision+1, template=$3::jsonb, updated_by=$4, updated_at=now()
WHERE template_key=$1 AND revision=$2 RETURNING revision, template;`,
        [
          'email_verification',
          input.expectedRevision,
          input.template ? JSON.stringify(input.template) : null,
          input.actorId,
        ]
      )
    );
    if (!rows[0]) throw new Error('mail_template_revision_conflict');
    return rows[0];
  },
  getInstanceMailTemplate: async (
    instanceId: string,
    kind: MailTemplateKind
  ): Promise<InstanceMailTemplate> => {
    const rows = await queryRows<Row>(
      db,
      statement(
        'SELECT * FROM iam.instance_mail_templates WHERE instance_id=$1 AND template_kind=$2;',
        [instanceId, kind]
      )
    );
    return rows[0]
      ? map(rows[0])
      : {
          instanceId,
          kind,
          revision: 0,
          template: null,
          syncStatus: 'unreviewed',
          confirmedRealm: null,
          confirmedTexts: null,
        };
  },
  saveInstanceMailTemplate: async (input: {
    instanceId: string;
    kind: MailTemplateKind;
    expectedRevision: number;
    template: MailTemplateSource | null;
    actorId?: string;
  }): Promise<InstanceMailTemplate> => {
    if (input.kind === 'invitation') {
      const rows = await queryRows<Row>(
        db,
        statement('SELECT * FROM iam.save_instance_invitation_template($1,$2,$3::jsonb,$4);', [
          input.instanceId,
          input.expectedRevision,
          input.template ? JSON.stringify(input.template) : null,
          input.actorId ?? null,
        ])
      );
      if (rows[0]) return map(rows[0]);
      throw new Error('mail_template_revision_conflict');
    }
    const rows = await queryRows<Row>(
      db,
      statement(
        `
INSERT INTO iam.instance_mail_templates(instance_id,template_kind,revision,template,sync_status,updated_by)
SELECT $1,$2,$3::integer+1,$4::jsonb,'pending',$5 WHERE $3=0 OR EXISTS(SELECT 1 FROM iam.instance_mail_templates WHERE instance_id=$1 AND template_kind=$2 AND revision=$3)
ON CONFLICT (instance_id,template_kind) DO UPDATE SET
 revision=iam.instance_mail_templates.revision+1, template=$4::jsonb, sync_status='pending', updated_by=$5, updated_at=now()
WHERE iam.instance_mail_templates.revision=$3
RETURNING *;`,
        [
          input.instanceId,
          input.kind,
          input.expectedRevision,
          input.template ? JSON.stringify(input.template) : null,
          input.actorId ?? null,
        ]
      )
    );
    if (rows[0]) return map(rows[0]);
    throw new Error('mail_template_revision_conflict');
  },
  recordMailTemplateSync: async (input: {
    instanceId: string;
    kind: MailTemplateKind;
    expectedRevision: number;
    status: MailTemplateSyncStatus;
    realm?: string;
    texts?: Readonly<Record<string, string>>;
  }): Promise<boolean> => {
    const result = await db.execute(
      statement(
        `
INSERT INTO iam.instance_mail_templates(instance_id,template_kind,revision,sync_status,confirmed_realm,confirmed_texts)
SELECT $1,$2,$3::integer,$4,$5,$6::jsonb WHERE $3=0 OR EXISTS(SELECT 1 FROM iam.instance_mail_templates WHERE instance_id=$1 AND template_kind=$2 AND revision=$3)
ON CONFLICT(instance_id,template_kind) DO UPDATE SET sync_status=$4,
 confirmed_realm=COALESCE($5,iam.instance_mail_templates.confirmed_realm),
 confirmed_texts=COALESCE($6::jsonb,iam.instance_mail_templates.confirmed_texts),updated_at=now()
WHERE iam.instance_mail_templates.revision=$3 RETURNING instance_id;`,
        [
          input.instanceId,
          input.kind,
          input.expectedRevision,
          input.status,
          input.realm ?? null,
          input.texts ? JSON.stringify(input.texts) : null,
        ]
      )
    );
    if (result.rowCount) return true;
    return false;
  },
});
