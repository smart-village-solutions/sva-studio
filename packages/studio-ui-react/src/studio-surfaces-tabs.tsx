import * as React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';
import { cn } from './utils.js';

export type StudioDetailTab = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  content: React.ReactNode;
}>;

export type StudioDetailTabsProps = Readonly<{
  ariaLabel: string;
  tabs: readonly StudioDetailTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}>;

export function StudioDetailTabs({
  ariaLabel,
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: StudioDetailTabsProps) {
  const firstTab = tabs[0]?.id;

  return (
    <Tabs
      defaultValue={defaultValue ?? firstTab}
      value={value}
      onValueChange={onValueChange}
      className={cn('space-y-4', className)}
    >
      <TabsList aria-label={ariaLabel}>
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
  );
}
