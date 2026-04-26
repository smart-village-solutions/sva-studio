export const pluginGuardrailViolationCodes = [
  'plugin_guardrail_route_bypass',
  'plugin_guardrail_authorization_bypass',
  'plugin_guardrail_audit_bypass',
  'plugin_guardrail_persistence_bypass',
  'plugin_guardrail_dynamic_registration',
  'plugin_guardrail_unsupported_binding',
] as const;

export type PluginGuardrailViolationCode = (typeof pluginGuardrailViolationCodes)[number];

export type PluginGuardrailViolationInput = {
  readonly code: PluginGuardrailViolationCode;
  readonly pluginNamespace: string;
  readonly contributionId: string;
  readonly fieldOrReason: string;
};

export const createPluginGuardrailError = ({
  code,
  pluginNamespace,
  contributionId,
  fieldOrReason,
}: PluginGuardrailViolationInput): Error =>
  new Error(`${code}:${pluginNamespace}:${contributionId}:${fieldOrReason}`);

const guardrailFieldCode = {
  beforeLoad: 'plugin_guardrail_route_bypass',
  loader: 'plugin_guardrail_route_bypass',
  handler: 'plugin_guardrail_route_bypass',
  validateSearch: 'plugin_guardrail_route_bypass',
  guardFn: 'plugin_guardrail_authorization_bypass',
  authorize: 'plugin_guardrail_authorization_bypass',
  permissionResolver: 'plugin_guardrail_authorization_bypass',
  emitAudit: 'plugin_guardrail_audit_bypass',
  auditSink: 'plugin_guardrail_audit_bypass',
  auditHandler: 'plugin_guardrail_audit_bypass',
  serverHandler: 'plugin_guardrail_persistence_bypass',
  mutationHandler: 'plugin_guardrail_persistence_bypass',
  repository: 'plugin_guardrail_persistence_bypass',
  registerContentType: 'plugin_guardrail_dynamic_registration',
} as const satisfies Record<string, PluginGuardrailViolationCode>;

export const createPluginContributionGuardrailError = (
  pluginNamespace: string,
  contributionId: string,
  field: string,
  fallbackCode: PluginGuardrailViolationCode = 'plugin_guardrail_unsupported_binding'
): Error =>
  createPluginGuardrailError({
    code: guardrailFieldCode[field as keyof typeof guardrailFieldCode] ?? fallbackCode,
    pluginNamespace,
    contributionId,
    fieldOrReason: field,
  });

export const assertPluginContributionAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  pluginNamespace: string,
  contributionId: string
): void => {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw createPluginContributionGuardrailError(pluginNamespace, contributionId, key);
    }
  }
};

export const assertPluginRoutePathAllowed = (
  pluginNamespace: string,
  contributionId: string,
  path: string
): void => {
  const canonicalPrefix = `/plugins/${pluginNamespace}`;
  if (path !== canonicalPrefix && path.startsWith(`${canonicalPrefix}/`) === false) {
    throw createPluginGuardrailError({
      code: 'plugin_guardrail_route_bypass',
      pluginNamespace,
      contributionId,
      fieldOrReason: 'path',
    });
  }
};
