import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MainserverApiError,
  publishSessionAccessSnapshot,
  registerPluginTranslationResolver,
} from '@sva/plugin-sdk';
import { pluginVouchersTranslations } from '../src/plugin.translations.js';
const state = vi.hoisted(() => ({
  assets: vi.fn(),
  asset: vi.fn(),
  delivery: vi.fn(),
  history: vi.fn(),
  get: vi.fn(),
  prepare: vi.fn(),
  commit: vi.fn(),
  reconcile: vi.fn(),
  visibility: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@sva/plugin-sdk', async (load) => ({
  ...(await load<typeof import('@sva/plugin-sdk')>()),
  listHostMediaAssets: state.assets,
  getHostMediaAsset: state.asset,
  getHostMediaDelivery: state.delivery,
  fetchIamContentHistory: state.history,
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  useParams: () => ({}),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../src/vouchers.api.js', () => ({
  getVoucher: state.get,
  prepareVoucher: state.prepare,
  commitVoucher: state.commit,
  reconcileVoucher: state.reconcile,
  changeVoucherVisibility: state.visibility,
  listVoucherCategories: async () => ({ data: [{ id: 'cat', name: 'Kultur' }] }),
  listVoucherLocations: async () => ({
    data: [{ id: '1', name: 'Ort' }],
    pagination: { hasNextPage: false },
  }),
}));
import { VoucherEditor } from '../src/vouchers.editor.js';
const labels = pluginVouchersTranslations.de.vouchers;
const record = {
  id: '2',
  title: 'Eintritt',
  teaser: '',
  visible: false,
  contentFingerprint: 'c'.repeat(64),
  payload: { id: 'uuid' },
  pointOfInterest: { id: '1', name: 'Ort' },
  dataProvider: { id: 'provider' },
  quota: { maxQuantity: 100, availableQuantity: 63, maxPerPerson: 2, frequency: 'monthly' },
  discountType: {
    originalPrice: null,
    discountedPrice: null,
    discountPercentage: 20,
    discountAmount: null,
  },
  contentBlocks: [{ body: '' }],
  dates: [],
  categories: [],
  mediaContents: [],
};
const preparation = {
  preparationId: '40000000-0000-4000-8000-000000000001',
  payloadHash: 'a'.repeat(64),
  voucherIdentity: 'uuid',
  preparationFingerprint: 'b'.repeat(64),
  requiresReset: true,
  poiId: '1',
  poiName: 'Ort',
  affected: [
    { id: '2', title: 'Eintritt' },
    { id: '3', title: 'Zweiter Gutschein' },
  ],
};
beforeEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
  registerPluginTranslationResolver((key, vars) => {
    let value: unknown = pluginVouchersTranslations.de;
    for (const part of key.split('.'))
      value =
        value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
    let text = typeof value === 'string' ? value : key;
    for (const [key, val] of Object.entries(vars ?? {}))
      text = text.replaceAll(`{{${key}}}`, String(val));
    return text;
  });
  publishSessionAccessSnapshot({
    isResolved: true,
    assignedModules: ['vouchers'],
    roles: [],
    permissionActions: ['vouchers.read', 'vouchers.create', 'vouchers.update', 'vouchers.publish'],
    unscopedPermissionActions: [
      'vouchers.read',
      'vouchers.create',
      'vouchers.update',
      'vouchers.publish',
    ],
  });
  state.get.mockResolvedValue({
    data: record,
    meta: { access: { 'vouchers.read': true, 'vouchers.update': true, 'vouchers.publish': true } },
    fetchedAt: '2026-10-24T12:00:00Z',
  });
  state.prepare.mockResolvedValue({ data: preparation });
  state.commit.mockResolvedValue({
    data: { ...record, id: '20', title: 'Neu' },
    meta: { reset: true },
  });
  state.reconcile.mockResolvedValue({ data: { ...record, id: '20', title: 'Neu' } });
  state.navigate.mockResolvedValue(undefined);
});
const edit = async () => {
  render(<VoucherEditor id="2" />);
  const title = await screen.findByLabelText(labels.fields.title);
  fireEvent.change(title, { target: { value: 'Neu' } });
};
describe('voucher editor', () => {
  it('shows actual usage and waits for explicit sibling reset confirmation', async () => {
    await edit();
    expect(screen.getByText('37 von 100 eingelöst')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await screen.findByRole('alertdialog');
    expect(screen.getByText('Zweiter Gutschein')).toBeDefined();
    expect(state.commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.cancel }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe('Neu');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.confirm }));
    await waitFor(() => expect(state.commit).toHaveBeenCalledOnce());
    await waitFor(() => expect(sessionStorage.getItem('voucher-pending:user:2')).toBeNull());
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/admin/vouchers/$id',
      params: { id: '20' },
    });
  });

  it('closes the reset dialog and blocks another save after an uncertain outcome', async () => {
    state.commit.mockRejectedValueOnce(new Error('timeout'));
    await edit();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.confirm }));
    await screen.findByRole('button', { name: labels.actions.reconcile });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(state.commit).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('voucher-pending:user:2')).toContain(preparation.preparationId);
  });
  it('reconciles a lost response after reload without re-reading the deleted old ID or repeating the write', async () => {
    sessionStorage.setItem(
      'voucher-pending:user:2',
      JSON.stringify({
        preparationId: preparation.preparationId,
        payloadHash: preparation.payloadHash,
      })
    );
    state.get.mockRejectedValue(new Error('old_id_deleted'));
    render(<VoucherEditor id="2" />);
    fireEvent.click(await screen.findByRole('button', { name: labels.actions.reconcile }));
    await waitFor(() => expect(state.reconcile).toHaveBeenCalledOnce());
    await waitFor(() => expect(state.navigate).toHaveBeenCalled());
    expect(state.get).not.toHaveBeenCalled();
    expect(state.commit).not.toHaveBeenCalled();
  });
});

