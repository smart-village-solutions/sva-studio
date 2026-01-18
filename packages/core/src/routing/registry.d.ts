export type RouteFactory<TRoot, TRoute> = (rootRoute: TRoot) => TRoute;
export declare const mergeRouteFactories: <TRoot, TRoute>(core: RouteFactory<TRoot, TRoute>[], plugins?: RouteFactory<TRoot, TRoute>[]) => RouteFactory<TRoot, TRoute>[];
export declare const buildRouteTree: <TRoot extends {
    addChildren: (routes: TRoute[]) => unknown;
}, TRoute>(rootRoute: TRoot, factories: RouteFactory<TRoot, TRoute>[]) => unknown;
//# sourceMappingURL=registry.d.ts.map