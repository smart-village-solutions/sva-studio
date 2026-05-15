export type LogStep = (message: string) => void;

export const logStep: LogStep = (message) => {
  process.stdout.write(`\n==> ${message}\n`);
};
