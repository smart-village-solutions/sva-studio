## Context

Das Waste-Management besitzt zwei getrennte Persistenzgrenzen:

- Die externe tenantbezogene Waste-PostgreSQL-Datenbank ist die führende Quelle für Touren, Abholorte, Termine und Verschiebungsregeln.
- Die zentrale Studio-Datenbank persistiert in `iam.studio_jobs` und `iam.studio_job_events` den generischen Background-Jobstatus einschließlich `started_at`, `finished_at`, Ergebnis und Fehler.

Der Job `waste-management.sync-mainserver` liest die externe Waste-Datenbank, materialisiert Termine für das aktuelle und folgende Jahr, lädt anschließend einen Snapshot aus dem externen SVA Mainserver und schreibt die ermittelte Create-/Delete-Differenz. Beim Seitenaufruf existiert heute weder ein Quelländerungsmarker noch ein Statusvertrag für einen ausstehenden Abgleich.

Ein bloßer Vergleich vorhandener `updated_at`-Felder mit `iam.studio_jobs.finished_at` wäre nicht ausreichend: Löschungen hinterlassen keinen Datensatz, parallele Transaktionen können einen zeitlichen Vergleich überholen und nicht jede Waste-Änderung beeinflusst die Mainserver-Terminmaterialisierung.

## Goals / Non-Goals

- Goals:
  - ausstehende Mainserver-relevante Quelländerungen ohne Mainserver-Zugriff erkennen;
  - den vorhandenen zentralen Jobstore für letzten Erfolg, aktiven Lauf und Fehler wiederverwenden;
  - Löschungen, Bulk-Operationen, parallele Änderungen und Jahreswechsel korrekt behandeln;
  - die tatsächlich verarbeitete Quellrevision im terminalen Jobergebnis nachweisen;
  - Handlungsbedarf und echten Jobfortschritt zugänglich im Waste-Fachbereich darstellen.
- Non-Goals:
  - kein zweiter allgemeiner Jobstore und kein pluginlokaler Jobstatusautomat;
  - kein Dry-Run, Mainserver-Snapshot oder Diff beim bloßen Seitenaufruf;
  - keine automatische Termin-Synchronisierung nach jeder Mutation oder per Scheduler;
  - keine Garantie, dass der Mainserver außerhalb des Studio-Sync-Pfads unverändert blieb;
  - keine Zusammenführung mit der separaten Abfallarten-Synchronisierung.

## Decisions

### Decision: Jobhistorie und Quelländerungsstand bleiben getrennte Wahrheiten

`iam.studio_jobs` bleibt die führende Wahrheit für Start, Lauf, Abschluss, Fehler und Ergebnis eines Mainserver-Abgleichs. Die externe Waste-Datenbank führt ausschließlich den Änderungsstand ihrer Mainserver-relevanten Quelle. Der Statuslesepfad kombiniert beide Daten, ohne Jobhistorie in die Waste-Datenbank oder Waste-Fachdaten in die zentrale Studio-Datenbank zu duplizieren.

Als letzter erfolgreicher Abgleich gilt ausschließlich der nach `finished_at` jüngste Datensatz derselben Instanz mit:

- `plugin_id = 'waste-management'`,
- `job_type_id = 'waste-management.sync-mainserver'`,
- `status = 'succeeded'`,
- gesetztem `finished_at` und einem gültigen revisionsfähigen Ergebnisvertrag.

Start-, Fehler- und Cancel-Events gelten nicht als erfolgreicher Abgleich. Die Repository-Abfrage sortiert ausdrücklich nach `finished_at`, damit parallele Jobstarts die Semantik nicht verfälschen.

### Decision: Die externe Waste-Datenbank führt Revision und Änderungszeitpunkt

Eine tenantlokale Singleton-Tabelle führt eine monoton wachsende `BIGINT`-Quellrevision und einen `TIMESTAMPTZ`-Zeitpunkt der letzten Mainserver-relevanten Änderung. Eine gemeinsame Triggerfunktion erhöht beide Werte transaktional. Pro relevanter Tabelle lösen Statement-Trigger bei Inserts und Deletes immer sowie bei Updates nur für materialisierungsrelevante Spalten aus. Mehrere Erhöhungen innerhalb einer fachlichen Transaktion sind ausdrücklich zulässig; eine zusätzliche transaktionsweite Verdichtung wäre für den monotonen Vergleich ohne fachlichen Nutzen.

