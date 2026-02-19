import { authServerRouteFactories } from '@sva/routing/server';
import type { RootRoute } from '@tanstack/react-router';

import { coreRouteFactoriesBase } from './-core-routes';

// Use pre-built server route factories from @sva/routing
export const coreRouteFactories = [...coreRouteFactoriesBase, ...authServerRouteFactories];
