import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { formatDocumentationIssue, loadDocumentationIntegrityInput } from './check-documentation';
import { checkDocumentationIntegrity } from './documentation-integrity';
import { buildWikiPublication, type WikiPublication } from './wiki-publication';

interface BuildWikiPublicationOptions {
  outputPath: string;
}

const EXPECTED_WIKI_REMOTE_PATH = '/smart-village-solutions/sva-studio.wiki';

export const parseBuildWikiPublicationOptions = (
  args: readonly string[]
): BuildWikiPublicationOptions => {
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--output') {
      outputPath = args[index + 1];
      index += 1;
      continue;
    }
    if (argument?.startsWith('--output=')) {
      outputPath = argument.slice('--output='.length);
      continue;
    }
    throw new Error(`Unbekanntes Argument: ${argument ?? ''}`);
  }
  if (!outputPath) {
    throw new Error('Fehlendes Pflichtargument --output <wiki-verzeichnis>');
  }
  return { outputPath };
};

const assertSafeOutputDirectory = (outputDirectory: string): void => {
  const resolved = path.resolve(outputDirectory);
  if (resolved === path.parse(resolved).root || resolved === path.resolve(process.cwd())) {
    throw new Error(`Unsicheres Wiki-Ausgabeverzeichnis: ${resolved}`);
  }
  if (!existsSync(resolved)) {
    return;
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Wiki-Ausgabe ist kein Verzeichnis: ${resolved}`);
  }
  const entries = readdirSync(resolved);
  if (entries.length > 0 && !entries.includes('.git')) {
    throw new Error(
      `Bestehendes Wiki-Ausgabeverzeichnis ist kein Git-Checkout und wird nicht überschrieben: ${resolved}`
    );
  }
  if (entries.includes('.git')) {
    let remoteUrl: string;
    try {
      remoteUrl = execFileSync('git', ['-C', resolved, 'config', '--get', 'remote.origin.url'], {
        encoding: 'utf8',
      }).trim();
    } catch {
      throw new Error(`Wiki-Ausgabeverzeichnis besitzt kein lesbares origin-Remote: ${resolved}`);
    }

    const normalizedRemoteUrl = remoteUrl.startsWith('git@github.com:')
      ? `https://github.com/${remoteUrl.slice('git@github.com:'.length)}`
      : remoteUrl;
    let remote: URL;
    try {
      remote = new URL(normalizedRemoteUrl);
    } catch {
      throw new Error(`Wiki-Ausgabeverzeichnis besitzt kein gültiges origin-Remote: ${resolved}`);
    }
    if (
      remote.hostname.toLowerCase() !== 'github.com' ||
      remote.pathname
        .toLowerCase()
        .replace(/\/$/u, '')
        .replace(/\.git$/u, '') !== EXPECTED_WIKI_REMOTE_PATH
    ) {
      throw new Error(
        `Wiki-Ausgabeverzeichnis verweist nicht auf das erwartete SVA-Studio-Wiki: ${resolved}`
      );
    }
  }
};

export const writeWikiPublication = (
  publication: WikiPublication,
  outputDirectory: string
): void => {
  const resolved = path.resolve(outputDirectory);
  assertSafeOutputDirectory(resolved);
  mkdirSync(resolved, { recursive: true });
  for (const entry of readdirSync(resolved)) {
    if (entry !== '.git') {
      rmSync(path.join(resolved, entry), { force: true, recursive: true });
    }
  }
  for (const [fileName, content] of publication.files) {
    if (path.basename(fileName) !== fileName || !fileName.endsWith('.md')) {
      throw new Error(`Ungültiger flacher Wiki-Dateiname: ${fileName}`);
    }
    writeFileSync(path.join(resolved, fileName), content, 'utf8');
  }
};

export const runWikiPublicationBuild = (
  rootDir = process.cwd(),
  args = process.argv.slice(2)
): number => {
  try {
    const options = parseBuildWikiPublicationOptions(args);
    const input = loadDocumentationIntegrityInput(rootDir);
    const integrityIssues = checkDocumentationIntegrity(input);
    if (integrityIssues.length > 0) {
      for (const issue of integrityIssues) {
        console.error(formatDocumentationIssue(issue));
      }
      console.error(
        `\nWiki-Publikation abgebrochen: Dokumentationsprüfung enthält ${integrityIssues.length} Befunde.`
      );
      return 1;
    }
    const result = buildWikiPublication(input);
    if (!result.publication) {
      for (const issue of result.issues) {
        console.error(formatDocumentationIssue(issue));
      }
      console.error(`\nWiki-Publikation abgebrochen (${result.issues.length} Befunde).`);
      return 1;
    }
    writeWikiPublication(result.publication, path.resolve(rootDir, options.outputPath));
    console.log(
      `Wiki-Publikation erfolgreich erzeugt: ${result.publication.files.size} gerenderte Seiten.`
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runWikiPublicationBuild());
}