Erfasst werden ausschließlich Tabellen und Spalten, die der bestehende Materialisierungspfad tatsächlich liest, insbesondere:

- Orte, Straßen, Hausnummern und aktive Abholorte,
- Fraktionsnamen,
- Tourregeln und benutzerdefinierte Wiederholungen,
- Tour-Ort-Zuordnungen, ortsbezogene Termine und explizite Einsätze einschließlich ihrer Ortszuordnungen,
- tourbezogene und globale Verschiebungen sowie Feiertagsregeln.

Der Tabellen- und optionale Update-Spaltenkatalog wird an einer Stelle im Waste-Schemabuilder definiert und von Migrationstests gegen die Materialisierungseingaben geprüft. PDF-Stamminhalte, Reminder-Abonnements, Outbox-Daten und andere nicht materialisierte Änderungen erhöhen die Revision nicht. Der Builder für neue Tenant-Datenbanken und eine additive versionierte Bestandsmigration erzeugen denselben Vertrag. Der zentrale Studio-Schema-Snapshot erhält keine externe Waste-Fachtabelle. Anwendungsrollen erhalten ausschließlich die für Statuslesen und revisionsauslösende Fachmutationen notwendigen Rechte; ein direkter fachlicher Schreibzugriff auf die Singleton-Tabelle ist nicht Teil des UI-Vertrags.

### Decision: Der Job verarbeitet eine konsistente Quellrevision

Der Sync-Job liest Quellrevision und materialisierungsrelevante Tabellen in einem konsistenten PostgreSQL-Snapshot. Das Jobergebnis enthält die gelesene Revision sowie das verwendete Jahresfenster. Die externe Revision wird durch den Sync selbst nicht zurückgesetzt.

Der Quellzustand ist `pending`, wenn mindestens eine der folgenden Bedingungen gilt:

- kein kompatibler erfolgreicher Job existiert;
- die aktuelle Quellrevision ist größer als die im letzten erfolgreichen Job verarbeitete Revision;
- das aktuelle Materialisierungs-Jahresfenster weicht vom zuletzt erfolgreich verarbeiteten Fenster ab.

Eine Mutation, die während des Jobs committed, erhält eine neuere Revision und bleibt deshalb nach Jobabschluss offen. Ein fehlgeschlagener Job bestätigt keine Revision. Der Quellzustand `clean | pending | unknown` bleibt von einem optionalen aktiven Job und dem letzten relevanten Versuch getrennt. Dadurch kann die Antwort gleichzeitig einen laufenden Job und bereits danach erneut ausstehende Änderungen ausdrücken, ohne einen kombinatorischen Statusautomaten einzuführen.

### Decision: Statuslesen führt keinen Mainserver-Vergleich aus

Ein autorisierter Waste-Status-Endpunkt liest nur:

- die aktuelle Revision aus der externen Waste-Datenbank,
- den letzten erfolgreichen und gegebenenfalls aktiven Mainserver-Sync aus dem zentralen Jobstore,
- das aktuell erwartete Jahresfenster.

Der Endpunkt liefert den abgeleiteten Quellzustand, den letzten kompatiblen Erfolg, den letzten relevanten Versuch und optional den aktiven Job. Rohe Revisionen bleiben serverseitige Vergleichs- und Jobresultatdaten und müssen nicht als UI-Fachwert exponiert werden. Der Endpunkt ruft weder SVA-Mainserver-GraphQL noch den Diff-Algorithmus auf. Bei nicht erreichbarer Waste-Datenbank, ungültigem Legacy-Ergebnis oder inkonsistenten Metadaten liefert er `unknown` und erfindet keinen sauberen Zustand.

### Decision: Die echte Differenzphase liefert die Terminanzahl

Der tatsächliche Sync-Job trennt die pure Planbildung von den mutierenden Batches. Unmittelbar nach dem echten Mainserver-Snapshot persistiert er geplante Create-, Delete- und Gesamtzahlen im bestehenden Jobfortschritt. Erst danach beginnen Mainserver-Schreiboperationen.

