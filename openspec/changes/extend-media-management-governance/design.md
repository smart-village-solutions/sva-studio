# Design: Tags und Virenscan im bestehenden Medienpfad

## Umfang und bestehende Pfade

Dieser Change liefert zwei begrenzte Erweiterungen: Tags für registrierte Medien und einen ClamAV-Scan für neue Uploads. Grundlage sind das vorhandene Asset-/Metadatenmodell sowie der Medienjob aus `add-media-async-processing`. Scan-Aufruf und Storage-Operationen laufen außerhalb der kurzen Finalisierungstransaktion. Es entstehen keine neue Job-Plattform, Scanner-Auswahl oder Versionsverwaltung.

## 1. Tags ohne Taxonomieverwaltung

Tags sind eine optionale Liste einfacher Begriffe im vorhandenen JSON-Metadatenfeld des Assets. Bestehende Assets ohne Tags entsprechen einer leeren Liste. Ein berechtigter Benutzer kann Tags bei der Metadatenpflege hinzufügen oder entfernen; es gibt keine eigenständigen Tag-Entitäten, globale Umbenennung oder Verwaltungsseite.

Tags werden client- und serverseitig begrenzt und validiert: höchstens 20 Tags je Asset, je 1 bis 64 Zeichen nach Normalisierung. Die Normalisierung verwendet Unicode-NFC, entfernt äußere Leerzeichen und fasst innere Leerzeichen zusammen. Vergleich und Filter sind unabhängig von Groß-/Kleinschreibung; gleiche Begriffe werden einmal gespeichert. Die zuerst eingegebene Schreibweise bleibt für die Anzeige erhalten. Nicht angegebene Tags verändern bei einem Metadaten-Patch nichts; eine leere Liste entfernt alle Tags.

Die vorhandene serverseitige Suche findet zusätzlich Tag-Begriffe. Der minimale Filter wählt genau einen Tag und vergleicht ihn vollständig nach derselben Normalisierung. Suchtext und Tag-Filter werden gemeinsam angewendet. Der Filter gehört in die vorhandene Cursor-Bindung; Filterwechsel starten eine neue Seitennavigation. Unregistrierte Bucket-Dateien haben keine Tags und erscheinen bei gesetztem Tag-Filter nicht. Instanzscope und bestehende Berechtigungen bleiben maßgeblich. Bibliothek und vorhandener Picker verwenden denselben API-Vertrag; keine zusätzliche Suchinfrastruktur.

## 2. ClamAV im vorhandenen Verarbeitungsjob

Die Produkt- und Lizenzentscheidung steht in [ADR-068](../../../docs/adr/ADR-068-clamav-als-virenscanner-fuer-medienuploads.md). Ein einzelner interner ClamAV-Dienst wird über `clamd`/`INSTREAM` angesprochen. `libclamav` wird nicht eingebunden; es gibt keinen generischen Scanner-Provider-Verbund.

1. Ein neuer Upload wird in einem tatsächlich geschützten Storage-Eingang abgelegt. Sein Empfang ist keine Freigabe.
2. Der vorhandene Upload-Abschluss nimmt den Medienjob dauerhaft an. Der bestehende Claim schützt jeden Verarbeitungsversuch.
3. Der Job prüft Größen-/Inhaltsgrenzen und scannt das Original vor der Variantenverarbeitung. Nur ein vollständig abgeschlossenes Ergebnis ohne Fund erlaubt die weitere Verarbeitung. Limits dürfen nicht stillschweigend zu einer unvollständigen Prüfung mit Erfolg führen.
4. Varianten und freigegebenes Original müssen aus denselben geprüften Bytes entstehen. Eine noch gültige Upload-URL oder ein konkurrierender Schreibzugriff darf die zur Veröffentlichung bestimmten Bytes nach dem Scan nicht austauschen. Der vom Browser beschreibbare Eingang wird nicht selbst zum unveränderlich freigegebenen Original erklärt.
5. Claim, offene Content-Speicheroperation, Validierung und harte Quote bleiben vor `ready` verbindlich. Der Scan ersetzt keine dieser Prüfungen. Veröffentlichung und nachgelagerte Bereinigung müssen diese Grenzen ebenfalls beachten; überholte Versuche dürfen keine fremden Ergebnisse veröffentlichen oder löschen.

