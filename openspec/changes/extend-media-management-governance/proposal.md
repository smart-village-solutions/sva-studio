# Change: Offene Governance-Funktionen des Medienmanagements ergänzen

## Why

Das bestehende Medienmanagement deckt den produktiven Basispfad bereits ab: redaktionelle Standardmetadaten einschließlich Copyright und Lizenz, serverseitige Upload-Validierung, synchrone Bildvarianten sowie harte instanzbezogene Speicherkontingente sind vorhanden. Offen bleiben klar abgrenzbare Funktionen für redaktionelle Organisation, Mehrsprachigkeit, sicheren Asset-Austausch und präventiven Betriebsschutz.

Dieser Change bündelt nur diese weiterhin sinnvollen Lücken. Er führt weder bereits vorhandene Basisfunktionen erneut ein noch übernimmt er Queue-, Worker- oder Retry-Verantwortung aus `add-media-async-processing`.

## What Changes

- Ergänzt mehrsprachige globale Medienmetadaten mit deterministischem Fallback
- Ergänzt Ordner, Tags und kontrollierte Kategorien für Organisation, Suche und Filterung
- Ergänzt instanzlokale, Hash-basierte Duplikaterkennung mit einer kontrollierten Wiederverwendungsentscheidung
- Ergänzt den sicheren Austausch eines Originals bei stabiler Asset-Identität und stabilen Medienreferenzen einschließlich Retention, Bereinigung und konsistenter Quota-Abrechnung alter Versionen
- Ergänzt einen produktneutralen Malware-Scan als Fail-closed-Freigabe-Gate
- Ergänzt konfigurierbare Frühwarnungen vor der bereits vorhandenen harten Speicherquote
- Ergänzt revisionssichere Audit-Ereignisse für diese Governance- und Schutzoperationen

## Out of Scope

- neue Copyright- oder Lizenzfelder; diese gehören bereits zum Medienmodell
- konfigurierbare Copyright-/Lizenz-Pflichtfelder ohne konkret abgestimmte Fachregeln
- Einführung oder Änderung der bereits vorhandenen harten Speicherquoten
- rollenbezogene Upload-Raten oder abweichende Dateigrößenlimits
- Queue-, Worker-, Retry- oder Dead-Letter-Infrastruktur; diese gehört zu `add-media-async-processing`
- Autorisierung über Ordner, Tags oder Kategorien; die bestehende Instanz- und IAM-Grenze bleibt maßgeblich

## Impact

- Affected specs: `media-management`, `iam-auditing`
- Affected code:
  - `packages/media/*` für Metadaten-, Taxonomie-, Duplikat-, Replace- und Scan-Verträge
  - `packages/data/*` und `packages/data-repositories/*` für Persistenz, Hashes, Taxonomien, Versionierung und Quota-Warnschwellen
  - `packages/auth-runtime/*` für serverseitige Orchestrierung und Berechtigungsprüfung
  - `apps/sva-studio-react/src/routes/media/*` sowie Media-Picker und Review-UI
  - produktneutraler Malware-Scanner-Adapter am bestehenden Processing-Pfad
- Depends on: bestehendes `media-management`; für asynchrone Ausführung zusätzlich `add-media-async-processing`
