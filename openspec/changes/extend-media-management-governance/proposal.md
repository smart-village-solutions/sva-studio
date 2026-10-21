# Change: Minimale Medienorganisation und ClamAV-Scan ergänzen

## Why

Die Medienverwaltung besitzt Standardmetadaten, Inhaltsvalidierung und harte instanzbezogene Speicherquoten. `add-media-async-processing` verlagert die vorhandene Verarbeitung in Studio-Jobs. Für den nächsten Schritt genügen eine einfache Verschlagwortung und die Prüfung neuer Uploads auf Schadsoftware.

Die Scannerwahl ist in [ADR-068](../../../docs/adr/ADR-068-clamav-als-virenscanner-fuer-medienuploads.md) festgehalten. Der ursprünglich breite Governance-Umfang wird auf diese beiden Fähigkeiten reduziert.

## What Changes

- Ergänzt optionale Tags am bestehenden Asset-Metadatenmodell sowie Suche nach Tags und einen einfachen Tag-Filter in Medienbibliothek und vorhandenem Medienpicker.
- Prüft neue Uploads vor Variantenverarbeitung und Freigabe mit dem intern betriebenen ClamAV-Dienst; der bestehende Medienjob übernimmt die Ausführung.
- Schützt ungeprüfte Uploads auch im Storage und bindet die Freigabe an die tatsächlich geprüften Dateibytes. Unvollständige Prüfung, Fund oder Scanfehler erlauben keine Nutzung.
- Verwendet vorhandene Status-, Warte-, Retry-, Bereinigungs-, Quota- und Audit-Pfade; ergänzt nur verständliche Scanfehler und die erforderlichen Audit-Ergebnisse.
- Plant ClamAV-Container, automatische Signaturupdates mit `freshclam`, persistente Signaturdaten und Diagnose im bestehenden Betriebsmodell. Nach 24 Stunden ohne bestätigte Aktualität wird gewarnt; nach 72 Stunden bleiben neue Freigaben gesperrt, bis die Aktualität der geladenen Signaturen wieder bestätigt ist. Bereits verfügbare Medien bleiben nutzbar.
- Sperrt bei aktivem Scan zunächst die Neuregistrierung unregistrierter Bucket-Dateien, da sie heute unmittelbar `ready` werden. Bereits registrierte Medien bleiben nutzbar; eine automatische Bestandsprüfung wird nicht eingeführt.

## Out of Scope

- Ordner, kontrollierte Kategorien, zentrale Tag-Verwaltung und Taxonomie-Berechtigungen
- mehrsprachige globale Asset-Metadaten und konfigurierbare Pflichtfelder
- Hash-Duplikaterkennung, Wiederverwendungsdialoge und Deduplizierung
- Originalaustausch, Versionierung, Retention und neue Aufbewahrungssperren
- Quota-Warnstufen sowie Änderungen an der vorhandenen harten Quotenabrechnung
- mehrere Scanner, Scanner-Auswahl, externe Analysedienste und manuelle Scanfreigaben
- automatische Neuprüfung des Bestands und ein neuer Import-Workflow
- neue Queue-, Worker-, Retry- oder Dead-Letter-Infrastruktur sowie eine allgemeine Medienjob-Plattform

## Impact

- Affected specs: `media-management`, `iam-auditing`
- Affected code:
  - `packages/media/*`, `packages/data-repositories/*`: Tags im vorhandenen Metadatenfeld, instanzbezogene Suche und Filter
  - `packages/auth-runtime/src/iam-media/*`: Tag-Validierung, ClamAV-Aufruf, geschützter Upload, Freigabe und Sperre der scanfreien Neuregistrierung
  - `packages/plugin-sdk/*` und vorhandene Medienbibliothek/-picker: Metadaten, Filter und verständliche Fehler
  - bestehende Betriebs-/Deployment-Konfiguration samt Remote-Konfigurationsvertrag: interner ClamAV-Container, Signaturvolume und Monitoring
- Depends on: bestehendes `media-management`; für den Scan der vorhandene Medienjob aus `add-media-async-processing` auf Basis der Studio-Job-Fähigkeit. Tags benötigen keine neue Job-Fähigkeit.
- Affected documentation: `docs/reference/media-management.md`, bestehende Betriebsdokumentation und tatsächlich betroffene arc42-Abschnitte 05/06/07/08/10/11; maßgeblich für die Scannerwahl ist ADR-068.
- Keine Datenbankmigration für eine eigene Taxonomie oder einen separaten Scan-Lebenszyklus. Falls eine konkrete Persistenz-/Indexänderung notwendig wird, sind zuvor die kanonischen Schemaunterlagen zu prüfen und gemeinsam mit einer erforderlichen Migration zu aktualisieren.

## Vor Abschluss und Aktivierung zu klären

- Der private Eingangs-Bucket mit ACL-/Policy-Prüfung und getrennten Ausgabepfaden ist lokal implementiert und getestet; der tatsächliche Zugriffsschutz der jeweiligen Zielanbindung muss vor Aktivierung nachgewiesen werden.
- Am 21.10.2026 freigegeben: Die Sichtbarkeit neu gescannter Medien bleibt nach dem Upload fest; Änderungen erfolgen über einen neuen Upload. Metadaten bleiben bearbeitbar; Bestandsmedien behalten ihren bisherigen Vertrag.

Die Anpassung dieses Changes ist eine Planung. Sie aktiviert keinen Dienst und erteilt keine Deployment-Freigabe.
