## ADDED Requirements

### Requirement: Getrennter Kanal fuer read-only Remote-Diagnostik

Das System SHALL read-only Remote-Diagnostik fuer Swarm-Stacks ueber einen stabilen Kanal bereitstellen, der nicht vom lokalen `quantum-cli`-Kontext abhaengt.

#### Scenario: Read-only Statusabfrage ohne lokale Quantum-CLI

- **WHEN** ein Operator `status`, `doctor` oder `precheck` fuer ein Remote-Profil ausfuehrt
- **THEN** werden Stack-, Service-, Netzwerk- oder Live-Spec-Abfragen bevorzugt ueber MCP oder Portainer-API aufgeloest
- **AND** ein lokaler `quantum-cli`-Auth-Fehler blockiert diese read-only Diagnostik nicht als primaeren Kanal
- **AND** der Report macht transparent, welcher Kanal fuer den Befund verwendet wurde

### Requirement: `quantum-cli exec` ist nur Fallback fuer Diagnostik

Das System SHALL `quantum-cli exec` im Diagnosepfad nur noch als expliziten Fallback behandeln.

#### Scenario: Diagnosepfad vermeidet Websocket-`exec` als Standard

- **WHEN** `doctor` oder `precheck` einen Remote-Befund fuer Runtime-Flags, Datenbank- oder Service-Zustand erzeugt
- **THEN** nutzt der Standardpfad keinen Websocket-basierten `quantum-cli exec`, sofern ein API-, HTTP-, Loki- oder Job-basierter Nachweis verfuegbar ist
- **AND** ein `exec`-Fallback wird im Report klar als Fallback gekennzeichnet
- **AND** ein Fallback-Fehler ueberschreibt den bereits vorhandenen fachlichen Gesundheitsbefund nicht unscharf

### Requirement: Quantum bleibt auf mutierende Rollout-Pfade begrenzt

Das System SHALL `quantum-cli` im Regelbetrieb auf mutierende Rollout- und Job-Pfade begrenzen.

#### Scenario: Mutierender Rollout verwendet weiterhin Quantum

- **WHEN** ein Operator einen Remote-Deploy oder einen dedizierten Migrations- oder Bootstrap-Job startet
- **THEN** darf der kanonische Pfad weiterhin `quantum-cli stacks update` oder Quantum-basierte Temp-Job-Stacks verwenden
- **AND** dieser mutierende Pfad bleibt klar von read-only Diagnostik getrennt
- **AND** die Dokumentation bezeichnet Quantum fuer diese Faelle als verbleibenden Orchestrierungsweg statt als universellen Betriebszugang

### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende Remote-Operationen in einem deterministischen Operator-Kontext ausfuehren.

#### Scenario: Lokaler Shell-Hidden-State bestimmt den Rollout nicht mehr

- **WHEN** ein mutierender Rollout fuer `studio` oder `acceptance-hb` ausgefuehrt wird
- **THEN** erfolgt der bevorzugte Pfad ueber CI oder einen festen Runner-Kontext mit bekanntem Quantum-Zugang
- **AND** beliebige lokale Shell-Overlays wie `~/.config/quantum/env` gelten nicht als primaere Quelle der technischen Freigabe
- **AND** lokale Mutationen bleiben dokumentierter Sonder- oder Notfallpfad
