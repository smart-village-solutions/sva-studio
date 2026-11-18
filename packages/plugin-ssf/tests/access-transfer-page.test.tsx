// @vitest-environment jsdom
import React from 'react';
import { expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as view from '../src/admin.access-transfers.page.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const v = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/lifecycle_v2.json'), 'utf8')
);
const api = vi.hoisted(() => ({ op: vi.fn(), people: vi.fn() }));
vi.mock('../src/organisation-key-client.js', () => ({
  requestOperation: api.op,
  readPeople: api.people,
}));
vi.mock('@sva/plugin-sdk', async (orig) => ({
  ...(await orig<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (k: string) => k,
}));
afterEach(cleanup);
it('groups a selected conversation across versions and resolves a target before requesting a single group', async () => {
  const key = {
      keyId: v.organisationKeyId,
      version: 2,
      publicKey: v.organisationPublicKey,
      fingerprint: v.organisationFingerprint,
    },
    other = { ...key, keyId: v.keyId, version: 1 };
  const target = {
    userSub: 'target',
    version: 3,
    encPub: v.targetEncPub,
    sigPub: v.targetSigPub,
    fingerprint: v.targetFingerprint,
  };
  api.people.mockResolvedValue([
    { sub: 'source', displayName: 'Source' },
    { sub: 'target', displayName: 'Target' },
  ]);
  api.op.mockImplementation(async (name: string) =>
    name === 'list'
      ? { keys: [key, other] }
      : name === 'candidates'
        ? {
            items: [
              {
                conversationId: v.conversationId,
                employeeSub: 'source',
                startedAt: v.expiresAt,
                keyIds: [v.keyId, v.transferId],
                organisationKeyIds: [key.keyId, other.keyId],
                keyScopes: [
                  { keyId: v.keyId, organisationKeyId: key.keyId },
                  { keyId: v.transferId, organisationKeyId: other.keyId },
                ],
              },
            ],
            nextCursor: null,
          }
        : name === 'target'
          ? target
          : Promise.reject(new Error('KEY_VERSION_CHANGED'))
  );
  expect(view.AccessTransferForm).toBeTypeOf('function');
  render(<view.AccessTransferForm tenantId="tenant-a" actor="manager" />);
  await screen.findAllByText('Source', { selector: 'option' });
  fireEvent.change(screen.getByLabelText('transfer.source'), { target: { value: 'source' } });
  fireEvent.click(screen.getByRole('button', { name: 'transfer.find' }));
  const selected = await screen.findByRole('checkbox');
  fireEvent.click(selected);
  fireEvent.change(screen.getByLabelText('transfer.target'), { target: { value: 'target' } });
  fireEvent.change(screen.getByLabelText('transfer.reason'), {
    target: { value: 'Receipt requested' },
  });
  fireEvent.change(screen.getByLabelText('transfer.target'), { target: { value: 'source' } });
  expect((screen.getByLabelText('transfer.target') as HTMLSelectElement).value).toBe('source');
  fireEvent.change(screen.getByLabelText('transfer.target'), { target: { value: 'target' } });
  const groups = await screen.findAllByRole('button', { name: 'transfer.preview' });
  expect(groups).toHaveLength(2);
  const [firstGroup] = groups;
  if (!firstGroup) throw new Error('Missing scope group');
  fireEvent.click(firstGroup);
  await waitFor(() =>
    expect(api.op).toHaveBeenCalledWith(
      'prepareTransfer',
      expect.objectContaining({
        body: expect.objectContaining({
          conversationIds: [v.conversationId],
          targetUserSub: 'target',
          expectedTargetKeyVersion: 3,
          expectedTargetFingerprint: v.targetFingerprint,
        }),
      })
    )
  );
  expect(api.op.mock.calls.some((c) => c[0] === 'commit')).toBe(false);
});

it('finds retained source conversations for a known former directory subject', async () => {
  api.people.mockResolvedValue([{ sub: 'target', displayName: 'Target' }]);
  api.op.mockImplementation(async (op: string) =>
    op === 'list' ? { keys: [] } : { items: [], nextCursor: null }
  );
  render(<view.AccessTransferForm tenantId="tenant-a" actor="manager" />);
  await screen.findByText('Target', { selector: 'option' });
  fireEvent.change(screen.getByLabelText('transfer.source'), {
    target: { value: 'former-employee' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'transfer.find' }));
  expect(
    api.op.mock.calls.some(
      ([op, arg]) => op === 'candidates' && arg.query.get('employeeSub') === 'former-employee'
    )
  ).toBe(true);
});

const transferOutcomes = [
  'late-success',
  'lost-response',
  'mismatched-receipt',
  'terminal-rejection',
  'preview-expiry',
  'expiry-during-proof',
];
it.each(transferOutcomes)(
  'uses the preparation deadline and authoritative transfer outcomes: %s',
  async (scenario) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { act } = await import('@testing-library/react');
    const crypto = await import('../src/access-transfer-crypto.js'),
      keys = await import('../src/organisation-key-crypto.js');
    const verify = vi.spyOn(crypto, 'verifyPreview').mockResolvedValue(undefined);
    const wires = {
      proof: v.transferProof,
      wraps: [{ conversationId: v.conversationId, keyId: v.keyId, envelope: v.targetEnvelope }],
    };
    const rewrap = vi.spyOn(crypto, 'rewrapTransfer').mockResolvedValue(wires),
      readKey = vi.spyOn(keys, 'importOrganisationKey').mockResolvedValue({} as CryptoKey);
    const response = Promise.withResolvers<unknown>();
    let sends = 0;
    const group = {
      keyId: v.organisationKeyId,
      version: v.organisationVersion,
      fingerprint: v.organisationFingerprint,
      publicKey: v.organisationPublicKey,
    };
    let version = 1;
    const outcome = {
      transferId: v.transferId,
      committedAt: v.expiresAt,
      scopeDigest: v.scopeDigest,
      grantedKeyIds: [v.keyId],
      targetUserSub: 'target',
      targetKeyVersion: version,
    };
    api.people.mockResolvedValue([{ sub: 'target', displayName: 'Target' }]);
    api.op.mockClear().mockImplementation(async (op: string) => {
      const targetKey = {
        userSub: 'target',
        version,
        fingerprint: v.targetFingerprint,
        encPub: v.targetEncPub,
        sigPub: v.targetSigPub,
      };
      if (op === 'list') return { keys: [group] };
      if (op === 'target') return targetKey;
      if (op === 'candidates')
        return {
          items: [
            {
              conversationId: v.conversationId,
              employeeSub: 'source',
              keyIds: [v.keyId],
              organisationKeyIds: [group.keyId],
              keyScopes: [{ keyId: v.keyId, organisationKeyId: group.keyId }],
            },
          ],
        };
      if (op === 'prepareTransfer')
        return {
          transferId: v.transferId,
          targetKey,
          scopeDigest: v.scopeDigest,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        };
      if (op === 'commit') return ++sends === 1 ? response.promise : outcome;
    });
    try {
      render(<view.AccessTransferForm tenantId={v.tenantId} actor={v.actorSub} />);
      await screen.findByText('Target', { selector: 'option' });
      fireEvent.change(screen.getByLabelText('transfer.source'), { target: { value: 'source' } });
      fireEvent.click(screen.getByRole('button', { name: 'transfer.find' }));
      fireEvent.click(await screen.findByRole('checkbox'));
      fireEvent.change(screen.getByLabelText('transfer.target'), { target: { value: 'target' } });
      fireEvent.change(screen.getByLabelText('transfer.reason'), {
        target: { value: 'Requested' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'transfer.preview' }));
      fireEvent.change(await screen.findByLabelText('transfer.file'), {
        target: { files: [new File(['local'], 'custody.json')] },
      });
      const yes = (await screen.findByLabelText('transfer.confirm')) as HTMLInputElement;
      await waitFor(() => expect(yes.disabled).toBe(false));
      if (scenario === 'preview-expiry') {
        await act(async () => {
          vi.advanceTimersByTime(300005);
        });
        await screen.findByText('keys.errors.PREPARATION_EXPIRED');
        expect(screen.queryByLabelText('transfer.file')).toBeNull();
        expect(sends).toBe(0);
        expect(rewrap).not.toHaveBeenCalled();
        return;
      }
      if (scenario === 'expiry-during-proof') {
        rewrap.mockImplementationOnce(async () => {
          vi.setSystemTime(Date.now() + 300005);
          return wires;
        });
      }
      fireEvent.click(yes);
      fireEvent.click(screen.getByRole('button', { name: 'transfer.commit' }));
      if (scenario === 'expiry-during-proof') {
        await screen.findByText('keys.errors.PREPARATION_EXPIRED');
        expect(sends).toBe(0);
        expect(screen.queryByRole('button', { name: 'keys.retryConfirmed' })).toBeNull();
        return;
      }
      await waitFor(() => expect(sends).toBe(1));
      if (scenario === 'terminal-rejection') {
        await act(async () => {
          response.reject(new Error('KEY_VERSION_CHANGED'));
        });
        await screen.findByText('keys.errors.KEY_VERSION_CHANGED');
        expect(screen.queryByRole('button', { name: 'keys.retryConfirmed' })).toBeNull();
        expect(screen.queryByText(/transfer.receipt/)).toBeNull();
        expect(screen.getByRole('button', { name: 'transfer.preview' })).toBeDefined();
        return;
      }
      if (scenario === 'mismatched-receipt') {
        await act(async () => {
          response.resolve({ ...outcome, grantedKeyIds: [] });
        });
        await screen.findByText('keys.errors.RECORDING_UNAVAILABLE');
        expect(screen.queryByText(/transfer.receipt/)).toBeNull();
      }
      if (scenario === 'lost-response')
        await act(async () => {
          response.reject(new Error('RECORDING_UNAVAILABLE'));
        });
      await act(async () => {
        vi.advanceTimersByTime(300005);
      });
      expect(screen.queryByText('keys.errors.PREPARATION_EXPIRED')).toBeNull();
      expect(screen.queryByLabelText('transfer.file')).toBeNull();
      if (scenario === 'late-success')
        await act(async () => {
          response.resolve(outcome);
        });
      else {
        act(() => {
          window.dispatchEvent(new Event('pagehide'));
        });
        fireEvent.click(await screen.findByRole('button', { name: 'keys.retryConfirmed' }));
        await waitFor(() => expect(sends).toBe(2));
        const calls = api.op.mock.calls.filter(([op]) => op === 'commit');
        expect(calls[1]?.[1].body).toEqual(calls[0]?.[1].body);
        expect(calls[1]?.[1].id).toBe(calls[0]?.[1].id);
        expect(rewrap).toHaveBeenCalledTimes(1);
      }
      await screen.findByText(/transfer.receipt/);
      version = 2;
      fireEvent.click(screen.getByRole('button', { name: 'transfer.preview' }));
      await waitFor(() =>
        expect(
          api.op.mock.calls.filter(([op]) => op === 'prepareTransfer').at(-1)?.[1].body
            .expectedTargetKeyVersion
        ).toBe(2)
      );
    } finally {
      verify.mockRestore();
      rewrap.mockRestore();
      readKey.mockRestore();
      vi.useRealTimers();
    }
  }
);

