## Context

Der aktuelle `studio`-/`acceptance-hb`-Betrieb nutzt `quantum-cli` fuer sehr unterschiedliche Aufgaben:

- read-only Inspection (`ps`, Endpoint-Aufloesung, Runtime-Service-Sicht)
- Remote-`exec` fuer Diagnostik und DB-Abfragen
- mutierende Rollouts (`stacks update`)
- Start dedizierter Migrations- und Bootstrap-Jobs

Die letzten Runtime-Recoveries zeigen, dass vor allem die lokale CLI-Authentisierung und der Websocket-basierte `exec`-Pfad selbst zum Incident-Verstaerker werden. Gleichzeitig ist ein kompletter Ersatz der Deploy-Orchestrierung weder kurzfristig noetig noch wuenschenswert.

## Goals / Non-Goals

- Goals:
  - read-only Diagnostik von der lokalen `quantum-cli` entkoppeln
  - `quantum-cli exec` aus dem kritischen Diagnosepfad herausnehmen
  - mutierende Rollouts auf einen kleinen, deterministischen Quantum-Pfad begrenzen
  - den lokalen Operator-Hidden-State fuer Remote-Befunde deutlich reduzieren
- Non-Goals:
  - kein Vollersatz von Quantum fuer Deploys in dieser Aenderung
  - keine zweite, konkurrierende Orchestrierungsplattform aufbauen
  - keine Aenderung an Traefik-, Swarm- oder Keycloak-Topologie

## Decisions

- Decision: Read-only Remote-Inspection nutzt bevorzugt MCP oder Portainer-API.
  - Warum: Diese Pfade sind fuer Bestandsabfragen stabiler und weniger von lokalen Shell-/Auth-Effekten betroffen als die CLI.
- Decision: `quantum-cli exec` bleibt nur Fallback fuer Sonderfaelle.
  - Warum: Genau dieser Transport zeigt wiederholt Marker-, Websocket- und Retry-Probleme.
- Decision: Mutationen bleiben vorerst bei Quantum.
  - Warum: `stacks update` sowie temporaere Job-Stacks sind bereits auf Quantum ausgerichtet; ein Vollersatz wuerde kurzfristig mehr Komplexitaet als Risikoreduktion erzeugen.
- Decision: Mutierende Rollouts sollen ueber CI oder einen festen Runner-Kontext laufen.
  - Warum: Damit haengt die technische Freigabe nicht mehr an beliebigen lokalen `~/.config/quantum/env`-Zustaenden.

## Risks / Trade-offs

- Risiko: Zwei Remote-Kanaele koennen den Betriebsvertrag unklar machen.
  - Mitigation: Harte Trennung nach Rolle: read-only via API/MCP, mutierend via Quantum.
- Risiko: Einige heutige `doctor`-Checks lesen Daten, die nur ueber `exec` leicht erreichbar sind.
  - Mitigation: Diese Checks auf API-, HTTP-, Loki- oder dedizierte Job-Evidenz umstellen und `exec` nur als dokumentierten Fallback behalten.
- Risiko: Quantum bleibt fuer Deploys ein Single Point of Failure.
  - Mitigation: Fokus dieser Aenderung ist nicht Vollersatz, sondern Entlastung des Alltags- und Debugpfads.

## Migration Plan

1. Read-only Abfragen inventarisieren und nach Ersatzkanal klassifizieren.
2. `doctor`/`precheck` so umstellen, dass `quantum-cli`-Auth- oder `exec`-Fehler nicht mehr pauschal den fachlichen Befund ueberdecken.
3. Deploy- und Job-Mutationen auf den kanonischen CI-/Runner-Pfad begrenzen und lokale Mutationen als Sonderfall dokumentieren.

## Open Questions

- Welche MCP- oder API-Pfade sollen fuer Endpoint-Aufloesung im Repo kanonisch werden?
- Soll `studio` mutierende Deploys lokal komplett sperren oder nur warnen?
- Welche verbleibenden `exec`-Use-Cases rechtfertigen einen dauerhaften Fallback?
