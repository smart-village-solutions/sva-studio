# ADR-068: ClamAV als Virenscanner für Medienuploads

**Status:** Accepted
**Entscheidungsdatum:** 2026-10-20
**Entschieden durch:** Projektverantwortlicher im Rahmen der Medienplanung
**GitHub Issue:** —
**GitHub PR:** —

## Kontext

Neue Medienuploads sollen vor ihrer Freigabe auf Schadsoftware geprüft werden. Der verkleinerte Change `add-media-async-processing` verlagert die vorhandene Verarbeitung in Studio-Jobs; er implementiert weder einen Scanner noch eine allgemeine Medienjob-Plattform. Die Scan-Anbindung gehört zur weiteren Planung von `extend-media-management-governance`.

Benötigt wird ein konkreter Scanner mit überschaubarer Integration und eigenem Betrieb. Eine zusätzliche Queue, ein Auswahlmechanismus für mehrere Scanner oder eine umfassende Dateisicherheitsplattform sind für diesen Bedarf nicht erforderlich. Studio steht unter EUPL-1.2; die Lizenzgrenze zum Scanner muss nachvollziehbar bleiben.

## Entscheidung

- Wir verwenden **ClamAV** als eigenständigen, intern erreichbaren Scan-Dienst im Container. Der vorhandene Medienverarbeitungsjob überträgt den Dateiinhalt über das dokumentierte `clamd`-Protokoll `INSTREAM` und wertet das Ergebnis aus.
- Der Scan erfolgt vor der Variantenverarbeitung und Freigabe neuer Uploads. Nur eine erfolgreich abgeschlossene Prüfung ohne Fund erlaubt die weitere Verarbeitung. Fund, Timeout, unvollständige Prüfung oder Scannerfehler führen zu keiner Freigabe; technische Wiederholungen verwenden die vorhandene Studio-Job-Fähigkeit.
- Ungeprüfte Dateien müssen auch im Storage vor öffentlichem Abruf geschützt sein. Eine Sperre ausschließlich am Studio-Lesepfad genügt nicht, da der bestehende Storage-Pfad direkte öffentliche URLs unterstützt. Der konkrete geschützte Upload- und Veröffentlichungspfad ist vor Aktivierung des Scans zu implementieren und nachzuweisen.
- `freshclam` aktualisiert die offiziellen Signaturen automatisch. Die Signaturdatenbank liegt auf einem persistenten Volume; `clamd` lädt aktualisierte Signaturen nach. Signaturupdates benötigen kein Studio-Deployment.
- Wir integrieren genau diesen Scanner über den bestehenden Processing-Pfad. Wir binden `libclamav` nicht direkt ein und übernehmen keinen ClamAV-Quellcode in Studio.

Die Entscheidung wählt das Produkt und den Integrationsweg. Sie ist kein Nachweis einer bereits implementierten oder produktiv aktivierten Scan-Funktion und erweitert den Async-Change nicht um Scan-, Replace- oder Retention-Verträge.

## Begründung

ClamAV bietet einen dokumentierten Streaming-Scan und offizielle Container-Images. Der Dienst kann innerhalb der eigenen Infrastruktur betrieben werden; die Scan-Anbindung benötigt keinen Upload an einen externen Analysedienst. Automatische Signaturpflege ist Bestandteil des Produkts. Damit deckt die Lösung den aktuellen Upload-Bedarf ohne zusätzliche Dateisicherheitsplattform ab.

## Lizenzbewertung

ClamAV steht unter **GPLv2**, Studio unter **EUPL-1.2**. Die vorgesehene Kommunikation über das Scanner-Protokoll behandelt beide als eigenständige Programme: Dateiinhalte und Scan-Ergebnisse werden ausgetauscht, ohne Scanner-Code oder interne Programmdatenstrukturen in Studio zu integrieren. Nach der zugrunde gelegten Einschätzung kann Studio dabei unter EUPL bleiben, während ClamAV seine GPL-Lizenz behält. Die tatsächliche Unabhängigkeit ist maßgeblich; eine Container-Grenze allein entscheidet die Lizenzfrage nicht.

Bei Weitergabe eines ClamAV-Images sind die GPL-Pflichten einschließlich Lizenzhinweisen und ordnungsgemäßer Bereitstellung des zugehörigen Quellcodes zu erfüllen. Eine eventuell eingesetzte Client-Dependency ist gesondert auf ihre Lizenz zu prüfen. Die EUPL-Kompatibilitätsklausel erlaubt unter ihren Voraussetzungen die Verbreitung eines kombinierten Werkes unter GPL; sie erlaubt nicht pauschal die Umlizenzierung von GPL-Code unter EUPL. Dieser kombinierte Weg ist hier nicht vorgesehen. Dies ist eine technische Lizenzeinschätzung und keine verbindliche Rechtsberatung.

## Betrachtete Alternativen

