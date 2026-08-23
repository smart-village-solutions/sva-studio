## Context

Der bestehende Einzel-Tour-Flow kopiert eine Tour über `duplicateFromTourId` und übernimmt serverseitig Abholort-Zuordnungen, ortsbezogene Abholtermine, explizite Tour-Einsätze und tourbezogene Datumsverschiebungen. Er verschiebt Datumswerte jedoch nicht in das Folgejahr und bietet weder eine gemeinsame Vorschau noch einen atomaren Jahres-Batch.

Eine Waste-Tour besitzt bereits den Zustand `active`. Inaktive Touren bleiben im Studio sichtbar und bearbeitbar, werden aber nicht operativ materialisiert. Dieser vorhandene Zustand reicht als sichere Arbeitsgrundlage aus; ein zusätzlicher Entwurfs- oder Workflowstatus würde den Lebenszyklus unnötig erweitern.

## Goals / Non-Goals

### Goals

- Ein Quelljahr auswählen und das direkte Folgejahr unveränderlich ableiten.
- Alle im Quelljahr relevanten Touren vollständig und verständlich einordnen.
- Vor jedem Schreibvorgang konkrete Auswirkungen und Ausschlussgründe barrierefrei anzeigen.
- Reguläre Wochentags- und Tagesabstandsrhythmen fachlich korrekt in das Folgejahr fortführen.
- Eine bestätigte, unveränderte Vorschau vollständig atomar und inaktiv anlegen.
- Bestehende Einzel-Tour-, Datums-, Idempotenz- und Transaktionsmuster wiederverwenden.

### Non-Goals

- Keine freie Wahl eines unabhängigen Zieljahres, keine Rückwärtskopie und kein Überspringen mehrerer Jahre.
- Keine alternativen Übernahmemodi und keine teilweise Übernahme einzelner Beziehungsarten.
- Kein neuer Tourstatus und keine persistierte Jahreswechsel- oder Assistenten-Entität.
- Keine automatische, unmittelbare oder gesammelte Aktivierung der erzeugten Touren.
- Kein automatisches Ersetzen, Aktualisieren oder Löschen bestehender Zieltouren.
- Keine Veränderung des Quellbestands.

## Decisions

### Quelljahr bestimmt genau ein Folgejahr

Der Assistent erfasst nur `sourceYear`; der Server leitet `targetYear = sourceYear + 1` selbst ab. Unterstützt werden das aktuelle und das unmittelbar vorherige Kalenderjahr. Damit liegt das Folgejahr stets im aktuellen oder nächsten Kalenderjahr und bleibt über die vorhandenen relativen Jahresfilter auffindbar. Das aktuelle Jahr ist vorausgewählt.

Freie Zieljahre wurden verworfen, weil sie zusätzliche Rückwärts-, Mehrjahres-, Filter- und Datumsverträge erzeugen, ohne den belegten jährlichen Vorbereitungsablauf besser zu unterstützen.

### Zustandsloser Assistent mit einer Schreibgrenze

Der Assistent hält seine Auswahl nur im Client. Eine read-only Serveroperation erzeugt die Vorschau. Beim Bestätigen validiert der Server den Vorschaustand erneut und legt den gesamten ausgewählten Satz in einer Datenbanktransaktion inaktiv an. Wird der Assistent danach beendet, bleiben die erzeugten Touren über die normale Tourenliste, den relativen Jahresfilter und den Statusfilter auffindbar und bearbeitbar.

Eine Aktivierung gehört bewusst nicht zum Jahreswechsel-Assistenten. Die Benutzer sollen den erzeugten Bestand zunächst prüfen und mit den bestehenden Tourenaktionen freigeben. Eine allgemeine Bulk-Aktivierung kann bei nachgewiesenem Bedarf separat spezifiziert werden.

### Vollständige und nachvollziehbare Quellklassifikation

