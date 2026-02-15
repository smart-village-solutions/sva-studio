import net from 'node:net';

type HttpService = {
  name: string;
  url: string;
};

type TcpService = {
  name: string;
  host: string;
  port: number;
};

const httpServices: HttpService[] = [
  { name: 'Loki', url: 'http://127.0.0.1:3100/ready' },
  { name: 'Promtail', url: 'http://127.0.0.1:3101/ready' },
];

const tcpServices: TcpService[] = [
  { name: 'Redis', host: '127.0.0.1', port: 6379 },
  { name: 'OTEL Collector Health Port', host: '127.0.0.1', port: 13133 },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const checkHttp = async (service: HttpService): Promise<void> => {
  const response = await fetch(service.url);
  if (response.status >= 400) {
    throw new Error(`${service.name} returned status ${response.status} (${service.url})`);
  }
};

const checkTcp = async (service: TcpService): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(2000);

    socket.once('connect', () => {
      socket.destroy();
      resolve();
    });

    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`${service.name} timed out (${service.host}:${service.port})`));
    });

    socket.once('error', (error) => {
      socket.destroy();
      reject(new Error(`${service.name} not reachable (${service.host}:${service.port}): ${error.message}`));
    });

    socket.connect(service.port, service.host);
  });
};

const waitFor = async (name: string, check: () => Promise<void>, attempts = 30): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[service-readiness] ${name} failed readiness check: ${message}`);
};

export const assertRequiredServicesReady = async (): Promise<void> => {
  for (const service of httpServices) {
    await waitFor(service.name, () => checkHttp(service));
  }

  for (const service of tcpServices) {
    await waitFor(service.name, () => checkTcp(service));
  }
};
