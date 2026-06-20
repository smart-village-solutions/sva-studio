import type { AcceptanceProbeResult } from '../runtime-env.shared.ts';

export const createAcceptanceProbeResult = (input: {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  httpStatus?: number;
  message: string;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  status: AcceptanceProbeResult['status'];
  target: string;
}): AcceptanceProbeResult => ({
  ...input,
});
