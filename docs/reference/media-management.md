# Medienmanagement

Dieser Guide beschreibt den aktuellen MVP-Umgang mit Medien im Studio für Redakteure und Instanzverantwortliche.

## Zielgruppe

- Redakteure, die Bilder hochladen und in News, Events oder POI verwenden
- Administratoren, die Mediennutzung, Sichtbarkeit und Löschblockierungen nachvollziehen müssen

## Einstieg

Der kanonische Einstieg liegt unter `/admin/media`.

Dort stehen im MVP zur Verfügung:

- Medienbibliothek mit Suche und Sichtbarkeitsfilter
- cursorbasierte Navigation in binärer S3-Storage-Key-Reihenfolge; bei der Zusammenführung von Datenbank und Bucket wird der Cursor nur bis zum von beiden Quellen vollständig gelesenen Bereich vorgeschoben, die Oberfläche zeigt bewusst keine teure Gesamtzahl an
- direkter Single-File-Upload für neue Bilder aus der Bibliothek
- Metadatenpflege für Titel, Alternativtext, Beschreibung, Copyright und Lizenz
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
- weitere Schutzregeln künftig eingreifen

Metadaten- und Sichtbarkeitsänderungen laufen ebenfalls über den hostseitigen Medienvertrag und werden auditierbar verarbeitet.

## Tags und optionaler ClamAV-Scan

Registrierte Medien besitzen optional bis zu 20 Tags mit je 1–64 Zeichen. Die Tag-Pflege erfolgt in der Detailansicht, ein Tag pro Zeile. Die Bibliothek kombiniert Suchtext mit einem exakten Tag-Filter; Groß-/Kleinschreibung, Unicode-NFC und überzählige Leerzeichen werden normalisiert. Die gemeinsame Medienauswahl fragt bei Suchtext oder Tag-Filter den Server ab und begrenzt die Auswahl weiterhin auf verfügbare öffentliche Bilder. Tags liegen im vorhandenen JSON-Metadatenfeld; eine zentrale Taxonomieverwaltung wird nicht eingeführt.

Die Scannerwahl ist in [ADR-068](../adr/ADR-068-clamav-als-virenscanner-fuer-medienuploads.md) festgehalten. Der Scan ist standardmäßig deaktiviert und benötigt vor seiner Aktivierung den nachgewiesenen Storage-Schutz sowie einen regulär freigegebenen Rollout. Der bestehende Async-Change allein aktiviert keinen Scanner.

Die internen Schlüssel `.quarantine/` und `.protected/` sind dauerhaft vom normalen Bucket-Import ausgeschlossen. Jeder Zugriff auf den gemeinsamen privaten Bucket ist an den exakten Instanzpräfix gebunden; geschützte Ausgaben werden nur als geschützte Medien ausgeliefert. Diese Grenzen gelten auch bei deaktivierter Scan-Anforderung.

### Konfiguration und privater Eingang

| Einstellung | Bedeutung |
| --- | --- |
| `MEDIA_SCAN_ENABLED` | Nur `true` aktiviert die Scan-Anforderung für neue Uploads; Standard `false`. Bereits im Quarantäne-Eingang liegende Uploads dürfen auch nach Deaktivierung nicht ohne Scan veröffentlicht werden. |
| `MEDIA_CLAMAV_REPLICAS` | Standard `0`; für den vorbereitenden Betrieb im freigegebenen Ziel auf `1` setzen. |
| `MEDIA_CLAMAV_HOST`, `MEDIA_CLAMAV_PORT` | Interner Dienstname `clamav`, Standardport `3310`; kein öffentlicher Port. |
| `MEDIA_CLAMAV_SIGNATURE_STATE_PATH` | Für die App lesbarer Aktualitätsnachweis `/var/lib/clamav/studio-freshness` im Signaturvolume. |
| `MEDIA_CLAMAV_TIMEOUT_MS` | Gesamtes Zeitlimit eines Protokollaustauschs, Standard 30 Sekunden. |
| `MEDIA_SCAN_QUARANTINE_BUCKET` | Separater privater Bucket auf demselben ausgewählten S3-Dienst; darf nicht der Auslieferungs-Bucket sein. |

