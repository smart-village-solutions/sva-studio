import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';

describe('tabs primitives', () => {
  it('renders navigation-style tabs without chip backgrounds and with an active primary underline', () => {
    render(
      <Tabs defaultValue="fractions">
        <TabsList aria-label="Bereiche">
          <TabsTrigger value="fractions">Abfallarten</TabsTrigger>
          <TabsTrigger value="tours">Touren</TabsTrigger>
        </TabsList>
        <TabsContent value="fractions">Fractions</TabsContent>
        <TabsContent value="tours">Tours</TabsContent>
      </Tabs>
    );

    const tabList = screen.getByRole('tablist', { name: 'Bereiche' });
    const activeTab = screen.getByRole('tab', { name: 'Abfallarten' });
    const inactiveTab = screen.getByRole('tab', { name: 'Touren' });

    expect(tabList.className).toContain('bg-transparent');
    expect(tabList.className).toContain('border-0');
    expect(tabList.className).toContain('min-h-9');
    expect(activeTab.className).toContain('border-b-[3px]');
    expect(activeTab.className).toContain('min-h-9');
    expect(activeTab.className).toContain('data-[state=active]:border-primary');
    expect(activeTab.className).toContain('data-[state=active]:text-foreground');
    expect(activeTab.className).not.toContain('data-[state=active]:bg-background');
    expect(inactiveTab.className).toContain('border-transparent');
  });

  it('forces tab triggers to render as buttons even when callers pass a different type', () => {
    render(
      <Tabs defaultValue="fractions">
        <TabsList aria-label="Bereiche">
          <TabsTrigger value="fractions" type="submit">
            Abfallarten
          </TabsTrigger>
        </TabsList>
        <TabsContent value="fractions">Fractions</TabsContent>
      </Tabs>
    );

    const trigger = screen.getAllByRole('tab', { name: 'Abfallarten' }).at(-1);
    expect(trigger?.getAttribute('type')).toBe('button');
  });
});
