## ADDED Requirements

### Requirement: Staging-Promote benötigt erfolgreiche Main-E2E-Evidenz

Das System SHALL einen regulären Staging-Promote vor jeder Remote-Mutation fail-closed blockieren, solange für den exakten `change_head` keine erfolgreiche kanonische Main-E2E-Evidenz vorliegt. Der E2E-Nachweis des Quellstands und die bestehende OCI-Revisionsprüfung des Ziel-Digests SHALL getrennte, gemeinsam erforderliche Verträge bleiben.

#### Scenario: Exakte Main-E2E-Evidenz ist erfolgreich

- **GIVEN** der kanonische App-E2E-Workflow wurde durch einen Push auf `main` ausgelöst
- **AND** sein terminal erfolgreicher Run weist exakt den angeforderten `change_head` aus
- **WHEN** ein regulärer Promote dieses Quellstands nach Staging vorbereitet wird
- **THEN** akzeptiert der Preflight die Main-E2E-Evidenz
- **AND** prüft er zusätzlich unverändert, dass die OCI-Revision des Ziel-Digests demselben `change_head` entspricht
- **AND** darf der Workflow erst nach beiden Nachweisen mit seinen weiteren Preflight- und Mutationsphasen fortfahren

#### Scenario: E2E-Evidenz fehlt oder ist nicht erfolgreich

- **WHEN** für `change_head` kein kanonischer Main-E2E-Lauf existiert oder dessen Ergebnis ausstehend, rot, abgebrochen beziehungsweise nicht auswertbar ist
- **THEN** stoppt der reguläre Staging-Promote vor Backup, Migration, Bootstrap und App-Deployment
- **AND** benennt die redigierte Diagnose Head-SHA, Evidenzstatus und nächste Aktion
- **AND** wird ein fehlender Nachweis weder als Warnung noch als impliziter Erfolg behandelt

#### Scenario: Evidenz stammt aus einem anderen Ausführungskontext

- **WHEN** ein erfolgreicher E2E-Lauf manuell, zeitgesteuert, in einem Pull Request, auf einem anderen Branch oder für ein anderes Head-SHA ausgeführt wurde
- **THEN** lehnt der reguläre Staging-Preflight ihn als Release-Evidenz ab
- **AND** startet keine Remote-Mutation

#### Scenario: Production befördert den Staging-verifizierten Digest

- **WHEN** Production denselben zuvor erfolgreich in Staging verifizierten Digest übernimmt
- **THEN** bleibt die bestehende Staging-Parität der autoritative vorgelagerte Nachweis
- **AND** muss Production den Main-E2E-Lauf nicht unabhängig ein zweites Mal ausführen
