import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { meHandler } = await import('@sva/auth/server');
        return meHandler(request);
      },
    },
  },
  component: () => null,
});
