# Change: Operative Logging-Diagnostik belastbar härten

## Why

Das aktuelle serverseitige Logging liefert zwar viele strukturierte Ereignisse, aber nicht zuverlässig die Informationen, die für eine schnelle Betriebsdiagnose benötigt werden. Ein erheblicher Teil der produktiven Logs besitzt keinen Request-Kontext, erwartbare Auth-Fehler werden an mehreren Schichten als Fehler protokolliert, häufige Cache- und Erfolgsereignisse dominieren das Volumen und einzelne Metadaten umgehen die bestehende Redaction über Alias- oder Verbundfelder. Gleichzeitig werden relevante Sekundärfehler in Worker-Pfaden teilweise verworfen.

Die ausgewertete produktive Stichprobe stammt aus dem derzeit beobachteten Pfad Console nach Loki. Dieser Change behandelt das als belegten Ist-Zustand, nicht als dauerhafte Zielarchitektur. Der Logging-Vertrag bleibt transportneutral und verbessert ausschließlich Inhalt, Korrelation, Datenschutz, Schweregrade und Signalqualität. Der aktive Change `refactor-cross-cutting-runtime-guardrails` behält die Verantwortung für den normativen OTEL-Produktionspfad; produktives Browser-Error-Tracking bleibt separate Folgearbeit.

## What Changes

- umschließt jeden eingehenden Server-Request vor Sonder-, Auth-, Routing- und Mainserver-Dispatch mit einem isolierten Request-Kontext
- übernimmt eine gültige eingehende Request-ID oder erzeugt eine sichere lokale Request-ID und stellt sie allen nachgelagerten Server-Logs sowie der bestehenden Response-Propagation bereit
- übernimmt eine Trace-ID nur aus einem gültigen eingehenden oder aktiven Tracing-Kontext und erfindet ohne echtes Tracing keine Trace-ID
- normalisiert sensible Metadaten-Schlüssel vor der Redaction und verbietet vollständige URLs, Query-Strings sowie identitätshaltige Verbundschlüssel in operativen Logs
- definiert je Fehlerkette genau eine verantwortliche Grenze für das kanonische Fehlerereignis; innere Schichten klassifizieren und propagieren, statt denselben Fehler erneut zu protokollieren
- vereinheitlicht Schweregrade: unerwartete interne Fehler und 5xx-Ergebnisse als `error`, erwartbare Ablehnungen als `warn` oder niedriger und routinemäßige Lese-, Cache-, Pagination- und Health-Ereignisse als `debug` oder ohne Einzelereignis
- macht diagnostische `debug`-Ereignisse über einen zentralen, standardmäßig deaktivierten Development-Schwellwert tatsächlich zuschaltbar, ohne die Production-Vorgabe zu lockern
- macht Fehler in Worker-Nebenpfaden wie Abbruchabfragen und Fehlerstatus-Persistenz sichtbar, ohne den fachlichen Kontrollfluss zu verändern
- ergänzt fokussierte Regressionstests für parallele Request-Kontexte, Redaction, Fehler-Deduplizierung, Schweregrade und bekannte Hochvolumenpfade
- aktualisiert die arc42-Laufzeit- und Querschnittsdokumentation sowie die Logging-Architektur für den aktuellen Console-nach-Loki-Betrieb

## Impact

- Affected specs: `monitoring-client`, `routing`, `iam-core`, `plugin-operations-platform`, `sva-mainserver-integration`
- Affected code: Request-Einstieg in `apps/sva-studio-react`, Request-Kontext in `packages/server-runtime`, Redaction in `packages/monitoring-client`, Auth- und Worker-Diagnostik in `packages/auth-runtime`, Mainserver-Routen und -Clients in `packages/sva-mainserver`
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
- Affected architecture docs: `docs/architecture/logging-architecture.md` und die relevanten Request-Flow-Dokumente
- Database impact: keine Schema- oder Datenmigration
- Rollout impact: keine Änderung des Deployment- oder Log-Transportpfads; Laufzeitabnahme erfolgt gegen den tatsächlich aktiven Transport
- Sequencing: Vor Änderungen am IAM-Content-Projection-Worker muss der Change `refactor-iam-content-list-projection` integriert oder der Implementierungszweig auf dessen finalen Stand aktualisiert sein. Vor Änderungen am produktiven Logger-Bootstrap oder an denselben Logging-Architekturabschnitten muss der Stand von `refactor-cross-cutting-runtime-guardrails` integriert und dessen OTEL-Zielvertrag unverändert erhalten werden.

## Non-Goals

- keine Aktivierung, Reparatur oder Erweiterung von OTEL, Exportern, Prozessoren, Traces oder Metriken
- keine Ablösung, Festschreibung oder Umdefinition des produktiven Log-Transportpfads
- kein produktives Browser-Error-Tracking; Browser-Logging bleibt ein separater Change
- keine Änderung fachlicher Fehlercodes, HTTP-Antworten, Retry-Regeln oder Worker-Zustandsübergänge
- keine ungefilterte Protokollierung von Provider-Fehlertexten, Request-Payloads, Tokens, personenbezogenen Daten oder vollständigen URLs
- keine Verwendung eingehender oder lokal erzeugter Korrelations-IDs für Authentifizierung, Autorisierung, Idempotenz oder sonstige Security-Entscheidungen
