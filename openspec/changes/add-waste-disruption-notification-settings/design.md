## Context

Der bestehende `wasteTypes`-Sync besitzt zwei relevante Quellen und Grenzen:

- Reguläre Abfallarten liegen als tenantbezogene Datensätze in `waste_fractions`.
- Globale Waste-Einstellungen liegen tenantbezogen in der Singleton-Tabelle `waste_settings` derselben externen Waste-Datenbank.

Der Core-Builder filtert aktive Fraktionen, normalisiert ihre PDF-Kürzel in Großschreibung, sortiert die Einträge und hasht das vollständig serialisierte JSON. Der Sync-Job lädt derzeit nur die Fraktionen und ersetzt anschließend den gesamten Mainserver-Static-Content. Fraktionsanlagen, -änderungen und -löschungen reihen nach erfolgreicher lokaler Persistenz automatisch denselben asynchronen Sync-Job ein; dessen Fehler rollen die lokale Änderung nicht zurück.

## Goals / Non-Goals

- Goals:
  - beide Störungstypen unabhängig und tenantbezogen konfigurieren;
  - sichere Defaults für Bestandsmandanten garantieren;
  - reguläre Fraktionen und Störungstypen typseitig und fachlich trennen;
  - vollständige, deterministische `wasteTypes`-Dokumente erzeugen;
  - den bestehenden mutationsgetriebenen Sync-Lebenszyklus wiederverwenden.
- Non-Goals:
  - keine neue allgemeine Static-Content-Abstraktion;
  - keine Störungsfraktionen oder künstlichen Datensätze in `waste_fractions`;
  - kein Merge mit unbekannten Mainserver-Inhalten;
  - kein synchroner Mainserver-Schreibvorgang innerhalb der Einstellungstransaktion;
  - keine App- oder Push-Änderung.

## Decisions

### Decision: Die Optionen liegen in der tenantlokalen `waste_settings`-Tabelle

Die Singleton-Tabelle erhält die Spalten `disruption_location_enabled` und `disruption_all_locations_enabled` als `BOOLEAN NOT NULL DEFAULT FALSE`. Damit bleiben Root-/Tenant-Grenzen erhalten, die Konfiguration liegt neben den bestehenden tenantbezogenen Waste-Einstellungen und Bestandszeilen erhalten durch die additive Migration den sicheren Default.

Reader und Writer liefern beide Werte als explizite Booleans. Fehlt die Tabelle oder ein Datensatz im bestehenden sicheren Kompatibilitätspfad, normalisiert der API-Vertrag beide Werte auf `false`. Die Werte werden nicht in die zentrale Interface-Konfiguration und nicht in `waste_fractions` gespiegelt.

### Decision: Reguläre und besondere `wasteTypes`-Einträge sind getrennte Varianten

Der Core-Vertrag unterscheidet einen regulären Fraktionseintrag mit dessen bestehenden Pflichtfeldern von einem Störungseintrag mit genau `label` und `notification_kind: 'disruption'`. Das resultierende Payload ist ein Record über die Union beider Varianten.

Nur reguläre Fraktionen durchlaufen PDF-Kürzel-Validierung und Großschreibungsnormalisierung. Die beiden reservierten Störungsschlüssel werden aus festen Konstanten erzeugt. Vor der Serialisierung werden alle Schlüssel gemeinsam lexikografisch sortiert; dadurch bleiben Inhalt und SHA-256-Hash bei identischen Eingaben stabil. `fractionCount` wird vor dem Hinzufügen der Sondertypen aus den aktiven regulären Fraktionen ermittelt.

### Decision: Der Sync lädt Fraktionen und Konfiguration aus demselben Tenant-Repository

Der bestehende Sync-Job lädt nach dem Schema-/Backfill-Gate sowohl die Fraktionen als auch die Waste-Einstellungen. Er übergibt eine explizite Störungskonfiguration an den Builder und schreibt weiterhin das vollständig neu erzeugte Dokument über `createOrUpdateStaticContent`. Unbekannte Mainserver-Einträge werden nicht gelesen oder übernommen.

### Decision: Speichern reiht denselben asynchronen Sync-Job ein

Wenn der Einstellungsschreibpfad beide Booleans erfolgreich persistiert und seine bestehende Read-after-write-Verifikation abgeschlossen hat, reiht er `waste-management.sync-waste-types` über denselben Hostpfad wie Fraktionsmutationen ein. Die API-Antwort trägt denselben typisierten Sync-Metadatenvertrag oder einen semantisch identischen gemeinsamen Vertrag.

