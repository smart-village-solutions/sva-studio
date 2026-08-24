## Context

Die Waste-Runtimes greifen bereits über den PostgreSQL-Treiber `pg` und eine serverseitige `databaseUrl` auf die Fachdaten zu. Supabase-spezifisch sind vor allem der Registry-Typ, Pflichtfelder wie `projectUrl` und `serviceRoleKey` sowie ein Supabase-Storage-Healthcheck. Browser und Plugin besitzen keinen direkten Supabase-Zugriff.

Das Ziel ist kein dauerhafter Dualbetrieb. Die vorhandene Supabase-Datenbank wird in einem geplanten Offline-Fenster einmalig in eine separate Datenbank derselben lokal betriebenen PostgreSQL-Instanz wie das Studio migriert. Studio-Governance und Waste-Fachdaten bleiben in getrennten Datenbanken und unter getrennten Datenbankrollen.

## Goals / Non-Goals

### Goals

- Supabase als Laufzeitabhängigkeit des Waste-Managements und der Public-Waste-App entfernen.
- Einen wiederverwendbaren, hostgeführten Schnittstellentyp `postgresql` bereitstellen.
- Die bestehende Waste-Datenbank vollständig, überprüfbar und rückfallfähig übernehmen.
- Pro Studio-Instanz weiterhin genau eine isolierte Waste-Fachdatenbank verwenden.
- Migrationen, Backups, Restore und Betriebsdiagnose für die neue Datenbank absichern.

### Non-Goals

- Den allgemeinen Schnittstellentyp `supabase` entfernen.
- Supabase und PostgreSQL dauerhaft synchronisieren oder parallel beschreibbar betreiben.
- Waste-Fachdaten in die zentrale Studio-Governance-Datenbank verschieben.
- Im Rahmen des Providerwechsels das fachliche `waste_*`-Schema neu entwerfen.
- Mehrere bestehende Supabase-Tenants automatisch in einem Sammellauf migrieren.

## Decisions

### Generischer PostgreSQL-Schnittstellentyp

Die Registry erhält `postgresql` mit einer verschlüsselt gespeicherten `databaseUrl` und einem optionalen `schemaName`. Connection-Checks verwenden eine minimale PostgreSQL-Abfrage und keine providerfremde HTTP- oder Storage-API. Der bestehende `supabase`-Typ bleibt unabhängig davon verfügbar.

Alternativen:

- Ein spezieller Typ `waste_postgresql` würde Registry- und UI-Logik unnötig an ein Fachmodul koppeln.
- Die lokale Datenbank weiterhin als `supabase` zu deklarieren würde Fake-Werte und irreführende Healthchecks beibehalten.

### Getrennte Datenbank und Rollen

Die Zielinstanz erhält in allen Umgebungen die Datenbank `sva_waste`. Passwörter und Hosts unterscheiden sich je Umgebung, die Bezeichner bleiben stabil:

- `sva_waste_owner` besitzt als `NOLOGIN`-Rolle Schema und Objekte.
- `sva_waste_migrator` darf ausschließlich im expliziten Migrationspfad auf `sva_waste_owner` wechseln.
- `sva_waste_app` ist die Runtime-Rolle der administrativen Studio-Waste-Fassade und erhält fachliche CRUD-, aber keine Owner- oder Rollenverwaltungsrechte.
- `sva_waste_public_app` ist die getrennte Runtime-Rolle der öffentlichen App und erhält Leserechte sowie ausschließlich die erforderlichen Schreibrechte für Reminder-, Double-Opt-In-, Abmelde- und Outbox-Pfade.

Studio-IAM, Audit und Registry verbleiben in der separaten Studio-Datenbank. Keine Waste-Runtime-Rolle erhält regulären Zugriff auf die Studio-Governance-Datenbank.

### Vollständiger Betriebsstopp statt Anwendungs-Wartungsmodus

Der Cutover erfolgt in einem angekündigten Sonntagsfenster. Studio-App, Public-Waste-App und Waste-Worker werden vor dem finalen Dump kontrolliert gestoppt. Nach dem Stop wird geprüft, dass keine Waste-Jobs und keine schreibenden Datenbanksitzungen mehr aktiv sind. Ein dauerhafter Wartungsmodus oder neuer Anwendungsschalter wird nicht eingeführt.

Nach der Offline-Grenze werden mit einem zur PostgreSQL-17-Quelle passenden Client zwei getrennte Artefakte erstellt. Ein vollständiges PostgreSQL-Custom-Archiv aller `public.waste_*`-Tabellen bleibt als unverändertes Quellbackup erhalten. Für die eigentliche Übertragung nach PostgreSQL 16 wird zusätzlich ein datenorientiertes Artefakt mit expliziten Tabellen und Spalten erzeugt. Das Zielschema entsteht vor dem Import ausschließlich durch die versionierten Waste-Migrationen. Erst danach werden die Daten importiert und vor der Umschaltung verifiziert.

Ein vollständiger Schema-Restore von PostgreSQL 17 nach PostgreSQL 16 ist kein unterstützter Downgrade-Pfad und wird deshalb nicht als Cutover-Verfahren verwendet. Die PostgreSQL-16-Instanz im Swarm bleibt unverändert; ein kurzlebiger PostgreSQL-17-Clientcontainer dient nur zum Lesen und Sichern der Supabase-Quelle.

