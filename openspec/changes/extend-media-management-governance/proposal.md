# Change: Medienmanagement um Governance- und Betriebsfunktionen erweitern

## Why
Der MVP `add-media-management` schafft die zentrale Medien-Capability, den MinIO-Storage-Pfad, Varianten, Media-Picker, Usage-Impact und Löschschutz. Für den produktiven Redaktionsbetrieb braucht das System danach zusätzliche Governance- und Betriebsfunktionen, die fachlich wertvoll sind, aber den MVP zu groß machen würden.

## What Changes
- Ergänzt verpflichtende Lizenz-/Copyright-Felder je Medientyp oder Instanz
- Ergänzt mehrsprachige Metadaten mit nachvollziehbarem Fallback
- Ergänzt Ordner, Tags und Kategorien für redaktionelle Organisation und Suche
- Ergänzt Hash-basierte Duplikaterkennung beim Upload
- Ergänzt Upload-Replace mit Referenzerhalt und Varianten-Neugenerierung
- Ergänzt Malware-Scan als Upload-/Processing-Gate
- Ergänzt rollen- und instanzbezogene Rate- und Größenlimits
- Ergänzt Quota-Warnungen vor Erreichen harter Speicherkontingente

## Impact
- Affected specs: `media-management`, `iam-access-control`, `iam-auditing`
- Affected code:
  - `packages/media/*` für erweiterte Domänen- und Validierungsverträge
  - `packages/data/*` für Migrationen, Repositories, Taxonomie, Hash- und Quota-Queries
  - IAM-Zielpackages für Limit- und Rechteprüfung
  - `apps/sva-studio-react/src/routes/media/*` und Media-Picker UI
  - Malware-Scanner-Adapter bzw. Processing-Gate
- Depends on: `add-media-management`
