import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Select, StudioSection } from '@sva/studio-ui-react';
import { subject } from './organisation-key-contracts.js';
import type { AccessTransferEditor } from './admin.access-transfer-state.js';
function SourceConversations({ editor }: { editor: AccessTransferEditor }) {
  const pt = usePluginTranslation('ssf');
  const { people, source, reset, setSource, find, selected, items, discard, setSelected, cursor } =
    editor;
  return (
    <>
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
    </>
  );
}
function TransferTarget({ editor }: { editor: AccessTransferEditor }) {
  const pt = usePluginTranslation('ssf');
  const { target, discard, setTarget, people, reason, setReason, groups, orgs, prepare } = editor;
  return (
    <>
      <label>
        {pt('transfer.target')}{' '}
        <Select
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
        </Select>
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
    </>
  );
}
export function TransferSelection({ editor }: { editor: AccessTransferEditor }) {
  const pt = usePluginTranslation('ssf');
  return (
    <StudioSection title={pt('transfer.selection')}>
      <fieldset disabled={editor.task.busy || !!editor.submission} className="space-y-3">
        <SourceConversations editor={editor} />
        <TransferTarget editor={editor} />
      </fieldset>
    </StudioSection>
  );
}
