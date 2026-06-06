# Change: Instanz-Lebenszyklus und Doctor-Navigation neu strukturieren

## Why
Die bestehende Instanz-Detailseite mischt einmaliges Setup, laufenden Betrieb,
Diagnose und Stammdatenpflege auf derselben Fläche. Dadurch ist die visuelle
Hierarchie unklar, der Happy Path der Modulverwaltung verliert Fokus und
Bestandsinstanzen fühlen sich zu stark wie fortgesetztes Setup an.

## What Changes
- Fuehre nach der Instanz-Anlage einen separaten einmaligen Flow
  `Setup abschliessen` ein.
- Richte die Bestandsverwaltung fuer fertig eingerichtete Instanzen auf die
  drei dauerhaften Modi `Betrieb`, `Doctor` und `Einstellungen` aus.
- Verankere `Doctor` als dauerhaft sichtbaren Einstieg mit gefuehrtem Ablauf
  aus Ueberblick, empfohlener Massnahme, Reparatur und Validierung.
- Verschiebe die technische Historie aus dem Erstblick in den Doctor-Kontext.

## Impact
- Affected specs:
  - `account-ui`
  - `instance-provisioning`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/instances/*`
  - `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
  - `packages/routing/src/*`
- Affected docs:
  - `docs/superpowers/specs/2026-06-06-instance-lifecycle-and-doctor-navigation-design.md`
  - `docs/guides/instance-lifecycle-navigation.md`
