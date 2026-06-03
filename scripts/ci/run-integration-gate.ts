import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const GENERAL_INTEGRATION_PROJECTS = ['data'] as const;
export const MONITORING_STACK_PROJECTS = ['monitoring-client'] as const;

type IntegrationGateMode = 'full' | 'affected';

interface IntegrationGateOptions {
  base: string;
  head: string;
  mode: IntegrationGateMode;
}

export const parseNxProjectList = (stdout: string): string[] =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const filterRunnableIntegrationProjects = (projects: readonly string[]): string[] => {
  const allowedProjects = new Set<string>(GENERAL_INTEGRATION_PROJECTS);
  return [...new Set(projects.filter((project) => allowedProjects.has(project)))].sort();
};

export const buildRunManyIntegrationCommand = (projects: readonly string[]): string =>
  `env -u NO_COLOR pnpm nx run-many -t test:integration --projects=${projects.join(',')} --output-style=stream`;

const parseCliOptions = (args: readonly string[]): IntegrationGateOptions => {
  let base = 'origin/main';
  let head = 'HEAD';
  let mode: IntegrationGateMode = 'full';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--base') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --base');
      }
      base = value;
      index += 1;
      continue;
    }

    if (argument === '--head') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --head');
      }
      head = value;
      index += 1;
      continue;
    }

    if (argument === '--mode') {
      const value = args[index + 1];
      if (value !== 'full' && value !== 'affected') {
        throw new Error('Ungültiger Wert für --mode. Erlaubt sind full oder affected.');
      }
      mode = value;
      index += 1;
      continue;
    }
  }

  return { base, head, mode };
};

const runCommand = (command: string): void => {
  console.log(`\n$ ${command}`);
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
  });
};

const resolveAffectedIntegrationProjects = (base: string, head: string): string[] => {
  const output = execSync(
    `env -u NO_COLOR pnpm nx show projects --affected --withTarget=test:integration --base=${base} --head=${head}`,
    {
      encoding: 'utf8',
      env: process.env,
    }
  );

  return filterRunnableIntegrationProjects(parseNxProjectList(output));
};

export const runIntegrationGate = (args: readonly string[]): number => {
  const options = parseCliOptions(args);

  if (options.mode === 'full') {
    runCommand(buildRunManyIntegrationCommand(GENERAL_INTEGRATION_PROJECTS));
    return 0;
  }

  const affectedProjects = resolveAffectedIntegrationProjects(options.base, options.head);
  if (affectedProjects.length === 0) {
    console.log(
      'Keine echten allgemeinen Integrationsziele betroffen. Monitoring-spezifische Checks laufen separat im Workflow `Monitoring Stack`.'
    );
    return 0;
  }

  runCommand(buildRunManyIntegrationCommand(affectedProjects));
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runIntegrationGate(process.argv.slice(2)));
}
