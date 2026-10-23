# Medienmanagement

Dieser Guide beschreibt den aktuellen Umgang mit Medien im Studio für Redakteure und Instanzverantwortliche.

## Zielgruppe

- Redakteure, die Bilder hochladen und in News, Events oder POI verwenden
- Administratoren, die Mediennutzung, Sichtbarkeit und Löschblockierungen nachvollziehen müssen

## Einstieg

Der kanonische Einstieg liegt unter `/admin/media`.

Dort stehen zur Verfügung:

- Medienbibliothek mit Suche und Sichtbarkeitsfilter
- cursorbasierte Navigation in binärer S3-Storage-Key-Reihenfolge; bei der Zusammenführung von Datenbank und Bucket wird der Cursor nur bis zum von beiden Quellen vollständig gelesenen Bereich vorgeschoben, die Oberfläche zeigt bewusst keine teure Gesamtzahl an
- direkter Single-File-Upload für neue Bilder aus der Bibliothek
- Metadatenpflege für Titel, Alternativtext, Beschreibung, Copyright, Lizenz und Tags
- Nutzungsanzeige (`Usage-Impact`) für aktive Referenzen
- kontrollierte Auslieferung für öffentliche und geschützte Medien

## Upload

Der MVP verarbeitet zunächst Bilder.

Ablauf:

1. Datei in `/admin/media` auswählen.
2. Studio initialisiert den Upload serverseitig und legt Asset-ID plus Upload-Session an.
3. Der Browser lädt die Datei direkt an die signierte Storage-URL.
4. Studio plant den vorhandenen Verarbeitungsablauf als hosteigenen Studio-Job `media.process-upload` ein. Der Abschluss-Endpunkt bestätigt die dauerhafte Annahme mit HTTP 202; ein bereits fertiggestellter Upload liefert idempotent HTTP 200.
5. Die Oberfläche zeigt die Verarbeitung an und prüft den Asset-Zustand einmal pro Sekunde, höchstens zwei Minuten. Erst bei `ready` öffnet sie die Mediendetailansicht.

Der Job führt außerhalb des Upload-Requests aus:

- Inhaltsvalidierung des Uploads
- Metadaten-Extraktion
- Generierung häufiger Standardvarianten
- Statuspflege für Upload und Verarbeitung
- Prüfung der tatsächlichen Gesamtgröße gegen das Speicherkontingent

Die Annahme speichert Upload-Claim, Job und Enqueue gemeinsam in einer kurzen Datenbanktransaktion. Die Upload-Session-ID ist zugleich die Job-ID; wiederholte oder parallele Abschlussaufrufe planen keinen zweiten Auftrag ein. Ein Enqueue-Fehler rollt die Annahme zurück. Der bestehende Studio-Job-Worker verarbeitet den Auftrag mit den vorhandenen technischen Wiederholungsversuchen und Betriebsdiagnosen.

Jeder Worker-Versuch erneuert sein Fencing-Token und schreibt unter claim-isolierten Storage-Keys. Erst die kurze Finalisierung sperrt die Session und veröffentlicht Varianten sowie Quotenbuchung für das aktuelle Token. Bei provisorischen Assets muss zusätzlich die Content-Speicheroperation noch für Uploads geöffnet sein. Überholte Versuche dürfen weder veröffentlichen noch fremde Varianten löschen. Storage- und Bildoperationen halten keine Datenbanktransaktion offen.

Bis `uploadStatus = processed` und `processingStatus = ready` sind neue Referenzen, Delivery und Metadatenänderungen gesperrt; der Media-Picker bietet solche Assets nicht zur Auswahl an. Der vorhandene Asset-Lesepfad bleibt für berechtigte Benutzer verfügbar.

Bei einer Zeitüberschreitung gilt:

