# Change: Minimale Medienorganisation und ClamAV-Scan ergänzen

## Why

Die Medienverwaltung besitzt Standardmetadaten, Inhaltsvalidierung und harte instanzbezogene Speicherquoten. `add-media-async-processing` verlagert die vorhandene Verarbeitung in Studio-Jobs. Für den nächsten Schritt genügen eine einfache Verschlagwortung, die Prüfung neuer Uploads auf Schadsoftware und ein manuell gestarteter lesender Bestandsscan mit Bericht.

Die Scannerwahl ist in [ADR-068](../../../docs/adr/ADR-068-clamav-als-virenscanner-fuer-medienuploads.md) festgehalten. Der ursprünglich breite Governance-Umfang wird auf diese drei konkreten Fähigkeiten begrenzt.

## What Changes

- Ergänzt optionale Tags am bestehenden Asset-Metadatenmodell sowie Suche nach Tags und einen einfachen Tag-Filter in Medienbibliothek und vorhandenem Medienpicker.
- Prüft neue Uploads vor Variantenverarbeitung und Freigabe mit dem intern betriebenen ClamAV-Dienst; der bestehende Medienjob übernimmt die Ausführung.
- Schützt ungeprüfte Uploads auch im Storage und bindet die Freigabe an die tatsächlich geprüften Dateibytes. Unvollständige Prüfung, Fund oder Scanfehler erlauben keine Nutzung.
- Verwendet vorhandene Status-, Warte-, Retry-, Bereinigungs-, Quota- und Audit-Pfade; ergänzt nur verständliche Scanfehler und die erforderlichen Audit-Ergebnisse.
- Plant ClamAV-Container, automatische Signaturupdates mit `freshclam`, persistente Signaturdaten und Diagnose im bestehenden Betriebsmodell. Nach 24 Stunden ohne bestätigte Aktualität wird gewarnt; nach 72 Stunden bleiben neue Freigaben gesperrt, bis die Aktualität der geladenen Signaturen wieder bestätigt ist. Bereits verfügbare Medien bleiben nutzbar.
- Sperrt bei aktivem Scan zunächst die Neuregistrierung unregistrierter Bucket-Dateien, da sie heute unmittelbar `ready` werden. Bereits registrierte Medien bleiben nutzbar; eine automatische Bestandsprüfung wird nicht eingeführt.

- Ergänzt auf ausdrücklichen Auftrag vom 21.10.2026 einen manuell gestarteten Bestandsscan des konfigurierten Medienbestands der aktuellen Instanz: höchstens 25 Dateien pro Durchlauf und 64 MiB pro Datei, Bericht mit `sauber`, `Fund` oder `nicht prüfbar` und manueller Fortsetzung. Der Scan verändert keine Dateien, Asset-Status, Sichtbarkeit, Quoten oder Berechtigungen und setzt keinen Upload-Scan-Nachweis.

## Out of Scope

- Ordner, kontrollierte Kategorien, zentrale Tag-Verwaltung und Taxonomie-Berechtigungen
- mehrsprachige globale Asset-Metadaten und konfigurierbare Pflichtfelder
- Hash-Duplikaterkennung, Wiederverwendungsdialoge und Deduplizierung
- Originalaustausch, Versionierung, Retention und neue Aufbewahrungssperren
- Quota-Warnstufen sowie Änderungen an der vorhandenen harten Quotenabrechnung
- mehrere Scanner, Scanner-Auswahl, externe Analysedienste und manuelle Scanfreigaben
- automatische Neuprüfung des Bestands, automatische Sperrung/Löschung bei Bestandsfunden und ein neuer Import-Workflow
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

Am 22.10.2026 hat der Nutzer den gemeinsamen Scanner für die zentralen Umgebungen Dev, Staging und Production auf dem SVA-Server sowie die vorläufige Staging-Aktivierung mit täglicher manueller Signaturkontrolle ausdrücklich freigegeben. Der automatische 24-Stunden-Warnalarm ist mangels Metrikübernahme noch nicht wirksam; die Staging-Ausnahme endet mit nachgewiesener Metrikübernahme und Alarmierung. Die automatische Sperre ohne Nachweis beziehungsweise ab 72 Stunden bleibt unverändert. Die Betriebsbedingungen stehen in der [Medienreferenz](../../../docs/reference/media-management.md#signaturpflege-fehler-und-betrieb). Dev und Production bleiben deaktiviert; Production-Rollout und Bestandsscans sind nicht freigegeben. Die Staging-Aktivierung erfolgt ausschließlich über den regulären Build-/Promote-Pfad.


Die Staging-Aktivierung erfolgt gemäß ausdrücklicher Freigabe vom 22.10.2026 als regulärer Rollout: Danach neu initialisierte Uploads verwenden privaten Eingang und Prüfung; vorher ausgestellte öffentliche Upload-URLs laufen nach ihrem bestehenden Vertrag aus. Ihr Ablauf ist keine Freigabebedingung. Eine feste Übergangsfrist, App-Pause, zusätzliche Bucket-Sperre und erzwungene Upload-Abbrüche sind nicht Bestandteil dieses Übergangs. Die frühere Wartungsplanung ist damit ersetzt.