Kandidaten sind aktive Touren, deren Gültigkeitszeitraum das Quelljahr überschneidet oder die mindestens einen expliziten Termin im Quelljahr besitzen. Die Vorschau verschweigt keine dieser Touren, sondern ordnet sie genau einer Gruppe zu:

- `Wird übernommen`: Die Tour ist im Quelljahr wirksam, aber weder durch ihren Gültigkeitszeitraum noch durch explizite Termine bereits im Folgejahr wirksam.
- `Gilt bereits im Folgejahr`: Die unveränderte Quelltour ist im Folgejahr weiterhin wirksam. Sie wird nicht dupliziert, weil Quell- und Zieltour sonst parallel dieselbe Planung materialisieren könnten.
- `Blockiert`: Die Tour benötigt eine manuelle Datumsentscheidung oder kann wegen ungültiger beziehungsweise unvollständiger Planungsdaten nicht sicher abgebildet werden.

Benutzer können übernehmbare Touren einzeln abwählen. Bereits weitergeltende und blockierte Touren können nicht bestätigt werden; die Vorschau erklärt jeweils den Grund und die geeignete manuelle Folgeaktion. Die Namen übernommener Touren bleiben unverändert und erhalten kein Kopie-Suffix.

### Ein vollständiger Übernahmevertrag

Der Assistent bietet keinen Modusschalter. Für jede bestätigte Tour übernimmt er Name, Beschreibung, Abfallarten, Abholorte, Turnus oder Abstandspreset sowie alle im Quelljahr wirksamen Planungsbeziehungen:

- konkrete Tourtermine,
- ortsbezogene Abholtermine,
- explizite Tour-Einsätze einschließlich ihrer Abholorte,
- jahresunabhängige tourbezogene Verschiebungsregeln,
- jahresspezifische tourbezogene Verschiebungen des Quelljahres.

Jahresunabhängige Regeln werden unverändert mit der neuen Tour verknüpft. Jahresbezogene Termine und Verschiebungen werden nach der Folgejahrregel abgebildet. Daten außerhalb des Quelljahres werden nicht in den neuen Satz übernommen und in der Vorschau als ausgeschlossen zusammengefasst.

### Deterministische Folgejahrregeln

Für wöchentliche, zweiwöchentliche, vierwöchentliche und durch ein Abstandspreset bestimmte Touren wird der vorhandene 7-/14-/28-Tage- beziehungsweise individuelle Tagesabstand ohne Unterbrechung fortgeführt. Der im Quelljahr wirksame Gültigkeitsausschnitt wird nach Monat und Tag auf das Folgejahr übertragen; der erste Termin ist das erste aus dem fortgeführten Takt resultierende Datum innerhalb dieses Zielausschnitts.

Kalendergebundene jährliche Touren behalten Monat und Tag. Konkrete Einzeltermine werden zunächst auf denselben Monat und Tag des Folgejahres übertragen und anschließend auf den nächstgelegenen gleichen Wochentag verschoben. Das Ergebnis muss im Folgejahr liegen; würde die nächstgelegene Wahl die Jahresgrenze überschreiten, wird der nächstgelegene gleiche Wochentag innerhalb des Folgejahres verwendet.

Kann ein Quellmonat/-tag wie der 29. Februar im Folgejahr nicht dargestellt werden, verlangt die Vorschau ein konkretes Ersatzdatum im Folgejahr. Dasselbe gilt, wenn mehrere unterschiedliche Quelltermine oder Verschiebungen auf dieselbe fachliche Zielbeziehung abgebildet würden. Ersatzdaten werden pro Quellressource erfasst, serverseitig validiert und in den Vorschau-Fingerprint aufgenommen. Ohne eindeutige Auflösung bleibt die Tour blockiert.

### Vorschau-Fingerprint und Konflikte

Die Vorschau zeigt je Tour mindestens Tourname, Klassifikation, Quell- und Zielzeitraum, ersten Zieltermin, Turnus sowie die Anzahl der Abfallarten, Abholorte, konkreten Termine, Einsätze und Verschiebungen. Sie fasst die Gesamtmengen und ausgeschlossenen Daten zusammen.

