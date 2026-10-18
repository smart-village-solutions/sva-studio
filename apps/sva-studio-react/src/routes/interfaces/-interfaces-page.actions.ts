import { useServerFn } from '@tanstack/react-start';
import React from 'react';

import { getActiveLocale, t } from '../../i18n';
import { deleteInstanceInterfaceServerFn, testMailInterfaceServerFn } from '../../lib/interfaces-api';
import type { InstanceInterface } from '../../lib/instance-interfaces';

export const useMailInterfaceTest = (
  instanceId: string,
  translateError: (error: unknown, fallback: string) => string
) => {
  const testMailInterface = useServerFn(testMailInterfaceServerFn);
  const testMailInterfaceRef = React.useRef(testMailInterface);
  testMailInterfaceRef.current = testMailInterface;
  const [mailTestPendingId, setMailTestPendingId] = React.useState<string | null>(null);
  const [mailTestResult, setMailTestResult] = React.useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const onTestMail = async (entry: InstanceInterface) => {
    if (entry.type !== 'mailTransport' || mailTestPendingId) return;
    setMailTestPendingId(entry.id);
    setMailTestResult(null);
    try {
      const result = await testMailInterfaceRef.current({
        data: { instanceId, id: entry.id, locale: getActiveLocale() },
      });
      setMailTestResult(
        result.status === 'sent'
          ? {
              kind: 'success',
              message: t('interfaces.mailTest.sent', { recipient: result.recipient }),
            }
          : { kind: 'error', message: t(`interfaces.mailTest.errors.${result.reason}`) }
      );
    } catch (error) {
      setMailTestResult({
        kind: 'error',
        message: translateError(error, t('interfaces.mailTest.errors.unknown')),
      });
    } finally {
      setMailTestPendingId(null);
    }
  };

  return { mailTestPendingId, mailTestResult, onTestMail };
};

export const useInterfaceDeletion = (
  instanceId: string,
  refresh: (reportError?: boolean) => Promise<unknown>,
  translateError: (error: unknown, fallback: string) => string
) => {
  const deleteInterface = useServerFn(deleteInstanceInterfaceServerFn);
  const deleteInterfaceRef = React.useRef(deleteInterface);
  deleteInterfaceRef.current = deleteInterface;
  const [pendingDelete, setPendingDelete] = React.useState<InstanceInterface | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const [deleteResultMessage, setDeleteResultMessage] = React.useState<string | null>(null);

  const onConfirmDelete = async () => {
    if (!pendingDelete || deletePending) {
      setPendingDelete(null);
      return;
    }

    setDeletePending(true);
    setDeleteErrorMessage(null);
    setDeleteResultMessage(null);
    try {
      const result = await deleteInterfaceRef.current({
        data: { instanceId, id: pendingDelete.id },
      });
      if (!result.deleted) {
        throw new Error('interface_not_found');
      }
      const deletedName = pendingDelete.name;
      const refreshed = await refresh(false);
      if (!refreshed) {
        setPendingDelete(null);
        setDeleteResultMessage(t('interfaces.messages.refreshAfterDeleteError'));
        return;
      }
      setPendingDelete(null);
      setDeleteResultMessage(t('interfaces.messages.deleteSuccess', { name: deletedName }));
    } catch (error) {
      setDeleteErrorMessage(translateError(error, t('interfaces.messages.deleteError')));
    } finally {
      setDeletePending(false);
    }
  };

  return {
    pendingDelete,
    deletePending,
    deleteErrorMessage,
    deleteResultMessage,
    onConfirmDelete,
    cancelDelete: () => {
      if (deletePending) return;
      setDeleteErrorMessage(null);
      setPendingDelete(null);
    },
    dismissDeleteResult: () => setDeleteResultMessage(null),
    requestDelete: (entry: InstanceInterface) => {
      setDeleteErrorMessage(null);
      setDeleteResultMessage(null);
      setPendingDelete(entry);
    },
  };
};