Der Bucket wird durch den Betreiber angelegt, nicht durch einen Upload-Request. Die vorhandenen Storage-Zugangsdaten benötigen dort Objektzugriff sowie `GetBucketAcl` und `GetBucketPolicy`. Die Anwendung akzeptiert für den Eingang nur private Owner-ACLs ohne Gruppenfreigaben und ohne Bucket-Policy; kann die Anbindung das nicht nachweisen, wird kein neues Upload-Ziel ausgegeben. Ein unbenannter kanonischer Owner-Grant wird bei S3-Anbindungen mit impliziter Owner-ACL akzeptiert. Ein vorhandenes öffentliches Storage-Gateway darf diesen Bucket nicht zusätzlich veröffentlichen.

Uploads liegen unter `.quarantine/<instance>/<asset>/<session>`. Der bestehende Job prüft die eingelesenen Bytes und verwendet genau diesen Speicherinhalt für Original und Varianten. Ein erneut verwendetes signiertes PUT-Ziel kann damit keine veränderten Bytes in das freigegebene Original einschleusen. Ausgabedateien liegen je Claim getrennt; geschützte Ausgaben bleiben unter `.protected/…` im privaten Bucket und erhalten ausschließlich signierte Delivery-URLs. Erst erfolgreich geprüfte und inhaltlich validierte Bytes gelangen in den öffentlichen Auslieferungs-Bucket. Die bestehende Finalisierung prüft zusätzlich Claim, Content-Save-Zustand und harte Quote vor `ready`; Storage-Schreibvorgänge bleiben außerhalb dieser Datenbanktransaktion. Bei fehlgeschlagener Finalisierung werden eigene Ausgaben bereinigt.

Die neue Registrierung bisher unregistrierter Bucket-Dateien ist im Scanbetrieb gesperrt, damit sie das Gate nicht umgehen kann. Bestehende Medien werden nicht automatisch neu geprüft und erhalten keinen nachträglich behaupteten Scan-Nachweis.

### Signaturpflege, Fehler und Betrieb

Auf dem SVA-Server ist genau ein gemeinsamer Scanner für Dev, Staging und Production vorgesehen. Der dedizierte Stack `studio-clamav` wird über den manuell geschützten Workflow `ClamAV Rollout` mit einer Replik gestartet; sein Vertrag liegt in `deploy/clamav-stack.yaml`. Er besitzt keinen veröffentlichten Port und verwendet das persistente Volume `studio-clamav-signatures`. Der Anschluss der App-Stacks an sein internes Netzwerk und ihr ausschließlich lesender Zugriff auf dieses Volume erfolgen im nachfolgenden Lieferabschnitt. Bis zu dessen Abnahme bleiben neue Upload-Scans deaktiviert. Die lokale Compose-Umgebung übernimmt denselben Scanner-Vertrag als eigenen Testdienst. Der Dienst führt FreshClam beim Start und danach stündlich aus. Nur ein erfolgreicher Check schreibt atomar Zeit und Daily-Datenbankrevision in den Nachweis; ein Check ohne neues Update zählt ebenfalls. Die App vergleicht diesen Nachweis vor und nach dem Scan mit der geladenen `clamd`-Version. Ein Ping, Neustart oder fehlgeschlagener Updateversuch erneuert den Nachweis nicht.

