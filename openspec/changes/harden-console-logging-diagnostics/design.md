# Design: Operative Logging-Diagnostik belastbar härten

## Context

Die produktive Stichprobe des Studio-Services zeigt ein grundsätzlich nutzbares strukturiertes Logging, aber vier operative Schwächen:

- Request-Korrelation beginnt erst nach mehreren Sonder- und Auth-Dispatchern und fehlt deshalb bei einem großen Teil der Ereignisse.
- Derselbe erwartbare Fehler wird teilweise in einer inneren und einer äußeren Schicht erneut als `error` protokolliert.
- Routinemäßige Cache-Treffer, GraphQL-Erfolge, Konfigurationszugriffe und Pagination-Ereignisse dominieren das Logvolumen.
- Die Redaction schützt bekannte exakte Schlüssel, erfasst aber nicht zuverlässig Alias-Schreibweisen oder sensible IDs innerhalb zusammengesetzter Werte.

Zusätzlich verwerfen einzelne Worker-Nebenpfade Fehler absichtlich, um den Hauptablauf fortzusetzen. Das Kontrollflussverhalten ist sinnvoll, die fehlende Diagnose jedoch nicht.

Die produktive Ausgangsstichprobe wurde im beobachteten Betriebsmodus `console_to_loki` erhoben. Dieser Modus ist für den Vorher-Nachher-Vergleich maßgeblich, aber keine neue normative Zielarchitektur. Das Design bleibt transportneutral, führt weder OTEL-Abhängigkeiten noch einen konkurrierenden Log-Transport ein und überschreibt insbesondere nicht den OTEL-Zielvertrag des aktiven Changes `refactor-cross-cutting-runtime-guardrails`.

## Goals / Non-Goals

- Goals:
  - lückenlose request-lokale Korrelation aller synchronen Server-Dispatcher über eine verpflichtende Request-ID
  - semantisch korrekte Trace-Korrelation nur bei gültigem eingehenden oder aktivem Tracing-Kontext
  - datensparsame und aliasfeste Redaction strukturierter Log-Metadaten
  - genau ein kanonisches Fehlerereignis je Fehlerkette und verantwortlicher Grenze
  - konsistente Schweregrade mit deutlich besserem Signal-Rausch-Verhältnis
  - beobachtbare Sekundärfehler in Worker-Pfaden ohne veränderte Fachsemantik
  - Regressionstests für die konkreten Klassen der produktiven Befunde
- Non-Goals:
  - OTEL-Aktivierung, OTEL-Attributweitergabe, Trace-Export oder Metrik-Gates
  - Browser-Fehlererfassung in Production
  - zentrale Log-Sampling-Plattform oder neue externe Logging-Abhängigkeit
  - Änderung fachlicher Antworten, Berechtigungen, Retry-Verträge oder Zustandsmaschinen

## Decisions

### Der Request-Kontext beginnt an der äußersten Servergrenze

Der Host erzeugt oder validiert den Korrelationskontext unmittelbar nach Eingang eines Requests und vor jeder fachlichen Verzweigung. Sonderrouten, Auth-Routen, Mainserver-Routen und reguläres Studio-Routing laufen innerhalb derselben `AsyncLocalStorage`-basierten Request-Grenze. Der Kontext wird nicht von optionalen Diagnose- oder OTEL-Schaltern abhängig gemacht.

Eine gültige eingehende Request-ID wird als untrusted Korrelationswert übernommen; fehlt sie oder ist sie ungültig, erzeugt der Host eine sichere lokale Request-ID. Sie dient ausschließlich der Diagnose und darf nie Authentifizierung, Autorisierung, Idempotenz oder andere Security-Entscheidungen beeinflussen. Eine Trace-ID wird nur aus einem gültigen eingehenden `traceparent`-/Trace-Kontext oder einem tatsächlich aktiven Tracing-Kontext übernommen. Ohne echtes Tracing wird keine Trace-ID erfunden.

