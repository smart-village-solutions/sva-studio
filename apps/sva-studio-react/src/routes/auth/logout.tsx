import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logoutHandler } = await import('@sva/auth/server');
        return logoutHandler(request);
      },
    },
  },
  component: () => null,
});