describe('editorial workflows', () => {
  it('creates a hidden priced voucher with dates and image metadata in the onepager', async () => {
    state.prepare.mockResolvedValue({ data: { ...preparation, requiresReset: false } });
    render(<VoucherEditor />);
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
    await screen.findByRole('option', { name: 'Ort' });
    change(labels.fields.title, 'Familienkarte');
    change(labels.fields.teaser, 'Gemeinsam entdecken');
    change(labels.fields.location, '1');
    change(labels.fields.discountMode, 'price');
    change(labels.fields.originalPrice, '20,50');
    change(labels.fields.discountValue, '15,25');
    change(labels.fields.frequency, 'monthly');
    change(labels.fields.maxQuantity, '100');
    change(labels.fields.maxPerPerson, '3');
    change(labels.fields.dateStart, '2026-11-01');
    change(labels.fields.dateEnd, '2026-11-30');
    fireEvent.click(screen.getByRole('button', { name: labels.media.add }));
    change(labels.media.url, 'https://example.org/image.jpg');
    change(labels.messages.mediaPickerAltText, 'Eine Familie');
    change(labels.media.caption, 'Familientag');
    change(labels.media.copyright, 'Museum');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.saveHidden }));
    await waitFor(() => expect(state.commit).toHaveBeenCalledOnce());
    expect(state.prepare.mock.calls[0][0]).toMatchObject({
      title: 'Familienkarte',
      teaser: 'Gemeinsam entdecken',
      visible: false,
      pointOfInterestIds: ['1'],
      frequency: 'monthly',
      maxQuantity: 100,
      maxPerPerson: 3,
      discountMode: 'price',
      originalPrice: 20.5,
      discountValue: 15.25,
      dateStart: '2026-11-01',
      dateEnd: '2026-11-30',
      mediaContents: [
        {
          sourceUrl: { url: 'https://example.org/image.jpg', description: 'Eine Familie' },
          captionText: 'Familientag',
          copyright: 'Museum',
        },
      ],
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('refreshes actual usage while preserving an unsaved draft and its original version', async () => {
    await edit();
    state.get.mockResolvedValue({
      data: {
        ...record,
        title: 'Extern geändert',
        contentFingerprint: 'd'.repeat(64),
        quota: { ...record.quota, availableQuantity: 60 },
      },
      meta: {
        access: { 'vouchers.read': true, 'vouchers.update': true, 'vouchers.publish': true },
      },
      fetchedAt: '2026-10-24T13:00:00Z',
    });
    fireEvent.click(screen.getByRole('button', { name: labels.actions.refresh }));
    await screen.findByText('40 von 100 eingelöst');
    expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe('Neu');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await waitFor(() => expect(state.prepare).toHaveBeenCalledOnce());
    expect(state.prepare.mock.calls[0][3]).toBe(record.contentFingerprint);
  });
  it('changes visibility separately without preparing a destructive content write', async () => {
    state.visibility.mockResolvedValue({ data: { ...record, visible: true } });
    render(<VoucherEditor id="2" />);
    fireEvent.click(await screen.findByRole('button', { name: labels.actions.show }));
    await screen.findByRole('button', { name: labels.actions.hide });
    expect(state.visibility).toHaveBeenCalledWith('2', true, 'user');
    expect(state.prepare).not.toHaveBeenCalled();
    expect(state.commit).not.toHaveBeenCalled();
  });
});

describe('shared editorial controls', () => {
  it('selects a public library image and detaches its reference when the URL is replaced', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      assignedModules: ['vouchers'],
      roles: [],
      permissionActions: [
        'vouchers.read',
        'vouchers.update',
        'media.read',
        'media.reference.manage',
      ],
      unscopedPermissionActions: ['vouchers.read', 'vouchers.update'],
    });
    const asset = {
      id: '10000000-0000-4000-8000-000000000001',
      storageKey: 'media/museum.jpg',
      fileName: 'museum.jpg',
      mimeType: 'image/jpeg',
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {
        title: 'Museum',
        altText: 'Eingang',
        description: 'Das Museum',
        copyright: 'Stadt',
        tags: [],
      },
      previewUrl: 'https://example.org/preview.jpg',
    };
    state.assets.mockResolvedValue([asset]);
    state.asset.mockResolvedValue(asset);
    state.delivery.mockResolvedValue({
      isPublicUrl: true,
      deliveryUrl: 'https://example.org/museum.jpg',
    });
    render(<VoucherEditor id="2" />);
    fireEvent.click(
      await screen.findByRole('button', { name: labels.messages.mediaPickerLibraryAction })
    );
    await screen.findByText('Museum');
    const selection =
      screen.getByText('Museum').closest('article') ?? screen.getByText('Museum').parentElement;
    expect(selection).not.toBeNull();
    const buttons = selection?.querySelectorAll('button');
    fireEvent.click(buttons![buttons!.length - 1]);
    fireEvent.click(
      await screen.findByRole('button', { name: labels.messages.mediaPickerUseMedia })
    );
    await waitFor(() =>
      expect((screen.getByLabelText(labels.media.url) as HTMLInputElement).value).toBe(
        'https://example.org/museum.jpg'
      )
    );
    expect(
      (screen.getByLabelText(labels.messages.mediaPickerAltText) as HTMLInputElement).value
    ).toBe('Eingang');
    fireEvent.change(screen.getByLabelText(labels.media.url), {
      target: { value: 'https://example.org/manual.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await waitFor(() => expect(state.prepare).toHaveBeenCalledOnce());
    expect(state.prepare.mock.calls[0][0].mediaContents[0].hostMediaAssetId).toBeUndefined();
  });
  it('loads declared history only after expanding it and reports a failed read', async () => {
    state.history.mockRejectedValue(new Error('unavailable'));
    render(<VoucherEditor id="2" />);
    await screen.findByLabelText(labels.fields.title);
    expect(state.history).not.toHaveBeenCalled();
    const summary = screen.getByText(labels.history.title);
    const details = summary.closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await screen.findByText(labels.history.errors.load);
    expect(state.history).toHaveBeenCalledWith('2', { contentType: 'vouchers.voucher' });
  });
});

describe('safe editorial failure states', () => {
  it('requires an explicit choice for a mixed legacy discount and keeps both current values visible', async () => {
    state.get.mockResolvedValue({
      data: { ...record, discountType: { ...record.discountType, discountAmount: 5 } },
      meta: { access: { 'vouchers.update': true } },
      fetchedAt: '2026-10-24T12:00:00Z',
    });
    await edit();
    expect(screen.getByText(labels.help.mixedDiscount)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    expect(state.prepare).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(labels.fields.discountMode, { exact: false }), {
      target: { value: 'amount' },
    });
    fireEvent.change(screen.getByLabelText(labels.fields.discountValue, { exact: false }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await waitFor(() => expect(state.prepare).toHaveBeenCalledOnce());
    expect(state.prepare.mock.calls[0][0]).toMatchObject({
      discountMode: 'amount',
      discountValue: 5,
    });
  });
  it('retains the draft on an editing conflict without sending a write', async () => {
    state.prepare.mockRejectedValue(new MainserverApiError('voucher_content_conflict', 'Conflict'));
    await edit();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await screen.findByText(labels.errors.voucher_content_conflict);
    expect(state.commit).not.toHaveBeenCalled();
    expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe('Neu');
  });
  it('keeps a clean form synchronized with a refreshed server version and prevents a no-op save', async () => {
    render(<VoucherEditor id="2" />);
    await screen.findByLabelText(labels.fields.title);
    expect(
      (screen.getByRole('button', { name: labels.actions.update }) as HTMLButtonElement).disabled
    ).toBe(true);
    state.get.mockResolvedValue({
      data: { ...record, title: 'Aktueller Titel' },
      meta: { access: { 'vouchers.update': true } },
      fetchedAt: '2026-10-24T13:00:00Z',
    });
    fireEvent.click(screen.getByRole('button', { name: labels.actions.refresh }));
    await waitFor(() =>
      expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe(
        'Aktueller Titel'
      )
    );
    expect(
      (screen.getByRole('button', { name: labels.actions.update }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it('reports a failed library read without changing the current media', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      assignedModules: ['vouchers'],
      roles: [],
      permissionActions: [
        'vouchers.read',
        'vouchers.update',
        'media.read',
        'media.reference.manage',
      ],
      unscopedPermissionActions: ['vouchers.read', 'vouchers.update'],
    });
    state.assets.mockRejectedValue(new Error('unavailable'));
    render(<VoucherEditor id="2" />);
    fireEvent.click(
      await screen.findByRole('button', { name: labels.messages.mediaPickerLibraryAction })
    );
    await screen.findByText(labels.messages.mediaPickerLoadError);
    expect(state.prepare).not.toHaveBeenCalled();
  });
});

it('fails a confirmed write conflict safely and allows correction without a pending recovery marker', async () => {
  state.commit.mockRejectedValue(new MainserverApiError('voucher_content_conflict'));
  await edit();
  fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', { name: labels.actions.confirm }));
  await screen.findByText(labels.errors.voucher_content_conflict);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(sessionStorage.getItem('voucher-pending:user:2')).toBeNull();
  expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe('Neu');
});
it.each([
  'voucher_media_unavailable',
  'voucher_ownership_conflict',
  'voucher_snapshot_incomplete',
  'voucher_poi_provider_unsupported',
  'voucher_inactive_categories',
  'voucher_dependents_unsupported',
  'voucher_identity_conflict',
] as const)(
  'allows correction after the pre-write rejection %s, including after reload',
  async (code) => {
    state.commit.mockRejectedValue(new MainserverApiError(code));
    await edit();
    fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: labels.actions.confirm }));
    await screen.findByText(labels.errors[code]);
    expect(sessionStorage.getItem('voucher-pending:user:2')).toBeNull();
    expect(screen.queryByRole('button', { name: labels.actions.reconcile })).toBeNull();
    fireEvent.change(screen.getByLabelText(labels.fields.title), {
      target: { value: 'Korrigiert' },
    });
    expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe(
      'Korrigiert'
    );
    cleanup();
    render(<VoucherEditor id="2" />);
    await waitFor(() =>
      expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe(
        'Eintritt'
      )
    );
  }
);
it('shows a successful save link when navigation fails and prevents duplicate creation', async () => {
  state.navigate.mockRejectedValue(new Error('navigation_failed'));
  await edit();
  fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', { name: labels.actions.confirm }));
  await screen.findByText(labels.messages.savedNavigation);
  expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).disabled).toBe(false);
  expect(screen.getByLabelText(labels.fields.title).closest('fieldset')?.disabled).toBe(true);
  expect(screen.getByRole('link', { name: labels.actions.edit })).toBeDefined();
  expect(state.commit).toHaveBeenCalledOnce();
});
it('uses resource read rights to present usage while preventing content edits', async () => {
  publishSessionAccessSnapshot({
    isResolved: true,
    assignedModules: ['vouchers'],
    roles: [],
    permissionActions: ['vouchers.read'],
    unscopedPermissionActions: ['vouchers.read'],
  });
  state.get.mockResolvedValue({
    data: record,
    meta: { access: { 'vouchers.read': true } },
    fetchedAt: '2026-10-24T12:00:00Z',
  });
  render(<VoucherEditor id="2" />);
  await screen.findByText('37 von 100 eingelöst');
  expect(screen.getByLabelText(labels.fields.title).closest('fieldset')?.disabled).toBe(true);
  expect(screen.queryByRole('button', { name: labels.actions.show })).toBeNull();
  expect(state.prepare).not.toHaveBeenCalled();
});

