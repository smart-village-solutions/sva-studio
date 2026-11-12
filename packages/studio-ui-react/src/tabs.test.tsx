import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';

afterEach(cleanup);

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
    expect(tabList.className).toContain('min-h-11');
    expect(activeTab.className).toContain('border-b-[3px]');
    expect(activeTab.className).toContain('min-h-11');
    expect(activeTab.className).toContain('data-[state=active]:border-primary');
    expect(activeTab.className).toContain('data-[state=active]:text-primary');
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

describe('tabs keyboard and state contract', () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue="fractions">
        <TabsList aria-label="Bereiche">
          <TabsTrigger value="fractions">Abfallarten</TabsTrigger>
          <TabsTrigger value="locked" disabled>
            Gesperrt
          </TabsTrigger>
          <TabsTrigger value="tours">Touren</TabsTrigger>
          <TabsTrigger value="calendar">Kalender</TabsTrigger>
        </TabsList>
        <TabsContent value="fractions">Fractions</TabsContent>
        <TabsContent value="locked">Locked</TabsContent>
        <TabsContent value="tours">Tours</TabsContent>
        <TabsContent value="calendar">Calendar</TabsContent>
      </Tabs>
    );

  const tab = (name: string) => screen.getByRole('tab', { name });

  const expectActiveTab = async (name: string) => {
    await waitFor(() => expect(document.activeElement).toBe(tab(name)));
    expect(tab(name).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name }).id).toBe(tab(name).getAttribute('aria-controls'));
  };

  it('links the selected tab to its panel and moves tab-key entry focus to the selected tab', async () => {
    renderTabs();

    expect(tab('Abfallarten').getAttribute('aria-selected')).toBe('true');
    expect(tab('Touren').getAttribute('aria-selected')).toBe('false');
    expect(tab('Gesperrt').hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel', { name: 'Abfallarten' }).id).toBe(
      tab('Abfallarten').getAttribute('aria-controls')
    );

    fireEvent.focus(screen.getByRole('tablist', { name: 'Bereiche' }));
    await expectActiveTab('Abfallarten');
    expect(tab('Abfallarten').tabIndex).toBe(0);
    expect(tab('Touren').tabIndex).toBe(-1);
  });

  it('moves focus and selection with arrow, Home and End keys and skips disabled tabs', async () => {
    renderTabs();
    tab('Abfallarten').focus();

    fireEvent.keyDown(tab('Abfallarten'), { key: 'ArrowRight' });
    await expectActiveTab('Touren');

    fireEvent.keyDown(tab('Touren'), { key: 'End' });
    await expectActiveTab('Kalender');

    fireEvent.keyDown(tab('Kalender'), { key: 'ArrowRight' });
    await expectActiveTab('Abfallarten');

    fireEvent.keyDown(tab('Abfallarten'), { key: 'ArrowLeft' });
    await expectActiveTab('Kalender');

    fireEvent.keyDown(tab('Kalender'), { key: 'Home' });
    await expectActiveTab('Abfallarten');
    expect(tab('Gesperrt').getAttribute('aria-selected')).toBe('false');
  });
});