- Ein Bibliotheksupload wird weiterverarbeitet. Die Bibliothek wird neu geladen und zeigt das unfertige Medium mit „In Verarbeitung“. Die geöffnete Detailansicht prüft zunächst bis zu 120 Sekunden im bisherigen kurzen Intervall. Danach fragt sie den Status alle zehn Sekunden weiter ab; eine weitere Abfrage beginnt erst nach Ende der vorherigen, mit einem Zeitlimit von zehn Sekunden je Abruf. Fertigstellung oder ein Verarbeitungs-/Abruffehler lädt die regulären Detaildaten neu und beendet die Folgeabfragen. Sobald das Medium fertig ist, wird die Vorschau automatisch aufgelöst. Beim Verlassen der Seite oder Wechsel zu einem anderen Medium werden Timer und laufende Statusabfragen abgebrochen; späte Antworten werden verworfen.
- Beim Content-Speichern wird der Versuch vor dem fachlichen Write mit einer Fehlermeldung beendet. Formulareingaben und lokale Dateientwürfe bleiben erhalten; die provisorischen Uploads dieses Versuchs werden über den bestehenden Abbruch-/Recovery-Pfad bereinigt. Bestehende Bibliotheksmedien und Referenzen bleiben erhalten. Es gibt keine automatische Wiederaufnahme.

Fehlschläge bleiben fail-closed. Redigierte Fehlerdetails werden am Asset gespeichert; technische Storage-Details werden nicht in Fachmodulen offengelegt.

Fehlverhalten im Frontend:

- Schlägt die Initialisierung fehl, bleibt der Nutzer in der Bibliothek und erhält eine fachlich redigierte Fehlermeldung.
- Schlägt der direkte Storage-Upload fehl, wird kein Abschluss-Call ausgeführt; die Bibliothek bleibt offen und zeigt den Uploadfehler an.
- Schlägt nur der Abschluss fehl, existiert bereits ein reserviertes Asset im Pending-Zustand und kann technisch nachverfolgt werden.
- Überschreiten die tatsächlichen Bytes bei der Job-Finalisierung das Kontingent, wird die Freigabe abgelehnt und die bereits erzeugten Storage-Objekte werden kompensierend entfernt.

Das Abbrechen provisorischer Uploads zieht nur zuvor gebuchte Bytes und Asset-Zahlen vom Kontingent ab. Ausstehende, fehlgeschlagene und blockierte Uploads waren nicht gebucht und vermindern deshalb auch beim wiederholten Bereinigen keinen vorhandenen Verbrauch.

## Medienrollen

Fachmodule referenzieren Medien nicht über rohe URLs, sondern über hostseitige Medienreferenzen mit Rollen.

Aktuelle Rollen im MVP:

- `teaser_image`
- `header_image`
- `gallery_item`
- `hero_image`
- `thumbnail`
- `download`

Die Rollen werden im jeweiligen Plugin über den hostseitigen Media-Picker ausgewählt.

## Nutzungstransparenz

Jedes Asset zeigt an, wo es aktuell verwendet wird.

Die Nutzungsansicht beantwortet insbesondere:

- welches Fachmodul das Asset referenziert
- welche Ziel-ID betroffen ist
- welche Medienrolle verwendet wird
- ob eine Löschung aktuell blockiert ist

## Löschung und Änderungen

Löschungen bleiben fail-closed.

Ein Asset kann im MVP nicht gelöscht werden, wenn:

- aktive Referenzen existieren
- der Upload oder die Verarbeitung nicht in einem löschbaren Zustand sind
- bearbeitbare Kopien die Grundlage weiterhin benötigen

Metadaten- und Sichtbarkeitsänderungen laufen ebenfalls über den hostseitigen Medienvertrag und werden auditierbar verarbeitet.

## Metadaten und Bildbearbeitung

Titel und Alternativtext sind auf je 512, Beschreibung auf 5.000 sowie Copyright und Lizenz auf je 512 Zeichen begrenzt. Ausgelassene Patch-Felder bleiben erhalten; `null` leert ein Feld ausdrücklich. Tags werden normalisiert und dedupliziert (höchstens 20 mit je 64 Zeichen).

Metadatenänderungen sperren das aktuelle Asset und führen Prüfung, Zusammenführung und Speicherung in derselben Transaktion aus. Parallele Änderungen anderer Felder bleiben dadurch erhalten; ein inzwischen gelöschtes oder zur Löschung markiertes Medium wird nicht wiederhergestellt. Der Editor übernimmt die Instanz des ausgewählten Mediums auch für den geschützten Abruf seiner Bearbeitungsgrundlage.