### Verifikation vor Freigabe

Die Verifikation umfasst mindestens:

- erfolgreichen Dump und Restore ohne ignorierte Fehler,
- erwartete Schemas, Tabellen, Sequenzen, Constraints, Indizes und Funktionen,
- Zeilenzahlen aller fachlichen `waste_*`-Tabellen sowie kontrollierte Ausnahmen für technische Tabellen,
- aktuellen Waste-Migrationsstand,
- Lese-Smoke-Tests für Stammdaten, Standortauflösung und Kalender,
- einen kontrollierten Schreib-/Rollback-Smoke-Test über die Studio-Fassade,
- Reminder-, Outbox- und Public-Waste-Read-Pfade, soweit in der Quellinstanz aktiviert.

### Rollback-Gate und Aufbewahrungsfrist

Ein verlustfreier Konfigurations-Rollback auf Supabase ist nur möglich, solange nach dem finalen Dump keine neuen Waste-Schreibzugriffe freigegeben wurden. Deshalb bleiben alle Waste-Runtimes bis zum Abschluss sämtlicher Pflicht- und Smoke-Tests gestoppt. Schlägt eine Prüfung fehl, wird noch innerhalb dieser Offline-Grenze auf die unveränderte Supabase-Konfiguration zurückgeschaltet.

Nach Freigabe der neuen PostgreSQL-Datenbank bleibt die Supabase-Quelle 14 Tage unverändert und schreibgeschützt als Vergleichs- und Notfallquelle erhalten. Ein späterer Rückwechsel wäre wegen neuer Daten in `sva_waste` eine erneute kontrollierte Datenmigration und kein einfacher Konfigurations-Rollback. Nach 14 fehlerfreien Tagen kann Supabase separat außer Betrieb genommen werden; die Stilllegung ist nicht Teil des atomaren Cutovers.

## Migration Plan

1. Datenbank `sva_waste`, die vier festgelegten Rollen, Netzwerkzugriff und Backup-Aufnahme vorbereiten.
2. PostgreSQL-Schnittstelle anlegen, aber noch nicht als aktive Waste-Quelle auswählen.
3. Im angekündigten Sonntagsfenster Studio-App, Public-Waste-App und Waste-Worker stoppen; anschließend Job- und Session-Drain nachweisen.
4. Vollständiges Custom-Sicherungsarchiv der `public.waste_*`-Tabellen sowie ein getrenntes, PostgreSQL-16-kompatibles Datenartefakt erstellen und beide auf Integrität prüfen.
5. Das leere Zielschema durch die versionierten Waste-Migrationen erzeugen und das Datenartefakt innerhalb einer Transaktion importieren; Eigentümer und Grants kontrolliert auf Zielrollen abbilden.
6. Schema- und Datenvergleich ausführen und den aktuellen Waste-Migrationsstand nachweisen.
7. Studio-Registry und Public-Waste-Konfiguration auf dieselbe Ziel-Datenbank umstellen.
8. Runtimes kontrolliert mit der neuen Konfiguration starten und Connection-, Read-, Write-, Kalender- und Reminder-Smoke-Tests ausführen, ohne den öffentlichen Zugriff freizugeben.
9. Bei Erfolg Systeme freigeben; bei Fehlern die Runtimes erneut stoppen und innerhalb des verlustfreien Rollback-Gates auf Supabase zurückschalten.
10. Supabase 14 Tage schreibgeschützt erhalten; anschließend Stilllegung gesondert freigeben.

## Risks / Trade-offs

- Nicht übertragene Supabase-spezifische Objekte → Vorab-Inventar von Extensions, Rollen, RLS, Funktionen und Grants; nur tatsächlich benötigte PostgreSQL-Objekte werden zielgerichtet übernommen.
- Veralteter Dump durch parallele Änderungen → Vollständiger Stopp aller Waste-Runtimes vor dem finalen Dump und nachgewiesener Job- und Session-Drain.
- Unterschiedliche Eigentümer oder Rechte → Restore ohne unkontrollierte Quell-Owner und explizite Ziel-Grants; Laufzeittest mit der echten Runtime-Rolle.
- Unterschiedliche PostgreSQL-Hauptversionen → Quellbackup mit PostgreSQL 17 erstellen, aber keinen Schema-Downgrade durchführen; Zielschema auf PostgreSQL 16 aus versionierten Migrationen aufbauen und ausschließlich explizit inventarisierte Fachdaten übertragen.
- Unvollständige Backup-Abdeckung → Waste-Datenbank vor Freigabe in Backup, Restore-Validierung und Betriebsdokumentation aufnehmen.
- Konfigurationsdrift zwischen Studio und Public-Waste-App → Beide Verbindungen werden im selben Cutover-Schritt aktualisiert und gemeinsam verifiziert.
- Datenverlust bei spätem Rückwechsel → Einfacher Rollback endet mit der ersten freigegebenen Ziel-Schreiboperation; danach ist ausdrücklich eine neue Datenmigration erforderlich.