Nach 24 Stunden ohne bestätigte Aktualität warnt das vorhandene Monitoring; ab 72 Stunden werden neue Freigaben gesperrt. Ohne initialen Nachweis oder bei Ausfall, ungültiger Antwort, Timeout und unvollständiger Prüfung gibt es keine Freigabe. `AlertExceedsMax` verhindert, dass überschrittene Scan-Grenzen als sauberer Scan behandelt werden. Solche Limitmeldungen werden als unvollständige Prüfung behandelt, nicht als Malware-Fund. Im Scanbetrieb gilt vor der Upload-Reservierung ein Limit von 64 MiB. Bestehende Medien bleiben nutzbar. Der Scanner benötigt bis zu 4 GiB RAM; die amd64-Ausführung auf ARM wird nur im lokalen Override beziehungsweise Integrationstest ausdrücklich gewählt. Scanner und App müssen bei einem lokalen Volume auf demselben vorhandenen Zielknoten laufen.

Technische Fehler verwenden die vorhandenen Studio-Job-Wiederholungen. Ein Fund blockiert den Upload; Nutzer erhalten eine verständliche Meldung ohne Signaturnamen. Der erfolgreiche Finalisierungspfad bucht Speicher weiterhin genau einmal. Die Eingangsbereinigung erfolgt nach Finalisierung und Audit; ein Fehler darf verfügbare Ausgaben oder die Quotenbuchung nicht zurücknehmen. Der bestehende explizite Job-Retry kann die Eingangsbereinigung eines bereits finalisierten oder abgewiesenen Uploads wiederholen, ohne neue Freigabe oder zweite Verarbeitung. Operative Logs und Audit enthalten ausschließlich normierte Gründe und zulässige Korrelation, keine Dateiinhalte, Scanner-Rohantworten oder Tagwerte.

Die Metrikerfassung vergleicht den Signaturnachweis mit der über `VERSION` abgefragten, tatsächlich geladenen Revision. Ein abweichender Stand, fehlender Nachweis, ungültige Konfiguration oder nicht erreichbarer Scanner meldet den Sperrwert von 72 Stunden; die Versionsabfrage ist auf höchstens eine Sekunde begrenzt.

Die vorhandenen OTEL-Instrumente `media_scan_enabled`, `media_scan_signature_check_age_seconds` und `media_scan_results_total` machen Aktivierung, Check-Alter und Ergebnisse sichtbar. Die Prometheus-Regeln für die 24-/72-Stunden-Grenzen setzen ein gemeldetes aktiviertes Scan-Gate voraus; sie erzeugen keinen Alarm allein wegen einer noch nicht aktivierten Funktion. Vor Aktivierung müssen die tatsächliche Metrikübernahme und die Scanner-Erreichbarkeit im Zielbetrieb geprüft werden.

### Feste Sichtbarkeit nach gescanntem Upload

Die beim Upload gewählte Sichtbarkeit bleibt bei neu gescannten Medien fest. Für eine andere Sichtbarkeit laden Sie die Datei erneut mit der gewünschten Einstellung hoch. Titel, Alternativtext und Tags bleiben bearbeitbar. Bestandsmedien ohne Scan-Nachweis behalten ihren bisherigen Vertrag.

Der Prozessor persistiert `technical.scanStatus = clean` nach erfolgreichem Scan mit der bestehenden Finalisierung. Ein nachträglicher Wechsel zwischen `public` und `protected` wird für diese Medien mit HTTP 409 und `details.reason = media_visibility_fixed` abgewiesen, ohne gleichzeitig übermittelte Metadaten zu speichern. Die Sperre bleibt bei später deaktiviertem Scan bestehen. Unveränderte oder ausgelassene Sichtbarkeit ist zulässig. Die Mediendetailansicht erläutert den erforderlichen neuen Upload. Ein eigener Storage-Wechsel gehört nicht zu diesem Umfang.

### Manueller Bestandsscan ohne Sperren

Die Medienbibliothek bietet Berechtigten mit `media.read` und `media.update` einen manuellen Bestandsscan. Ein Lauf prüft 1–25 Dateien (Standard 25) im konfigurierten Medien-Bucket der aktuellen Instanz; andere Buckets, Instanzen und der separate private Upload-Eingang werden nicht durchsucht. Höchstens 64 MiB je Datei werden geprüft. Zu große Dateien werden ohne Download als **nicht prüfbar** berichtet. Ein begrenzter S3-Range-Abruf erkennt auch Größenänderungen nach dem Listing.