Im gemeinsamen Medienpicker gelten die sichtbaren Angaben für den aktuellen Inhalt. „Angaben in der Mediathek öffnen“ führt innerhalb desselben Dialogs zu allen fünf zentralen Textfeldern und Tags. Erst „In der Mediathek speichern“ ändert das vorhandene Medium und erfordert `media.update`. Eigene Inhaltsangaben bleiben dabei erhalten; anschließend lassen sich unterstützte Felder einzeln aus dem zentralen Stand übernehmen. Eigene Abweichungen sind dabei zunächst nicht ausgewählt. Bestehende Inhalte werden nicht automatisch geändert.

„Bild bearbeiten“ öffnet den vollständigen Filerobot-Editor: Zuschnitt, Drehen, Spiegeln, Feinabstimmung, Filter, Text, Formen, Zeichnungen, eingefügte Bilder, Wasserzeichen und Größenänderung mit Rückgängig/Wiederholen. Er wird ausschließlich im Browser nachgeladen; Übersetzungen, Schriftwahl und Farbschema kommen aus dem Studio. Cloudimage, KI und entfernte Schrift-/Übersetzungsdienste sind deaktiviert. Die bekannte Einschränkung der Tastatur-/Screenreader-Bedienung der Spezialwerkzeuge steht sichtbar am Einstieg und in [ADR-069](../adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md). Studio-Rahmen und Metadaten bleiben von dieser Ausnahme ausgenommen.

Nach der Bearbeitung erscheinen die Angaben der Kopie und eine Vorschau für Vorschaubild (320 × 320), Teaser (800 × 450) und Titelbild (1.600 × 900). Zwei native Regler bestimmen den wichtigen Bildbereich. Eine Warnung bei Vergrößerung berät und blockiert das Speichern nicht. Original, ursprüngliche Metadaten und bestehende Verwendungen bleiben unverändert. Die Kopie übernimmt zunächst die fünf Textfelder und Tags; Alternativtext und Beschreibung sollten nach sichtbaren Änderungen geprüft werden. Zuschnitt und Bildfokus werden für die neue Ausgabe bestimmt.

In der Mediathek erzeugt „Als neues Bild speichern“ die Kopie unmittelbar und öffnet deren Detailansicht. Sobald die Upload-Sitzung angelegt ist, bleiben Bild, Metadaten und Fokus für diesen Upload fest. Wiederholungen behalten dieselbe Sitzung und übertragen nur fehlende Dateien; nach vollständiger Übertragung setzen sie ausschließlich den Abschluss fort. Abgelaufene Upload-Ziele melden einen Fehler und erzeugen keine zweite Kopie. Ungespeicherte Änderungen beim Schließen werden mit dem vorhandenen Studio-Bestätigungsdialog geschützt. In News, Events, POI, Projects, Generic Items und Cockpit Cards bleiben Datei und Bearbeitung zunächst im lokalen Inhaltsentwurf; erst das Speichern des Inhalts startet den bestehenden Content-Save-Pfad. News/Events/POI/Projects/Generic Items verwenden ihre vorhandenen Felder für Alternativtext, Beschreibung und Copyright; Cockpit Cards verwenden Alternativtext. Vollständige zentrale Angaben werden dadurch nicht als zusätzliche Fachfelder eingeführt. In Mediathek und Einstellungen werden ausdrücklich gespeicherte Angaben der lokalen Kopie auch bei der anschließenden Bestätigung übernommen. Manuelle Medienlinks bleiben verfügbar. Waste-Branding speichert eine bearbeitete Kopie unmittelbar als öffentliches Medium und wählt ihre dauerhafte URL aus; die Konfiguration wird anschließend separat gespeichert.

### Weiterbearbeitung und Schutz der Grundlage

Jede Bearbeitung erzeugt ein neues Asset mit einem begrenzten, versionierten Zustand (`filerobot`, `5.0.0-beta.159`, Dokumentversion 1) und einem Bezug zur tatsächlichen Grundlage. Lokale Originale werden zusammen mit dem Zustand privat aufbewahrt; referenzierte Grundlagen bleiben an dieselbe Instanz und Sichtbarkeit gebunden. Der bestehende Upload-Job validiert, scannt bei aktivierter Scanpflicht und verbucht Ausgabe, private Ressourcen und Zustand gemeinsam im Kontingent. Fehler oder überholte Claims dürfen keine Teilfreigabe bewirken. Auch bei deaktiviertem Scan ist der private Ressourcen-Bucket erforderlich und wird mit dem vorhandenen Storage-Guard geprüft.

