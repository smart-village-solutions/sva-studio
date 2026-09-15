## Context

Issue #1201 erweitert die vorhandene Tourenliste um seitengrenzenübergreifende Mehrfachauswahl
und eine atomare Statusänderung. Die bereits vorbereitete Implementierung verwendet dafür noch
den bisherigen Boolean `active`. Die Kundenanforderung ersetzt dieses Modell durch die drei
fachlichen Zustände `Entwurf`, `Veröffentlicht` und `Archiviert`.

`active` wird heute nicht nur in der Studio-Oberfläche verwendet. Es steuert außerdem
Mainserver-Materialisierung, Public-Waste-Abfragen, Abdeckungsprüfungen, Folgejahrübernahme und
Datenaustausch. Studio und Public-Waste-App besitzen getrennte Releasepfade, greifen aber auf
dasselbe tenantbezogene Waste-Schema zu. Der Wechsel benötigt deshalb einen kontrollierten
Migrationsvertrag statt eines rein visuellen UI-Updates.

## Goals / Non-Goals

### Goals

- Ein einziger fachlicher Tourstatus mit den Werten `draft`, `published` und `archived`.
- `draft` als sicherer Default aller regulären Erstellungswege.
- Ausschließlich `published` darf öffentliche oder operative Daten erzeugen.
- Einzel- und Sammeländerungen verwenden denselben validierten Zielstatus.
- Bestehende Daten und Legacy-Importe werden deterministisch und verlustfrei abgebildet.
- Der getrennte Rollout von Studio und Public-Waste bleibt während der Migration funktionsfähig.

### Non-Goals

- Kein Freigabeprozess mit Rollen, Genehmigungen oder Vier-Augen-Prinzip.
- Keine Statushistorie, automatische Archivierung oder schreibgeschützte Archive.
- Keine neue generische Bulk-Infrastruktur.
- Keine Änderung des Mainserver-Zielschemas oder der mobilen App.

## Decisions

### 1. Ein Status ist die einzige dauerhafte Source of Truth

Der geteilte Vertrag verwendet `WasteTourStatus = 'draft' | 'published' | 'archived'`. Das
tenantbezogene PostgreSQL-Schema persistiert `status TEXT NOT NULL DEFAULT 'draft'` mit einem
Check-Constraint und einem Statusindex. Nach Abschluss der Migration existiert weder im
produktiven Vertrag noch im Schema ein paralleles `active` für Touren.

Bestehende Werte werden einmalig abgebildet:

- `active = true` → `published`
- `active = false` → `draft`

`archived` wird nie geraten, weil der bisherige Boolean diesen fachlichen Unterschied nicht
enthält.

### 2. Die Migrationskompatibilität ist befristet und hat eine Endbedingung

Weil Studio und Public-Waste-App getrennt veröffentlicht werden, erfolgt die Migration in einer
Expand-/Migrate-/Contract-Sequenz:

1. Das Schema erhält `status`, Backfill und eine befristete Datenbank-Synchronisierung zwischen
   `status` und dem alten `active`. Ändert nur ein alter Verbraucher `active`, wird `status`
   deterministisch zu `published` oder `draft`; ändert ein neuer Verbraucher `status`, wird
   `active` auf `status = 'published'` projiziert. Ein Request mit widersprüchlichen gleichzeitigen
   Werten wird abgelehnt.
2. Studio und Public-Waste werden auf den neuen Statusvertrag umgestellt und jeweils mit
   `draft`, `published` und `archived` verifiziert.
3. Erst nach diesem Nachweis werden Synchronisierung, `active`-Spalte und alter Index entfernt.

Die Kompatibilität ist keine zweite Fachquelle und darf den Change nicht als Dauerzustand
verlassen.

### 3. Veröffentlichungsstatus ist eine gemeinsame Verbraucher-Invariante

Nur `published` darf in einen öffentlichen oder operativen Pfad gelangen. Das gilt mindestens für:

- Public-Waste-Webansicht, Standortauflösung, PDF und iCal,
- Reminder- und sonstige öffentliche Terminprojektionen,
- Mainserver-Materialisierung und deren Reconciliation,
- Abdeckungsprüfung,
- Auswahl des Quellbestands für die Folgejahrübernahme.

