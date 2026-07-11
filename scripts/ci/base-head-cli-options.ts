export interface BaseHeadCliOptions {
  base: string;
  head: string;
}

export const parseBaseHeadCliOptions = (args: readonly string[]): BaseHeadCliOptions => {
  let base = 'origin/main';
  let head = 'HEAD';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== '--base' && argument !== '--head') {
      continue;
    }

    const value = args[index + 1];
    if (!value) {
      throw new Error(`Fehlender Wert für ${argument}`);
    }

    if (argument === '--base') {
      base = value;
    } else {
      head = value;
    }
    index += 1;
  }

  return { base, head };
};
