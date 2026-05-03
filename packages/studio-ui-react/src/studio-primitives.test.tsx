import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioActionMenu,
  StudioDataTable,
  type StudioDataTableLabels,
  StudioDetailTabs,
  StudioDetailPageTemplate,
  StudioEditSurface,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioFormSummary,
  StudioListPageTemplate,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioResourceHeader,
  StudioSection,
  StudioStateBlock,
  Textarea,
} from './index.js';

const tableLabels: StudioDataTableLabels = {
  selectionColumn: 'Auswahl',
  actionsColumn: 'Aktionen',
  loading: 'Lädt.',
  selectAllRows: (label) => `Alle ${label} auswählen`,
  selectRow: ({ label, rowId }) => `${label} ${rowId} auswählen`,
  selectMobileRow: ({ label, rowId }) => `${label} ${rowId} in Kartenansicht auswählen`,
};

describe('studio-ui-react primitives', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders overview pages with header, action and content regions', () => {
    render(
      <StudioOverviewPageTemplate title="News" description="Verwalten" primaryAction={<button type="button">Anlegen</button>} toolbar={<span>Werkzeuge</span>}>
        <p>Inhalt</p>
      </StudioOverviewPageTemplate>
    );

    expect(screen.getByRole('heading', { name: 'News' })).toBeTruthy();
    expect(screen.getByText('Verwalten')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anlegen' })).toBeTruthy();
    expect(screen.getByText('Werkzeuge')).toBeTruthy();
    expect(screen.getByText('Inhalt')).toBeTruthy();
  });

  it('renders list page templates with a primary action callback', () => {
    const onClick = vi.fn();

    render(
      <StudioListPageTemplate
        title="Abholorte"
        description="Hierarchische Verwaltung der Abholorte."
        primaryAction={{ label: 'Neu erstellen', onClick }}
      >
        <div>Tabelleninhalt</div>
      </StudioListPageTemplate>
    );

    expect(screen.getByRole('heading', { name: 'Abholorte' })).toBeTruthy();
    expect(screen.getByText('Hierarchische Verwaltung der Abholorte.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Neu erstellen' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tabelleninhalt')).toBeTruthy();
  });

  it('renders list page templates with tabbed content', () => {
    render(
      <StudioListPageTemplate
        title="Abfallkalender"
        tabs={[
          { id: 'pickup', label: 'Abholorte', content: <div>Abholorte-Inhalt</div> },
          { id: 'dates', label: 'Ausweichtermine', content: <div>Ausweichtermine-Inhalt</div> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Abholorte' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Abholorte-Inhalt')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ausweichtermine' }).getAttribute('data-state')).toBe('inactive');
  });

  it('renders tab lists with an explicit accessible name when the title is not a plain string', () => {
    render(
      <StudioListPageTemplate
        title={
          <span>
            <strong>Abfall</strong> kalender
          </span>
        }
        tabsAriaLabel="Inhaltsbereiche"
        tabs={[
          { id: 'pickup', label: 'Abholorte', content: <div>Abholorte-Inhalt</div> },
          { id: 'dates', label: 'Ausweichtermine', content: <div>Ausweichtermine-Inhalt</div> },
        ]}
      />
    );

    expect(screen.getByRole('tablist', { name: 'Inhaltsbereiche' })).toBeTruthy();
  });

  it('renders detail pages, grouped fields and form summaries', () => {
    render(
      <StudioDetailPageTemplate title="Detail" description="Beschreibung" actions={<Button>Speichern</Button>}>
        <StudioFieldGroup columns={2}>
          <StudioField id="summary-title" label="Titel">
            <Input id="summary-title" />
          </StudioField>
          <StudioField id="summary-body" label="Text">
            <Textarea id="summary-body" />
          </StudioField>
        </StudioFieldGroup>
        <StudioFormSummary kind="success">Gespeichert</StudioFormSummary>
        <StudioFormSummary kind="error">Fehler</StudioFormSummary>
      </StudioDetailPageTemplate>
    );

    expect(screen.getByRole('heading', { name: 'Detail' })).toBeTruthy();
    expect(screen.getByText('Beschreibung')).toBeTruthy();
    expect(screen.getByLabelText('Titel')).toBeTruthy();
    expect(screen.getByLabelText('Text')).toBeTruthy();
    expect(screen.getByText('Gespeichert')).toBeTruthy();
    expect(screen.getByText('Fehler')).toBeTruthy();
  });

  it('keeps field label, description and error relationships explicit', () => {
    render(
      <StudioField
        id="title"
        label="Titel"
        description="Pflichtfeld"
        descriptionId="title-help"
        error="Titel fehlt"
        errorId="title-error"
        required
      >
        <Input id="title" aria-describedby="title-help title-error" aria-invalid="true" />
      </StudioField>
    );

    const input = screen.getByLabelText('Titel');
    expect(input.getAttribute('aria-describedby')).toBe('title-help title-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Pflichtfeld').id).toBe('title-help');
    expect(screen.getByText('Titel fehlt').id).toBe('title-error');
  });

  it('renders state blocks with polite live status semantics', () => {
    render(
      <>
        <StudioStateBlock title="Keine Daten" description="Es gibt noch keine Einträge.">
          <Button>Neu laden</Button>
        </StudioStateBlock>
        <StudioLoadingState>Lädt</StudioLoadingState>
        <StudioEmptyState>Leer</StudioEmptyState>
        <StudioErrorState>Kaputt</StudioErrorState>
      </>
    );

    const block = screen.getAllByRole('status')[0];
    expect(block.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('heading', { name: 'Keine Daten' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(screen.getByText('Lädt')).toBeTruthy();
    expect(screen.getByText('Leer')).toBeTruthy();
    expect(screen.getByText('Kaputt')).toBeTruthy();
  });

  it('uses assertive live semantics for alert state blocks', () => {
    render(<StudioStateBlock role="alert" title="Fehler" />);

    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
  });

  it('renders resource headers with status, metadata and actions', () => {
    render(
      <StudioResourceHeader
        title="News A"
        description="Beschreibung"
        status={<span>Entwurf</span>}
        metadata={[{ id: 'updated', label: 'Geändert', value: 'Heute' }]}
        actions={<Button>Speichern</Button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'News A' })).toBeTruthy();
    expect(screen.getByText('Entwurf')).toBeTruthy();
    expect(screen.getByText('Geändert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
  });

  it('renders detail tabs with accessible tab labels', () => {
    render(
      <StudioDetailTabs
        ariaLabel="Detailbereiche"
        defaultValue="history"
        tabs={[
          { id: 'base', label: 'Basis', content: <p>Basisdaten</p> },
          { id: 'history', label: 'Historie', description: 'Änderungen', content: <p>Historie</p> },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
    expect(screen.getByText('Änderungen')).toBeTruthy();
    expect(screen.getAllByText('Historie')).toHaveLength(2);
  });

  it('renders surfaces and action menu items with custom renders and disabled actions', () => {
    const onSelect = vi.fn();

    render(
      <StudioSection title="Abschnitt" description="Beschreibung" actions={<Button>Aktion</Button>}>
        <StudioEditSurface footer={<Button>Footer</Button>}>
          <StudioActionMenu
            items={[
              { id: 'save', label: 'Speichern', onSelect },
              { id: 'disabled', label: 'Gesperrt', disabled: true, onSelect },
              { id: 'custom', label: 'Custom', render: <button type="button">Eigene Aktion</button> },
            ]}
          />
        </StudioEditSurface>
      </StudioSection>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gesperrt' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Abschnitt' })).toBeTruthy();
    expect(screen.getByText('Beschreibung')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aktion' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Footer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eigene Aktion' })).toBeTruthy();
  });

  it('renders data table rows and forwards selected rows to bulk actions', () => {
    const onBulk = vi.fn();
    const data = [
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ];

    render(
      <StudioDataTable
        ariaLabel="News"
        labels={tableLabels}
        data={data}
        getRowId={(row) => row.id}
        columns={[{ id: 'title', header: 'Titel', cell: (row) => row.title, sortable: true, sortValue: (row) => row.title }]}
        emptyState={<p>Keine Daten</p>}
        bulkActions={[{ id: 'archive', label: 'Archivieren', onClick: ({ selectedRows }) => onBulk(selectedRows) }]}
      />
    );

    fireEvent.click(screen.getByLabelText('News a auswählen'));
    expect((screen.getByLabelText('Alle News auswählen') as HTMLInputElement).indeterminate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Archivieren' }));

    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(onBulk).toHaveBeenCalledWith([{ id: 'a', title: 'Alpha' }]);
  });

  it('renders table sorting, row actions, toolbar content and clearable bulk actions', () => {
    const onBulk = vi.fn();
    const data = [
      { id: 'a', title: 'Alpha', priority: 2 },
      { id: 'b', title: 'Beta', priority: 1 },
    ];

    render(
      <StudioDataTable
        ariaLabel="News"
        labels={tableLabels}
        caption="News-Tabelle"
        data={data}
        getRowId={(row) => row.id}
        columns={[
          {
            id: 'title',
            header: 'Titel',
            mobileLabel: 'Mobiler Titel',
            mobileClassName: 'mobile-title',
            className: 'title-cell',
            headerClassName: 'title-header',
            cell: (row) => row.title,
            sortable: true,
            sortValue: (row) => row.priority,
          },
          { id: 'priority', header: 'Priorität', cell: (row) => row.priority },
        ]}
        emptyState={<p>Keine Daten</p>}
        toolbarStart={<span>Start</span>}
        toolbarEnd={<span>Ende</span>}
        rowActions={(row) => <Button>Öffnen {row.title}</Button>}
        bulkActions={[
          { id: 'custom', label: 'Custom', render: <button type="button">Sonderaktion</button>, onClick: vi.fn() },
          {
            id: 'archive',
            label: 'Archivieren',
            onClick: ({ selectedRows, clearSelection }) => {
              onBulk(selectedRows);
              clearSelection();
            },
          },
        ]}
      />
    );

    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('Ende')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sonderaktion' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archivieren' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Öffnen Alpha' })).toHaveLength(2);
    expect(screen.getAllByText('Mobiler Titel')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Titel/ }));
    const titleHeader = screen.getByRole('columnheader', { name: /Titel/ });
    expect(titleHeader.getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(screen.getByRole('button', { name: /Titel/ }));
    expect(titleHeader.getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(screen.getByLabelText('Alle News auswählen'));
    fireEvent.click(screen.getByRole('button', { name: 'Archivieren' }));
    expect(onBulk).toHaveBeenCalledWith(data);
    expect(screen.getByRole('button', { name: 'Archivieren' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders table loading, empty and no-selection variants', () => {
    const { rerender } = render(
      <StudioDataTable
        ariaLabel="News"
        labels={tableLabels}
        data={[]}
        getRowId={(row: { id: string }) => row.id}
        columns={[{ id: 'title', header: 'Titel', cell: (row: { id: string }) => row.id }]}
        emptyState={<p>Keine Daten</p>}
        isLoading
      />
    );

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('Lädt.')).toBeTruthy();

    rerender(
      <StudioDataTable
        ariaLabel="News"
        labels={tableLabels}
        data={[]}
        getRowId={(row: { id: string }) => row.id}
        columns={[{ id: 'title', header: 'Titel', cell: (row: { id: string }) => row.id }]}
        emptyState={<p>Keine Daten</p>}
      />
    );

    expect(screen.getByText('Keine Daten')).toBeTruthy();

    rerender(
      <StudioDataTable
        ariaLabel="News"
        labels={tableLabels}
        data={[{ id: 'a' }]}
        getRowId={(row) => row.id}
        columns={[{ id: 'title', header: 'Titel', cell: (row) => row.id }]}
        emptyState={<p>Keine Daten</p>}
        selectionMode="none"
      />
    );

    expect(screen.queryByLabelText('News a auswählen')).toBeNull();
    expect(screen.getAllByText('a')).toHaveLength(2);
  });

  it('renders base controls', () => {
    render(
      <>
        <Alert>
          <AlertDescription>Hinweis</AlertDescription>
        </Alert>
        <Badge>Aktiv</Badge>
        <Select aria-label="Status" defaultValue="draft">
          <option value="draft">Entwurf</option>
        </Select>
      </>
    );

    expect(screen.getByText('Hinweis')).toBeTruthy();
    expect(screen.getByText('Aktiv')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy();
  });

  it('renders dialog wrappers', () => {
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialogtitel</DialogTitle>
              <DialogDescription>Dialogbeschreibung</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Schließen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bestätigen</AlertDialogTitle>
              <AlertDialogDescription>Wirklich ausführen?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );

    expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();
    expect(screen.getByRole('alertdialog', { hidden: true })).toBeTruthy();
    expect(screen.getByText('Dialogtitel')).toBeTruthy();
    expect(screen.getByText('Bestätigen')).toBeTruthy();
  });

  it('renders optional primitive variants without auxiliary content', () => {
    render(
      <>
        <StudioOverviewPageTemplate title="Minimal" primaryAction={<Button asChild><a href="/new">Neu</a></Button>}>
          <p>Minimaler Inhalt</p>
        </StudioOverviewPageTemplate>
        <StudioDetailPageTemplate title="Detail minimal">
          <StudioFieldGroup>
            <StudioField id="plain" label="Plain">
              <Input id="plain" />
            </StudioField>
          </StudioFieldGroup>
        </StudioDetailPageTemplate>
        <StudioResourceHeader title="Ressource" media={<span aria-label="Icon">I</span>} />
        <StudioSection>
          <StudioEditSurface>
            <p>Nur Inhalt</p>
          </StudioEditSurface>
        </StudioSection>
        <StudioStateBlock role="alert" />
        <Alert>
          <AlertTitle>Titel</AlertTitle>
          <AlertDescription>Beschreibung</AlertDescription>
        </Alert>
        <Button variant="destructive" size="sm">Löschen</Button>
      </>
    );

    expect(screen.getByRole('heading', { name: 'Minimal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Neu' })).toBeTruthy();
    expect(screen.getByLabelText('Plain')).toBeTruthy();
    expect(screen.getByLabelText('Icon')).toBeTruthy();
    expect(screen.getByText('Nur Inhalt')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Titel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeTruthy();
  });
});