it('renders creation, content and visibility history through the shared history component', async () => {
  state.history.mockResolvedValue(
    ['created', 'updated', 'status_changed'].map((action, i) => ({
      id: String(i),
      action,
      actor: 'Redaktion',
      changedFields: [],
      createdAt: '2026-10-24T12:00:00Z',
    }))
  );
  render(<VoucherEditor id="2" />);
  await screen.findByLabelText(labels.fields.title);
  const details = screen.getByText(labels.history.title).closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByText(labels.history.actions.created);
  expect(screen.getByText(labels.history.actions.updated)).toBeDefined();
  expect(screen.getByText(labels.history.actions.statusChanged)).toBeDefined();
});
it('keeps rich text and category selection in the same content save and removes an unwanted image', async () => {
  await edit();
  fireEvent.click(screen.getByRole('button', { name: labels.rich.htmlMode }));
  fireEvent.change(document.getElementById('voucher-body-html')!, {
    target: { value: '<p>Mit Anmeldung</p>' },
  });
  fireEvent.blur(document.getElementById('voucher-body-html')!);
  const category = screen.getByLabelText(labels.fields.categories) as HTMLSelectElement;
  category.options[0].selected = true;
  fireEvent.change(category);
  fireEvent.click(screen.getByRole('button', { name: labels.media.add }));
  fireEvent.click(screen.getByRole('button', { name: labels.media.remove }));
  fireEvent.click(screen.getByRole('button', { name: labels.actions.update }));
  await waitFor(() => expect(state.prepare).toHaveBeenCalledOnce());
  expect(state.prepare.mock.calls[0][0]).toMatchObject({
    body: '<p>Mit Anmeldung</p>',
    categories: [{ name: 'Kultur' }],
    mediaContents: [],
  });
});