Ungeprüfte, abgewiesene und bereits bereinigte Uploads dürfen weder über Delivery/Preview noch über direkte Storage-URLs oder Bucket-Listings nutzbar werden. Der bestehende S3-Port verwendet einen separaten privaten Quarantäne-Bucket auf demselben ausgewählten S3-Dienst und mit denselben Zugangsdaten. Vor der Reservierung prüft er die private Owner-ACL ohne Gruppenfreigaben und das Fehlen einer Bucket-Policy; unterstützt die Anbindung diese Auskunft nicht, bleibt die Reservierung gesperrt. Der Browser kann ausschließlich den Eingangs-Key beschreiben. Original und Varianten entstehen aus dem gescannten Speicherinhalt in claim-isolierten Ausgabepfaden; geschützte Ausgaben bleiben im privaten Bucket und werden signiert ausgeliefert. Es gibt keinen neuen Storage-Dienst und keine zweite Storage-Abstraktion. Der tatsächliche Zugriffsschutz einschließlich vorgeschalteter Gateways bleibt vor Aktivierung im Zielbetrieb nachzuweisen.

Der bestehende Pfad `asset-registration-handler.ts` setzt unregistrierte Bucket-Dateien unmittelbar auf `ready`. Diese Neuregistrierung wird bei aktivem Scan zunächst verständlich abgewiesen. Bereits registrierte Medien behalten ihren bisherigen Lebenszyklus und erhalten keinen nachträglich behaupteten Scan-Nachweis. Ein neuer Import-Workflow und die automatische Bestandsprüfung gehören nicht zu diesem Abschnitt.

## 3. Status, Fehler und Bereinigung

Die vorhandenen Upload-/Processing-Status bleiben bestehen. Ein Fund führt in den vorhandenen gesperrten Uploadzustand mit einem normierten Fehlergrund. Technische Scanfehler verwenden die vorhandenen Job-Wiederholungen; nach deren Ausschöpfung endet der Upload im vorhandenen Fehlerzustand. Timeout, Verbindungsfehler, ungültige Antwort, Größenlimit und sonstige unvollständige Prüfung werden niemals als Freigabe interpretiert. Es gibt keinen manuellen Bypass.

Die UI wartet wie im Async-Change auf `ready`. Bei einer Zeitüberschreitung gelten dessen bestehende Regeln: Bibliotheksjob läuft weiter; beim Content-Speichern bleiben Formulardaten erhalten und die vorhandene Abbruch-/Recovery-Verarbeitung bereinigt provisorische Uploads. Eine neue automatische Wiederaufnahme wird nicht eingeführt.

Abgewiesene Dateien und nicht mehr benötigte Eingangsobjekte verwenden die bestehenden Bereinigungs- und Recovery-Pfade. Keine Quotenbuchung allein aufgrund eines Scan-Ergebnisses: Die bestehende erfolgreiche Finalisierung bleibt maßgeblich; nie gebuchte Bytes dürfen bei einer Bereinigung nicht von der Nutzung abgezogen werden. Wiederholte Ausführung darf weder doppelt buchen noch fremde Objekte löschen. Es entsteht keine allgemeine Retention-Verwaltung.

## 4. Betrieb und Signaturpflege

Der ClamAV-Container bleibt intern erreichbar, da `clamd` TCP-Verbindungen nicht selbst authentifiziert oder verschlüsselt. `freshclam` prüft automatisch auf Updates; die Datenbank wird persistent gespeichert und von `clamd` nachgeladen. Signaturupdates benötigen kein Studio-Deployment. Scanner-Software und Container werden zusätzlich über den regulären freigegebenen Rollout-Prozess aktualisiert.

