## Context

Mit `plugin.moduleIam` existiert bereits ein deklarativer Vertrag fuer modulbezogene Permissions und Systemrollen. Der aktuelle Runtime-Pfad in `auth-runtime` repliziert diese Information jedoch noch einmal in einer lokalen `Map`. Dadurch entsteht eine fachliche Driftquelle zwischen:

- Plugin-Definitionen
- Build-Time-Host-Registry
- Runtime-Seeding und Instanzdiagnostik

Die Runtime darf fuer diese Vertraege nicht von React-Komponenten oder UI-spezifischen Paketkanten abhaengen. Deshalb reicht ein direkter Import produktiver Plugin-Pakete in `auth-runtime` nicht als saubere Loesung.

## Goals / Non-Goals

- Goals:
  - eine einzige kanonische Runtime-Quelle fuer Modul-IAM-Vertraege schaffen
  - serverseitige Nutzung ohne UI-/React-Abhaengigkeit ermoeglichen
  - Drift zwischen Routing, Modulverwaltung, IAM-Seeding und Runtime-Access-Control verhindern
  - kuenftige Plugin-Aenderungen mit minimaler Verdrahtung in Runtime und Provisioning wirksam machen
- Non-Goals:
  - kein vollstaendiger Umbau des gesamten Plugin-Systems
  - keine neue dynamische Plugin-Ladeinfrastruktur zur Laufzeit
  - keine fachliche Aenderung an Modulzuweisungs-, Entzugs- oder Fail-Closed-Semantik

## Decisions

- Decision: Die Runtime konsumiert keine manuell gepflegte Modul-Registry mehr.
  - Why: Dieselbe fachliche Information darf nicht parallel in Plugin-Paketen und in `auth-runtime` modelliert werden.

- Decision: Es wird ein framework-agnostischer Contract-Edge eingefuehrt, der nur die fuer Runtime und Provisioning benoetigten Modul-IAM-Daten bereitstellt.
  - Why: `auth-runtime` braucht serverseitig sichere, ESM-kompatible Imports ohne React- oder UI-Kopplung.

- Decision: Build-Time-Host-Registry und Runtime-Registry muessen aus derselben Vertragsfamilie erzeugt werden.
  - Why: Nur so bleiben UI, Routing, IAM-Seeding und Diagnose deterministisch konsistent.

## Alternatives considered

- Direkter Import der Plugin-Pakete in `auth-runtime`
  - Verworfen, weil die Plugin-Pakete heute React- und Host-Naehe mitbringen und damit unnoetige Runtime-Kopplung erzeugen.

- Manuelle Map in `auth-runtime` beibehalten und nur durch Tests absichern
  - Verworfen, weil Tests die Doppelquelle nur beobachten, aber nicht beseitigen.

- Build-Time-Registry serialisieren und serverseitig wieder einlesen
  - Moeglich, aber nur sinnvoll, wenn der erzeugte Artefaktpfad stabil, build-unabhaengig und fuer Node-ESM sauber konsumierbar ist. Das ist eine moegliche technische Auspraegung, aber nicht die fachliche Kernentscheidung.

## Risks / Trade-offs

- Neue Paketkante oder neues gemeinsames Contract-Modul kann Folge-PRs im PR-338-Split betreffen.
  - Mitigation: Den Umbau als separaten Folge-PR nach der akuten Stabilisierung umsetzen.

- Ein zu UI-naher Contract-Edge wuerde die aktuelle Architekturgrenze verschlechtern.
  - Mitigation: Nur reine Vertragsdaten und Helper in den gemeinsamen Edge aufnehmen, keine React-Komponenten oder Host-Bindings.

- Bestehende Tests koennen implizit auf die manuelle Runtime-Registry zugeschnitten sein.
  - Mitigation: Paritaets-Tests auf Contract-Ebene und gezielte Runtime-Regressionstests ergaenzen.

## Migration Plan

1. Gemeinsamen Runtime-Contract-Edge definieren
2. `auth-runtime` und `instance-registry` auf diesen Edge umstellen
3. Manuelle Runtime-Registry entfernen
4. Paritaets- und Drift-Tests ergaenzen
5. Architektur- und Betriebsdoku aktualisieren

## Open Questions

- Liegt der gemeinsame Contract-Edge sinnvoller in `plugin-sdk` oder in einem neuen dedizierten Workspace-Package?
- Soll die Runtime den Vertrag direkt aus Quellmodulen beziehen oder aus einem erzeugten build-/artifact-stabilen Export?
