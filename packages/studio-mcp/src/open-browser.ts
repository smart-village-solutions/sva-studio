import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const openLoginUrl = async (
  url: string,
  platform: NodeJS.Platform = process.platform
): Promise<void> => {
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32' : 'xdg-open';
  const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  await execFileAsync(command, args, { timeout: 10_000, maxBuffer: 1024 });
};
