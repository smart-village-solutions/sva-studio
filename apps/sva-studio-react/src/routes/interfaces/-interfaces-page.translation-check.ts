import React from 'react';
import { t } from '../../i18n';
import type { InstanceInterface } from '../../lib/instance-interfaces';
import type { EditState } from './-interfaces-page.controller';

export const useTranslationInterfaceCheck = ({
  editState,
  checkDeepL,
  refresh,
  setEditState,
  setSaveErrorMessage,
  translateInterfacesErrorMessage,
}: {
  editState: EditState;
  checkDeepL: (input: {
    data: { id: string; type?: 'ssf_translation' };
  }) => Promise<{ ok: boolean; errorCode?: string }>;
  refresh: (
    showLoading: boolean
  ) => Promise<{ entries: readonly InstanceInterface[] } | null | undefined>;
  setEditState: React.Dispatch<React.SetStateAction<EditState>>;
  setSaveErrorMessage: (message: string | null) => void;
  translateInterfacesErrorMessage: (error: unknown, fallback: string) => string;
}) => {
  const [deepLChecking, setDeepLChecking] = React.useState(false);
  const [deepLCheckFailed, setDeepLCheckFailed] = React.useState(false);
  const onCheckDeepL = async () => {
    if (
      editState.mode !== 'edit' ||
      (editState.entry.type !== 'deepl' && editState.entry.type !== 'ssf_translation')
    )
      return;
    const isSsf = editState.entry.type === 'ssf_translation';
    setDeepLChecking(true);
    setDeepLCheckFailed(false);
    setSaveErrorMessage(null);
    try {
      const result = await checkDeepL({
        data: { id: editState.entry.id, ...(isSsf ? { type: 'ssf_translation' as const } : {}) },
      });
      const updated = await refresh(false);
      if (!updated) throw new Error(t('interfaces.deepl.refreshFailed'));
      const entry = updated?.entries.find((item) => item.id === editState.entry.id);
      if (entry)
        setEditState((current) =>
          current.mode === 'edit' && current.entry.id === entry.id ? { ...current, entry } : current
        );
      if (!result.ok) {
        setDeepLCheckFailed(true);
        setSaveErrorMessage(
          translateInterfacesErrorMessage(
            new Error(
              result.errorCode ?? (isSsf ? 'ssf_translation_unavailable' : 'deepl_unavailable')
            ),
            t(
              isSsf
                ? 'interfaces.ssf.errors.ssf_translation_unavailable'
                : 'interfaces.deepl.checkFailed'
            )
          )
        );
      }
    } catch (error) {
      setDeepLCheckFailed(true);
      setSaveErrorMessage(
        translateInterfacesErrorMessage(
          error,
          t(
            isSsf
              ? 'interfaces.ssf.errors.ssf_translation_unavailable'
              : 'interfaces.deepl.checkFailed'
          )
        )
      );
    } finally {
      setDeepLChecking(false);
    }
  };
  return { onCheckDeepL, deepLChecking, deepLCheckFailed, setDeepLCheckFailed };
};
