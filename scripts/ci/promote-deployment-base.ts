#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { inspectRegistryImage, type RegistryImageInspection } from './promote-image-provenance.ts';
import type { PromoteEnvironment } from './promote-target.ts';

const commitShaPattern = /^[a-f0-9]{40}$/u;
const liveImagePattern =
  /^ghcr\.io\/smart-village-solutions\/sva-studio(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?@sha256:[a-f0-9]{64}$/u;
const configRevisionPattern = /^[a-f0-9]{64}$/u;
const lineSwitchRiskPaths = [
  /^Dockerfile$/u,
  /^pnpm-lock\.yaml$/u,
  /^config\/runtime\//u,
  /^deploy\/compose\./u,
  /^deploy\/portainer\//u,
  /^packages\/(?:data|auth-runtime|plugin-ssf|server-runtime|instance-registry)\//u,
  /^packages\/iam-/u,
  /^docs\/development\/studio-db-schema/u,
];

export type StagingLineSwitch = 'none' | 'beta-to-hotfix' | 'hotfix-to-beta';

const verifyStagingLineSwitch = (
  input: Readonly<{
    changedFiles?: readonly string[];
    declaredBase: string;
    environment: PromoteEnvironment;
    head: string;
    isAncestor: (base: string, head: string) => boolean;
    lineSwitch: Exclude<StagingLineSwitch, 'none'>;
    liveConfigRevision?: string;
    liveRevision: string;
    sourceKind?: 'main' | 'hotfix';
    targetConfigRevision?: string;
  }>
): void => {
  const expectedKind = input.lineSwitch === 'beta-to-hotfix' ? 'hotfix' : 'main';
  if (
    input.environment !== 'staging' ||
    input.sourceKind !== expectedKind ||
    !commitShaPattern.test(input.declaredBase) ||
    input.liveRevision === input.head ||
    input.isAncestor(input.liveRevision, input.head) ||
    !input.isAncestor(input.declaredBase, input.liveRevision) ||
    !input.isAncestor(input.declaredBase, input.head) ||
    !configRevisionPattern.test(input.liveConfigRevision ?? '') ||
    input.liveConfigRevision !== input.targetConfigRevision ||
    !input.changedFiles?.length ||
    input.changedFiles.some((file) => lineSwitchRiskPaths.some((pattern) => pattern.test(file)))
  ) {
    throw new Error(
      'Staging-Linienwechsel ist für Live-Schema, Config oder Quellklasse nicht belegt.'
    );
  }
};

export const resolveEffectiveDeploymentBase = (
  input: Readonly<{
    declaredBase: string;
    environment: PromoteEnvironment;
    head: string;
    inspection: RegistryImageInspection;
    isAncestor: (base: string, head: string) => boolean;
    liveImage: string;
    lineSwitch?: StagingLineSwitch;
    sourceKind?: 'main' | 'hotfix';
    liveConfigRevision?: string;
    targetConfigRevision?: string;
    changedFiles?: readonly string[];
    prodRevision?: string;
  }>
) => {
  if (!liveImagePattern.test(input.liveImage)) {
    throw new Error('Das tatsächlich deployte Image gehört nicht zum erwarteten Repository.');
  }
  const revision = input.inspection.image?.config?.Labels?.['org.opencontainers.image.revision'];
  if (!revision || !commitShaPattern.test(revision)) {
    throw new Error(
      'Die OCI-Revision des tatsächlich deployten Images ist nicht vertrauenswürdig.'
    );
  }
  if (!commitShaPattern.test(input.head)) {
    throw new Error('change_head ist keine gültige Revision.');
  }
  if (input.sourceKind === 'hotfix' && input.prodRevision !== input.declaredBase) {
    throw new Error('Der Production-Basistag stimmt nicht mit der Live-OCI-Revision überein.');
  }
  const lineSwitch = input.lineSwitch ?? 'none';
  if (lineSwitch === 'none' && !input.isAncestor(revision, input.head)) {
    throw new Error('Die tatsächlich deployte OCI-Revision ist kein Ancestor von change_head.');
  }
  if (lineSwitch !== 'none') {
    verifyStagingLineSwitch({
      changedFiles: input.changedFiles,
      declaredBase: input.declaredBase,
      environment: input.environment,
      head: input.head,
      isAncestor: input.isAncestor,
      lineSwitch,
      liveConfigRevision: input.liveConfigRevision,
      liveRevision: revision,
      sourceKind: input.sourceKind,
      targetConfigRevision: input.targetConfigRevision,
    });
  }
  return {
    declaredBase: input.declaredBase,
    effectiveBase: revision,
    source: 'live-image' as const,
  };
};

const required = (value: string | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} fehlt.`);
  return normalized;
};

const readOption = (args: readonly string[], option: string) => {
  const index = args.indexOf(option);
  return index < 0 ? undefined : args[index + 1];
};

const main = () => {
  const args = process.argv.slice(2);
  const declaredBase = required(readOption(args, '--declared-base'), '--declared-base');
  const head = required(readOption(args, '--head'), '--head');
  const liveImage = required(readOption(args, '--live-image'), '--live-image');
  const environmentValue = required(readOption(args, '--environment'), '--environment');
  if (environmentValue !== 'dev' && environmentValue !== 'staging' && environmentValue !== 'prod') {
    throw new Error('--environment ist ungültig.');
  }
  const lineSwitch = readOption(args, '--line-switch') ?? 'none';
  if (lineSwitch !== 'none' && lineSwitch !== 'beta-to-hotfix' && lineSwitch !== 'hotfix-to-beta') {
    throw new Error('--line-switch ist ungültig.');
  }
  const inspection = inspectRegistryImage(liveImage);
  const liveRevision = inspection.image?.config?.Labels?.['org.opencontainers.image.revision'];
  const sourceKind = readOption(args, '--source-kind') as 'main' | 'hotfix' | undefined;
  const prodLiveImage = readOption(args, '--prod-live-image');
  const prodRevision =
    sourceKind === 'hotfix'
      ? prodLiveImage
        ? inspectRegistryImage(prodLiveImage).image?.config?.Labels?.[
            'org.opencontainers.image.revision'
          ]
        : environmentValue === 'prod'
          ? liveRevision
          : undefined
      : undefined;
  const result = resolveEffectiveDeploymentBase({
    declaredBase,
    environment: environmentValue,
    head,
    inspection,
    isAncestor: (base, target) => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', base, target], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    liveImage,
    lineSwitch,
    sourceKind,
    prodRevision,
    liveConfigRevision: readOption(args, '--live-config-revision'),
    targetConfigRevision: readOption(args, '--target-config-revision'),
    changedFiles:
      lineSwitch !== 'none'
        ? execFileSync(
            'git',
            ['diff', '--name-only', required(liveRevision, 'Live-Revision'), head],
            { encoding: 'utf8' }
          )
            .trim()
            .split('\n')
            .filter(Boolean)
        : undefined,
  });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `base_sha=${result.effectiveBase}\nbase_source=${result.source}\n`,
      'utf8'
    );
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    process.stderr.write(
      'PROMOTE_SOURCE_CONTRACT_INVALID: Die tatsächliche Deploy-Basis konnte nicht sicher gebunden werden.\n'
    );
    process.exitCode = 1;
  }
}