it('retains a valid draft when refreshing usage fails', async () => {
  await edit();
  state.get.mockRejectedValue(new Error('unavailable'));
  fireEvent.click(screen.getByRole('button', { name: labels.actions.refresh }));
  await screen.findByText(labels.messages.error);
  expect((screen.getByLabelText(labels.fields.title) as HTMLInputElement).value).toBe('Neu');
  expect(screen.getByText('37 von 100 eingelöst')).toBeDefined();
  expect(state.commit).not.toHaveBeenCalled();
});
it('keeps a failed visibility action separate from destructive content editing', async () => {
  state.visibility.mockRejectedValue(new Error('unavailable'));
  render(<VoucherEditor id="2" />);
  fireEvent.click(await screen.findByRole('button', { name: labels.actions.show }));
  await screen.findByText(labels.messages.error);
  expect(screen.getByRole('button', { name: labels.actions.show })).toBeDefined();
  expect(state.prepare).not.toHaveBeenCalled();
});
it('blocks editing after a malformed recovery marker rather than retrying the write', async () => {
  sessionStorage.setItem('voucher-pending:user:2', '{}');
  render(<VoucherEditor id="2" />);
  fireEvent.click(await screen.findByRole('button', { name: labels.actions.reconcile }));
  await waitFor(() =>
    expect(screen.getByLabelText(labels.fields.title).closest('fieldset')?.disabled).toBe(true)
  );
  expect(state.reconcile).not.toHaveBeenCalled();
  expect(state.get).not.toHaveBeenCalled();
  expect(state.commit).not.toHaveBeenCalled();
});

it('uses an exact resource grant to offer visibility to a scoped publisher', async () => {
  publishSessionAccessSnapshot({
    isResolved: true,
    assignedModules: ['vouchers'],
    roles: [],
    permissionActions: ['vouchers.read', 'vouchers.publish'],
    unscopedPermissionActions: ['vouchers.read'],
  });
  render(<VoucherEditor id="2" />);
  await screen.findByRole('button', { name: labels.actions.show });
  expect(screen.getByLabelText(labels.fields.title).closest('fieldset')?.disabled).toBe(true);
});