`POST /api/v1/iam/media/inventory-scans` nimmt `{ limit, cursor? }` mit CSRF-Schutz entgegen und plant den hosteigenen Job `media.scan-existing` atomar über die vorhandene Queue `media-processing` ein. `GET /api/v1/iam/media/inventory-scans/{scanId}` liefert berechtigt und instanzgebunden Status und Bericht. Pro Datei erscheinen **sauber**, **Fund** oder **nicht prüfbar**, ergänzt um normierte Fehlergründe und Prüfzeitpunkt. Ein Scanner-Ausfall oder veraltete Signaturen beendet die Einzelprüfungen; verbleibende Dateien werden ebenfalls als nicht prüfbar berichtet. Der nächste Abschnitt startet nur per manuellem Klick, ohne automatische Fortsetzung oder Wiederholung.

Der Bericht bleibt im bestehenden Job-Ergebnis (`result_payload.plugin.report`). Er ist eine Momentaufnahme der gelesenen Bytes mit Objektkennung (ETag, soweit verfügbar). Dateischlüssel erscheinen ausschließlich im medienberechtigten Bericht, nicht in Logs oder Audit. Das generische Job-Monitoring blendet diesen Ergebnisbericht aus; `iam.monitoring.read` und `iam.monitoring.write` gewähren auch beim generischen Löschen eines Jobs keinen Zugriff darauf. Laufender Scan, Bericht und Fortsetzungscursor bleiben beim Nachladen oder einem Ladefehler der Medienliste erhalten. Der Worker besitzt ausschließlich lesende Storage-Abhängigkeiten: keine Dateiänderung, Löschung, Sperre, Quotenbuchung, Referenzänderung oder Aktualisierung von Asset-Metadaten, Sichtbarkeit und Scan-Markern. Auch ein Fund bleibt nutzbar; eine weitere Maßnahme ist eine separate manuelle Entscheidung.

Der manuelle Scan benötigt einen erreichbaren ClamAV-Dienst und gültigen Signaturnachweis, unabhängig von `MEDIA_SCAN_ENABLED` für neue Uploads. Die bestehenden 24-/72-Stunden-Regeln und Scanner-Limits gelten weiterhin; ein fehlender Nachweis wird als nicht prüfbar berichtet. Eine Aktivierung oder ein Scan tatsächlicher Zielbestände ist separat abzustimmen.

### Aktivierungsnachweis

Der reguläre Rollout richtet sich ausschließlich nach dem [Studio-Rollout-Prozess](../guides/studio-rollout-process.md). Vor dem Setzen von `MEDIA_SCAN_ENABLED=true` sind im freigegebenen Ziel der private Bucket einschließlich direktem anonymem Zugriff, korrekt geladene aktuelle Signaturen, Update/Reload, EICAR-Ablehnung und die unveränderte Nutzung bestehender Medien nachzuweisen. Bereits begonnene Uploads am früheren öffentlichen Ziel sind vor dem Umschalten abzuschließen oder abzubrechen. Lokale Tests sind dafür keine Produktionsabnahme und keine Deployment-Freigabe.

## Grenzen des MVP

- Fokus auf Bild-Assets
- Standardvarianten laufen über den vorhandenen Studio-Job-Worker; es gibt keinen separaten Medien-Worker-Dienst
- Legacy-URL-Felder in News, Events und POI bleiben im Übergang lesbar, neue hostseitige Referenzen sind jedoch der Zielpfad

## Referenzen

- [Plugin-Entwicklung](../development/plugin-development.md)
- [Architekturentscheidungen](../architecture/09-architecture-decisions.md)
- [Risiken und technische Schulden](../architecture/11-risks-and-technical-debt.md)