Der Server bildet einen kanonischen `previewFingerprint` aus Instanz, Quell- und Folgejahr, ausgewählten Quell-Tour-IDs, kopierrelevanten Tourfeldern, Beziehungen, Ersatzdaten und den jeweiligen fachlichen Änderungsständen. Die Erstellung akzeptiert nur einen Fingerprint, den dieselbe serverseitige Berechnung unmittelbar vor dem Schreiben erneut ergibt. Abweichungen liefern `preview_stale` mit einer aktualisierten Vorschau und erfordern eine neue Bestätigung.

Ein gleicher Tourname ist allein kein Konflikt. Die Vorschau unterscheidet:

- Ein stabil abgeleitetes Ziel mit derselben Quelltour und demselben Folgejahr ist entweder ein idempotentes vorhandenes Ergebnis oder ein harter `target_identity_conflict`, falls sein Inhalt abweicht.
- Eine andere bestehende Tour mit identischen Mengen von Abfallarten und Abholorten, gleichem effektiven Tagesabstand, überschneidendem Zielzeitraum und mindestens einem gemeinsamen generierten oder expliziten Termin ist ein möglicher fachlicher Konflikt. Die Quelltour ist zunächst abgewählt, kann aber nach ausdrücklicher Kenntnisnahme bestätigt werden, weil parallele Einsätze fachlich zulässig sein können.

Entsteht zwischen Vorschau und Bestätigung ein neuer Konflikt, schlägt die gesamte Erstellung ohne Schreibzugriff fehl und liefert eine aktualisierte Vorschau.

### Atomarität, Konkurrenz und Idempotenz

Der Server sperrt Erstellungsvorgänge mandanten- und folgejahrbezogen mit einem transaktionalen Advisory Lock. Innerhalb derselben Waste-Datenbanktransaktion lädt er den aktuellen Quell- und Zielbestand, prüft Fingerprint und Konflikte und erzeugt anschließend Touren und Beziehungen. Jeder Fehler führt zum vollständigen Rollback.

Ziel-Tour-IDs werden stabil aus Instanz, Quell-Tour-ID und Folgejahr abgeleitet. Beziehungs-IDs werden stabil aus Ziel-Tour-ID, Beziehungstyp und Quell-Beziehungs-ID abgeleitet. Sie hängen nicht vom Akteur oder HTTP-Idempotenzschlüssel ab. So konvergieren wiederholte Jahreswechselversuche fachlich auf dieselben Zielressourcen.

Der Erstellungsrequest trägt zusätzlich einen mandantenbezogenen Idempotenzschlüssel. Der zentrale Idempotenzspeicher reserviert den Scope aus Akteur, Instanz, Endpunkt und Schlüssel mit einem kanonischen Payload-Fingerprint und speichert die abschließende Antwort. Nach einem Prozessabbruch zwischen Commit der Waste-Transaktion und Abschluss des zentralen Eintrags rekonstruiert der Server das Ergebnis anhand der stabilen Ziel-IDs. Vollständig identische Daten gelten als Replay, fehlende Daten erlauben einen erneuten atomaren Versuch und abweichende Daten führen zu `target_identity_conflict`.

Es gelten feste serverseitige Grenzwerte von 1.000 Touren und insgesamt 100.000 zu kopierenden Beziehungen pro Jahresübernahme. Beide Werte sind im API-Vertrag zentral definiert und werden in Vorschau sowie Erstellung identisch mit `batch_limit_exceeded` durchgesetzt. Die Grenzen liegen bewusst deutlich über einem regulären Mandantenbestand, begrenzen aber Arbeitsspeicher, Fingerprint-Bildung und Transaktionsdauer gegen unkontrollierte Eingaben.

### Berechtigungen und Audit

