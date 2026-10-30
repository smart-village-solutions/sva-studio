import * as React from 'react';
import {
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  EmailVerificationTemplateError,
  validateEmailVerificationTemplate,
  type EmailVerificationTemplate,
  type MailTemplateView,
  type ServerEmailVerificationTemplateView,
} from '@sva/core';
import { t } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';
import {
  getInstanceMailTemplate,
  getServerEmailVerificationTemplate,
  updateInstanceMailTemplate,
  updateServerEmailVerificationTemplate,
} from '../../../lib/iam-api-instance-operations';

type VerificationView = MailTemplateView | ServerEmailVerificationTemplateView;
export type VerificationCardProps = { readonly disabled?: boolean } & (
  | { readonly mode: 'server'; readonly instanceId?: never }
  | { readonly mode?: 'instance'; readonly instanceId: string }
);
type Operation = 'save' | 'transfer' | 'adopt';

const useVerificationDraft = (props: VerificationCardProps) => {
  const server = props.mode === 'server';
  const load = () =>
    props.mode === 'server'
      ? getServerEmailVerificationTemplate()
      : getInstanceMailTemplate(props.instanceId, 'verification');
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<VerificationView | null>(null);
  const [draft, setDraft] = React.useState<EmailVerificationTemplate>(
    DEFAULT_EMAIL_VERIFICATION_TEMPLATE
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [invalidField, setInvalidField] = React.useState<'subject' | 'body' | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const draftState = React.useRef({ key: server ? 'server' : props.instanceId, dirty: false });
  React.useEffect(() => {
    if (!open) return;
    const key = server ? 'server' : props.instanceId;
    if (draftState.current.key !== key) draftState.current = { key, dirty: false };
    let active = true;
    setLoading(true);
    setView(null);
    setMessage(null);
    setInvalidField(null);
    setConflict(false);
    void load()
      .then(({ data }) => {
        if (!active) return;
        setView(data);
        if (!draftState.current.dirty) setDraft(data.template);
      })
      .catch(() => {
        if (active) setMessage(t('admin.instances.emailVerification.loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [props.instanceId, open, server]);
  const changeDraft = (value: EmailVerificationTemplate) => {
    draftState.current.dirty = true;
    setDraft(value);
  };
  return {
    open,
    setOpen,
    view,
    setView,
    draft,
    setDraft,
    message,
    setMessage,
    invalidField,
    setInvalidField,
    conflict,
    setConflict,
    loading,
    draftState,
    load,
    changeDraft,
  };
};
type DraftState = ReturnType<typeof useVerificationDraft>;

const invalidDraftField = (template: EmailVerificationTemplate | null) => {
  try {
    validateEmailVerificationTemplate(template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE);
    return null;
  } catch (error) {
    return error instanceof EmailVerificationTemplateError ? error.field : 'body';
  }
};

const writeTemplate = async (
  props: VerificationCardProps,
  view: VerificationView,
  operation: Operation,
  template: EmailVerificationTemplate | null
) => {
  if (props.mode === 'server' && !('stored' in view))
    return (
      await updateServerEmailVerificationTemplate({ template, expectedRevision: view.revision })
    ).data;
  if (props.mode !== 'server' && 'stored' in view)
    return (
      await updateInstanceMailTemplate(props.instanceId, 'verification', {
        operation,
        expectedRevision: view.stored.revision,
        ...(operation === 'save'
          ? { template }
          : {
              expectedStudioTexts: view.studioTexts,
              expectedKeycloakTexts: view.keycloakTexts ?? undefined,
            }),
      })
    ).data;
  throw new Error('verification_context_changed');
};

const saveMessage = (data: VerificationView, server: boolean) => {
  const synchronized =
    'stored' in data ? data.status === 'synced' : !data.unsynchronizedInstances?.length;
  if (!synchronized) return t('admin.instances.mailSync.savedPending');
  return t(
    server
      ? 'admin.instances.emailVerification.serverSaved'
      : 'admin.instances.emailVerification.saved'
  );
};

const reportSaveFailure = async (error: unknown, state: DraftState) => {
  if (error instanceof IamHttpError && error.code === 'mail_template_conflict') {
    try {
      const { data } = await state.load();
      state.setView(data);
      state.setConflict(true);
      state.setMessage(t('admin.instances.emailVerification.conflict'));
    } catch {
      state.setMessage(t('admin.instances.emailVerification.loadFailed'));
    }
    return;
  }
  state.setMessage(
    t(
      error instanceof IamHttpError && error.code === 'reauth_required'
        ? 'admin.instances.emailVerification.reauthRequired'
        : 'admin.instances.emailVerification.saveFailed'
    )
  );
};

const useVerificationMutations = (props: VerificationCardProps, state: DraftState) => {
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const apply = async (operation: Operation, template: EmailVerificationTemplate | null = null) => {
    if (!state.view || props.disabled || savingRef.current) return;
    const field = operation === 'save' ? invalidDraftField(template) : null;
    state.setInvalidField(field);
    if (field) {
      document.getElementById(`verification-${field}`)?.focus();
      state.setMessage(t('admin.instances.emailVerification.invalid'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    state.setMessage(null);
    try {
      const data = await writeTemplate(props, state.view, operation, template);
      state.setView(data);
      state.setDraft(data.template);
      state.draftState.current.dirty = false;
      state.setConflict(false);
      state.setMessage(operation === 'save' ? saveMessage(data, props.mode === 'server') : null);
    } catch (error) {
      if (operation === 'save') await reportSaveFailure(error, state);
      else state.setMessage(t('admin.instances.mailSync.conflict'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return {
    saving,
    save: (template: EmailVerificationTemplate | null) => apply('save', template),
    reconcile: (operation: 'transfer' | 'adopt') => apply(operation),
    changeOpen: (next: boolean) => {
      if (!savingRef.current) state.setOpen(next);
    },
  };
};

export const useEmailVerificationTemplate = (props: VerificationCardProps) => {
  const state = useVerificationDraft(props);
  const mutations = useVerificationMutations(props, state);
  return { ...state, ...mutations };
};
