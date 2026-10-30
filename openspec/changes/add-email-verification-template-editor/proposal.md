# Change: Gemeinsame Studio-Ablage und Synchronisierung der Account-Mailvorlagen

## Why

Der Nutzer hat den Zuschnitt erweitert: Studio ist für Einladungs- und Bestätigungsvorlagen die führende Ablage. Die zuvor vorbereitete direkte Keycloak-Bearbeitung der Bestätigung wird ersetzt. Der gespeicherte Studio-Stand darf bei externen Änderungen oder Fehlern nicht verloren gehen.

## What Changes

- Migration `0111` übernimmt bestehende Instanz-Einladungen datenbewahrend in `iam.instance_mail_templates` und behält die alte Spalte befristet als atomar gespiegelten Kompatibilitätseingang bis zum separat freigegebenen Contract nach Ende alter App- und Rollback-Versionen. Beide Typen verwenden aktuelle Quelle, fortlaufende Revision und getrennten bestätigten Realm-Textsatz. Keine Versionshistorie.
- Allgemeine Vorlagen für Einladung und Bestätigung bleiben im bestehenden serverweiten Bestand. Die bisherige Einladung samt Instanz-/Tenant-Editoren bleibt erhalten; Migration `0111` ergänzt dort den Bestätigungsschlüssel. Für beide gilt Instanz-Override vor allgemeiner Vorlage vor eingebautem Standard. Override entfernen stellt die aktuelle Vererbung wieder her. Globale Änderungen synchronisieren nur unter der Instanzsperre erneut als erbend bestätigte Instanzen.
- Quelle zuerst in eigener DB-Transaktion speichern. Anschließend über den bestehenden Keycloak-Client ausschließlich die passenden drei deutschen Texte schreiben und zurücklesen. Fehlschläge bleiben als nicht synchronisiert sichtbar; die Quelle bleibt gespeichert.
- Öffnen vergleicht Studio-Soll, letzten bestätigten Stand und aktuelles Keycloak. Explizite Aktionen: Keycloak-Stand übernehmen oder Studio-Stand übertragen. Übernahme nur verlustfrei in das bestehende textuelle Vorlagenmodell; nicht darstellbares HTML bleibt sichtbar, ohne stille Konvertierung.
- Studio-Schreibvorgänge verwenden CAS-Revisionen und die vorhandene Instanz-Transaktionssperre. Vor explizitem Übertragen werden Quelle und beobachtete Realm-Texte erneut verglichen. Keycloak bietet kein atomisches CAS gegenüber externen Admin-Änderungen; der abschließende Readback erkennt konkurrierende Abweichungen.
- Änderungen an Kommunenname, Startseiten-Host oder geerbter Servervorlage lösen ebenfalls Synchronisierung aus. Ein unbekannter beziehungsweise extern abweichender Realm wird dabei nicht automatisch überschrieben.
- Bestand startet unreviewed; kontrollierter Erstabgleich je Instanz über bewusste Übernahme oder Übertragung, zuerst Staging und dann Havelland. Keine Live-Änderungen oder echten Versandtests ohne konkrete Freigabe.
- Der Einladungsversand schreibt keine Realm-Texte und keine Themes mehr. Bekannte Abweichungen, fehlende Bestätigung oder Fehler blockieren ihn mit Erklärung und Link zur zuständigen Vorlagenpflege. Diese Entscheidung hat der Nutzer ausdrücklich bestätigt.

## Invarianten und Nachweise

- Bestehende Einladungstexte, Vererbung und Bearbeitungsrechte bleiben erhalten. Reset erhöht Revisionen weiter und darf keinen ABA-Konflikt ermöglichen.
- Speichern und externer Write sind getrennte Commit-Grenzen. Ein Keycloak-Ausfall rollt Studio-Text nicht zurück; ein Prozessabbruch hinterlässt pending, niemals eine unbewiesene Erfolgsmeldung.
- Realm und Instanz kommen aus autorisiertem Registry-Kontext. Nur sechs feste Schlüssel, je Vorgang drei, sind erlaubt. SMTP, Absendernamen, Themes und andere Realms bleiben unangetastet.
- RLS und Source-CAS werden mit Repository-/DB-Tests geprüft; Synchronisierungsausfall, Drift, Parallelität, veränderte Kommunendaten und Versandblockade mit gezielten Service-/Handler-/UI-Tests.
- Kein neuer Worker, Versanddienst, Credential-Fallback oder paralleler Vorlagenspeicher. Die direkte Bestätigungsbearbeitung aus dem vorherigen Arbeitsstand entfällt.
- Main-Server verwendet weiterhin `send-verify-email`. Passwort-Reset und vorhandene Adressänderungsmails bleiben unverändert.

## Impact

Betroffen sind Core-Vorlagenvertrag, bestehende Registry-Repositories und Editorpfade, Auth-Runtime-Synchronisierung, Einladungs-Readiness und die bestehenden API-/Architekturdokumente. Der Schema-Snapshot und die Übersicht werden mit Migration `0111` aktualisiert. Die bestehende Rollout-Vorbereitung unter `docs/staging/2026-10/` wird auf Migration plus kontrollierten Erstabgleich erweitert; der kanonische Studio-Promote-Prozess bleibt maßgeblich.

## Freigabe

Maßgeblich ist der aktuelle explizite Nutzerauftrag einschließlich der bestätigten Versandblockade. Zuerst vollständig lokal umsetzen und prüfen, Rollout nur vorbereiten.
