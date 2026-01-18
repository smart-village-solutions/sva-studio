import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { RootLayout } from '../components/RootLayout';
import { ThemeProvider } from '../contexts/ThemeContext';
import '../i18n/config';

import globalsCss from '../globals.css?url';
import appCss from '../styles.css?url';
import designTokensCss from '@sva-studio/ui-contracts/design-tokens.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SVA Studio', // Phase 1: Hardcoded, Phase 1.5: Use t('layout.title') with i18n hook
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: globalsCss,
      },
      {
        rel: 'stylesheet',
        href: designTokensCss,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

export const rootRoute = Route;

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <RootLayout>{children}</RootLayout>
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
