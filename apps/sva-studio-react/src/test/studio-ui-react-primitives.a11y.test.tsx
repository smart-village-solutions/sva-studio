import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Input,
  Radio,
  Select,
  StudioSwitch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sva/studio-ui-react';

import { expectNoA11yViolations } from './a11y';

// Die Primitive gehören @sva/studio-ui-react; der Axe-Helper und das A11y-Target liegen im Host.
// Behavior- und Tastaturverträge werden direkt neben den Komponenten im Paket getestet.

afterEach(() => {
  cleanup();
});

const noop = () => undefined;

type AxeCase = Readonly<{
  name: string;
  ui: ReactElement;
  act?: () => void;
  /** Prüfziel, falls die relevante Ausgabe außerhalb des Render-Containers portalt wird. */
  target?: () => HTMLElement;
}>;

const cases: readonly AxeCase[] = [
  {
    name: 'Button with an open tooltip and a disabled asChild link',
    ui: (
      <>
        <Button type="button" size="icon" aria-label="Suche">
          <span aria-hidden="true">S</span>
        </Button>
        <Button asChild disabled>
          <a href="/geschuetzt">Geschützte Aktion</a>
        </Button>
      </>
    ),
    act: () => fireEvent.focus(screen.getByRole('button', { name: 'Suche' })),
    // Der Tooltip portalt in den Body; aria-describedby muss dort auflösbar sein.
    target: () => document.body,
  },
  {
    name: 'Tabs with a disabled trigger and the active panel',
    ui: (
      <Tabs defaultValue="fractions">
        <TabsList aria-label="Bereiche">
          <TabsTrigger value="fractions">Abfallarten</TabsTrigger>
          <TabsTrigger value="tours" disabled>
            Touren
          </TabsTrigger>
        </TabsList>
        <TabsContent value="fractions">Abfallarten verwalten</TabsContent>
        <TabsContent value="tours">Touren verwalten</TabsContent>
      </Tabs>
    ),
  },
  {
    name: 'Checkbox in checked and indeterminate state',
    ui: (
      <>
        <label>
          <Checkbox defaultChecked />
          Aktiv
        </label>
        <label>
          <Checkbox indeterminate />
          Alle Zeilen auswählen
        </label>
      </>
    ),
  },
  {
    name: 'StudioSwitch in checked and disabled state',
    ui: (
      <>
        <StudioSwitch aria-label="Veröffentlicht" checked onCheckedChange={noop} />
        <StudioSwitch aria-label="Archiviert" checked={false} onCheckedChange={noop} disabled />
      </>
    ),
  },
  {
    name: 'native form wrappers with labels, descriptions, invalid and disabled state',
    ui: (
      <form aria-label="Eintrag">
        <label htmlFor="title">Titel</label>
        <Input id="title" aria-describedby="title-error" aria-invalid="true" required />
        <p id="title-error">Titel ist erforderlich.</p>
        <label htmlFor="teaser">Teaser</label>
        <Textarea id="teaser" disabled />
        <label htmlFor="status">Status</label>
        <Select id="status" defaultValue="draft">
          <option value="draft">Entwurf</option>
          <option value="published">Veröffentlicht</option>
        </Select>
        <fieldset>
          <legend>Veröffentlichung</legend>
          <label>
            <Radio name="mode" value="draft" defaultChecked />
            Entwurf
          </label>
          <label>
            <Radio name="mode" value="scheduled" disabled />
            Planen
          </label>
        </fieldset>
      </form>
    ),
  },
  {
    name: 'AlertDialog with title, description and actions',
    ui: (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>Der Eintrag wird endgültig entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
    // Wie in dialog.a11y.test.tsx: Radix-Fokus-Guards außerhalb des modalen Dialogs sind nicht Prüfgegenstand.
    target: () => screen.getByRole('alertdialog'),
  },
];

describe('@sva/studio-ui-react primitives accessibility', () => {
  it.each(cases)('has no axe violations: $name', async ({ ui, act, target }) => {
    const { container } = render(ui);
    act?.();

    await expect(expectNoA11yViolations(target?.() ?? container)).resolves.toBeUndefined();
  });
});
