import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pluginSdkVersion } from '@sva/plugin-sdk';
import { build } from 'vite';
import {
  createInstalledPluginInputsPlugin,
  createModulePublicCodePlugin,
  createSelectedWorkspacePluginInputsPlugin,
  renderInstalledPluginInputs,
  resolveInstalledPluginSources,
} from '../../plugin-installed-inputs.vite.js';

const temporaryRoots: string[] = [];
const createFixture = (
  input: {
    distribution?: 'studio' | 'ssf';
    enabled?: boolean;
    browserPath?: string;
    exportsManifest?: boolean;
    jobsPath?: string | null;
    runtimeRequirement?: string;
    sourceRef?: string;
    sdkVersion?: string;
    requiredCapabilities?: string[];
  } = {}
) => {
  const root = mkdtempSync(join(tmpdir(), 'studio-installed-plugin-'));
  temporaryRoots.push(root);
  const appRoot = join(root, 'app');
  const sourceRef = input.sourceRef ?? '@vendor/calendar';
  const packageRoot = join(appRoot, 'node_modules', ...sourceRef.split('/'));
  mkdirSync(packageRoot, { recursive: true });
  const paths = {
    descriptor: './dist/metadata.js',
    browser: input.browserPath ?? './dist/calendar-view.js',
    server: './dist/calendar-http.js',
    jobs: input.jobsPath === null ? undefined : (input.jobsPath ?? './dist/calendar-worker.js'),
  };
  writeFileSync(
    join(appRoot, 'package.json'),
    JSON.stringify({
      name: 'test-studio',
      dependencies: { [sourceRef]: '1.0.0' },
    })
  );
  writeFileSync(
    join(appRoot, 'plugin-catalog.json'),
    JSON.stringify([
      {
        pluginId: 'calendar',
        sourceType: 'installed-distribution',
        enabled: input.enabled ?? true,
        sourceRef,
        distribution: input.distribution ?? 'studio',
      },
    ])
  );
  writeFileSync(
    join(packageRoot, 'package.json'),
    JSON.stringify({
      name: sourceRef,
      version: '1.0.0',
      type: 'module',
      exports:
        input.exportsManifest === false
          ? { '.': './dist/calendar-view.js' }
          : { './plugin.manifest.json': './plugin.manifest.json' },
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
      runtimeRequirements: { jobs: input.runtimeRequirement ?? 'waste-management.operations' },
    })
  );
  for (const path of Object.values(paths)) {
    if (!path || path.includes('..')) continue;
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
  const createPublicCodeFixture = () => {
    const root = mkdtempSync(join(tmpdir(), 'studio-publiccode-'));
    temporaryRoots.push(root);
    const appRoot = join(root, 'apps', 'studio');
    const mediaFile = join(root, 'packages', 'media', 'publiccode.yml');
    mkdirSync(dirname(mediaFile), { recursive: true });
    mkdirSync(appRoot, { recursive: true });
    writeFileSync(join(appRoot, 'plugin-catalog.json'), '[]');
    writeFileSync(
      mediaFile,
      readFileSync(join(process.cwd(), '../../packages/media/publiccode.yml'))
    );
    return { appRoot, mediaFile };
  };

  it('reads public names and descriptions from module-owned publiccode files', () => {
    const plugin = createModulePublicCodePlugin(process.cwd(), 'studio', []) as unknown as {
      resolveId: (id: string) => string;
      load: (id: string) => string;
    };
    const code = plugin.load(plugin.resolveId('virtual:studio-module-publiccode'));
    expect(code).toContain('Nachrichten');
    expect(code).toContain('Erstellt und veröffentlicht Nachrichten');
    expect(code).toContain('Mediathek');
    expect(code).not.toContain('Smart Speech Flow');
  });

  it('rejects malformed module metadata before generating the virtual module', () => {
    const { appRoot, mediaFile } = createPublicCodeFixture();
    writeFileSync(mediaFile, 'name: [broken\n');
    expect(() => createModulePublicCodePlugin(appRoot, 'studio', [])).toThrow(
      'module_publiccode_yaml_invalid:media'
    );

    writeFileSync(mediaFile, 'publiccodeYmlVersion: "1"\nname: Media\ndescription: {}\n');
    expect(() => createModulePublicCodePlugin(appRoot, 'studio', [])).toThrow(
      'module_publiccode_invalid:media'
    );

    writeFileSync(
      mediaFile,
      'publiccodeYmlVersion: "0"\nname: Media\ndescription:\n  de:\n    shortDescription: Valid\n  en:\n    shortDescription: ""\n'
    );
    expect(() => createModulePublicCodePlugin(appRoot, 'studio', [])).toThrow(
      'module_publiccode_description_invalid:media:en'
    );
  });

  it('requires metadata from an installed module selected for the distribution', () => {
    const { appRoot } = createPublicCodeFixture();
    writeFileSync(
      join(appRoot, 'plugin-catalog.json'),
      JSON.stringify([
        {
          pluginId: 'calendar',
          sourceType: 'installed-distribution',
          enabled: true,
          sourceRef: '@vendor/calendar',
          distribution: 'studio',
        },
      ])
    );
    expect(() => createModulePublicCodePlugin(appRoot, 'studio', [])).toThrow(
      'module_publiccode_missing:calendar'
    );
    const packageRoot = join(appRoot, 'node_modules', '@vendor', 'calendar');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      join(packageRoot, 'publiccode.yml'),
      'publiccodeYmlVersion: "0"\nname: Calendar\ndescription:\n  de:\n    shortDescription: Termine verwalten.\n  en:\n    localisedName: Calendar\n    shortDescription: Manage events.\n'
    );
    const plugin = createModulePublicCodePlugin(appRoot, 'studio', []) as unknown as {
      resolveId: (id: string) => string;
      load: (id: string) => string;
    };
    expect(plugin.load(plugin.resolveId('virtual:studio-module-publiccode'))).toContain(
      'Termine verwalten.'
    );
  });

  it('generates browser, server, worker, descriptor, manifest, and ownership maps from one selection', () => {
    const appRoot = process.cwd();
    const plugin = createSelectedWorkspacePluginInputsPlugin(appRoot, [
      'categories',
      'news',
      'ssf',
    ]);
    const hook = plugin as unknown as {
      resolveId: (id: string) => string | undefined;
      load: (id: string) => string | undefined;
    };
    const loadVirtual = (id: string): string => {
      const resolved = hook.resolveId(id);
      if (!resolved) throw new Error(`virtual_module_missing:${id}`);
      const code = hook.load(resolved);
      if (!code) throw new Error(`virtual_module_empty:${id}`);
      return code;
    };

    const client = loadVirtual('virtual:studio-selected-plugin-client');
    const server = loadVirtual('virtual:studio-selected-plugin-server');
    const jobs = loadVirtual('virtual:studio-selected-plugin-jobs');
    const ownership = loadVirtual('virtual:studio-selected-plugin-ownership');
    for (const pluginId of ['categories', 'news', 'ssf']) {
      expect(client).toContain(`packages/plugin-${pluginId}/`);
    }
    expect(server).toContain('packages/plugin-ssf/');
    expect(jobs).toContain('packages/plugin-ssf/');
    for (const pluginId of ['events', 'poi', 'faq', 'waste-management']) {
      expect(server).not.toContain(`packages/plugin-${pluginId}/`);
      expect(jobs).not.toContain(`packages/plugin-${pluginId}/`);
      expect(client).not.toContain(`packages/plugin-${pluginId}/`);
      expect(ownership).not.toContain(`packages/plugin-${pluginId}/`);
    }
  });

  it('escapes workspace paths in generated custom JavaScript modules', () => {
    const root = mkdtempSync(join(tmpdir(), 'studio-selected-escaping-'));
    temporaryRoots.push(root);
    const appRoot = join(root, 'apps', 'studio');
    const sourceRef = 'packages/plugin-<script>&\u2028\u2029';
    const packageRoot = join(root, sourceRef);
    mkdirSync(appRoot, { recursive: true });
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(
      join(appRoot, 'plugin-catalog.json'),
      JSON.stringify([{ pluginId: 'news', sourceType: 'workspace', sourceRef, enabled: true }])
    );
    writeFileSync(join(packageRoot, 'plugin.manifest.json'), '{"pluginId":"news"}');
    writeFileSync(join(packageRoot, 'src', 'browser.ts'), 'export {};');
    writeFileSync(join(packageRoot, 'src', 'descriptor.ts'), 'export {};');
    writeFileSync(join(packageRoot, 'src', 'server.ts'), 'export {};');
    writeFileSync(join(packageRoot, 'src', 'generic-item-ownership.ts'), 'export {};');
    const hook = createSelectedWorkspacePluginInputsPlugin(appRoot, ['news']) as unknown as {
      resolveId: (id: string) => string;
      load: (id: string) => string;
    };
    for (const kind of ['catalog', 'client', 'server', 'jobs', 'ownership']) {
      const code = hook.load(hook.resolveId(`virtual:studio-selected-plugin-${kind}`));
      expect(code).not.toMatch(/[<&\u2028\u2029]/u);
      expect(code).toContain('\\u003cscript\\u003e\\u0026\\u2028\\u2029');
    }
  });

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
    const { appRoot } = createFixture({ distribution: 'ssf', jobsPath: null });
    expect(resolveInstalledPluginSources(appRoot, 'studio')).toEqual([]);
    expect(resolveInstalledPluginSources(appRoot, 'ssf')).toHaveLength(1);
  });

  it('rejects an enabled SSF package whose job entrypoint the host cannot register', () => {
    const { appRoot } = createFixture({ distribution: 'ssf' });
    expect(() => resolveInstalledPluginSources(appRoot, 'ssf')).toThrow(
      'installed_plugin_jobs_unsupported:calendar:ssf'
    );
  });

  it('rejects a Studio job entrypoint without a registered runtime provider', () => {
    const { appRoot } = createFixture({ runtimeRequirement: 'calendar.test' });
    expect(() => resolveInstalledPluginSources(appRoot, 'studio')).toThrow(
      'installed_plugin_jobs_unsupported:calendar:studio'
    );
  });

  it.each(['@vendor/plugin.calendar', '@vendor/plugin_calendar'])(
    'accepts valid npm package names such as %s',
    (sourceRef) => {
      const { appRoot } = createFixture({ jobsPath: null, sourceRef });
      expect(resolveInstalledPluginSources(appRoot, 'studio')).toHaveLength(1);
    }
  );

  it('loads a package manifest without an exports-map subpath', () => {
    const { appRoot } = createFixture({ exportsManifest: false });
    expect(resolveInstalledPluginSources(appRoot, 'studio')).toHaveLength(1);
  });

  it('escapes dangerous characters in generated JavaScript import strings', () => {
    const { appRoot } = createFixture({ browserPath: './dist/</script>.js' });
    const generated = renderInstalledPluginInputs(
      resolveInstalledPluginSources(appRoot, 'studio'),
      'client'
    );
    expect(generated).toContain('\\u003c/script\\u003e.js');
    expect(generated).not.toContain('</script>');
  });

  it('keeps disabled packages in the catalog without loading their entrypoints', () => {
    const disabled = createFixture({
      enabled: false,
      sdkVersion: '999.0.0',
      runtimeRequirement: 'calendar.test',
    });
    rmSync(join(disabled.packageRoot, 'dist'), { recursive: true, force: true });
    const sources = resolveInstalledPluginSources(disabled.appRoot, 'studio');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.catalog.enabled).toBe(false);
    expect(sources[0]?.files).toEqual({});
    expect(renderInstalledPluginInputs(sources, 'catalog')).toContain('"enabled":false');
    expect(renderInstalledPluginInputs(sources, 'client')).toContain('"pluginId":"calendar"');
    expect(renderInstalledPluginInputs(sources, 'client')).not.toContain('import(');
    expect(renderInstalledPluginInputs(sources, 'server')).not.toContain('import(');
  });

  it('validates package identity before skipping disabled entrypoints', () => {
    const { appRoot, packageRoot } = createFixture({ enabled: false });
    writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: '@vendor/other' }));
    expect(() => resolveInstalledPluginSources(appRoot, 'studio')).toThrow(
      'installed_plugin_package_mismatch:calendar'
    );

    writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ dependencies: {} }));
    expect(() => resolveInstalledPluginSources(appRoot, 'studio')).toThrow(
      'installed_plugin_dependency_missing:calendar'
    );
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
