# Change: Studio-Tabelleninteraktionen vereinheitlichen

## Why

Tabellen im Studio verwenden für anklickbare Informationen, Statusänderungen und Zeilenaktionen derzeit unterschiedliche visuelle und semantische Muster. Besonders in der Waste-Tourenliste mischen sich klickbare Badges, dauerhaft unterstrichene Texte, Tertiary-Buttons mit Flächen-Hover, Mini-Switches und lokal duplizierte Icon-Aktionen. Auch die vertikale Ausrichtung wechselt ohne fachlichen Grund zwischen oberer und mittiger Ausrichtung.

## What Changes

- Das gemeinsame Studio-UI-Package stellt wiederverwendbare Muster für Icon-Aktionen, anklickbare Tabelleninformationen und Status-Badges bereit.
- Icon-Aktionen verwenden ein Icon mit zugänglichem Namen, Tooltip bei Hover und Tastaturfokus sowie einen semantischen Hover-Hintergrund.
- Anklickbare Informationen unterscheiden sich bereits im Ruhezustand von reinem Text und verwenden keinen Hintergrundwechsel. Unterstreichung erscheint bei Hover und Tastaturfokus.
- Navigationsziele bleiben echte Links; Dialog- und lokale Aktionen bleiben echte Buttons.
- Status wird als beschriftetes semantisches Badge dargestellt. Änderbare Status-Badges öffnen ein kompaktes, vorhandenes Dialogmuster für Auswahl oder Bestätigung.
- Alle Tabellen-Body-Zellen werden bei einheitlichem vertikalem Padding oben ausgerichtet. Buttons, Badges und andere Controls bleiben innerhalb ihrer eigenen Trefferfläche zentriert.
- Tooltips für Tabellenaktionen werden so gerendert, dass sie nicht von scrollenden oder abgeschnittenen Tabellencontainern verdeckt werden.
- Nicht selbsterklärende Icon-Aktionen erhalten in mobilen Kartenansichten eine sichtbare Beschriftung; fachlich komplexe Zeilenaktionen bleiben beschriftete Buttons.
- Die Waste-Tourenliste und die zentrale Inhaltstabelle werden als erste vollständige Verbraucher auf die gemeinsamen Muster migriert, ohne ihre Fachlogik, Berechtigungen oder Navigationsziele zu verändern.
- Doppelte Ziele innerhalb derselben Zeile entfallen: Wenn die primäre Zeilenidentität bereits das vorhandene Öffnen-/Bearbeitungsziel anbietet, wird dafür kein zusätzliches Icon gerendert.

## Impact

- Affected specs: `ui-layout-shell`, `waste-management`, `content-management`
- Affected code:
  - `packages/studio-ui-react/src/`
  - `packages/plugin-waste-management/src/waste-management.tours.table*.tsx`
  - `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
  - `apps/sva-studio-react/src/routes/content/-content-status-dialog.tsx`
  - zugehörige Studio-UI- und Waste-Tests
- Affected documentation:
  - `docs/development/studio-uebersichts-und-detailseiten-standard.md`
- Affected arc42 sections: keine; die bestehende Ownership von `@sva/studio-ui-react` und die vorhandenen Plugin-Grenzen bleiben unverändert
- Breaking impact: keiner für externe Verträge; interne lokale Tabellenstile werden durch gemeinsame Primitives ersetzt

## Out of Scope

- Vollständige Migration aller Studio- und Plugin-Tabellen außerhalb von Waste-Tourenliste und zentraler Inhaltstabelle in derselben Änderung
- Vollständige Migration der Waste-Tourenliste auf `StudioDataTable`
- Änderung von Fachlogik, Berechtigungen, Mutation, Routing oder Bestätigungsanforderungen
- Einführung einer zweiten Komponentenbibliothek oder eines neuen Popover-Pakets
- Globale Neugestaltung nicht interaktiver Badges außerhalb von Tabellen
