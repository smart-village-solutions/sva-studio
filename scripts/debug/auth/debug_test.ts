import { chromium, type ConsoleMessage, type Response } from 'playwright';

interface CapturedConsoleMessage {
  type: string;
  text: string;
}

interface NetworkError {
  url: string;
  status: number;
  body: string;
}

const responseHasFailureStatus = (response: Response): boolean => response.status() >= 400;

const toConsoleMessage = (message: ConsoleMessage): CapturedConsoleMessage => ({
  type: message.type(),
  text: message.text(),
});

const run = async (): Promise<void> => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleMessages: CapturedConsoleMessage[] = [];
  const networkErrors: NetworkError[] = [];

  page.on('console', (message) => {
    consoleMessages.push(toConsoleMessage(message));
  });

  page.on('response', async (response) => {
    if (!responseHasFailureStatus(response)) {
      return;
    }

    try {
      const body = await response.text();
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        body: body.slice(0, 500),
      });
    } catch {
      // Ignore unreadable response bodies in this debug script.
    }
  });

  console.log('Loading http://localhost:3000/...');

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    console.log('Page loaded successfully');
  } catch (error: unknown) {
    console.error(`Navigation failed: ${error instanceof Error ? error.message : String(error)}`);
    await browser.close();
    return;
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot.png' });
  console.log('Screenshot saved: screenshot.png');

  const content = await page.content();
  const errorIndicators = ['HTTPError', '500', 'error', 'Internal Server Error', 'RunnerError'];
  const hasErrors = errorIndicators.some((indicator) => content.includes(indicator));

  console.log('\nDebug Info:');
  console.log(`  Page title: ${await page.title()}`);
  console.log(`  URL: ${page.url()}`);

  if (consoleMessages.length > 0) {
    console.log(`\nConsole Messages (${consoleMessages.length}):`);
    for (const message of consoleMessages.slice(-10)) {
      console.log(`  [${message.type}] ${message.text.slice(0, 100)}`);
    }
  }

  if (networkErrors.length > 0) {
    console.log(`\nNetwork Errors (${networkErrors.length}):`);
    for (const error of networkErrors) {
      console.log(`  ${error.status} ${error.url}`);
      console.log(`  Body: ${error.body}\n`);
    }
  }

  if (hasErrors) {
    console.log('\nError indicators found in HTML');
    const index = content.indexOf('HTTPError');
    if (index >= 0) {
      console.log(`  Context: ...${content.slice(Math.max(0, index - 100), index + 200)}...`);
    }
  } else {
    console.log('\nNo obvious error indicators found');
  }

  await browser.close();
};

void run();
