export type OtelSeverityNumber = 1 | 5 | 9 | 13 | 17;

export type OtelLogRecord = {
  severityNumber: OtelSeverityNumber;
  severityText: string;
  body: string;
  attributes: Record<string, unknown>;
};

export type OtelLogger = {
  emit: (payload: OtelLogRecord) => void;
  debug?: (message: string, attributes?: Record<string, unknown>) => void;
  info?: (message: string, attributes?: Record<string, unknown>) => void;
  warn?: (message: string, attributes?: Record<string, unknown>) => void;
  error?: (message: string, attributes?: Record<string, unknown>) => void;
};

export type OtelLoggerProvider = {
  getLogger: (name: string, version?: string) => OtelLogger;
};
