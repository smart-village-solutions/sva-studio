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
  fireEvent.click(groups[0]!);
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