Erreichbarkeit, fehlgeschlagene Updates und die Aktualität der tatsächlich geladenen Signaturen werden im vorhandenen Monitoring sichtbar. Ein neuer Monitor-Dienst oder Workflow wird nicht eingeführt. Der reguläre Compose-Pfad enthält einen intern erreichbaren ClamAV-Dienst mit standardmäßig null Replikaten und deaktiviertem Scan-Gate; drei optionale Felder erweitern den vorhandenen Remote-Konfigurationsvertrag. Aktivierung erfordert eine Replik und einen privaten Bucket. Die Scan-Größe ist auf 64 MiB begrenzt; größere neue Uploads werden vor der Reservierung mit HTTP 413 abgewiesen. Die am 20.10.2026 abgestimmte Regel lautet: Nach 24 Stunden ohne bestätigte Aktualität wird gewarnt; nach 72 Stunden werden neue Uploads nicht mehr freigegeben. Bereits verfügbare Medien bleiben nutzbar. Die Sperre endet erst, wenn ein erfolgreicher Aktualitätscheck und der passende geladene Signaturstand bestätigt sind. Auch ein erfolgreicher Check ohne verfügbares Update zählt als Aktualitätsbestätigung; ein bloßer Scanner-Ping, Container-Neustart oder Updateversuch setzt die Frist nicht zurück. Ohne initialen Nachweis wird keine Freigabe erteilt. Scanner-Ausfall und unvollständige Scans sperren unabhängig von diesen Fristen.

Ein einzelner Updatefehler bei weiterhin zulässigem Aktualitätsnachweis sperrt nicht automatisch alle Uploads. Stream-/Scan-Limits decken die erlaubten Uploadgrößen ab; Ressourcen berücksichtigen den zusätzlichen Bedarf beim Signatur-Reload gemäß ADR-068.

## 5. Audit und Diagnose

Tag-Änderungen nutzen den vorhandenen Metadaten-Auditpfad. Scan-Freigaben und Ablehnungen verwenden vorhandene instanzbezogene Audit-Ereignisse mit Ergebnis, normiertem Reason-Code, Asset-/Job-Bezug, pseudonymisiertem Actor beziehungsweise Systemakteur und vorhandener Request-/Trace-Korrelation. Kein neues Audit-Subsystem.

Dateiinhalte, Tagwerte, rohe Scanner-Antworten, Signaturnamen, Storage-Keys, Secrets und Klartext-PII werden nicht protokolliert. Nutzer sehen übersetzte verständliche Status-/Fehlertexte; technische Diagnose bleibt redigiert.

## Abnahme und Grenzen

Nachzuweisen sind Tag-Validierung, Patch-Semantik, Suche/Filter samt Cursor- und Mandantentrennung sowie der Scan-Erfolg, Fund und alle unvollständigen Prüfungen. Integrationstests belegen dieselben geprüften/veröffentlichten Bytes, fehlenden öffentlichen Zugriff vor Freigabe, gesperrte Neuregistrierung, Claim-/Abbruchrennen und unveränderte Quotenbuchung. Ein lokaler Scanner-Vertragstest umfasst eine harmlose Datei und die standardisierte EICAR-Testdatei.

Die Auslieferung des Scans benötigt zusätzlich den Nachweis der tatsächlichen Storage-Policy, geladener Signaturen und automatischer Updates im Zielbetrieb. Lokale Tests ersetzen weder diese Abnahme noch die separate Deployment-Freigabe. Tags können unabhängig vom noch nicht aktivierten Scanner nachgewiesen werden; eine Pflicht zu künstlich getrennten PRs entsteht daraus nicht.

## Feste Sichtbarkeit neu gescannter Medien

Am 21.10.2026 wurde die kleine Variante freigegeben: Die beim Upload gewählte Sichtbarkeit bleibt für neu gescannte Medien fest. Eine Änderung erfordert einen neuen Upload mit der gewünschten Sichtbarkeit. Ein bloßer Metadatenwechsel kann zuvor öffentlichen Storage-Objekten den direkten Zugriff nicht entziehen; ein zusätzlicher Storage-Wechsel gehört nicht zu diesem Lieferumfang.

Der bestehende Prozessor setzt `technical.scanStatus = clean` erst nach erfolgreicher Prüfung und persistiert den Nachweis mit der vorhandenen Finalisierung. Die Metadaten-API verweigert anschließend Änderungen von `public` zu `protected` und umgekehrt mit HTTP 409 und dem normierten Grund `media_visibility_fixed`, bevor Metadaten geschrieben werden. Die Sperre gilt auch bei später deaktiviertem Scan. Unveränderte oder ausgelassene Sichtbarkeit erlaubt weiterhin Metadatenänderungen; Bestandsmedien ohne diesen Nachweis behalten ihren bisherigen Vertrag. Vor Abschluss der Verarbeitung verhindert bereits die bestehende Bearbeitungssperre einen Sichtbarkeitswechsel.
