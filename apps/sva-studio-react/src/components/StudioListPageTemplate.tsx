import * as React from 'react';

import { Button, type ButtonProps } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export type PageAction = Readonly<{
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  render?: React.ReactNode;
  variant?: ButtonProps['variant'];
}>;

export type StudioTableTab = Readonly<{
  id: string;
  label: string;
  description?: string;
  content: React.ReactNode;
}>;

export type StudioListPageTemplateProps = Readonly<{
  title: string;
  description?: string;
  primaryAction?: PageAction;
  tabs?: readonly StudioTableTab[];
  children?: React.ReactNode;
}>;

const renderPageAction = (action: PageAction) => {
  if (action.render) {
    return action.render;
  }

  return (
    <Button type="button" onClick={action.onClick} disabled={action.disabled} variant={action.variant ?? 'default'}>
      {action.icon}
      {action.label}
    </Button>
  );
};

export function StudioListPageTemplate({
  title,
  description,
  primaryAction,
  tabs,
  children,
}: StudioListPageTemplateProps) {
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const defaultTab = tabs?.[0]?.id;

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {primaryAction ? <div className="flex shrink-0 items-start">{renderPageAction(primaryAction)}</div> : null}
      </header>

      {hasTabs && tabs ? (
        <Tabs defaultValue={defaultTab} className="space-y-0">
          <TabsList aria-label={title}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-3">
              {tab.description ? <p className="text-sm text-muted-foreground">{tab.description}</p> : null}
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        children
      )}
    </section>
  );
}