Parallele Requests dürfen ihre Kontexte nicht gegenseitig sehen. Nach einer Response weiterlaufende oder fire-and-forget gestartete Arbeit darf den Request-Kontext nur behalten, wenn sie fachlich ausdrücklich Teil derselben Request-Kette ist. Worker-Bootstrap und bewusst unabhängige Hintergrundarbeit werden außerhalb beziehungsweise explizit losgelöst von der HTTP-Request-Grenze gestartet. Sie verwenden eine vorhandene Job-, Execution- oder vergleichbare Ausführungskorrelation und erfinden keine HTTP-Request-ID.

### Sichere Metadaten werden über Schlüssel und Wertform begrenzt

Die zentrale Redaction normalisiert Schlüssel mindestens hinsichtlich Groß-/Kleinschreibung sowie üblicher Trennzeichen. Dadurch werden semantisch gleiche Identitätsfelder wie `actorId`, `actor_id` und `actor-id` gleich behandelt. Die Schutzliste umfasst die im Studio verwendeten Aliasnamen für Account-, Actor-, Subject-, User-, Session- und Credential-Identitäten.

Zusätzlich gelten folgende Wertverträge:

- Routen werden als stabile Pfade oder Templates ohne Query-String protokolliert.
- Provider-Fehler werden über stabile interne Codes, Status und Retry-Klasse beschrieben; freie externe Fehlerbeschreibungen werden nicht übernommen.
- Identitäten werden nicht in zusammengesetzte Schlüssel oder Labels eingebettet. Ein Projection-Kontext enthält getrennte, jeweils zulässige beziehungsweise redigierte Felder statt eines `projection_scope_key` mit Account- oder Subject-ID.
- Request-Payloads, Header, Tokens und vollständige URLs bleiben ausgeschlossen.
- Request-, Trace-, Job- und Execution-IDs bleiben ausschließlich Felder im Log-Body und werden nie zu frei skalierenden Loki- oder OTEL-Labels.

Die Redaction bleibt Defense-in-Depth. Aufrufer müssen weiterhin nur notwendige, explizit sichere Felder übergeben.

### Jede Fehlerkette besitzt eine kanonische Logging-Grenze

Die Schicht, die das operative Ergebnis kennt und verantwortet, emittiert genau ein kanonisches Fehlerereignis. Innere Schichten dürfen Fehler klassifizieren, mit sicheren strukturierten Metadaten anreichern und propagieren, protokollieren denselben Fehler aber nicht zusätzlich als Fehlerereignis.

Für die betroffenen Pfade gilt folgende Ownership-Matrix:

- Der Server-Entry besitzt ausschließlich unbehandelte Transport-/Dispatchfehler, die vor oder außerhalb einer fachlichen Routengrenze enden.
- Auth-Konfiguration und Tenant-Auflösung werden an der äußeren Auth-Routengrenze genau einmal mit stabilem Fehlercode protokolliert.
- Mainserver-Routen protokollieren das abschließende HTTP-/Domänenergebnis; tiefe Clients protokollieren routinemäßige Erfolge nicht auf `info`.
- Worker protokollieren den finalen Jobausgang einmal. Fehler eines unabhängigen Nebenpfads erhalten ein eigenes, klar als sekundär klassifiziertes Ereignis, weil sie nicht dieselbe Fehlerkette darstellen.

Begrenzte Retry-, Circuit-Breaker-, Recovery- und Nebenpfadereignisse sind keine Duplikate des kanonischen Endereignisses, wenn sie einen eigenen stabilen Event-Code, eine eigene Operation oder einen eigenen Zustandsübergang beschreiben. Ein Duplikat liegt vor, wenn innerhalb derselben Request- oder Ausführungskorrelation dieselbe Operation, derselbe stabile Fehlercode und dasselbe abschließende Ergebnis mehrfach als operatives Fehlerereignis ausgegeben werden. Die Caller-Inventur validiert diese Matrix vor der ersten Produktionscode-Änderung; neue Ownership-Entscheidungen dürfen nicht still während der Umsetzung entstehen.

### Schweregrade folgen der operativen Bedeutung