Nur `GET /api/v1/iam/media/{assetId}/editing` gibt nach eigener Leseprüfung für Kopie und tatsächliche Grundlage sowie gegebenenfalls `media.deliver.protected` eine kurzlebige signierte Quell-URL und den Zustand zurück (`private, no-store`, `no-referrer`). Normale Asset-/Bibliotheksantworten enthalten keine privaten Schlüssel, Zustände oder Quellbezüge. Eingefügte Bildressourcen sind begrenzte eingebettete PNG/JPEG/WebP-Daten; entfernte Ressourcen werden abgelehnt. Der Zustand ist auf 8 MiB, einzelne Ressourcen auf 4 MiB und Anmerkungen auf 200 begrenzt.

Die Nutzungsansicht trennt Inhaltsreferenzen von bearbeitbaren Kopien und zeigt einen Link zur Grundlage nur mit deren eigener Leseberechtigung. Eine Grundlage kann nicht gelöscht werden, solange Kopien sie benötigen; auch provisorische Kopien schützen sie, ohne in fremden Bibliotheken sichtbar zu werden. Löschung markiert das Asset vor Storage-I/O unter derselben Sperre wie neue Kopien und Referenzen. Terminal fehlgeschlagene Kopien lösen ihren Quellbezug. Fehlgeschlagene Medien lassen sich bereinigen; nie abgeschlossene Uploads erst nach Ablauf aller signierten Upload-URLs, ohne laufende Verarbeitung. Session-Sperren verhindern dabei eine konkurrierende Verarbeitungsannahme. Auch beim unmittelbaren Verwerfen eines Inhaltsentwurfs werden eigene private Bildgrundlagen und Eingangsdateien vor der Datenbankfinalisierung gelöscht; gemeinsam referenzierte Grundlagen bleiben erhalten. Fehlgeschlagene Storage-Bereinigung bleibt wiederholbar; nur erfolgreich gebuchte Medien korrigieren bei endgültiger Löschung einmalig das Kontingent. Es gibt keinen zusätzlichen Verlaufsdienst und keine neue Freigabestufe für Redakteure.

## Tags und optionaler ClamAV-Scan

Registrierte Medien besitzen optional bis zu 20 Tags mit je 1–64 Zeichen. Die Tag-Pflege erfolgt in der Detailansicht, ein Tag pro Zeile. Die Bibliothek kombiniert Suchtext mit einem exakten Tag-Filter; Groß-/Kleinschreibung, Unicode-NFC und überzählige Leerzeichen werden normalisiert. Die gemeinsame Medienauswahl fragt bei Suchtext oder Tag-Filter den Server ab und begrenzt die Auswahl weiterhin auf verfügbare öffentliche Bilder. Tags liegen im vorhandenen JSON-Metadatenfeld; eine zentrale Taxonomieverwaltung wird nicht eingeführt.

Die Scannerwahl ist in [ADR-068](../adr/ADR-068-clamav-als-virenscanner-fuer-medienuploads.md) festgehalten. Der Scan ist standardmäßig deaktiviert und benötigt vor seiner Aktivierung den nachgewiesenen Storage-Schutz sowie einen regulär freigegebenen Rollout. Der bestehende Async-Change allein aktiviert keinen Scanner.

Die internen Schlüssel `.quarantine/` und `.protected/` sind dauerhaft vom normalen Bucket-Import ausgeschlossen. Jeder Zugriff auf den gemeinsamen privaten Bucket ist an den exakten Instanzpräfix gebunden; geschützte Ausgaben werden nur als geschützte Medien ausgeliefert. Diese Grenzen gelten auch bei deaktivierter Scan-Anforderung.

### Konfiguration und privater Eingang

| Einstellung | Bedeutung |
| --- | --- |
| `MEDIA_SCAN_ENABLED` | Nur `true` aktiviert die Scan-Anforderung für neue Uploads; Standard `false`. Bereits im Quarantäne-Eingang liegende Uploads dürfen auch nach Deaktivierung nicht ohne Scan veröffentlicht werden. |
| `MEDIA_CLAMAV_REPLICAS` | Nur lokale Compose-Tests; die zentrale Replik wird ausschließlich im Stack `studio-clamav` verwaltet. |
| `MEDIA_CLAMAV_HOST`, `MEDIA_CLAMAV_PORT` | Zentraler interner Dienstname `studio-clamav_clamav`, Standardport `3310`; lokal `clamav`. Kein öffentlicher Port. |
| `MEDIA_CLAMAV_SIGNATURE_STATE_PATH` | Für die App lesbarer Aktualitätsnachweis `/var/lib/clamav/studio-freshness` im Signaturvolume. |
| `MEDIA_CLAMAV_TIMEOUT_MS` | Gesamtes Zeitlimit eines Protokollaustauschs, Standard 30 Sekunden. |
| `MEDIA_SCAN_QUARANTINE_BUCKET` | Separater privater Bucket auf demselben ausgewählten S3-Dienst; darf nicht der Auslieferungs-Bucket sein. |

