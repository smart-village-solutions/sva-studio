import { createFileRoute } from '@tanstack/react-router';

import { HomePage } from './-home-page';

export const Route = createFileRoute('/')({
  component: HomePage,
});