it('reloads the directory and refuses a candidate page with scope outside the chosen source', async () => {
  api.people
    .mockRejectedValueOnce(new Error('RECORDING_UNAVAILABLE'))
    .mockResolvedValue([{ sub: 'target', displayName: 'Target' }]);
  api.op.mockClear().mockImplementation(async (op: string) =>
    op === 'list'
      ? { keys: [] }
      : {
          items: [
            {
              employeeSub: 'different-source',
              conversationId: v.conversationId,
              keyIds: [v.keyId],
              keyScopes: [],
              organisationKeyIds: [],
            },
          ],
          nextCursor: null,
        }
  );
  render(<view.AccessTransferForm tenantId={v.tenantId} actor={v.actorSub} />);
  fireEvent.click(await screen.findByRole('button', { name: 'keys.reload' }));
  await screen.findByText('Target', { selector: 'option' });
  fireEvent.change(screen.getByLabelText('transfer.source'), { target: { value: 'source' } });
  fireEvent.click(screen.getByRole('button', { name: 'transfer.find' }));
  await screen.findByText('keys.errors.SCOPE_CHANGED');
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(api.op.mock.calls.some(([op]) => op === 'prepareTransfer')).toBe(false);
});

it('appends distinct candidates on the next page and removes a deselected conversation from scope', async () => {
  const row = {
    employeeSub: 'source',
    conversationId: v.conversationId,
    startedAt: '2026-11-01',
    keyIds: [v.keyId],
    keyScopes: [{ keyId: v.keyId, organisationKeyId: v.organisationKeyId }],
    organisationKeyIds: [v.organisationKeyId],
  };
  api.people.mockResolvedValue([{ sub: 'target', displayName: 'Target' }]);
  api.op.mockClear().mockImplementation(async (op: string, options) => {
    if (op === 'list') return { keys: [{ keyId: v.organisationKeyId, version: 2 }] };
    if (options.query.get('cursor') === 'next')
      return { items: [row, { ...row, conversationId: v.transferId }], nextCursor: null };
    return { items: [row], nextCursor: 'next' };
  });
  render(<view.AccessTransferForm tenantId={v.tenantId} actor={v.actorSub} />);
  await screen.findByText('Target', { selector: 'option' });
  fireEvent.change(screen.getByLabelText('transfer.source'), { target: { value: 'source' } });
  fireEvent.click(screen.getByRole('button', { name: 'transfer.find' }));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'transfer.more' }));
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
  const first = screen.getByLabelText(new RegExp(v.conversationId)) as HTMLInputElement;
  expect(first.checked).toBe(true);
  fireEvent.click(first);
  expect(screen.queryByRole('button', { name: 'transfer.preview' })).toBeNull();
});