Die UI bestätigt den angenommenen Job zunächst ohne erfundene Anzahl. Sobald die Differenzphase abgeschlossen ist, zeigt sie getrennt:

- wie viele Termine übertragen werden,
- wie viele veraltete Termine entfernt werden,
- dass die Verarbeitung bis zu einer Stunde dauern kann.

Updates dürfen intern als Delete plus Create erscheinen; deshalb bildet die UI keine irreführende einzelne Zahl für „geänderte Termine“, sondern zeigt beide bestehenden Operationsmengen.

### Decision: Der gemeinsame Header bleibt ruhig und pluginübergreifend konsistent

Die Waste-Seite verwendet weiterhin den gemeinsamen `StudioOverviewPageTemplate`. Der Header enthält ausschließlich den von der App-Shell bereitgestellten Breadcrumb, die H1 `Abfallkalender`, die bestehende fachliche Beschreibung und den optionalen sekundären Verweis auf die öffentliche Abfallkalender-Webversion, sofern dieser konfiguriert und für den Benutzer lesbar ist. Der aktuelle Breadcrumb verwendet ebenfalls `Abfallkalender`; der Sidebar-Modulname `Abfallmanagement` kann davon unberührt bleiben. Synchronisierungsstatus und Synchronisierungsaktion werden nicht als primäre Headeraktion dargestellt.

Der Statusbereich folgt direkt auf den Header und vor der Waste-Tabnavigation. So bleibt die Seitenhierarchie mit anderen Plugins vergleichbar, während Zustand, Erklärung und Handlung räumlich und semantisch zusammengehören.

### Decision: Der Statusblock bündelt Handlungsbedarf und Aktion

Bei `pending` verwendet die Aktion eine hervorgehobene vorhandene Design-System-Variante und den handlungsorientierten Text `Änderungen synchronisieren`. Sie liegt innerhalb desselben kompakten Statusblocks, der den ausstehenden Abgleich und optional den letzten erfolgreichen Abschlusszeitpunkt benennt. Der Block fordert den Benutzer auf, zunächst alle geplanten Änderungen an Terminen und Abholorten abzuschließen und zu speichern, und erklärt, dass Änderungen während oder nach der Übertragung einen weiteren Abgleich erfordern. Auf breiten Ansichten darf die Aktion rechts neben dem Text stehen; auf schmalen Ansichten folgt sie im natürlichen Dokumentfluss unter dem Text.

Der Hinweis ist beratend und blockiert die Synchronisierung nicht technisch: Das System kann gespeicherte Änderungen erkennen, aber nicht wissen, ob ein Benutzer fachlich noch weitere Bearbeitung plant. Dringende Korrekturen bleiben während eines laufenden Jobs möglich; die höhere Quellrevision hält den anschließenden Status in diesem Fall auf `pending`.

Bei `clean` wird der Synchronisierungsbutton vollständig ausgeblendet. Statt einer deaktivierten oder unbenutzbaren Aktion zeigt derselbe Seitenbereich nur einen ruhigen Status mit dem letzten erfolgreichen Abschlusszeitpunkt. Bei `running` ersetzt dort der zentrale Jobstatus mit einem Weg zum Vorgang die Startaktion. Bei `unknown` enthält der Warnblock eine manuelle Aktion, ohne zu behaupten, dass sicher Änderungen ausstehen. Nach einem fehlgeschlagenen Versuch enthält der Fehlerblock die erneute Synchronisierungsaktion, solange der Quellabgleich nicht als `clean` bestätigt ist.

Während der initialen Statusabfrage zeigt der Bereich einen kompakten, höhenstabilen Ladezustand und behauptet weder `clean` noch `pending`. Benutzer ohne Ausführungsberechtigung sehen den fachlichen Zustand, aber keine Aktion; bei `pending` erklärt der Block knapp, dass eine berechtigte Person die Synchronisierung starten muss. Dafür entsteht genau eine pluginlokale Statuskomponente. Es werden weder eine neue globale UI-Abstraktion noch ein eigener Client-Provider oder Zustandsautomat eingeführt.

