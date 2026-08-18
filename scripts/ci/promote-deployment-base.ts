#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { inspectRegistryImage, type RegistryImageInspection } from './promote-image-provenance.ts';
import type { PromoteEnvironment } from './promote-target.ts';

const commitShaPattern = /^[a-f0-9]{40}$/u;
const liveImagePattern = /^ghcr\.io\/smart-village-solutions\/sva-studio@sha256:[a-f0-9]{64}$/u;

export const resolveEffectiveDeploymentBase = (
  input: Readonly<{
    declaredBase: string;
    environment: PromoteEnvironment;
    head: string;
    inspection: RegistryImageInspection;
    isAncestor: (base: string, head: string) => boolean;
    liveImage: string;
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
  if (!commitShaPattern.test(input.head) || !input.isAncestor(revision, input.head)) {
    throw new Error('Die tatsächlich deployte OCI-Revision ist kein Ancestor von change_head.');
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
  const result = resolveEffectiveDeploymentBase({
    declaredBase,
    environment: environmentValue,
    head,
    inspection: inspectRegistryImage(liveImage),
    isAncestor: (base, target) => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', base, target], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    liveImage,
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
