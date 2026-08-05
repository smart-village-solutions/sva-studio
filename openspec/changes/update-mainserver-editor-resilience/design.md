## Context

Die produktiven Content-Editoren lesen über host-owned HTTP-Routen und typisierte `@sva/sva-mainserver`-Adapter aus der externen GraphQL-API. POI, Events, News und Generic Items validieren Detailantworten derzeit überwiegend als vollständige Zod-Objekte. Eine Typabweichung in einem optionalen Unterfeld kann deshalb den gesamten Adapter mit `invalid_response` beenden. Mehrere Editoren koppeln den erfolgreichen Detailrequest außerdem über `Promise.all` an optionale Studio-Dienste wie Medienreferenzen. Beim Speichern rekonstruieren Form-Mapper Mutation-Inputs aus den sichtbaren Werten; unbekannte Payload-Schlüssel werden nur in einzelnen Plugins bereits bewusst erhalten.

Die GraphQL-Grenze bleibt verbindlich: Studio kann nur Werte erhalten, die der Lesevertrag tatsächlich abfragt, und nur Felder schreiben, die der Mutation-Input akzeptiert. Der Change macht den bestehenden bestätigten Vertrag resilient, führt aber keinen generischen Rohdateneditor und keinen GraphQL-Bypass ein.

## Goals / Non-Goals

- Goals:
  - Anzeige jedes Mainserver-Datensatzes, dessen stabile ID sowie typbezogene harte Mindestfelder sicher erkannt wurden
  - Isolation optionaler Feld- und Anreicherungsfehler
  - sichere Bearbeitung der nicht betroffenen Feldgruppen
  - Erhalt unmittelbar zuvor gelesener Payload- und Passthrough-Werte innerhalb des bestätigten GraphQL-Vertrags
  - konsistente, lokalisierte Warnungen im Editor
  - strukturierte, PII-arme und deduplizierbare Diagnose über den Server-Runtime-Logger
  - gemeinsamer Host-/SDK-Vertrag statt pluginweiser Sonderlösungen
- Non-Goals:
  - keine Anzeige oder Erhaltung von Feldern, die der GraphQL-Lesevertrag nicht selektiert
  - kein Schreiben von Feldern außerhalb des bestätigten Mutation-Inputs
  - keine automatische Reparatur fachlich falscher Quelldaten
  - kein frei editierbarer JSON-Fallback für vollständige Mainserver-Objekte
  - keine konfliktfreie Zusammenführung paralleler Mainserver-Änderungen ohne Revision oder ETag
  - keine stillschweigende Normalisierung, die den Originalwert beim nächsten Speichern zerstört

## Decisions

### Identität ist die harte Lesegrenze

Ein Detaildatensatz gilt als darstellbar, wenn der Mainserver-Detailrequest erfolgreich war, die stabile Mainserver-ID verwendbar ist und die für die typisierte Route erforderlichen harten Mindestfelder gültig sind. Der Inhaltstyp wird nicht aus einem nicht vorhandenen GraphQL-Feld erraten, sondern durch die bereits autorisierte typisierte Route bestimmt. Typdiskriminatoren wie `genericType` bleiben hart, wenn sie verhindern, dass ein Datensatz über das falsche Fachplugin gelesen oder mutiert wird. Fehlende ID oder ein fehlender erforderlicher Diskriminator bleibt ein harter `invalid_response`- beziehungsweise `not_found`-Fehler nach bestehendem Routenvertrag. Optionale Skalare, Listen und Unterobjekte werden dagegen feld- oder gruppenweise gelesen.

Der Adapter liefert einen Detail-Result-Vertrag:

```ts
type MainserverDetailResult<TItem> = Readonly<{
  data: TItem;
  deviations: readonly MainserverDataDeviation[];
}>;

type MainserverDataDeviation = Readonly<{
  fieldPath: string;
  fieldGroup: string;
  code:
    'unexpected_type' | 'unsupported_value' | 'optional_dependency_failed' | 'preservation_limited';
  phase: 'read' | 'enrichment' | 'write';
  handling: 'defaulted' | 'omitted' | 'preserved_readonly' | 'temporarily_unavailable' | 'blocked';
  retryable: boolean;
}>;
```

Der konkrete TypeScript-Vertrag darf technisch auf Response-Metadaten aufgeteilt werden, muss aber Datensatz und Abweichungen getrennt halten. Bestehende `get(id): Promise<TItem>`-Aufrufer und unveränderte HTTP-Responses dürfen durch die Einführung nicht brechen; Detailmetadaten werden additiv über eine neue SDK-Methode oder eine versionierte Response-Hülle eingeführt. Er darf keine rohen Feldwerte in Browser-Metadaten oder Logs duplizieren. `fieldPath` verwendet kanonische Schema-Pfade ohne konkrete Listenindizes, etwa `mediaContents[].url`, damit Logs aggregierbar bleiben und keine unbeschränkte Kardinalität entsteht.

