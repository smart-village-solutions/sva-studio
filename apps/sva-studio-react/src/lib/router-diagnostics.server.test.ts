// @vitest-environment node
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

const mockMkdtemp = vi.fn().mockResolvedValue('/tmp/sva-router-diagnostics-abc123');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    default: actual,
    mkdtemp: mockMkdtemp,
    writeFile: mockWriteFile,
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => mockLogger),
}));

describe('router-diagnostics.server', () => {
  const diagnosticsFile = path.join('/tmp/sva-router-diagnostics-abc123', 'snapshot.json');

  const routeTree = {
    id: '__root__',
    fullPath: '/',
    children: [{ id: '/', path: '/', fullPath: '/' }],
  };

  const router = {
    routesById: { root: { id: '__root__', fullPath: '/' } },
    routesByPath: { '/': { id: '/', fullPath: '/' } },
    flatRoutes: [{ id: '/', fullPath: '/' }],
  };

  it('emitRouterDiagnosticsOnce writes snapshot, logs with workspace_id, and is idempotent', async () => {
    const { emitRouterDiagnosticsOnce } = await import('./router-diagnostics.server');

    await emitRouterDiagnosticsOnce(router as never, routeTree);

    expect(mockMkdtemp).toHaveBeenCalledWith(path.join(tmpdir(), 'sva-router-diagnostics-'));
    expect(mockWriteFile).toHaveBeenCalledWith(
      diagnosticsFile,
      expect.stringContaining('"routeTreeNodeCount"'),
      'utf8',
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        workspace_id: 'platform',
      }),
    );

    // Idempotency: second call should not write again
    const callCount = mockWriteFile.mock.calls.length;
    await emitRouterDiagnosticsOnce(router as never, routeTree);
    expect(mockWriteFile).toHaveBeenCalledTimes(callCount);
  });

  it('logs error without throwing when writeFile fails', async () => {
    mockWriteFile.mockRejectedValueOnce(new Error('disk full'));
    mockLogger.error.mockClear();

    const { emitRouterModuleLoadDiagnosticsOnce } = await import('./router-diagnostics.server');

    const emptyTree = { id: '__root__', fullPath: '/', children: [] };

    await expect(emitRouterModuleLoadDiagnosticsOnce(emptyTree)).resolves.toBeUndefined();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('konnte nicht geschrieben werden'),
      expect.objectContaining({
        workspace_id: 'platform',
        error: 'disk full',
      }),
    );
  });
});