Kann der Job nicht eingereiht werden oder endet er später fehlerhaft, bleibt die Einstellung gespeichert. Die Einstellungs-UI zeigt eine Warnung mit Retry und verfolgt einen angenommenen Job bis zum Terminalzustand. Damit folgt die neue Mutation dem vorhandenen lokalen-Save-plus-Async-Sync-Vertrag, ohne eine verteilte Transaktion vorzutäuschen.

### Decision: Die UI verwendet zwei unabhängige vorhandene Switch-Primitives

Eine eigene Konfigurationssektion in den Waste-Einstellungen beschreibt die Wirkung auf App und nächsten Mainserver-Abgleich. Jeder Switch besitzt eine sichtbare übersetzte Beschriftung und einen übersetzten Hilfetext, ist per Tastatur bedienbar und bleibt unabhängig vom jeweils anderen Wert änderbar. Beim Laden fehlender Felder wird `false` gesetzt; beim Speichern werden beide Werte explizit übertragen.

## Alternatives Considered

### Werte in der zentralen Interface-`publicConfig` speichern

Verworfen, weil die Optionen fachlich keine Transport- oder Schnittstellenkonfiguration sind und der Sync bereits an die externe tenantbezogene Waste-Datenbank gebunden ist. Eine zweite Quelle würde Ownership und Fehlerfälle erhöhen.

### Störungstypen als besondere Zeilen in `waste_fractions` speichern

Verworfen, weil ihnen Fraktionsfelder und Fraktionsverhalten fehlen und sie dadurch in Zählungen, Auswahllisten, Tourzuordnungen und Exporte durchsickern könnten.

### Erst bei einem manuellen Sync wirksam werden

Verworfen, weil reguläre Fraktionsmutationen bereits automatisch synchronisieren und ein abweichender Lebenszyklus unnötige Drift zwischen sichtbarer Studio-Konfiguration und Mainserver erzeugen würde.

### Vorhandene Mainserver-Einträge lesen und zusammenführen

Verworfen, weil das Studio weiterhin alleinige Quelle des vollständig synchronisierten Dokuments bleibt und unbekannte Einträge keinen vertrauenswürdigen Ownership-Vertrag besitzen.

## Risks / Trade-offs

- Ein erfolgreicher lokaler Save kann einem fehlgeschlagenen Sync vorausgehen. → Bestehenden Warnungs-, Jobtracking- und Retry-Vertrag der Fraktionsmutationen wiederverwenden.
- Reservierte Störungsschlüssel könnten mit einem Fraktionskürzel kollidieren. → Builder prüft Kollisionen über das vollständige Payload und liefert einen deterministischen fachlichen Fehler, statt einen Eintrag zu überschreiben.
- Legacy-Datenbanken besitzen die neuen Spalten noch nicht. → Additive idempotente Schemaanweisungen und versionierten Schema-Snapshot ergänzen; fehlende Konfigurationswerte im API-/Formvertrag sicher als `false` behandeln.
- Eine Erweiterung der bestehenden Singleton-Repository-Namen kann deren bisherigen PDF-Fokus sichtbar machen. → Den bestehenden Repository-Teil proportional zu allgemeinen Waste-Static-Einstellungen benennen oder erweitern, ohne einen zusätzlichen Service-/Provider-Layer einzuführen.

## Migration Plan

1. Neue Boolespalten additiv mit `NOT NULL DEFAULT FALSE` in Builder und Bestandsmigration ergänzen.
2. Repository-, API- und UI-Verträge ausrollen; Bestandsmandanten zeigen beide Schalter deaktiviert.
3. Builder und Sync-Job auf die kombinierte Quelle umstellen und automatischen Sync nach Settings-Save aktivieren.
4. In Staging alle vier Konfigurationen, Deaktivierung, Jobfehler/Retry, Payload und Hash prüfen.
5. Für MeinePR beide Optionen aktivieren und denselben abgenommenen Digest über den kanonischen Rolloutpfad promoten; der Studio-Sync ersetzt danach das manuell gepflegte Dokument ohne Funktionsverlust.

## Open Questions

- Keine. Der automatische asynchrone Sync nach erfolgreicher Speicherung folgt dem bestätigten bestehenden Fraktionsvertrag.