Vorschau und Erstellung verlangen `waste-management.tours.manage` und wegen der vollständig übernommenen Planungsdaten zusätzlich `waste-management.scheduling.manage`. CSRF-, Mandanten- und Eingabevalidierung entsprechen den bestehenden Waste-Mutationen.

Die Erstellung erzeugt genau ein zusammenfassendes Audit-Ereignis für Erfolg oder Fehlschlag. Protokolliert werden Quell- und Folgejahr, Klassifikations- und Ergebnismengen sowie technische Ressourcen-IDs, jedoch keine Notizen, Adressdaten oder sonstigen fachlichen Freitexte. Vorschau und reine Validierungsfehler vor einer bestätigten Mutation erzeugen kein Audit-Ereignis.

### Verständlichkeit und Barrierefreiheit

Der Assistent verwendet keine internen Begriffe wie `Assignment`, `Date-Shift`, `Fingerprint` oder `duplicateFromTourId`. Die Oberfläche erklärt das unveränderliche Folgejahr sowie die drei Tourgruppen in Fachsprache. Vor dem Schreiben zeigt die Zusammenfassung konkrete Mengen und Beispieldaten im Format `Quelle → Folgejahr`.

Schritte, Auswahl, Tabellen, Warnungen, Ersatzdatumseingaben, Fehlermeldungen und Bestätigungen sind vollständig per Tastatur und Screenreader bedienbar. Status und Konflikte werden nicht ausschließlich über Farbe vermittelt. Nach `preview_stale` bleibt die Eingabe erhalten und der Fokus wird auf die aktualisierte verständliche Zusammenfassung gesetzt.

## Risks / Trade-offs

- Die Begrenzung auf das direkte Folgejahr deckt bewusst keine Rückwärts- oder Mehrjahreskopien ab, reduziert dafür Datums-, Filter- und Bedienkomplexität erheblich.
- Bereits weitergeltende Touren werden nicht kopiert. Die vollständige sichtbare Klassifikation verhindert, dass Benutzer sie als versehentlich ausgelassen wahrnehmen.
- Die fachliche Konflikterkennung kann bewusst parallele Einsätze markieren. Solche Treffer sind deshalb erklärbare Warnungen mit ausdrücklicher Bestätigung und keine automatischen Lösch- oder Ersetzungsentscheidungen.
- Ohne persistierte Workflow-Entität kann ein abgebrochener Assistent nicht exakt wiederaufgenommen werden. Erfolgreich erzeugte inaktive Touren bleiben jedoch über normale Filter auffindbar; Wiederholungen konvergieren über stabile Ziel-IDs.

## Migration Plan

Es ist keine Datenmigration vorgesehen. Die Implementierung ergänzt API-, Core-, Repository- und UI-Verträge und verwendet die vorhandenen Waste-Tabellen. Vor Abschluss wird bestätigt, dass weder `docs/development/studio-db-schema-final.sql` noch `docs/development/studio-db-schema.md` geändert werden müssen.

Die Funktion wird ausschließlich mit inaktiver Erstellung ausgeliefert. Bestehende Einzelduplizierung und Statusänderungen bleiben unverändert verfügbar.

## Validation

- Unit-Tests für Quellklassifikation, Folgejahrableitung, Datumsabbildung, Taktfortführung, Kollisionen und Konfliktsignaturen
- Repository- und PostgreSQL-Integrationstests für Advisory Lock, Transaktion, Rollback, stabile IDs und Idempotenz-Recovery
- Auth-Runtime-Tests für Berechtigungen, CSRF, `preview_stale`, erneute Konfliktprüfung, Mengenlimits, Fehlerabbildung und Audit
- UI-Tests für alle Assistentenschritte, drei Tourgruppen, Ersatzdaten, Auswahl und Fokusführung
- E2E-Test für Vorschau, atomare inaktive Erstellung und anschließendes Auffinden über Folgejahr- und Statusfilter
- Gezielter Server-Runtime-Check für die betroffenen serverseitigen Workspace-Packages