| Ergebnis                                                | Standard-Level                   | Beispiele                                                                               |
| ------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| unerwarteter interner Fehler oder 5xx-Ergebnis          | `error`                          | unbehandelter Provider-/Persistenzfehler, interner Routingfehler                        |
| erwartbare Ablehnung mit möglichem Betriebsbedarf       | `warn`                           | ungültige Session, fehlende Tenant-Zuordnung, erwartbarer 4xx-Vertrag                   |
| fachlich relevante Zustandsänderung                     | `info`                           | Job gestartet/beendet, Mutation erfolgreich, sicherheitsrelevante administrative Aktion |
| routinemäßiger erfolgreicher Read oder interner Schritt | `debug` oder kein Einzelereignis | Cache-Treffer, GraphQL-Leseerfolg, Pagination, Konfigurations-Read, Health-Check        |

Ein Fehler wird nicht allein deshalb auf `warn` herabgestuft, weil er abgefangen wurde. Entscheidend sind erwartete Fachsemantik und abschließendes Ergebnis. Freie Fehlermeldungen bleiben optional und dürfen nur nach sicherer Klassifizierung beziehungsweise Sanitization aufgenommen werden.

`debug` ist ein echter, zentral konfigurierter Logger-Schwellwert und nicht nur eine andere Methodenwahl am Callsite. Development bleibt standardmäßig bei `info`; ein expliziter Development-Diagnosemodus kann `debug` aktivieren. Production bleibt standardmäßig bei mindestens `info`; dieser Change führt keinen dauerhaften Production-Debug-Modus ein. Redaction und Safe-Field-Regeln gelten unabhängig vom Schwellwert identisch.

### Sekundärfehler bleiben sichtbar, aber begrenzt

Fehlschläge bei Abbruchabfragen, Lease-/Statuspflege oder Persistenz eines Fehlerzustands dürfen den bestehenden Hauptablauf weiterhin nicht automatisch abbrechen. Sie erzeugen jedoch ein strukturiertes Ereignis mit Job-/Execution-ID, Operation, stabilem Fehlercode und Folgebehandlung.

Pollende Nebenpfade deduplizieren oder begrenzen wiederholte identische Warnungen pro Ausführung und Zustand. Ein Recovery kann einmal protokolliert werden, wenn dies für die Diagnose notwendig ist. Es werden keine unbeschränkten Warnungen pro Poll-Zyklus erzeugt.

### Hochvolumenpfade werden durch semantische Tests abgesichert

Der Change führt keine fragile globale Mengenobergrenze für alle Logs ein. Stattdessen sichern Tests die bekannten Ursachen ab:

- Cache-Treffer und erfolgreiche Leseoperationen emittieren kein `info`-Ereignis pro Zugriff.
- Eine einzelne Fehlerkette erzeugt genau ein kanonisches `error`- beziehungsweise `warn`-Ereignis.
- Health-, Pagination- und Konfigurationszugriffe bleiben unterhalb von `info`, sofern keine Zustandsänderung oder Abweichung vorliegt.
- Mutation- und Jobabschlussereignisse bleiben als fachlich relevante `info`-Signale erhalten.

Nach dem Rollout wird dieselbe Abfrageklasse wie in der Ausgangsstichprobe gegen den tatsächlich aktiven Log-Transport verwendet, um Request-Korrelation, Level-Verteilung, Top-Messages und sensible Feldnamen zu vergleichen. Diese Prüfung ist Laufzeitnachweis, kein Ersatz für Tests. Für die inventarisierten Pfade gelten folgende Abnahmekriterien:

- Jedes operative Ereignis innerhalb der festgelegten HTTP-Request-Grenzen enthält eine gültige `request_id`; Bootstrap- und unabhängige Hintergrundereignisse sind explizit ausgenommen.
- Eine Trace-ID fehlt zulässig, wenn kein gültiger eingehender oder aktiver Tracing-Kontext existiert; vorhandene Trace-IDs entsprechen dem validierten Format.
- Die repräsentativen Auth-, Mainserver- und Worker-Fehlerketten erzeugen je Operation, stabilem Fehlercode und Endergebnis genau ein kanonisches Endereignis.
- Kein inventarisiertes Cache-, Read-, Pagination-, Konfigurations- oder Health-Erfolgsereignis erscheint pro Zugriff auf `info`.
- Die inventarisierten Mutation-, Audit- und Jobabschlussereignisse bleiben erhalten.
- Canary-Tests finden keinen unredigierten sensiblen Wert in direkten, Alias-, verschachtelten, URL- oder Verbundformen; die Laufzeitprüfung sucht ergänzend nach bekannten verbotenen Feldformen, ohne sensible Werte zu exportieren.

## Runtime Flow

```text
HTTP request
  -> request-ID validation/generation
  -> optional valid trace-context extraction
  -> request context boundary
  -> special | auth | mainserver | studio dispatcher
  -> inner layers classify and propagate
  -> owning boundary emits one outcome event
  -> centralized redaction
  -> current server console transport
  -> Loki

background job
  -> detached job/execution context without invented HTTP request ID
  -> primary work + bounded secondary diagnostics
  -> one final job outcome
  -> centralized redaction
  -> current server console transport
  -> Loki
```

## Package Boundaries

- `packages/server-runtime`: request-lokaler Kontext, zentraler Logger-Schwellwert und unveränderte fachliche Logger-API
- `packages/monitoring-client`: zentrale Schlüssel-Normalisierung und Redaction ohne Transportänderung
- `apps/sva-studio-react`: äußerste Request-Grenze vor allen Dispatchern
- `packages/auth-runtime`: Auth-Fehlerownership, sichere Provider-Klassifizierung und Worker-Nebendiagnostik
- `packages/sva-mainserver`: Level-Matrix und Entfernung routinemäßiger Erfolgsereignisse auf `info`

Die Kernregeln werden nicht als parallele Logger-Abstraktion in den Fachpackages dupliziert. Fachpackages liefern ausschließlich sichere strukturierte Felder und wählen das semantische Ereignis.

## Security and Privacy

- Tests verwenden Canary-Werte für alle Aliasformen sensibler IDs und prüfen, dass diese weder direkt noch innerhalb zusammengesetzter Felder erscheinen.
- URL-Tests enthalten Query-Parameter mit Token-, E-Mail- und ID-ähnlichen Werten und erwarten ausschließlich den sicheren Pfad beziehungsweise das Route-Template.
- Provider-Fehlertexte werden als nicht vertrauenswürdige Eingabe behandelt.
- Die Zahl redigierter Felder darf diagnostisch gezählt werden; Originalwerte und Originalschlüsselwerte dürfen dabei nicht erneut protokolliert werden.

## Testing Strategy

- Unit-Tests für Schlüssel-Normalisierung, Alias-Redaction, verschachtelte Metadaten und sichere URL-/Routenrepräsentation
- Nebenläufigkeitstests mit überlappenden Requests und unterschiedlichen Korrelations-IDs
- Lebensdauertests für nach der Response weiterlaufende Arbeit sowie explizit losgelösten Worker-Bootstrap
- Vertragstests für Sonder-, Auth-, Mainserver- und reguläre Routen innerhalb des Request-Kontexts
- Vertragstests für verpflichtende Request-ID, optionale echte Trace-ID und die rein diagnostische, untrusted Semantik eingehender IDs
- Logger-Spies für genau ein kanonisches Ereignis je repräsentativer Fehlerkette
- tabellarische Tests der Level-Matrix für erwartbare 4xx-, unerwartete 5xx-, Read-, Mutation-, Cache- und Worker-Ergebnisse
- Logger-Transporttests, die `debug` im expliziten Development-Diagnosemodus sichtbar und bei normalem `info`-Schwellwert unterdrückt zeigen
- Worker-Tests für fehlgeschlagene Abbruchabfrage, Fehlerstatus-Persistenz, Deduplizierung und unveränderten Hauptkontrollfluss
- Server-Runtime-, Type- und fokussierte Nx-Unit-Gates nach jedem abgeschlossenen Änderungsblock

