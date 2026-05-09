# ADR-040: graphile-worker als Standard für Hintergrundprozesse

**Status:** Akzeptiert
**Entscheidungsdatum:** 2026-05-09
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** n/a
**GitHub PR:** n/a

## Kontext

SVA Studio benötigt einen belastbaren Standard für Hintergrundprozesse, langlebige Abläufe und technisch entkoppelte Nachverarbeitung. Dazu gehören insbesondere:

1. hostgeführte Folgearbeiten wie asynchrone Medienverarbeitung, Reconcile-/Sync-Läufe, Exporte, Retry-Pfade und betrieblich sichtbare Batch-Prozesse,
2. eine enge Anbindung an den bestehenden Postgres-first Architekturansatz,
3. deterministische Betriebsfähigkeit im bestehenden Node-/pnpm-/Nx- und OTEL-Setup,
4. nachvollziehbare Fehler-, Retry- und Audit-Semantik ohne zusätzliche proprietäre Betriebsgrenze.

Gleichzeitig ist absehbar, dass nicht jeder spätere Ablauf gleich bleibt. Ein Teil der heutigen und mittelfristigen Jobs ist datenbanknah, hostintern und orchestrationstechnisch überschaubar. Einzelne spätere Domänen können aber langlebigere, stärker verteilte oder signalgesteuerte Abläufe benötigen. Deshalb wird jetzt ein produktiver Standard benötigt, ohne die Architektur unnötig früh auf ein schwereres Orchestrierungsmodell festzulegen.

Als konkrete Optionen standen `graphile-worker`, Temporal und Trigger.dev im Raum.

## Entscheidung

- SVA Studio verwendet ab sofort `graphile-worker` als kanonischen Standard für neue Hintergrundprozesse und technische Host-Orchestrierung.
- Neue asynchrone Host-Abläufe sollen bevorzugt auf `graphile-worker` aufsetzen, solange ihre Anforderungen durch das Postgres-zentrierte Modell sauber abgedeckt werden.
- Temporal wird ausdrücklich nicht eingeführt, bleibt aber als spätere Option für komplexere, langlebige oder stärker verteilte Orchestrierung offen.
- Trigger.dev ist kein zulässiger Zielpfad für SVA Studio und wird nicht weiterverfolgt.
- Workflow-Definitionen bleiben Host-Verantwortung; Plugins dürfen keinen eigenen Orchestrator, keine fremde Queue-Infrastruktur und keine an der Host-Governance vorbei laufenden Hintergrundpfade etablieren.

## Begründung

### Positive Konsequenzen

- `graphile-worker` passt zum bestehenden Postgres-first Zuschnitt und vermeidet für den ersten produktiven Schritt eine zusätzliche Workflow-Control-Plane.
- Der technische Fußabdruck bleibt kleiner als bei Temporal, während Retry, Scheduling, Entkopplung und betriebliche Sichtbarkeit trotzdem strukturiert modelliert werden können.
- Die Entscheidung reduziert Einführungsaufwand für Entwicklung, Betrieb, Observability und lokale Reproduzierbarkeit.
- Host-seitige Workflow-Steuerung bleibt konsistent mit den bestehenden Architekturprinzipien: fail-closed, auditierbar, mandantenbewusst und zentral governbar.
- Die offene Temporal-Option verhindert, dass die heutige Entscheidung als endgültige Langfristbindung missverstanden wird.

### Negative Konsequenzen

- `graphile-worker` ist nicht automatisch die beste Endlösung für sehr langlebige, stark verteilte oder signalintensive Prozessketten.
- Eine spätere Migration einzelner Workflows auf Temporal kann zusätzlichen Schnitt- und Migrationsaufwand erzeugen.
- Das Team muss diszipliniert darauf achten, Workflow-Verträge fachlich sauber zu kapseln, damit eine spätere Eskalation nicht an technischem Lock-in scheitert.

## Verworfene Alternativen

### 1. Temporal sofort als Standard einführen

Nicht gewählt, weil der aktuelle Bedarf in SVA Studio dadurch übererfüllt würde. Temporal bietet starke Fähigkeiten für langlebige und komplexe Orchestrierung, bringt aber schon heute zusätzliche betriebliche und konzeptionelle Komplexität mit, die für den ersten produktiven Schnitt nicht notwendig ist.

### 2. Trigger.dev als Workflow-Plattform verwenden

Verworfen. Trigger.dev ist für SVA Studio kein zulässiger Zielpfad. Ausschlaggebend sind der unerwünschte Plattformpfad, die zusätzliche externe Produktentscheidung und die schlechtere Passung zum gewünschten host- und datenbanknahen Betriebsmodell.

### 3. Kein einheitlicher Workflow-Standard, sondern ad-hoc Jobs je Modul

Verworfen, weil dies Retry-Logik, Fehlersemantik, Observability, Ownership und Betriebsregeln fragmentieren würde. Gerade bei Medien-, Sync- und Governance-Folgearbeiten braucht Studio einen einheitlichen Host-Standard.

## Konsequenzen für Umsetzung und Betrieb

- Neue Hintergrundprozesse sollen fachlich so modelliert werden, dass sie über explizite Host-Ports oder Domänenservices gestartet werden und `graphile-worker` nur die technische Orchestrierung übernimmt.
- Workflow-Payloads, Statusübergänge und Fehlerklassen müssen weiter mit den bestehenden Audit-, Logging- und Diagnostikregeln kompatibel bleiben.
- Mandantenbezug, Actor-Kontext, Korrelation und Idempotenz bleiben explizite Anforderungen an jeden produktiven Workflow.
- Wenn ein neuer Ablauf Anforderungen wie lang laufende Signalinteraktion, komplexe Child-Workflow-Topologien oder stark systemübergreifende Orchestrierung aufweist, muss vor Umsetzung geprüft werden, ob `graphile-worker` noch angemessen ist oder ein gezielter Temporal-Change erforderlich wird.
- Eine spätere Temporal-Einführung soll als bewusste Folgeentscheidung erfolgen und nicht als stiller Parallelpfad neben `graphile-worker`.

## Verwandte ADRs

- [ADR-029](ADR-029-goose-als-oss-standard-fuer-sql-migrationen.md)
- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-039](ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)
