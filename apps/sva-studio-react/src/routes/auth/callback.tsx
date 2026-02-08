import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { callbackHandler } = await import('@sva/auth/server');
        return callbackHandler(request);
      },
    },
  },
  component: () => null,
});
