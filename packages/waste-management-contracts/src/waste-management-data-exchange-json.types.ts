import type {
  WasteManagementDataExchangeEnvelope,
} from './waste-management-data-exchange.js';

export type WasteManagementDataExchangeIssue = Readonly<{
  code:
    | 'duplicate_record'
    | 'excluded_field'
    | 'invalid_envelope'
    | 'invalid_field_type'
    | 'missing_required_field'
    | 'unknown_entity_type'
    | 'unknown_field'
    | 'unsupported_format_version'
    | 'unsupported_profile';
  path: string;
  message: string;
}>;

export type WasteManagementDataExchangeParseResult =
  | Readonly<{
      ok: true;
      envelope: WasteManagementDataExchangeEnvelope;
      defaultedFields: readonly string[];
    }>
  | Readonly<{
      ok: false;
      issues: readonly WasteManagementDataExchangeIssue[];
    }>;
