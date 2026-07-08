## 1. Scope- und Snapshot-Isolation
- [x] 1.1 Bestehende Projektions-, Sync-State- und Deduplizierungs-Schluessel auf account- und scope-isoliertes Modell umstellen
- [x] 1.2 Datenbankschema fuer `iam.content_list_projection` und `iam.content_list_projection_sync_state` auf den neuen Scope erweitern, inklusive Migration und Schema-Snapshot
- [x] 1.3 Lese-, Upsert- und Delete-Pfade gegen den neuen Scope absichern
- [x] 1.4 Shift-left nach diesem Block: relevanten Type-/Unit-Gate fuer Projektion und DB-nahe Logik ausfuehren

## 2. Progressiver Hintergrund-Refresh
- [x] 2.1 Login-/Session-nahen Trigger fuer Mainserver-Projektionsrefresh identifizieren und anbinden
- [x] 2.2 Fuer alle sichtbaren Mainserver-Typen zuerst `pageSize = 25` mit `updatedAt DESC` laden und sofort persistieren
- [x] 2.3 Aeltere Seiten erst nach Abschluss des ersten Seitenblocks aller sichtbaren Typen progressiv weiterladen
- [x] 2.4 Reconciliation-/Poll-Logik so anpassen, dass sie nicht mehr der primaere Listenfrische-Pfad ist
- [x] 2.5 Shift-left nach diesem Block: relevante Unit-Tests fuer Refresh-Orchestrierung und Pagination ausfuehren

## 3. Mainserver-Integration und Mutations-Nachsynchronisation
- [x] 3.1 Mutationspfade fuer News, Events und POI nach erfolgreicher Mutation an den gezielten Projektionspfad anbinden
- [x] 3.2 Detail-Read-Nachladen fuer Create- und Update-Pfade auf bestehende typed Mainserver-Adapter stuetzen
- [x] 3.3 Delete-Pfade auf identitaetsbasiertes Entfernen der Projektionszeile im neuen Scope umstellen
- [x] 3.4 Shift-left nach diesem Block: relevante `sva-mainserver`- und App-Unit-Tests fuer Mutation-Refresh ausfuehren

## 4. Fehler- und Fallback-Semantik
- [x] 4.1 Deterministische Fehlerklassifikation fuer fehlgeschlagenes gezieltes Nachladen und fehlgeschlagene Hintergrundseiten definieren
- [x] 4.2 Sicherstellen, dass stale Projektionen weiter auslieferbar bleiben, waehrend Hintergrund-Refresh oder Reconciliation fehlschlagen
- [x] 4.3 Monitoring/Logging so erweitern, dass Scope, Seitentiefe, Mutations-Nachsynchronisation und Reconciliation unterscheidbar bleiben

## 5. Tests
- [x] 5.1 Unit-Tests fuer account-isolierte Scope-Aufloesung, Deduplizierung und Sync-State ergaenzen
- [x] 5.2 Unit-Tests fuer progressive Pagination und Reihenfolge der ersten Seiten aller sichtbaren Typen ergaenzen
- [x] 5.3 Unit-Tests fuer gezieltes Projektions-Upsert und -Delete ergaenzen
- [x] 5.4 Regressionstests fuer News-, Event- und POI-Mutationen ergaenzen: Create, Update, Delete
- [x] 5.5 Fehlerfall testen: Mutation erfolgreich, gezielter Detail-Refresh fehlschlaegt, stale Snapshot bleibt sichtbar, spaetere Reconciliation bleibt zustaendig

## 6. Doku und Validierung
- [x] 6.1 OpenSpec-Change mit `openspec validate refactor-mainserver-projection-mutation-refresh --strict` validieren
- [x] 6.2 Relevante Architekturstellen in `docs/architecture/` fuer account-isolierte Projektionen, Login-Refresh und Mutations-Nachsynchronisation aktualisieren