## Migration and Rollback

1. Delta-Spezifikationen, Ownership-Inventur und Transport-Sequencing widerspruchsfrei abschließen.
2. Request-Kontext einschließlich Background-Detachment als ersten unabhängigen Delivery-Slice einführen und fokussiert absichern.
3. Redaction und sichere Metadaten als zweiten unabhängigen Slice härten.
4. Auth- und Mainserver-Fehlerownership sowie Level-Matrix domänenweise umstellen.
5. Worker-Nebendiagnostik als eigenen letzten Produktionscode-Slice umsetzen.
6. Dokumentation und Changelog pro ausgeliefertem Vertrag aktualisieren.
7. Vor dem initialen Push eines neuen oder wesentlich erweiterten Slices die dafür relevanten lokalen Gates ausführen; vor dem ersten Push des vollständigen cross-cutting Scopes bevorzugt `pnpm test:pr` ausführen.
8. Nach Deployment die produktive Verteilung gegen Ausgangsstichprobe und Abnahmekriterien vergleichen; bei fehlender Request-Korrelation, verlorenen kanonischen Ereignissen oder unredigierten sensiblen Werten den betroffenen Slice zurückrollen.

Die Änderungen benötigen keine Datenmigration. Ein Rollback erfolgt paketweise auf die vorherige Ereigniswahl; der äußere Request-Kontext und die verschärfte Redaction sollten wegen ihres Sicherheits- und Diagnosegewinns unabhängig rückrollbar bleiben.

## Risks / Trade-offs

- Weniger `info`-Ereignisse können Ad-hoc-Debugging erschweren. Gegenmaßnahme: diagnostisch relevante strukturierte `debug`-Ereignisse bleiben im aktivierten Entwicklungsmodus verfügbar.
- Eine rein synthetische Trace-ID könnte einen nicht existierenden Trace vortäuschen. Gegenmaßnahme: nur Request-IDs werden lokal erzeugt; Trace-IDs benötigen echten validierten Trace-Kontext.
- Eine zu breite Schlüsselnormalisierung könnte harmlose Felder redigieren. Gegenmaßnahme: semantische Aliasliste und positive Vertragstests für weiterhin zulässige technische IDs.
- Eine falsch gewählte kanonische Grenze könnte Kontext verlieren. Gegenmaßnahme: innere Schichten propagieren stabile Fehlercodes und sichere Kontextfelder typisiert bis zur verantwortlichen Grenze.
- Sekundärfehler können bei Polling neues Rauschen erzeugen. Gegenmaßnahme: Deduplizierung beziehungsweise Begrenzung pro Ausführung und Fehlerzustand.
- Eine zu weit außen liegende `AsyncLocalStorage`-Grenze könnte Worker- oder fire-and-forget-Arbeit an einen abgeschlossenen Request binden. Gegenmaßnahme: explizite Detachment-Grenze und Lebensdauertests.
- Der parallele Content-Projection-Refactor kann dieselben Worker-Dateien berühren. Gegenmaßnahme: Integration beziehungsweise Rebase vor diesem Implementierungsblock und keine parallele Änderung derselben Log-Kontexte.
- Der aktive Runtime-Guardrails-Change kann denselben Logger-Bootstrap und dieselben Architekturdokumente berühren. Gegenmaßnahme: transportneutraler Vertrag, explizites Sequencing und Erhalt des OTEL-Zielvertrags.

## Open Questions

- Keine offenen Produkt- oder Architekturentscheidungen für den vereinbarten Scope. Console nach Loki ist ausschließlich beobachteter Ist-Transport, der Vertrag bleibt transportneutral, nur Request-IDs werden lokal erzeugt und unabhängige Hintergrundarbeit wird vom HTTP-Kontext gelöst. Konkrete Level-Abweichungen müssen anhand der hier definierten Ergebnissemantik begründet und als Vertragstest festgehalten werden.
