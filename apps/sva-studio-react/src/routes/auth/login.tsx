import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: async () => {
        const { loginHandler } = await import('@sva/auth/server');
        return loginHandler();
      },
    },
  },
  component: () => null,
});