Dauerhafte `clean`- und `pending`-Hinweise verwenden keine assertive Alert-Semantik. Bedeutende Status- und Phasenwechsel werden über eine höfliche, gedrosselte Statusankündigung vermittelt; echte Fehler dürfen als Alert angekündigt werden. Numerische Einzelupdates erzeugen keine unkontrollierte Live-Region-Kette. Berechtigungen des vorhandenen Sync-Starts bleiben maßgeblich; der neue Lesepfad exponiert keine Secrets oder rohen Mainserver-Daten.

## Alternatives Considered

### Mainserver-Dry-Run beim Seitenaufruf

Verworfen, weil jeder Seitenaufruf die komplette Waste-Materialisierung und mehrere Mainserver-Abfragen auslösen würde. Der Benutzer hat ausdrücklich einen Zustand ohne Dry-Run gewünscht.

### Nur `MAX(updated_at)` mit letztem Jobabschluss vergleichen

Verworfen, weil Löschungen unsichtbar bleiben, irrelevante Änderungen falsch positiv werden und parallele Transaktionen nicht zuverlässig dem gelesenen Quellsnapshot zugeordnet werden können.

### Nur ein boolesches Dirty-Flag führen

Verworfen, weil ein Job das Flag nach erfolgreichem Abschluss fälschlich löschen könnte, obwohl während seines Laufs eine weitere Änderung committed wurde. Eine monotone Revision ordnet Job und Quellsnapshot eindeutig zu.

### Syncstatus vollständig in der zentralen Studio-Datenbank speichern

Verworfen, weil die führenden Waste-Daten in einer separaten tenantbezogenen Datenbank liegen und Änderungen über mehrere Runtime-Pfade einschließlich Imports und Migrationen erfolgen. Der Änderungsmarker bleibt an der Quellgrenze; die zentrale Datenbank behält ausschließlich den generischen Jobnachweis.

## Risks / Trade-offs

- Die Singleton-Zeile serialisiert gleichzeitig commitende relevante Fachmutationen kurzzeitig. → Ausschließlich Statement-Trigger verwenden, die Triggerfunktion auf ein einzelnes atomisches Update begrenzen und keine externen Aufrufe oder langen Arbeiten in derselben Transaktion halten.
- Eine relevante Materialisierungsspalte könnte beim Trigger-Scope vergessen werden. → Triggerliste direkt gegen die gelesenen Materialisierungstabellen und Spalten testen.
- Bestandsjobs enthalten noch keine Quellrevision. → Nach der Migration bis zum ersten kompatiblen erfolgreichen Job fail-closed `pending` oder `unknown` anzeigen.
- Ein Jahreswechsel erzeugt ohne Mutation neuen fachlichen Bedarf. → Jahresfenster im Jobergebnis speichern und im Statusvertrag vergleichen.
- Direkte Änderungen im externen Mainserver bleiben unsichtbar. → UI und Dokumentation bezeichnen den Status ausdrücklich als offenen Studio-/Waste-Quellabgleich und nicht als vollständigen Paritätsnachweis.
- Statusdaten stammen aus zwei Datenbanken. → Fehler getrennt behandeln, keine Teilantwort als `clean` interpretieren und keine verteilte Transaktion vortäuschen.

## Migration Plan

1. Additive, versionierte Waste-Tenant-Migration für Singleton-Zustand und Trigger bereitstellen; Builder für neue Tenant-Datenbanken auf denselben Sollvertrag bringen.
2. Migration in Staging über den kanonischen Promote-Pfad anwenden und Revisionserhöhung für relevante Inserts, Updates, Deletes und Bulk-Flows verifizieren.
3. Statuslesepfad und erweiterten Jobergebnis-/Progress-Vertrag ausrollen; Legacy-Tenants bleiben bis zum ersten kompatiblen Erfolg sichtbar offen.
4. Plugin-UI anbinden und echten Sync in Staging einschließlich paralleler Änderung und Jahresfenster prüfen.
5. Denselben Digest nach erfolgreicher Staging-Evidenz und Backup über den kanonischen Rolloutprozess promoten.

## Open Questions

- Keine. Die Anzahl wird nach der echten Differenzphase getrennt als Create und Delete dargestellt; der Seitenstatus benötigt keinen Mainserver-Zugriff.
