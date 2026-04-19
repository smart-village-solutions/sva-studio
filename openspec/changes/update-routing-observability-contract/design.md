## Context

`@sva/routing` bündelt UI-Routen, Guards, Plugin-Routen und serverseitige Auth-/IAM-Dispatch-Pfade. Der operative Logging-Vertrag ist heute asymmetrisch: `auth.routes.server.ts` besitzt strukturierte Error-Logs, andere routing-relevante Entscheidungen sind dagegen entweder unsichtbar oder nur implizit aus Folgeeffekten ableitbar.

Das führt zu drei Problemen:

1. Zugriffs- und Redirect-Entscheidungen sind schwer von Business- oder Auth-Fehlern abzugrenzen.
2. Plugin- oder Routing-Konfigurationsprobleme werden erst spät oder indirekt sichtbar.
3. Es fehlt eine definierte Grenze zwischen notwendiger Diagnose und ungewolltem Event-Rauschen.

## Goals / Non-Goals

- Goals:
  - Einen einheitlichen Routing-Observability-Vertrag für Server-, Guard-, Plugin- und Search-Pfade definieren.
  - Strukturierte, privacy-sichere Routing-Logs mit stabilen Pflichtfeldern etablieren.
  - Browser- und Server-Kontext sauber trennen, ohne Produktions-Browser-Logging als Pflicht einzuführen.
  - Bestehende Auth-Error-Observability in denselben Vertrag integrieren.
- Non-Goals:
  - Vollständiges Clickstream- oder Analytics-Tracking aller Navigationen.
  - Persistente Produktions-Telemetrie aus beliebigem Browser-Code ohne expliziten App-Vertrag.
  - Neue Loki-/OTEL-Pipeline oder Änderungen an der globalen Logger-Infrastruktur außerhalb des Routing-Bedarfs.

## Decisions

### Decision: Routing nutzt einen expliziten Diagnostics-Hook statt verstreuter Logger-Zugriffe

Das Routing-Package erhält einen kleinen, typisierten Diagnostics-Vertrag. Routing-nahe Stellen emittieren darüber strukturierte Ereignisse; die konkrete Umsetzung kann serverseitig an den SDK Logger gebunden sein oder clientseitig als No-op bzw. Development-Diagnostik implementiert werden.

Begründung:
- trennt framework-agnostische Routing-Logik von konkreter Logger-Implementierung
- vermeidet direkte `console.*`-Nutzung im Paket
- erlaubt selektives Logging in Browser-Kontexten ohne Produktionspflicht

### Decision: Nur entscheidungs- und anomaliebezogene Routing-Ereignisse werden geloggt

Geloggt werden nur Ereignisse mit betrieblichem Diagnosewert:
- unbehandelte Handler-Fehler
- Method-not-allowed, Mapping-Drift und vergleichbare Dispatch-Anomalien
- Guard-Denials und daraus resultierende Redirect-Gründe
- unbekannte oder nicht unterstützte Plugin-Guard-Mappings
- relevante Search-Param-Korrekturen mit Einfluss auf Routing-/Guard-Verhalten

Normale erfolgreiche Navigationen, reine Factory-Erzeugung und erwartbares Standard-Routing ohne Diagnosewert werden nicht geloggt.

Begründung:
- verhindert Log-Rauschen
- schützt Performance und Kosten
- fokussiert Logs auf Support- und Betriebsfälle

### Decision: Routing-Logs verwenden einen stabilen Safe-Feldsatz

Der Vertrag definiert einen minimalen, wiederverwendbaren Feldsatz:
- `component`
- `event`
- `route`
- `method` falls vorhanden
- `reason`
- `workspace_id` best effort
- `request_id` best effort
- `trace_id` best effort
- typsichere Zusatzfelder je Ereigniskategorie

Nicht erlaubt sind rohe Token-URLs, unredaktierte Search-Params mit Geheimnissen, Stack-Traces in regulären Routing-Ereignissen und beliebige High-Cardinality-Labels.

### Decision: Browser-Routing bleibt in Produktion opt-in bzw. no-op

Der OpenSpec-Vertrag verlangt keine globale Produktions-Telemetrie aus Browser-Routing. Für clientseitige Routing-Entscheidungen muss das Paket so gestaltet sein, dass:
- serverseitig strukturierte Logs möglich sind
- im Browser Development-Diagnostik möglich ist
- in Produktions-Browsern standardmäßig kein unkontrolliertes Logging entsteht

Begründung:
- passt zur bestehenden Logging-Architektur
- verhindert schleichendes Analytics-/Tracking-Verhalten im Routing

## Risks / Trade-offs

- Mehr Observability im Routing erhöht die API-Oberfläche des Pakets.
  - Mitigation: kleines, fokussiertes Diagnostics-Interface mit klaren Default-Implementierungen
- Guard-Logging kann bei falscher Granularität zu Noise führen.
  - Mitigation: nur Denials/Anomalien loggen, keine Erfolgsnavigationen
- Search-Param-Logging kann leicht Datenschutzprobleme erzeugen.
  - Mitigation: nur sanitierte Korrekturinformationen und keine Rohwerte mit Geheimnissen loggen

## Migration Plan

1. Spec und Design für den Routing-Observability-Vertrag freigeben.
2. Diagnostics-Vertrag in `@sva/routing` einführen.
3. Zuerst serverseitige Dispatch-Pfade und bestehende Error-Boundary harmonisieren.
4. Anschließend Guards, Plugin-Routen und Search-Normalisierung anbinden.
5. Tests und Dokumentation gemeinsam mit der Implementierung aktualisieren.

## Open Questions

- Soll für Guard-Denials ein dedizierter `reason`-Katalog verbindlich werden oder reicht ein freier, aber dokumentierter Satz?
- Sollen relevante Search-Korrekturen nur `debug`/`info`-fähig sein oder ausschließlich als `warn` bei auffälligen Eingaben erscheinen?
