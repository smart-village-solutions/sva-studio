import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pluginSdkVersion } from '@sva/plugin-sdk';
import { build } from 'vite';
import {
  createInstalledPluginInputsPlugin,
  renderInstalledPluginInputs,
  resolveInstalledPluginSources,
} from '../../plugin-installed-inputs.vite.js';

const temporaryRoots: string[] = [];
const createFixture = (
  input: {
    distribution?: 'studio' | 'ssf';
    enabled?: boolean;
    browserPath?: string;
    sdkVersion?: string;
    requiredCapabilities?: string[];
  } = {}
) => {
  const root = mkdtempSync(join(tmpdir(), 'studio-installed-plugin-'));
  temporaryRoots.push(root);
  const appRoot = join(root, 'app');
  const packageRoot = join(appRoot, 'node_modules', '@vendor', 'calendar');
  mkdirSync(packageRoot, { recursive: true });
  const paths = {
    descriptor: './dist/metadata.js',
    browser: input.browserPath ?? './dist/calendar-view.js',
    server: './dist/calendar-http.js',
    jobs: './dist/calendar-worker.js',
  };
  writeFileSync(
    join(appRoot, 'package.json'),
    JSON.stringify({
      name: 'test-studio',
      dependencies: { '@vendor/calendar': '1.0.0' },
    })
  );
  writeFileSync(
    join(appRoot, 'plugin-catalog.json'),
    JSON.stringify([
      {
        pluginId: 'calendar',
        sourceType: 'installed-distribution',
        enabled: input.enabled ?? true,
        sourceRef: '@vendor/calendar',
        distribution: input.distribution ?? 'studio',
      },
    ])
  );
  writeFileSync(
    join(packageRoot, 'package.json'),
    JSON.stringify({
      name: '@vendor/calendar',
      version: '1.0.0',
      type: 'module',
      exports: { './plugin.manifest.json': './plugin.manifest.json' },
    })
  );
  writeFileSync(
    join(packageRoot, 'plugin.manifest.json'),
    JSON.stringify({
      pluginId: 'calendar',
      manifestVersion: 1,
      extensionTier: 'feature',
      tenantActivationPolicy: 'optional',
      version: '1.0.0',
      sdkVersion: input.sdkVersion ?? pluginSdkVersion,
      hostCompatibility: {
        studioVersionRange: '^0.0.1',
        requiredCapabilities: input.requiredCapabilities,
      },
      entryPoints: paths,
      runtimeRequirements: { jobs: 'calendar.test' },
    })
  );
  for (const path of Object.values(paths)) {
    if (path.includes('..')) continue;
    const file = join(packageRoot, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'export const marker = true;');
  }
  return { appRoot, packageRoot };
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('installed plugin build inputs', () => {
  it('uses the selected package and exact manifest paths for all runtime registers', () => {
    const { appRoot } = createFixture();
    const sources = resolveInstalledPluginSources(appRoot, 'studio');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.files.server).toContain('/dist/calendar-http.js');
    expect(renderInstalledPluginInputs(sources, 'catalog')).toContain('"@vendor/calendar"');
    const clientLoaders = renderInstalledPluginInputs(sources, 'client')
      .split('\n')
      .slice(1)
      .join('\n');
    const serverLoaders = renderInstalledPluginInputs(sources, 'server')
      .split('\n')
      .slice(1)
      .join('\n');
    expect(clientLoaders).toContain('dist/calendar-view.js');
    expect(clientLoaders).not.toContain('dist/calendar-http.js');
    expect(serverLoaders).toContain('dist/calendar-http.js');
    expect(serverLoaders).toContain('dist/calendar-worker.js');
    expect(serverLoaders).not.toContain('dist/calendar-view.js');
  });

  it('does not include a package chosen for another profile', () => {
    const { appRoot } = createFixture({ distribution: 'ssf' });
    expect(resolveInstalledPluginSources(appRoot, 'studio')).toEqual([]);
    expect(resolveInstalledPluginSources(appRoot, 'ssf')).toHaveLength(1);
  });

  it('keeps disabled packages in the catalog without loading their entrypoints', () => {
    const disabled = createFixture({ enabled: false });
    rmSync(join(disabled.packageRoot, 'dist'), { recursive: true, force: true });
    const sources = resolveInstalledPluginSources(disabled.appRoot, 'studio');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.catalog.enabled).toBe(false);
    expect(renderInstalledPluginInputs(sources, 'catalog')).toContain('"enabled":false');
    expect(renderInstalledPluginInputs(sources, 'client')).toContain('"pluginId":"calendar"');
    expect(renderInstalledPluginInputs(sources, 'client')).not.toContain('import(');
    expect(renderInstalledPluginInputs(sources, 'server')).not.toContain('import(');
  });

  it('fails before bundling when an entry is missing or escapes its package', () => {
    const missing = createFixture();
    rmSync(join(missing.packageRoot, 'dist', 'calendar-worker.js'));
    expect(() => resolveInstalledPluginSources(missing.appRoot, 'studio')).toThrow(
      'installed_plugin_entry_missing:calendar:jobs'
    );

    const escaping = createFixture({ browserPath: '../outside.js' });
    expect(() => resolveInstalledPluginSources(escaping.appRoot, 'studio')).toThrow(
      'installed_plugin_entry_invalid:calendar:browser'
    );

    const symlink = createFixture();
    const browser = join(symlink.packageRoot, 'dist', 'calendar-view.js');
    const outside = join(symlink.appRoot, 'outside.js');
    writeFileSync(outside, 'export {};');
    rmSync(browser);
    symlinkSync(outside, browser);
    expect(() => resolveInstalledPluginSources(symlink.appRoot, 'studio')).toThrow(
      'installed_plugin_entry_invalid:calendar:browser'
    );

    const manifestSymlink = createFixture();
    const packageManifest = join(manifestSymlink.packageRoot, 'plugin.manifest.json');
    const outsideManifest = join(manifestSymlink.appRoot, 'outside-manifest.json');
    writeFileSync(outsideManifest, readFileSync(packageManifest));
    rmSync(packageManifest);
    symlinkSync(outsideManifest, packageManifest);
    expect(() => resolveInstalledPluginSources(manifestSymlink.appRoot, 'studio')).toThrow(
      'installed_plugin_manifest_invalid:calendar'
    );
  });

  it('rejects an incompatible installed manifest', () => {
    const { appRoot } = createFixture({ sdkVersion: '999.0.0' });
    expect(() => resolveInstalledPluginSources(appRoot, 'studio')).toThrow(
      'installed_plugin_incompatible:calendar'
    );
    const unavailableCapability = createFixture({ requiredCapabilities: ['unknown-capability'] });
    expect(() => resolveInstalledPluginSources(unavailableCapability.appRoot, 'studio')).toThrow(
      'installed_plugin_incompatible:calendar'
    );
  });

  it('bundles exact entrypoints from an installed packed package and excludes unselected packages', async () => {
    const { appRoot, packageRoot } = createFixture();
    const packageFiles = {
      browser: join(packageRoot, 'dist', 'calendar-view.js'),
      descriptor: join(packageRoot, 'dist', 'metadata.js'),
      server: join(packageRoot, 'dist', 'calendar-http.js'),
      jobs: join(packageRoot, 'dist', 'calendar-worker.js'),
    };
    writeFileSync(
      packageFiles.browser,
      'if (typeof window === "undefined") throw new Error("browser_module_on_server"); export const marker = "calendar-browser";'
    );
    writeFileSync(packageFiles.descriptor, 'export const marker = "calendar-descriptor";');
    writeFileSync(packageFiles.server, 'export const marker = "calendar-server";');
    writeFileSync(
      packageFiles.jobs,
      'export const marker = "calendar-jobs"; export const createPluginJobExecutionHandlers = (runtime) => ({ "calendar.sync": () => runtime.marker });'
    );
    const archive = execFileSync(
      'npm',
      ['pack', '--pack-destination', dirname(appRoot), '--silent'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
      }
    ).trim();
    rmSync(join(appRoot, 'node_modules'), { recursive: true, force: true });
    execFileSync(
      'npm',
      [
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        join(dirname(appRoot), archive),
      ],
      {
        cwd: appRoot,
        stdio: 'pipe',
      }
    );
    const hidden = join(appRoot, 'node_modules', '@vendor', 'hidden');
    mkdirSync(hidden, { recursive: true });
    writeFileSync(join(hidden, 'index.js'), 'export const marker = "hidden-plugin-marker";');

    const buildEntry = async (kind: 'client' | 'server') => {
      const entry = join(appRoot, `${kind}.js`);
      const names =
        kind === 'client'
          ? ['nodePluginModuleLoaders', 'nodeDescriptorModuleLoaders']
          : ['nodeServerModuleLoaders', 'nodeDescriptorModuleLoaders', 'nodeJobModuleLoaders'];
      writeFileSync(
        entry,
        `import { ${names.join(', ')} } from 'virtual:studio-installed-plugin-${kind}';\nexport const registries = { ${names.join(', ')} };`
      );
      const result = await build({
        root: appRoot,
        configFile: false,
        logLevel: 'error',
        plugins: [createInstalledPluginInputsPlugin(appRoot, 'studio')],
        build: { write: false, lib: { entry, formats: ['es'], fileName: kind }, target: 'es2022' },
      });
      const outputs = Array.isArray(result) ? result : [result];
      if (outputs.some((output) => !('output' in output)))
        throw new Error('unexpected_build_result');
      const chunks = outputs
        .flatMap((output) => ('output' in output ? output.output : []))
        .filter((item) => item.type === 'chunk');
      if (chunks.length === 0) throw new Error('empty_build_output');
      const source = chunks.map((chunk) => chunk.code).join('\n');
      expect(source).not.toContain('hidden-plugin-marker');
      return { chunks, source };
    };

    const client = await buildEntry('client');
    expect(client.source).toContain('calendar-browser');
    expect(client.source).toContain('calendar-descriptor');
    expect(client.source).not.toContain('calendar-server');
    expect(client.source).not.toContain('calendar-jobs');
    const clientDir = join(appRoot, 'client-output');
    mkdirSync(clientDir);
    writeFileSync(join(clientDir, 'package.json'), '{"type":"module"}');
    for (const chunk of client.chunks) writeFileSync(join(clientDir, chunk.fileName), chunk.code);
    const clientEntry = client.chunks.find((chunk) => chunk.isEntry);
    if (!clientEntry) throw new Error('client_entry_missing');
    const clientCheck = `globalThis.window = {}; const { registries } = await import(${JSON.stringify(`./${clientEntry.fileName}`)}); const markers = await Promise.all(Object.values(registries).flatMap((registry) => Object.values(registry)).map(async (load) => (await load()).marker)); process.stdout.write(JSON.stringify(markers.sort()));`;
    const clientMarkers = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', clientCheck], {
        cwd: clientDir,
        encoding: 'utf8',
      })
    ) as string[];
    expect(clientMarkers).toEqual(['calendar-browser', 'calendar-descriptor']);
    const server = await buildEntry('server');
    expect(server.source).toContain('calendar-server');
    expect(server.source).toContain('calendar-jobs');
    expect(server.source).toContain('calendar-descriptor');
    expect(server.source).not.toContain('calendar-browser');
    const serverDir = join(appRoot, 'server-output');
    mkdirSync(serverDir);
    writeFileSync(join(serverDir, 'package.json'), '{"type":"module"}');
    for (const chunk of server.chunks) writeFileSync(join(serverDir, chunk.fileName), chunk.code);
    const entryChunk = server.chunks.find((chunk) => chunk.isEntry);
    if (!entryChunk) throw new Error('server_entry_missing');
    const moduleCheck = `const { registries } = await import(${JSON.stringify(`./${entryChunk.fileName}`)}); const modules = await Promise.all(Object.values(registries).flatMap((registry) => Object.values(registry)).map((load) => load())); const job = modules.find((module) => module.marker === 'calendar-jobs'); process.stdout.write(JSON.stringify({ markers: modules.map((module) => module.marker).sort(), jobResult: job.createPluginJobExecutionHandlers({ marker: 'injected-runtime' })['calendar.sync']() }));`;
    const loaded = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', moduleCheck], {
        cwd: serverDir,
        encoding: 'utf8',
      })
    ) as { markers: string[]; jobResult: string };
    expect(loaded).toEqual({
      markers: ['calendar-descriptor', 'calendar-jobs', 'calendar-server'],
      jobResult: 'injected-runtime',
    });
  }, 60_000);
});
