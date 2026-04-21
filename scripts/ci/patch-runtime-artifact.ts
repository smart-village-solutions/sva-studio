import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const appDirArg = process.argv[2] ?? 'apps/sva-studio-react';
const appDir = path.resolve(appDirArg);
const outputServerDir = path.join(appDir, '.output', 'server');
const outputBuildDir = path.join(outputServerDir, 'chunks', 'build');
const outputSsrDir = path.join(outputServerDir, '_ssr');
const finalServerEntryPath = path.join(outputServerDir, 'index.mjs');
const intermediateServerEntryPath = path.join(appDir, '.nitro', 'vite', 'services', 'ssr', 'server.js');
const generatedServerEntryFileName = 'tanstack-server-entry.mjs';
const generatedServerEntryPath = path.join(outputBuildDir, generatedServerEntryFileName);
const generatedServerEntryImportPath = `./chunks/build/${generatedServerEntryFileName}`;
const generatedNitroSsrEntryPath = path.join(outputSsrDir, 'ssr.mjs');

const finalSsrRendererPattern =
  /function ssrRenderer\(\{ req \}\) \{\n\treturn fetch\(req, \{ viteEnv: "ssr" \}\);\n\}/;

const generatedEntryImportPattern = /^import \{[^}]*createStartHandler[^}]*\} from "\.\/assets\/[^"]+";/m;

const pathExists = async (filePath: string) => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const assertServerEntryContract = (source: string, filePath: string) => {
  const missingMarkers = ['dispatchAuthRouteRequest', 'server-entry-transport', 'server-function-transport'].filter(
    (marker) => !source.includes(marker)
  );

  if (missingMarkers.length > 0) {
    throw new Error(`Server-Entry ${filePath} enthaelt nicht alle Runtime-Vertragsmarker: ${missingMarkers.join(', ')}`);
  }
};

const main = async () => {
  const [finalServerEntrySource, nitroSsrEntryExists] = await Promise.all([
    readFile(finalServerEntryPath, 'utf8'),
    pathExists(generatedNitroSsrEntryPath),
  ]);

  if (nitroSsrEntryExists && finalServerEntrySource.includes('./_ssr/ssr.mjs')) {
    const generatedNitroSsrEntrySource = await readFile(generatedNitroSsrEntryPath, 'utf8');
    assertServerEntryContract(generatedNitroSsrEntrySource, generatedNitroSsrEntryPath);

    process.stdout.write(
      `${JSON.stringify(
        {
          appDir,
          finalServerEntryPath,
          generatedServerEntryPath: generatedNitroSsrEntryPath,
          mode: 'nitro-vite-ssr-service',
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const buildFiles = await readdir(outputBuildDir);
  const serverChunkFileName = buildFiles.find((fileName) => /^server-.*\.mjs$/.test(fileName));

  if (!serverChunkFileName) {
    throw new Error(`Kein finaler Server-Chunk unter ${outputBuildDir} gefunden.`);
  }

  const intermediateServerEntrySource = await readFile(intermediateServerEntryPath, 'utf8');

  const generatedServerEntrySource = intermediateServerEntrySource.replace(
    generatedEntryImportPattern,
    `import { defaultStreamHandler, createStartHandler } from "./${serverChunkFileName}";`
  );

  if (generatedServerEntrySource === intermediateServerEntrySource) {
    throw new Error('Der intermediate Server-Entry konnte nicht auf den finalen Server-Chunk umgeschrieben werden.');
  }

  const patchedFinalServerEntrySource = finalServerEntrySource.replace(
    finalSsrRendererPattern,
    `function ssrRenderer({ req }) {\n\treturn import("${generatedServerEntryImportPath}").then((mod) => mod.default.fetch(req));\n}`
  );

  if (patchedFinalServerEntrySource === finalServerEntrySource) {
    throw new Error('Der finale SSR-Renderer konnte nicht auf den generierten Server-Entry umgeschrieben werden.');
  }

  assertServerEntryContract(generatedServerEntrySource, generatedServerEntryPath);
  await mkdir(outputBuildDir, { recursive: true });
  await Promise.all([
    writeFile(generatedServerEntryPath, generatedServerEntrySource, 'utf8'),
    writeFile(finalServerEntryPath, patchedFinalServerEntrySource, 'utf8'),
  ]);

  process.stdout.write(
    `${JSON.stringify(
      {
        appDir,
        finalServerEntryPath,
        generatedServerEntryPath,
        mode: 'legacy-chunks-build-patch',
        serverChunkFileName,
      },
      null,
      2
    )}\n`
  );
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