| Alternative | Vorteil | Grund gegen die Auswahl für diesen Lieferumfang |
| --- | --- | --- |
| WithSecure Atlant | Dokumentierte REST- und ICAP-Schnittstellen; kommerzieller Produktpfad | Für den aktuellen Bedarf ist keine zusätzliche kommerzielle Beschaffung begründet. Bei gefordertem Herstellersupport erneut prüfen. |
| Sophos Protection for Linux | Lokaler Dateiscan über `avscanner` | Erfordert eine Anbindung über lokale Dateien und den verwalteten Linux-Agenten statt des hier gewählten Streaming-Dienstes. |
| OPSWAT MetaDefender Core | REST-API, eigener Betrieb und mehrere Scan-Engines | Der Funktionsumfang und die zusätzliche Plattform gehen über den derzeitigen Upload-Bedarf hinaus. |

Die Alternativen sind mögliche Integrationswege, keine bereits durchgeführten Produkt- oder Erkennungsqualitätstests. Ihre Nutzungs- und Hosting-Lizenzen müssten bei einer Auswahl konkret geklärt werden.

## Konsequenzen für Umsetzung und Betrieb

- Ein zusätzlicher Scan-Dienst benötigt Ressourcen und Pflege. Die ClamAV-Dokumentation nennt mindestens 3 GiB, bevorzugt 4 GiB RAM; die konkrete Dimensionierung muss Dateigrößen, Parallelität und Signatur-Reload berücksichtigen.
- Der Scanner-Zugang bleibt intern beschränkt. `clamd` authentifiziert und verschlüsselt TCP-Verbindungen nicht selbst. Stream- und Scan-Limits müssen zu den erlaubten Uploads passen; das Überschreiten eines Limits darf nicht als erfolgreicher Scan gelten.
- Erreichbarkeit, fehlgeschlagene Signaturupdates und die Aktualität der tatsächlich geladenen Signaturen werden über das bestehende Monitoring sichtbar gemacht. Nach 24 Stunden ohne bestätigte Aktualität wird gewarnt; nach 72 Stunden werden neue Uploads nicht mehr freigegeben. Bereits verfügbare Medien bleiben nutzbar. Ein erfolgreicher Aktualitätscheck mit passendem geladenem Signaturstand hebt diese Sperre auf; auch ein Check ohne verfügbares Update bestätigt Aktualität. Ein bloßer Ping, Neustart oder Updateversuch setzt die Frist nicht zurück. Ohne initialen Nachweis gibt es keine Freigabe. Scanner-Ausfall oder unvollständige Prüfung sperren unabhängig von diesen Fristen; ein kurzzeitig fehlgeschlagener Updateversuch allein ist noch kein Scanfehler. Diese Betriebsregel wurde am 20.10.2026 abgestimmt.
- Scanner-Software und Container müssen zusätzlich regulär aktualisiert werden. Automatische Signaturupdates ersetzen keine Software- und Sicherheitsupdates.
- Ein erfolgreicher Scan garantiert keine Schadsoftwarefreiheit. Bestehende Inhaltsvalidierung, Berechtigungen und Verarbeitungslimits bleiben erforderlich; Fehlalarme sind möglich.
- Die Umsetzung muss erfolgreiche Prüfung, Fund, Ausfall, Timeout, überschrittene Limits sowie die fehlende öffentliche Abrufbarkeit vor Freigabe belegen. Eine automatische Neuprüfung sämtlicher Bestandsmedien ist nicht Bestandteil dieser Produktwahl.

## Ergänzung vom 21.10.2026: Sichtbarkeit

Für neu gescannte Medien bleibt die beim Upload gewählte Sichtbarkeit fest, auch bei später deaktiviertem Scanner. Eine Änderung erfordert einen neuen Upload. Der bestehende Prozessor hält den erfolgreichen Scan im technischen Metadatenobjekt fest; die vorhandene Änderungs-API sperrt Sichtbarkeitswechsel in beide Richtungen, lässt aber normale Metadatenänderungen zu. Bestandsmedien ohne Scan-Nachweis behalten ihren bisherigen Vertrag. Damit ist kein zusätzlicher Storage-Wechsel erforderlich.

## Referenzen

- [ADR-039: Medienmanagement als Host-Capability mit Storage- und Processing-Vertrag](./ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)
- [ADR-040: graphile-worker als Standard für Hintergrundprozesse](./ADR-040-graphile-worker-als-standard-fuer-hintergrundprozesse.md)
- [ClamAV: Lizenz und Systemanforderungen](https://docs.clamav.net/)
- [ClamAV: Streaming-Protokoll und Scan-Limits](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)
- [ClamAV: Containerbetrieb, Signaturpersistenz und Supportende](https://docs.clamav.net/manual/Installing/Docker.html)
- [ClamAV: Signaturupdates mit FreshClam](https://docs.clamav.net/manual/Usage/SignatureManagement.html)
- [Europäische Kommission: EUPL-FAQ zu Interoperabilität und Kompatibilität](https://interoperable-europe.ec.europa.eu/collection/eupl/faqs)
- [GNU: GPLv2-FAQ zur Weitergabe und zu unabhängigen Programmen](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html)
- [WithSecure Atlant: API-Dokumentation](https://support.withsecure.com/userguides/data/pdf/atlant_api_guide_eng.pdf)
- [Sophos Protection for Linux: Server Protection Agent](https://docs.sophos.com/esg/spl/en-US/index.html?contextID=protect-devices-server-Linux-agent)
- [OPSWAT MetaDefender Core: API-Dokumentation](https://www.opswat.com/docs/mdcore/metadefender-core/ref)
