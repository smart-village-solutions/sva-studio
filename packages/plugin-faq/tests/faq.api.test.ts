import { createMainserverCrudClient } from '@sva/plugin-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const getMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@sva/plugin-sdk', () => ({
  createMainserverCrudClient: vi.fn((options: { errorFactory: (code: string, message?: string) => Error }) => ({
    list: listMock,
    get: getMock,
    create: createMock,
    update: updateMock,
    remove: removeMock,
    errorFactory: options.errorFactory,
  })),
}));

describe('faq api wrapper', () => {
  beforeEach(() => {
    listMock.mockReset();
    getMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    removeMock.mockReset();
  });

  it('delegates list/get/create/update/delete to the generated crud client', async () => {
    listMock.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 25, hasNextPage: false } });
    getMock.mockResolvedValue({ id: 'faq-1' });
    createMock.mockResolvedValue({ id: 'faq-2' });
    updateMock.mockResolvedValue({ id: 'faq-3' });
    removeMock.mockResolvedValue(undefined);

    const { listFaqs, getFaq, createFaq, updateFaq, deleteFaq } = await import('../src/faq.api.js');
    const input = { title: 'Frage', genericType: 'FAQ' as const, contentBlocks: [{ body: 'Antwort' }], payload: {}, visible: true };

    await expect(listFaqs({ page: 1, pageSize: 25 })).resolves.toEqual({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    await expect(getFaq('faq-1')).resolves.toEqual({ id: 'faq-1' });
    await expect(createFaq(input)).resolves.toEqual({ id: 'faq-2' });
    await expect(updateFaq('faq-3', input)).resolves.toEqual({ id: 'faq-3' });
    await expect(deleteFaq('faq-4')).resolves.toBeUndefined();

    expect(listMock).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(getMock).toHaveBeenCalledWith('faq-1');
    expect(createMock).toHaveBeenCalledWith(input);
    expect(updateMock).toHaveBeenCalledWith('faq-3', input);
    expect(removeMock).toHaveBeenCalledWith('faq-4');
  });

  it('creates stable faq api errors through the configured error factory', async () => {
    await import('../src/faq.api.js');

    const factory = vi.mocked(createMainserverCrudClient).mock.calls[0]?.[0].errorFactory;
    const error = factory?.('forbidden', 'Nope');

    expect(error).toBeInstanceOf(Error);
    expect(error?.name).toBe('FaqApiError');
    expect(error?.message).toBe('Nope');
    expect(error).toMatchObject({ code: 'forbidden' });
  });
});
