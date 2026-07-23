import { appendFileSync } from 'node:fs';

import type { PromoteDeployGateEvaluation } from './promote-deploy-gates.ts';

export const emitPromoteDeployGateOutputs = (evaluation: PromoteDeployGateEvaluation): void => {
  const githubOutput = process.env.GITHUB_OUTPUT?.trim();
  if (!githubOutput) return;

  const lines = [
    `changed_files=${evaluation.changedFiles.join(',')}`,
    `combined_ok=${String(evaluation.migration.ok && evaluation.bootstrap.ok)}`,
    `migration_gate_ok=${String(evaluation.migration.ok)}`,
    `migration_gate_result=${evaluation.migration.result}`,
    `migration_gate_risk_files=${evaluation.migration.riskFiles.join(',') || 'none'}`,
    `migration_gate_message=${evaluation.migration.message}`,
    `migration_should_run=${String(evaluation.migration.shouldRun)}`,
    `bootstrap_gate_ok=${String(evaluation.bootstrap.ok)}`,
    `bootstrap_gate_result=${evaluation.bootstrap.result}`,
    `bootstrap_gate_risk_files=${evaluation.bootstrap.riskFiles.join(',') || 'none'}`,
    `bootstrap_gate_message=${evaluation.bootstrap.message}`,
    `bootstrap_should_run=${String(evaluation.bootstrap.shouldRun)}`,
  ];
  appendFileSync(githubOutput, `${lines.join('\n')}\n`, 'utf8');
};