### Feldgruppen werden isoliert gemappt

Die bestehenden Mapper behalten typisierte Schemas für bestätigte Werte. Statt eines einzigen vollständigen `safeParse` werden Identität, skalare Felder und fachlich zusammengehörige Unterobjekte getrennt ausgewertet.

- Ein ungültiges optionales Skalarfeld erhält einen sicheren Anzeige-Default oder wird ausgelassen.
- Eine ungültige Listenposition verwirft nicht automatisch die übrigen gültigen Positionen.
- Eine fachlich zusammengehörige, nicht sicher teilbare Unterstruktur bleibt als gesamte Feldgruppe schreibgeschützt.
- Defaults sind Darstellungswerte und dürfen nicht automatisch als Ersatz für den abweichenden Originalwert gespeichert werden.
- Jede Abweichung erzeugt höchstens einen stabil klassifizierten Diagnoseeintrag pro Request, normalisiertem Feldpfad und Abweichungsklasse.
- Für jeden Inhaltstyp dokumentiert eine Feldmatrix harte Mindestfelder, kontrollierte Editorfelder, nur lesbare Felder, Passthrough-Felder und nicht durch Studio erhaltbare Felder.

### Hauptdaten und Anreicherungen sind unabhängige Zustände

Der Mainserver-Detailrequest entscheidet über den Hauptzustand des Editors. Medienreferenzen, Kategorien, Historie, Karten, Geocoding und vergleichbare optionale Dienste laden unabhängig.

- Fehler einer Anreicherung zeigen eine lokalisierte Abschnittswarnung.
- Bereits geladene Mainserver-Daten und andere erfolgreiche Anreicherungen bleiben nutzbar.
- Die betroffene Zusatzfunktion darf gezielt wiederholt werden.
- Eine fehlgeschlagene Medienreferenzabfrage darf weder als `not_found` noch als vollständig fehlgeschlagener Content-Load erscheinen.

### Erhaltung erfolgt innerhalb des bekannten Vertrags

Der Server beziehungsweise der typbezogene Adapter führt für Updates mit verifiziertem Erhaltungsbedarf kontrollierte Read-Merge-Write-Schritte aus:

1. den aktuellen Datensatz im gültigen Mainserver-Kontext unmittelbar vor der Mutation lesen
2. die vom Editor kontrollierten, gültigen Feldgruppen ersetzen
3. deklarierte Payload- und Passthrough-Felder aus dem aktuellen Datensatz erhalten
4. nicht sicher rekonstruierbare Feldgruppen nur dann unverändert lassen, wenn der Mutation-Vertrag Auslassung nachweislich als Erhaltung behandelt
5. andernfalls nur die betroffene Mutation als `blocked` zurückweisen und die Ursache feldbezogen melden

Plugins deklarieren explizit ihre kontrollierten und erhaltenen Feldgruppen. Ein Feld wird nur als erhaltbar klassifiziert, wenn es im Detailquery gelesen, aus der Antwort verlustfrei typisiert und vom Update-Input akzeptiert wird. Bei Replace-Semantik muss der Adapter die vollständige erforderliche Feldgruppe aus dem unmittelbar zuvor gelesenen Datensatz rekonstruieren; andernfalls wird die gesamte betroffene Mutation vor dem Provider-Aufruf blockiert. Es gibt keinen untypisierten globalen Objekt-Spread in GraphQL-Variablen. Projects und Cockpit Cards dienen als Referenz für den bestehenden Payload-Merge; POI und Events sind die erste Migration für strukturierte Unterobjekte. Create-Pfade erhalten keine scheinbaren Passthrough-Garantien, weil kein vorheriger Datensatz existiert.

### Logging und Datenschutz

Abweichungen werden ausschließlich serverseitig über `@sva/server-runtime` protokolliert. Ein Logeintrag enthält, soweit vorhanden:

- pseudonymisierungsarme technische Korrelationsfelder wie `instance_id`, `content_id`, `content_type`, soweit sie nach bestehender Logging-Klassifizierung zulässig und vorhanden sind
- `component`, `operation`, `phase`
- stabilen `deviation_code`, normalisierten `field_path` und `handling`
- `request_id` und `trace_id`
- ein aggregierbares Ergebnis wie `degraded`, `preserved` oder `blocked`

