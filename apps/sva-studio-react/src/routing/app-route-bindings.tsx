import { type AppRouteBindings as BaseAppRouteBindings } from '@sva/routing';
import type { PluginDefinition, PluginViewBinding } from '@sva/plugin-sdk';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import React from 'react';
import {
  ContentEditorPage,
  normalizeContentEditorTab,
} from '../routes/content/-content-editor-page';
import { ContentTypePickerPage } from '../routes/content/-content-type-picker-page';
import { studioPlugins } from '../lib/plugins';
import { coreAppRouteBindings } from './app-route-bindings.core';
import { readStringParam } from './mainserver-resource-principal';
import { createHostOwnedPluginView } from './app-plugin-view-adapter';
import { ContentListRoutePage } from './app-route-pages';

export {
  resolveMainserverPrincipalControl,
  type MainserverPrincipalResolution,
} from './mainserver-principal-control';

type StudioAppRouteBindings = BaseAppRouteBindings;

const ContentDetailRoutePage = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <ContentEditorPage
      mode="edit"
      contentId={readStringParam(params.id)}
      activeTab={normalizeContentEditorTab(search.tab)}
      onTabChange={(tab) =>
        void navigate({
          search: { tab } as never,
          replace: true,
        })
      }
    />
  );
};

const hostAppRouteBindings: StudioAppRouteBindings = {
  ...coreAppRouteBindings,
  content: ContentListRoutePage,
  contentCreate: ContentTypePickerPage,
  contentDetail: ContentDetailRoutePage,
};

export const studioRoutePlugins: readonly PluginDefinition[] = studioPlugins.map((plugin) => ({
  ...plugin,
  viewBindings: (() => {
    const contributed = [...(plugin.viewBindings ?? [])];
    for (const resource of plugin.adminResources ?? []) {
      const listBinding = resource.contentUi?.bindings?.list?.bindingKey;
      if (listBinding && !contributed.some((binding) => binding.bindingKey === listBinding)) {
        contributed.push({ bindingKey: listBinding, component: ContentListRoutePage });
      }
    }
    return contributed.map((binding: PluginViewBinding) => ({
      ...binding,
      component: createHostOwnedPluginView(
        plugin.id,
        binding,
        binding.component as React.ComponentType<never>
      ) as unknown as PluginViewBinding['component'],
    }));
  })(),
}));

const contributedRouteComponents = Object.fromEntries(
  studioRoutePlugins.flatMap((plugin) =>
    (plugin.viewBindings ?? []).map(({ bindingKey, component }) => [bindingKey, component])
  )
);

export const appRouteBindings = Object.assign(
  {},
  hostAppRouteBindings,
  contributedRouteComponents
) as StudioAppRouteBindings & Readonly<Record<string, React.ComponentType>>;
