import { chromium, type ConsoleMessage, type Request, type Response } from 'playwright';

interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

interface CapturedResponse {
  url: string;
  status: number;
  statusText: string;
}

const toConsoleLine = (message: ConsoleMessage): string => `[${message.type()}] ${message.text()}`;

const toCapturedRequest = (request: Request): CapturedRequest => ({
  method: request.method(),
  url: request.url(),
  headers: request.headers(),
});

const toCapturedResponse = (response: Response): CapturedResponse => ({
  url: response.url(),
  status: response.status(),
  statusText: response.statusText(),
});

const run = async (): Promise<void> => {
  console.log('Testing session loading with Playwright...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const requests: CapturedRequest[] = [];
  const responses: CapturedResponse[] = [];

  page.on('console', (message) => {
    consoleLogs.push(toConsoleLine(message));
  });

  page.on('request', (request) => {
    requests.push(toCapturedRequest(request));
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      responses.push(toCapturedResponse(response));
    }
  });

  console.log('\nLoading http://localhost:3000/?auth=ok');
  await page.goto('http://localhost:3000/?auth=ok');

  console.log('Waiting for networkidle...');
  await page.waitForLoadState('networkidle', { timeout: 10_000 });

  console.log('Taking screenshot...');
  await page.screenshot({ path: '/tmp/session-loading.png', fullPage: true });
  await page.waitForTimeout(2000);

  console.log('\nChecking page content...');
  const content = await page.content();
  if (content.includes('Lade Session')) {
    console.log("Session still loading (stuck on 'Lade Session ...')");
  } else {
    console.log('Session text changed (may have loaded)');
  }

  console.log(`\nConsole logs (${consoleLogs.length} entries):`);
  for (const log of consoleLogs) {
    console.log(`  ${log}`);
  }

  console.log(`\nNetwork requests (${requests.length} total):`);
  const authRequests = requests.filter((request) => request.url.includes('/auth/me'));
  if (authRequests.length > 0) {
    console.log(`  Found ${authRequests.length} request(s) to /auth/me`);
    for (const request of authRequests) {
      console.log(`    Method: ${request.method}`);
      console.log(`    Cookie: ${request.headers.cookie ?? '(none)'}`);
    }
  } else {
    console.log('  No request to /auth/me found');
  }

  if (responses.length > 0) {
    console.log(`\nFailing responses (${responses.length}):`);
    for (const response of responses) {
      console.log(`  ${response.status} ${response.statusText} ${response.url}`);
    }
  }

  await browser.close();
  console.log('\nTest complete. Screenshot: /tmp/session-loading.png');
};

void run();