Logs enthalten keine Rohwerte, Payloads, Beschreibungen, Kontaktwerte oder sonstige potenzielle PII. Listenindizes, freie Schlüssel und externe Fehlertexte werden nicht Bestandteil aggregierbarer Labels. Derselbe Feldbefund wird innerhalb eines Requests nicht mehrfach emittiert. Metriken und Logabfragen können nach Inhaltstyp, Abweichungscode und normalisiertem Feldpfad aggregieren.

### Editor-Verhalten

- Eine Seitenwarnung fasst degradierte Bereiche zusammen.
- Der betroffene Tab oder Abschnitt zeigt den konkreten lokalisierten Zustand.
- Nicht sicher interpretierbare Felder sind schreibgeschützt; unabhängige Felder bleiben bedienbar.
- Speichern erklärt vorab, welche Feldgruppen unverändert bleiben.
- Ein serverseitig blockierter Teilwrite wird nicht als vollständiger Erfolg dargestellt.
- Warnungen sind per Tastatur erreichbar, semantisch als Status oder Alert ausgezeichnet und nicht allein farbcodiert.

## Package Boundaries

- `packages/sva-mainserver`: tolerante typbezogene Mapper, Abweichungsermittlung, Read-Merge-Write und serverseitiges Logging
- `packages/plugin-sdk`: neutraler Detail-Result- und Abweichungsvertrag sowie kompatible Mainserver-Clients
- `packages/studio-ui-react`: gemeinsame zugängliche Darstellung degradierter Bereiche
- Inhalts-Plugins: Deklaration kontrollierter/Passthrough-Feldgruppen, Form-Mapping und fachliche Schreibvalidierung
- `apps/sva-studio-react`: unveränderte Host-Routen-Komposition und sichere Response-Grenze

## Migration Plan

1. Den bestehenden fully-qualified Action-ID-Vertrag ohne neue Kurzform wiederherstellen und POI-/Event-Hauptdaten von Medienreferenzen entkoppeln.
2. Pro Inhaltstyp die GraphQL-Read-/Write-Feldmatrix und harte Mindestfelder aus dem generierten Vertrag festhalten.
3. Gemeinsamen additiven Detail-Result- und Abweichungsvertrag in Mainserver und Plugin SDK ergänzen, ohne bestehende Clients zu brechen.
4. POI- und Event-Mapper feldgruppenweise tolerant machen und strukturierte Logs hinzufügen.
5. Für POI und Events kontrollierte/Passthrough-Feldgruppen und sichere Read-Merge-Write-Tests etablieren.
6. Gemeinsame Editor-Warnungen und Wiederholungsaktionen ergänzen.
7. News und Generic Items migrieren; bestehende Sonderfälle wie Veröffentlichungsdaten bewusst neu bewerten.
8. FAQ, Cockpit Cards und Projects migrieren, ohne deren Typdiskriminatoren oder Lifecycle-Verträge aufzuweichen.
9. Architektur- und Plugin-Entwicklungsdokumentation aktualisieren.

Jeder Plugin-Block ist separat auslieferbar. Ein Rollback erfolgt pluginweise auf den bisherigen strikten Adapter; es werden keine Daten migriert oder gelöscht.

## Risks / Trade-offs

- Zu großzügige Toleranz könnte echte Vertragsbrüche verbergen. Gegenmaßnahme: nur Identität ist global hart, alle Abweichungen bleiben sichtbar und geloggt; Mutationseingaben bleiben strikt.
- Defaults könnten versehentlich Quelldaten überschreiben. Gegenmaßnahme: Anzeige-Defaults werden von persistierbaren Werten getrennt und abweichende Feldgruppen bleiben schreibgeschützt.
- Read-before-write erhöht Mainserver-Roundtrips und besitzt ohne Revision ein Rest-Race. Gegenmaßnahme: nur für Updates mit Erhaltungsbedarf, unmittelbar vor der Mutation und mit dokumentierter Last-Writer-Wins-Grenze; Reconciliation kann lokale Folgearbeit reparieren, aber keine überschriebenen Providerfelder wiederherstellen.
- Unterschiedliche GraphQL-Typen erlauben unterschiedliche Erhaltung. Gegenmaßnahme: typbezogene Feldgruppenverträge statt eines generischen Raw-Merge.
- Viele Warnungen können Redakteure überlasten. Gegenmaßnahme: Seitenzusammenfassung, feldnahe Details und Deduplizierung.

## Open Questions

- Keine offenen Produktentscheidungen für den vereinbarten Scope. Die exakten harten, kontrollierten, nur lesbaren und Passthrough-Feldgruppen werden vor der jeweiligen Plugin-Migration anhand des generierten GraphQL-Vertrags dokumentiert und getestet. Ergibt die Matrix keine verlustfreie Read-/Write-Symmetrie, bleibt die betreffende Mutation blockiert; dies ist kein Implementierungsdetail, das stillschweigend aufgeweicht werden darf.