Ein Wechsel von `published` nach `draft` oder `archived` entfernt die Tour unmittelbar aus direkt
lesenden Public-Waste-Abfragen. Die bestehende Mainserver-Reconciliation entfernt ihre zuvor
materialisierten Termine beim nächsten erfolgreichen Sync. Fehler dürfen keinen fälschlich
erfolgreichen Veröffentlichungszustand melden.

### 4. Erstellen und Datenaustausch bleiben unterscheidbar

Manuelles Anlegen, Duplizieren und Folgejahrübernahme erzeugen immer `draft`. Ein regulärer Import
ohne Status erzeugt ebenfalls `draft`. Ein expliziter Status in einem aktuellen Austauschprofil
wird als übertragener Fachdatenwert erhalten; ein Legacy-`active` aus Tourprofilversion `1.0.0`
wird wie bei der Datenmigration abgebildet. Neue Tour-Exporte verwenden wegen des brechenden
Feldwechsels die Profilversion `2.0.0` und enthalten nur `status`.

### 5. Einzel- und Bulk-Aktion teilen denselben Zielstatusvertrag

Einzeländerung und Bulk-Endpoint akzeptieren einen expliziten Zielstatus. Der Bulk-Request ist auf
1.000 eindeutige Tour-IDs begrenzt, prüft Instanzkontext, Berechtigung und CSRF vor der Mutation,
sperrt und validiert alle angeforderten Touren und aktualisiert sie atomar. Bereits im Zielstatus
befindliche Touren sind ein idempotenter Erfolg. Auditdaten enthalten Zielstatus, Anzahl, Akteur
und Instanz, aber keine vollständigen Tourdaten.

### 6. Archiviert bleibt ein editierbarer Redaktionszustand

`archived` bedeutet ausschließlich „nicht öffentlich und nicht operativ“. Archivierte Touren
bleiben filterbar, bearbeitbar und können direkt auf `draft` oder `published` gesetzt werden. Es
entsteht kein zusätzlicher Restore- oder Unlock-Ablauf.

## Failure Modes and Evidence

| Invariante                         | Verletzungsszenario                                                       | Prävention                                                          | Geplanter Nachweis                                                |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Nur `published` ist öffentlich     | Entwurf oder Archiv erscheint in Web, PDF, iCal, Reminder oder Mainserver | Gemeinsamer Statusvertrag und explizite Filter an jedem Verbraucher | Negativtests je Verbraucher sowie Studio-/Public-Waste-Smoke-Test |
| Bulk bleibt atomar                 | Eine fehlende ID oder ein DB-Fehler ändert nur einen Teil                 | Transaktion, Sperre, Existenz- und Anzahlprüfung                    | Repository- und Handler-Rollbacktests                             |
| Migration verliert keinen Zustand  | Boolean-Bestandsdaten werden falsch zugeordnet                            | Deterministischer Backfill ohne Archive-Heuristik                   | Migrationstest mit beiden Altwerten und ungültigen Statuswerten   |
| Getrennte Releases driften nicht   | Alter und neuer Verbraucher schreiben verschiedene Felder                 | Befristete DB-Synchronisierung mit Konfliktablehnung                | Integrationstest beider Schreibrichtungen und Rollout-Readback    |
| Kein Shadow-Modell bleibt bestehen | `active` wird nach dem Rollout weiter produktiv genutzt                   | Explizite Contract-Phase und repositoryweiter Restmengentest        | `rg`-basierter Scope-Check plus Schema- und Runtime-Readback      |

## Documentation Impact

- `docs/reference/waste-management-tour-gueltigkeit.md`: Bedienung und fachliche Statussemantik
- `docs/architecture/05-building-block-view.md`: Verbraucher des Tourstatus
- `docs/architecture/06-runtime-view.md`: Statusänderung, Veröffentlichung und Migration
- `docs/architecture/08-cross-cutting-concepts.md`: Datenintegrität und fail-closed Veröffentlichung
- `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` werden
  geprüft; die Tourtabellen liegen im externen tenantbezogenen Waste-Schema und werden dort als
  Laufzeitvertrag dokumentiert, ohne sie fälschlich in den zentralen Studio-Snapshot aufzunehmen.
