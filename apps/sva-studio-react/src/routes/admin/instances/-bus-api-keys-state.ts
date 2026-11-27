import React from 'react';
import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';
import {
  instanceBusKeyExpiresAt,
  type InstanceBusKey,
  type InstanceBusKeyCreated,
  type InstanceStatus,
} from '@sva/core';
import {
  createInstanceBusKey,
  listInstanceBusKeys,
  mutateInstanceBusKey,
} from '../../../lib/iam-api-instance-bus-keys';
import { IamHttpError } from '../../../lib/iam-http-client';

export type BusKeysProps = { instanceId: string; displayName: string; status: InstanceStatus };
const errorKeys: Readonly<Record<string, string>> = {
  reauth_required: 'reauth',
  bus_not_configured: 'notConfigured',
  bus_unavailable: 'unavailable',
  invalid_request: 'invalid',
  bus_instance_inactive: 'inactive',
  bus_key_not_activatable: 'notActivatable',
  bus_key_not_found: 'keyNotFound',
  unauthorized: 'accessDenied',
  forbidden: 'accessDenied',
};
const isSimpleEmail = (value: string): boolean => {
  const at = value.indexOf('@');
  const dot = value.lastIndexOf('.');
  return (
    at > 0 &&
    at === value.lastIndexOf('@') &&
    dot > at + 1 &&
    dot < value.length - 1 &&
    !/\s/u.test(value)
  );
};
const yearEnd = () =>
  `${new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date())}-12-31`;
const EMPTY_KEYS: readonly InstanceBusKey[] = [];
const useBusKeysState = (props: BusKeysProps) => {
  const { instanceId } = props;
  const mounted = React.useRef(false);
  const pending = React.useRef(false);
  const createButtonRef = React.useRef<HTMLButtonElement>(null);
  const reloadButtonRef = React.useRef<HTMLButtonElement>(null);
  const revokeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const pendingFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const [manualLoading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mutationError, setError] = React.useState<string | null>(null);
  const [auditWarning, setAuditWarning] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [secret, setSecret] = React.useState<InstanceBusKeyCreated | null>(null);
  const displayedSecretRef = React.useRef(secret);
  displayedSecretRef.current = secret;
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const [contact, setContact] = React.useState('');
  const [createdBy, setCreatedBy] = React.useState('');
  const [validThrough, setValidThrough] = React.useState(yearEnd);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | undefined>();
  const invalidate = useStudioTableInvalidation();
  const list = useStudioTableQuery(['instance-bus-keys', instanceId], async () => {
    const { data } = await listInstanceBusKeys(instanceId);
    return data.filter((key) => key.label === instanceId);
  });
  const keys = list.data ?? EMPTY_KEYS;
  const loading = manualLoading || list.state === 'loading';
  const error =
    mutationError ??
    (list.error
      ? list.error instanceof IamHttpError && list.error.code === 'bus_not_configured'
        ? 'notConfigured'
        : 'loadError'
      : null);
  const expiresAt = instanceBusKeyExpiresAt(validThrough);

  const focusAction = (preferred: HTMLButtonElement | null) => {
    const target = [preferred, createButtonRef.current, reloadButtonRef.current].find(
      (button) => button?.isConnected && !button.disabled
    );
    pendingFocusRef.current = target ? null : preferred;
    target?.focus();
  };
  const restoreActionFocus = (event: Event, preferred: HTMLButtonElement | null) => {
    event.preventDefault();
    focusAction(preferred);
  };
  React.useEffect(() => {
    if (!busy && !loading && pendingFocusRef.current) focusAction(pendingFocusRef.current);
  }, [busy, loading]);

  const load = async () => {
    await invalidate(['instance-bus-keys', instanceId], false);
    await list.refetch();
    if (mounted.current) setLoading(false);
  };
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [instanceId]);

  const copy = async () => {
    if (!secret) return;
    const copyingSecret = secret;
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(secret.apiKey);
      if (mounted.current && displayedSecretRef.current === copyingSecret) setCopied(true);
    } catch {
      if (mounted.current && displayedSecretRef.current === copyingSecret) setCopyError(true);
    }
  };

  const handleSecretClose = () => {
    if (copied) {
      setSecret(null);
      setCopied(false);
      setConfirmClose(false);
    } else {
      setConfirmClose((confirming) => !confirming);
    }
  };

  return {
    ...props,
    yearEnd,
    mounted,
    pending,
    createButtonRef,
    reloadButtonRef,
    revokeButtonRef,
    pendingFocusRef,
    keys,
    loading,
    setLoading,
    busy,
    setBusy,
    error,
    setError,
    auditWarning,
    setAuditWarning,
    formOpen,
    setFormOpen,
    secret,
    setSecret,
    displayedSecretRef,
    revoking,
    setRevoking,
    contact,
    setContact,
    createdBy,
    setCreatedBy,
    validThrough,
    setValidThrough,
    copied,
    setCopied,
    copyError,
    setCopyError,
    confirmClose,
    setConfirmClose,
    requestId,
    setRequestId,
    expiresAt,
    focusAction,
    restoreActionFocus,
    load,
    copy,
    handleSecretClose,
  };
};

const useBusKeyMutations = (state: ReturnType<typeof useBusKeysState>) => {
  const {
    instanceId,
    pending,
    setBusy,
    setError,
    setAuditWarning,
    setRequestId,
    expiresAt,
    createdBy,
    contact,
    validThrough,
    mounted,
    setFormOpen,
    setSecret,
    setCopied,
    setCopyError,
    setRevoking,
    load,
  } = state;
  const mutate = async (action: 'create' | 'revoke' | 'activate', keyId?: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setAuditWarning(false);
    setRequestId(undefined);
    try {
      if (action === 'create') {
        if (
          !expiresAt ||
          Date.parse(expiresAt) <= Date.now() ||
          !/^[\p{L}\p{M}]{1,32}$/u.test(createdBy.trim()) ||
          !isSimpleEmail(contact.trim())
        ) {
          setError('invalid');
          return;
        }
        const { data, requestId: correlation } = await createInstanceBusKey(instanceId, {
          contact: contact.trim(),
          createdBy: createdBy.trim(),
          validThrough,
        });
        if (!mounted.current) return;
        setFormOpen(false);
        setSecret(data);
        setCopied(false);
        setCopyError(false);
        setAuditWarning(!data.auditRecorded);
        setRequestId(correlation);
      } else {
        if (!keyId) return;
        const { data, requestId: correlation } = await mutateInstanceBusKey(
          instanceId,
          keyId,
          action
        );
        if (!mounted.current) return;
        setRevoking(null);
        setAuditWarning(!data.auditRecorded);
        setRequestId(correlation);
      }
    } catch (failure) {
      if (!mounted.current) return;
      setFormOpen(false);
      setRevoking(null);
      const failureKey =
        failure instanceof IamHttpError
          ? (errorKeys[failure.code] ?? 'outcomeUnknown')
          : 'outcomeUnknown';
      setError(
        failureKey === 'outcomeUnknown' && action !== 'create'
          ? `${action}OutcomeUnknown`
          : failureKey
      );
      setRequestId(failure instanceof IamHttpError ? failure.requestId : undefined);
    } finally {
      if (mounted.current) {
        await load();
        if (mounted.current) setBusy(false);
      }
      pending.current = false;
    }
  };

  return mutate;
};

export const useBusKeys = (props: BusKeysProps) => {
  const state = useBusKeysState(props);
  const mutate = useBusKeyMutations(state);
  return { ...state, mutate };
};

export type BusKeysModel = ReturnType<typeof useBusKeys>;
