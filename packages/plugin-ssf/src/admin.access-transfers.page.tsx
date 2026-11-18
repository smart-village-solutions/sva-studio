import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioFormSummary,
  StudioOverviewPageTemplate,
  StudioSection,
  useStudioEditorLeaveGuard,
} from '@sva/studio-ui-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readPeople, requestOperation } from './organisation-key-client.js';
import { rewrapTransfer, verifyPreview } from './access-transfer-crypto.js';
import { importOrganisationKey } from './organisation-key-crypto.js';
import { subject } from './organisation-key-contracts.js';
import type {
  Candidate,
  OrganisationKey,
  Transfer,
  KeyIdentity,
} from './organisation-key-contracts.js';
import {
  RecordingContext,
  RecordingError,
  type RecordingActor,
  useRecordingTask,
} from './admin.recording-key-session.js';

type ScopeMember = { conversationId: string; keyId: string };
interface Preview {
  transfer: Transfer;
  id: KeyIdentity;
  members: ScopeMember[];
}
interface TransferSubmission {
  transferId: string;
  scopeDigest: string;
  targetUserSub: string;
  targetKeyVersion: number;
  body: Awaited<ReturnType<typeof rewrapTransfer>>;
}
export const AccessTransferForm = ({ tenantId, actor }: RecordingActor) => {
  const pt = usePluginTranslation('ssf'),
    task = useRecordingTask();
  const [people, setPeople] = useState<Awaited<ReturnType<typeof readPeople>>>([]),
    [orgs, setOrgs] = useState<OrganisationKey[]>([]);
  const [source, setSource] = useState(''),
    [target, setTarget] = useState(''),
    [reason, setReason] = useState(''),
    [items, setItems] = useState<Candidate[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [submission, setSubmission] = useState<TransferSubmission | null>(null),
    [hasLocalKey, setHasLocalKey] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [receipts, setReceipts] = useState<
    Awaited<ReturnType<typeof requestOperation<'commit'>>>[]
  >([]);
  const localKey = useRef<CryptoKey | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preview) fileInput.current?.focus();
  }, [preview]);
  const [fileEpoch, setFileEpoch] = useState(0);
  const discard = useCallback(() => {
    clearTimeout(deadline.current);
    setPreview(null);
    localKey.current = null;
    setHasLocalKey(false);
    setConfirmed(false);

    setFileEpoch((n) => n + 1);
  }, []);
  const reset = () => {
    task.cancel();
    discard();
    setSelected([]);
    setItems([]);
    setCursor(null);
    setReceipts([]);
  };
  useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: !!submission || !!preview || selected.length > 0,
    onDiscard: () => {
      if (!submission) reset();
    },
  });
  const load = useCallback(async (signal: AbortSignal) => {
    const [people, orgs] = await Promise.all([
      readPeople(signal),
      requestOperation('list', { signal }),
    ]);
    signal.throwIfAborted();
    setPeople(people);
    setOrgs(orgs.keys);
  }, []);
  useEffect(() => {
    void task.run(load);
  }, [load, task.run]);
  useEffect(() => {
    const hide = () => {
      task.cancel();
      discard();
    };
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, [task.cancel, discard]);
  useEffect(() => {
    if (!preview) return;
    deadline.current = setTimeout(
      () => {
        task.cancel();
        discard();
        void task.run(async () => {
          throw new Error('PREPARATION_EXPIRED');
        });
      },
      Math.max(0, Date.parse(preview.transfer.expiresAt) - Date.now())
    );
    return () => clearTimeout(deadline.current);
  }, [preview, task.run, task.cancel, discard]);
  const find = (next: string | null) =>
    task.run(async (signal) => {
      const query = new URLSearchParams({ employeeSub: source });
      if (next) query.set('cursor', next);
      const page = await requestOperation('candidates', { query, signal });
      if (
        page.items.some(
          (c) =>
            c.employeeSub !== source ||
            c.keyScopes.length !== c.keyIds.length ||
            new Set(c.keyScopes.map((m) => m.keyId)).size !== c.keyIds.length ||
            c.keyScopes.some(
              (m) =>
                !c.keyIds.includes(m.keyId) || !c.organisationKeyIds.includes(m.organisationKeyId)
            )
        )
      )
        throw new Error('SCOPE_CHANGED');
      signal.throwIfAborted();
      discard();
      if (!next) setSelected([]);
      setItems((previous) => [
        ...new Map(
          [...(next ? previous : []), ...page.items].map((c) => [c.conversationId, c])
        ).values(),
      ]);
      setCursor(page.nextCursor);
    });
  const groups = new Map<string, ScopeMember[]>();
  for (const c of items.filter((c) => selected.includes(c.conversationId)))
    for (const scope of c.keyScopes) {
      const members = groups.get(scope.organisationKeyId) ?? [];
      members.push({ conversationId: c.conversationId, keyId: scope.keyId });
      groups.set(scope.organisationKeyId, members);
    }
  const prepare = (organisationKeyId: string, members: ScopeMember[]) =>
    task.run(async (signal) => {
      discard();
      const org = orgs.find((o) => o.keyId === organisationKeyId);
      if (!org) throw new Error('KEY_VERSION_CHANGED');
      const proposed = await requestOperation('target', { sub: target, signal });
      if (proposed.userSub !== target) throw new Error('KEY_VERSION_CHANGED');
      const transfer = await requestOperation('prepareTransfer', {
        body: {
          conversationIds: [...new Set(members.map((m) => m.conversationId))],
          organisationKeyId,
          targetUserSub: target,
          expectedTargetKeyVersion: proposed.version,
          expectedTargetFingerprint: proposed.fingerprint,
          reason,
        },
        signal,
      });
      if (
        transfer.targetKey.userSub !== target ||
        transfer.targetKey.version !== proposed.version ||
        transfer.targetKey.fingerprint !== proposed.fingerprint
      )
        throw new Error('KEY_VERSION_CHANGED');
      const id = {
        tenantId,
        keyId: org.keyId,
        version: org.version,
        publicKey: org.publicKey,
        fingerprint: org.fingerprint,
      };
      await verifyPreview(id, transfer, members);
      signal.throwIfAborted();
      setPreview({ transfer, id, members });
    });
  const fileChanged = (file: File | undefined) => {
    localKey.current = null;
    setHasLocalKey(false);
    setConfirmed(false);

    if (file && preview)
      void task.run(async (signal) => {
        const key = await importOrganisationKey(file, preview.id);
        signal.throwIfAborted();
        localKey.current = key;
        setHasLocalKey(true);
      });
  };
  const commit = () =>
    task.run(async (signal) => {
      let command = submission;
      try {
        if (!command) {
          if (!preview || !localKey.current || !confirmed) return;
          const body = await rewrapTransfer(
            localKey.current,
            preview.id,
            actor,
            preview.transfer,
            reason,
            preview.members,
            signal
          );
          signal.throwIfAborted();
          if (Date.now() >= Date.parse(preview.transfer.expiresAt))
            throw new Error('PREPARATION_EXPIRED');
          command = {
            transferId: preview.transfer.transferId,
            targetUserSub: preview.transfer.targetKey.userSub,
            targetKeyVersion: preview.transfer.targetKey.version,
            scopeDigest: preview.transfer.scopeDigest,
            body,
          };
          setSubmission(command);
          discard();
        }
        const receipt = await requestOperation('commit', {
          id: command.transferId,
          body: command.body,
          signal,
        });
        signal.throwIfAborted();
        if (
          receipt.transferId !== command.transferId ||
          receipt.scopeDigest !== command.scopeDigest ||
          receipt.targetUserSub !== command.targetUserSub ||
          receipt.targetKeyVersion !== command.targetKeyVersion ||
          JSON.stringify([...receipt.grantedKeyIds].sort()) !==
            JSON.stringify(command.body.wraps.map((w) => w.keyId).sort())
        )
          throw new Error('RECORDING_UNAVAILABLE');
        setReceipts((prev) => [...prev, receipt]);
        setSubmission(null);
      } catch (error) {
        signal.throwIfAborted();
        if (
          error instanceof Error &&
          [
            'KEY_VERSION_CHANGED',
            'SCOPE_CHANGED',
            'PREPARATION_NOT_FOUND',
            'PREPARATION_USED',
            'PREPARATION_EXPIRED',
            'PERMISSION_REQUIRED',
            'AUTHENTICATION_REQUIRED',
            'INVALID_PROOF',
          ].includes(error.message)
        ) {
          setSubmission(null);
          discard();
        }
        throw error;
      }
    });
  const label = (s: string) => people.find((p) => p.sub === s)?.displayName ?? s;
  return (
    <StudioOverviewPageTemplate
      title={pt('administration.pages.access-transfers')}
      description={pt('transfer.description')}
    >
      <RecordingError code={task.error} />
      <StudioSection title={pt('transfer.selection')}>
        <fieldset disabled={task.busy || !!submission} className="space-y-3">
          <label>
            {pt('transfer.source')}{' '}
            <input
              list="ssf-transfer-sources"
              value={source}
              maxLength={255}
              placeholder={pt('transfer.sourceHint')}
              onChange={(e) => {
                reset();
                setSource(e.target.value);
              }}
            />
            <datalist id="ssf-transfer-sources">
              {people.map((p) => (
                <option key={p.sub} value={p.sub} label={p.displayName} />
              ))}
            </datalist>
          </label>
          <Button disabled={!subject.safeParse(source).success} onClick={() => void find(null)}>
            {pt('transfer.find')}
          </Button>
          <ul>
            {items.map((c) => (
              <li key={c.conversationId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.conversationId)}
                    disabled={!selected.includes(c.conversationId) && selected.length >= 100}
                    onChange={(e) => {
                      discard();
                      setSelected(
                        e.target.checked
                          ? [...selected, c.conversationId]
                          : selected.filter((id) => id !== c.conversationId)
                      );
                    }}
                  />{' '}
                  {c.startedAt} · {c.conversationId}
                </label>
              </li>
            ))}
          </ul>
          {cursor && (
            <Button variant="secondary" onClick={() => void find(cursor)}>
              {pt('transfer.more')}
            </Button>
          )}
          <label>
            {pt('transfer.target')}{' '}
            <select
              value={target}
              onChange={(e) => {
                discard();
                setTarget(e.target.value);
              }}
            >
              <option value="">{pt('transfer.choose')}</option>
              {people.map((p) => (
                <option key={p.sub} value={p.sub}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {pt('transfer.reason')}{' '}
            <textarea
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                discard();
                setReason(e.target.value);
              }}
            />
          </label>
          {[...groups].map(([id, members]) => (
            <div key={id}>
              <p>
                {pt('keys.version')} {orgs.find((o) => o.keyId === id)?.version} · {id} ·{' '}
                {pt('transfer.keyCount')} {members.length}
              </p>
              <Button
                disabled={!target || !reason.trim() || members.length > 1000}
                onClick={() => void prepare(id, members)}
              >
                {pt('transfer.preview')}
              </Button>
            </div>
          ))}
        </fieldset>
      </StudioSection>
      {submission && (
        <StudioSection title={pt('keys.confirmedStatus')}>
          <p>
            {submission.transferId} · {label(submission.targetUserSub)} · {pt('transfer.targetKey')}{' '}
            {submission.targetKeyVersion}
          </p>
          <Button disabled={task.busy} onClick={() => void commit()}>
            {pt('keys.retryConfirmed')}
          </Button>
        </StudioSection>
      )}
      {preview && (
        <StudioSection title={pt('transfer.confirmTitle')}>
          <dl>
            <dt>{pt('transfer.source')}</dt>
            <dd>
              {label(source)} · {source}
            </dd>
            <dt>{pt('transfer.target')}</dt>
            <dd>
              {label(target)} · {preview.transfer.targetKey.userSub}
            </dd>
            <dt>{pt('transfer.targetKey')}</dt>
            <dd>
              {preview.transfer.targetKey.version} ·{' '}
              <code>{preview.transfer.targetKey.fingerprint}</code>
            </dd>
            <dt>{pt('keys.version')}</dt>
            <dd>
              {preview.id.version} · <code>{preview.id.fingerprint}</code>
            </dd>
            <dt>{pt('transfer.reason')}</dt>
            <dd>{reason}</dd>
            <dt>{pt('transfer.selection')}</dt>
            <dd>
              <ul>
                {preview.members.map((m) => (
                  <li key={m.keyId}>
                    {m.conversationId} · {m.keyId}
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
          <label>
            {pt('transfer.file')}{' '}
            <input
              type="file"
              ref={fileInput}
              key={fileEpoch}
              accept=".json,application/json"
              disabled={task.busy}
              onChange={(e) => fileChanged(e.target.files?.[0])}
            />
          </label>
          <label>
            <input
              type="checkbox"
              disabled={task.busy || !hasLocalKey}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            {pt('transfer.confirm')}
          </label>
          <div className="flex gap-3">
            <Button
              disabled={task.busy || !hasLocalKey || !confirmed}
              onClick={() => void commit()}
            >
              {pt('transfer.commit')}
            </Button>
            <Button variant="secondary" disabled={task.busy} onClick={discard}>
              {pt('keys.cancel')}
            </Button>
          </div>
        </StudioSection>
      )}
      {receipts.map((r) => (
        <StudioFormSummary key={r.transferId} kind="success">
          {pt('transfer.receipt')} {r.transferId} · {r.committedAt} · {label(r.targetUserSub)} ·{' '}
          {pt('transfer.targetKey')} {r.targetKeyVersion} · {pt('transfer.keyCount')}{' '}
          {r.grantedKeyIds.length}
        </StudioFormSummary>
      ))}
      {task.error && !people.length && (
        <Button onClick={() => void task.run(load)}>{pt('keys.reload')}</Button>
      )}
    </StudioOverviewPageTemplate>
  );
};
export const SsfAccessTransfersPage = () => (
  <RecordingContext form={AccessTransferForm} permission="ssf.recording.access.transfer" />
);
