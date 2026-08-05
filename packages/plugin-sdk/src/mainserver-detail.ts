export type MainserverDataDeviation = Readonly<{
  fieldPath: string;
  fieldGroup: string;
  code:
    'unexpected_type' | 'unsupported_value' | 'optional_dependency_failed' | 'preservation_limited';
  phase: 'read' | 'enrichment' | 'write';
  handling: 'defaulted' | 'omitted' | 'preserved_readonly' | 'temporarily_unavailable' | 'blocked';
  retryable: boolean;
}>;

export type MainserverDetailResult<TItem> = Readonly<{
  data: TItem;
  deviations: readonly MainserverDataDeviation[];
}>;

export const omitDeviatedMainserverFields = <TInput extends Readonly<Record<string, unknown>>>(
  input: TInput,
  deviations: readonly Pick<MainserverDataDeviation, 'fieldGroup'>[]
): TInput => {
  const omittedFields = new Set(deviations.map(({ fieldGroup }) => fieldGroup));
  return Object.fromEntries(
    Object.entries(input).filter(([fieldName]) => !omittedFields.has(fieldName))
  ) as TInput;
};