Der Bucket wird durch den Betreiber angelegt, nicht durch einen Upload-Request. Die vorhandenen Storage-Zugangsdaten benötigen dort Objektzugriff sowie `GetBucketAcl` und `GetBucketPolicy`. Die Anwendung akzeptiert für den Eingang nur private Owner-ACLs ohne Gruppenfreigaben und ohne Bucket-Policy; kann die Anbindung das nicht nachweisen, wird kein neues Upload-Ziel ausgegeben. Ein unbenannter kanonischer Owner-Grant wird bei S3-Anbindungen mit impliziter Owner-ACL akzeptiert. Die private MinIO-Platzhalterantwort ohne Eigentümer-ID ist ausschließlich mit genau einem `CanonicalUser`-Grant ohne weitere Grantee-Felder und mit `FULL_CONTROL` zulässig; fremde IDs, zusätzliche Grants, Gruppen und Bucket-Policies bleiben ausgeschlossen. Diese Antwortform entspricht dem [MinIO-ACL-Vertrag](https://github.com/minio/minio/blob/master/cmd/acl-handlers.go); es wird kein MinIO-Quellcode übernommen. Ein vorhandenes öffentliches Storage-Gateway darf diesen Bucket nicht zusätzlich veröffentlichen.

Uploads liegen unter `.quarantine/<instance>/<asset>/<session>`. Der bestehende Job prüft die eingelesenen Bytes und verwendet genau diesen Speicherinhalt für Original und Varianten. Ein erneut verwendetes signiertes PUT-Ziel kann damit keine veränderten Bytes in das freigegebene Original einschleusen. Ausgabedateien liegen je Claim getrennt; geschützte Ausgaben bleiben unter `.protected/…` im privaten Bucket und erhalten ausschließlich signierte Delivery-URLs. Erst erfolgreich geprüfte und inhaltlich validierte Bytes gelangen in den öffentlichen Auslieferungs-Bucket. Die bestehende Finalisierung prüft zusätzlich Claim, Content-Save-Zustand und harte Quote vor `ready`; Storage-Schreibvorgänge bleiben außerhalb dieser Datenbanktransaktion. Bei fehlgeschlagener Finalisierung werden eigene Ausgaben bereinigt.

Die neue Registrierung bisher unregistrierter Bucket-Dateien ist im Scanbetrieb gesperrt, damit sie das Gate nicht umgehen kann. Bestehende Medien werden nicht automatisch neu geprüft und erhalten keinen nachträglich behaupteten Scan-Nachweis.

### Signaturpflege, Fehler und Betrieb

Auf dem SVA-Server verwenden Dev, Staging und Production denselben zentralen Scanner. Der dedizierte Stack `studio-clamav` wird über den manuell geschützten Workflow `ClamAV Rollout` mit einer Replik gestartet; sein Vertrag liegt in `deploy/clamav-stack.yaml`. Er besitzt keinen veröffentlichten Port und verwendet das persistente Volume `studio-clamav-signatures`. Die App-Services verbinden sich über das externe Overlay `studio-clamav_default` und binden dieses Volume ausschließlich lesend ein. Andere App-Stack-Services erhalten keinen Zugang zu diesem Overlay. Die Scan-Anforderung wird weiterhin pro Umgebung über `MEDIA_SCAN_ENABLED` freigegeben. Die lokale Compose-Umgebung übernimmt denselben Scanner-Vertrag als eigenen Testdienst. Der Dienst führt FreshClam beim Start und danach stündlich aus. Nur ein erfolgreicher Check schreibt atomar Zeit und Daily-Datenbankrevision in den Nachweis; ein Check ohne neues Update zählt ebenfalls. Die App vergleicht diesen Nachweis vor und nach dem Scan mit der geladenen `clamd`-Version. Ein Ping, Neustart oder fehlgeschlagener Updateversuch erneuert den Nachweis nicht.

Nach 24 Stunden ohne bestätigte Aktualität warnt das vorhandene Monitoring; ab 72 Stunden werden neue Freigaben gesperrt. Ohne initialen Nachweis oder bei Ausfall, ungültiger Antwort, Timeout und unvollständiger Prüfung gibt es keine Freigabe. `AlertExceedsMax` verhindert, dass überschrittene Scan-Grenzen als sauberer Scan behandelt werden. Solche Limitmeldungen werden als unvollständige Prüfung behandelt, nicht als Malware-Fund. Im Scanbetrieb gilt vor der Upload-Reservierung ein Limit von 64 MiB. Bestehende Medien bleiben nutzbar. Der Scanner benötigt bis zu 4 GiB RAM; die amd64-Ausführung auf ARM wird nur im lokalen Override beziehungsweise Integrationstest ausdrücklich gewählt. Scanner und App müssen bei einem lokalen Volume auf demselben vorhandenen Zielknoten laufen.

Technische Fehler verwenden die vorhandenen Studio-Job-Wiederholungen. Ein Fund blockiert den Upload; Nutzer erhalten eine verständliche Meldung ohne Signaturnamen. Der erfolgreiche Finalisierungspfad bucht Speicher weiterhin genau einmal. Die Eingangsbereinigung erfolgt nach Finalisierung und Audit; ein Fehler darf verfügbare Ausgaben oder die Quotenbuchung nicht zurücknehmen. Der bestehende explizite Job-Retry kann die Eingangsbereinigung eines bereits finalisierten oder abgewiesenen Uploads wiederholen, ohne neue Freigabe oder zweite Verarbeitung. Operative Logs und Audit enthalten ausschließlich normierte Gründe und zulässige Korrelation, keine Dateiinhalte, Scanner-Rohantworten oder Tagwerte.

Die Metrikerfassung vergleicht den Signaturnachweis mit der über `VERSION` abgefragten, tatsächlich geladenen Revision. Ein abweichender Stand, fehlender Nachweis, ungültige Konfiguration oder nicht erreichbarer Scanner meldet den Sperrwert von 72 Stunden; die Versionsabfrage ist auf höchstens eine Sekunde begrenzt.

Die vorhandenen OTEL-Instrumente `media_scan_enabled`, `media_scan_signature_check_age_seconds` und `media_scan_results_total` machen Aktivierung, Check-Alter und Ergebnisse sichtbar. Die Prometheus-Regeln für die 24-/72-Stunden-Grenzen setzen ein gemeldetes aktiviertes Scan-Gate voraus; sie erzeugen keinen Alarm allein wegen einer noch nicht aktivierten Funktion. Vor Aktivierung müssen die tatsächliche Metrikübernahme und die Scanner-Erreichbarkeit im Zielbetrieb geprüft werden. Die Scan-Metriken kommen im zentralen Zielbetrieb derzeit noch nicht in Prometheus an; ein automatischer 24-Stunden-Alarm ist deshalb dort nicht wirksam.

Für Staging wurde am 22.10.2026 ausdrücklich ein vorläufiger Betrieb mit manueller Kontrolle freigegeben. Anschließend hat der Nutzer auch die Production-Aktivierung beauftragt; dieselbe tägliche Kontrolle des gemeinsamen Scanners gilt für beide Umgebungen. Diese Ausnahme gilt nur für den fehlenden automatischen 24-Stunden-Warnalarm, bis Metrikübernahme und Alarm im Ziel nachgewiesen sind. Dev bleibt deaktiviert. Die ursprünglichen Staging-Zielnachweise sind im [zugehörigen PR #1949](https://github.com/smart-village-solutions/sva-studio/pull/1949) zusammengefasst; sie ersetzen keinen automatischen Alarm.

Während der Ausnahme prüft der Betrieb täglich den Nachweis `/var/lib/clamav/studio-freshness` am gemeinsamen Scanner: Zeitstempel und Revision müssen gültig sein und zur geladenen Revision aus `clamd VERSION` passen. Prüfzeit, Alter, Revisionsübereinstimmung und Ergebnis sind im Betriebsnachweis festzuhalten, ohne Dateien, Zugangsdaten oder Scanner-Rohantworten aufzuzeichnen. Ab 24 Stunden ohne bestätigte Aktualität wird der Updatefehler manuell eskaliert und untersucht. Fehlender Nachweis, Scanner-Ausfall und mindestens 72 Stunden alte Signaturen verhindern Freigaben weiterhin automatisch. Kann die tägliche Kontrolle nicht gewährleistet werden, sind die Scan-Gates in Staging und Production über den regulären Rollout wieder zu deaktivieren; die privaten Buckets bleiben erhalten. Bestandsscans sind von dieser Ausnahme nicht umfasst.

Beim Abschalten der Scan-Anforderung wird ausschließlich `MEDIA_SCAN_ENABLED=false` gesetzt. Der konfigurierte private Bucket, seine Inhalte und Zugriffsrechte bleiben für bereits gespeicherte geschützte Medien erhalten; Entfernen oder Wechseln des Buckets benötigt eine eigene Migration.

### Feste Sichtbarkeit nach gescanntem Upload

Die beim Upload gewählte Sichtbarkeit bleibt bei neu gescannten Medien fest. Für eine andere Sichtbarkeit laden Sie die Datei erneut mit der gewünschten Einstellung hoch. Titel, Alternativtext und Tags bleiben bearbeitbar. Bestandsmedien ohne Scan-Nachweis behalten ihren bisherigen Vertrag.

Der Prozessor persistiert `technical.scanStatus = clean` nach erfolgreichem Scan mit der bestehenden Finalisierung. Ein nachträglicher Wechsel zwischen `public` und `protected` wird für diese Medien mit HTTP 409 und `details.reason = media_visibility_fixed` abgewiesen, ohne gleichzeitig übermittelte Metadaten zu speichern. Die Sperre bleibt bei später deaktiviertem Scan bestehen. Unveränderte oder ausgelassene Sichtbarkeit ist zulässig. Die Mediendetailansicht erläutert den erforderlichen neuen Upload. Ein eigener Storage-Wechsel gehört nicht zu diesem Umfang.

Die Mediendetailansicht zeigt direkt unter dem Medienkopf den Bereich **Virenprüfung**. Ein gespeicherter `clean`-Nachweis erscheint als **Geprüft – kein Schadsoftware-Fund**. Ein blockierter Upload oder der gespeicherte Fehler `media_scan_infected` erscheint als **Schadsoftware-Verdacht – Datei gesperrt**. Die gespeicherten Scanfehler `media_scan_unavailable`, `media_scan_stale` und `media_scan_incomplete` erscheinen als **Prüfung nicht möglich**. Ohne diese Nachweise zeigt die Ansicht **Kein Prüfergebnis vorhanden**, auch bei Bestandsmedien, noch laufender Verarbeitung oder allgemeinen Verarbeitungsfehlern. Die Anzeige übernimmt die vorhandene automatische Aktualisierung und bezieht sich auf die Upload-Prüfung; manuelle Bestandsscans bleiben im separaten Prüfbericht.

### Manueller Bestandsscan ohne Sperren

Die Medienbibliothek bietet Berechtigten mit `media.read` und `media.update` einen manuellen Bestandsscan. Ein Lauf prüft 1–25 Dateien (Standard 25) im konfigurierten Medien-Bucket der aktuellen Instanz; andere Buckets, Instanzen und der separate private Upload-Eingang werden nicht durchsucht. Höchstens 64 MiB je Datei werden geprüft. Zu große Dateien werden ohne Download als **nicht prüfbar** berichtet. Ein begrenzter S3-Range-Abruf erkennt auch Größenänderungen nach dem Listing.

`POST /api/v1/iam/media/inventory-scans` nimmt `{ limit, cursor? }` mit CSRF-Schutz entgegen und plant den hosteigenen Job `media.scan-existing` atomar über die vorhandene Queue `media-processing` ein. `GET /api/v1/iam/media/inventory-scans/{scanId}` liefert berechtigt und instanzgebunden Status und Bericht. Pro Datei erscheinen **sauber**, **Fund** oder **nicht prüfbar**, ergänzt um normierte Fehlergründe und Prüfzeitpunkt. Ein Scanner-Ausfall oder veraltete Signaturen beendet die Einzelprüfungen; verbleibende Dateien werden ebenfalls als nicht prüfbar berichtet. Der nächste Abschnitt startet nur per manuellem Klick, ohne automatische Fortsetzung oder Wiederholung.

Der Bericht bleibt im bestehenden Job-Ergebnis (`result_payload.plugin.report`). Er ist eine Momentaufnahme der gelesenen Bytes mit Objektkennung (ETag, soweit verfügbar). Dateischlüssel erscheinen ausschließlich im medienberechtigten Bericht, nicht in Logs oder Audit. Das generische Job-Monitoring blendet diesen Ergebnisbericht aus; `iam.monitoring.read` und `iam.monitoring.write` gewähren auch beim generischen Löschen eines Jobs keinen Zugriff darauf. Laufender Scan, Bericht und Fortsetzungscursor bleiben beim Nachladen oder einem Ladefehler der Medienliste erhalten. Der Worker besitzt ausschließlich lesende Storage-Abhängigkeiten: keine Dateiänderung, Löschung, Sperre, Quotenbuchung, Referenzänderung oder Aktualisierung von Asset-Metadaten, Sichtbarkeit und Scan-Markern. Auch ein Fund bleibt nutzbar; eine weitere Maßnahme ist eine separate manuelle Entscheidung.

Der manuelle Scan benötigt einen erreichbaren ClamAV-Dienst und gültigen Signaturnachweis, unabhängig von `MEDIA_SCAN_ENABLED` für neue Uploads. Die bestehenden 24-/72-Stunden-Regeln und Scanner-Limits gelten weiterhin; ein fehlender Nachweis wird als nicht prüfbar berichtet. Eine Aktivierung oder ein Scan tatsächlicher Zielbestände ist separat abzustimmen.

### Aktivierungsnachweis

Der reguläre Rollout richtet sich ausschließlich nach dem [Studio-Rollout-Prozess](../guides/studio-rollout-process.md). Vor dem Setzen von `MEDIA_SCAN_ENABLED=true` sind im freigegebenen Ziel der private Bucket einschließlich direktem anonymem Zugriff, korrekt geladene aktuelle Signaturen, Update/Reload, EICAR-Ablehnung und die unveränderte Nutzung bestehender Medien nachzuweisen. Für Staging ist der reguläre Übergang am 22.10.2026 ausdrücklich freigegeben: Nach Aktivierung neu initialisierte Uploads verwenden den privaten Eingang und die Scan-Prüfung. Bereits zuvor ausgestellte öffentliche Upload-URLs behalten ihre bisherige Gültigkeit; ihr Auslaufen ist keine Rollout-Bedingung. Es gibt dafür keine feste Übergangsfrist, App-Pause, zusätzliche Bucket-Sperre oder erzwungenen Abbruch bestehender Uploads. Der bei Initialisierung festgelegte Eingang entscheidet über den Scan: private Quarantäne-Uploads bleiben auch nach Abschalten des Schalters scanpflichtig; alte öffentliche Uploads werden dadurch nicht nachträglich als `clean` markiert. Lokale Tests sind dafür keine Produktionsabnahme und keine Deployment-Freigabe.

Die anschließend beauftragte Production-Aktivierung verwendet denselben regulären Übergang und den eigenen privaten Bucket `studio-media-private-production` auf dem vorhandenen S3-Dienst. Der private Eingang wurde für alle 23 zum Freigabezeitpunkt konfigurierten Production-Speicheranbindungen mit dem tatsächlichen Storage-Guard geprüft. Eine isolierte Schreib-/Leseprobe war anonym nicht abrufbar und wurde anschließend gelöscht; CORS erlaubt den Browser-Upload für Root- und Tenant-Hosts. Bestehende Dateien und öffentliche Bucket-Policies bleiben unverändert. Der Rollout erfordert weder eine feste Wartezeit noch eine App-Pause.

## Grenzen des MVP

- Fokus auf Bild-Assets
- Standardvarianten laufen über den vorhandenen Studio-Job-Worker; es gibt keinen separaten Medien-Worker-Dienst
- Legacy-URL-Felder in News, Events und POI bleiben im Übergang lesbar, neue hostseitige Referenzen sind jedoch der Zielpfad

## Referenzen

- [Plugin-Entwicklung](../development/plugin-development.md)
- [Architekturentscheidungen](../architecture/09-architecture-decisions.md)
- [Risiken und technische Schulden](../architecture/11-risks-and-technical-debt.md)
