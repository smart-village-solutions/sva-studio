## Kontext

Medienmanagement ist im Studio kein isoliertes Fachfeature, sondern eine hostseitige Querschnittsfunktion. Das Zielbild verlangt:

- zentrale Wiederverwendbarkeit über mehrere Module und Instanzen hinweg
- Trennung von fachlicher Nutzung und technischer Dateiausprägung
- kontrollierte Variantenbildung und Auslieferung
- Mandantenisolation, Rechte, Audit und Löschsicherheit

Die bestehende Plugin-Architektur ist dafür nicht der richtige Ort. Plugins dürfen heute fachliche Erweiterungen auf Basis des SDK liefern, aber keine hostseitigen Storage-, Sicherheits- oder Routing-Bypässe etablieren. Medienmanagement muss deshalb als Capability des Hosts modelliert werden, mit optionalen Extension Points für Fachmodule.

Der inzwischen etablierte Host-Zuschnitt mit Build-time-Registry, `adminResources`, `contentUi`-Spezialisierungen und modulgebundener Navigation bestätigt diese Richtung: Medienmanagement darf nicht als viertes Fachplugin mit eigener CRUD-Strecke entstehen, sondern muss an dieselben Host-Verträge anschließen, über die News, Events und POI bereits materialisiert werden.

## Ziele

- Medien als zentrale Assets mit stabiler Identität modellieren
- Inhalte und Fachmodule an Medien über Referenzen und Rollen ankoppeln
- technische Varianten zentral steuern, ohne Content-Modelle an Dateigrößen zu koppeln
- Upload, Pflege, Löschung und Auslieferung über IAM und Audit absichern
- spätere Erweiterungen für Video, Audio, KI-Analyse oder externe Quellen offenhalten

## Nicht-Ziele für den ersten Schnitt

- vollständiges Digital Asset Management mit Freigabeworkflows
- komplexe Versionierung und Branching von Medien
- generische Plugin-Eigenimplementierungen für Storage oder Variantengenerierung
- unbegrenzte Suche oder Volltextsuche über Binärinhalte

## Architekturentscheidung: Host-Capability mit eigenem Domänenpaket

Der bevorzugte Zuschnitt ist ein eigenes hostseitiges Package `packages/media` für den kanonischen Medienvertrag. Dieses Package enthält keine UI, keine Datenbankzugriffe und keine runtime-spezifischen Adapter, sondern:

- Domänentypen für `MediaAsset`, `MediaVariant`, `MediaReference`
- Validierungs- und Statuslogik
- Preset- und Rollenmodell
- Regeln für Referenzierbarkeit, Ersetzbarkeit und Löschbarkeit

Die Umsetzung bleibt schichtentreu:

- `packages/media`: Domänenvertrag und framework-agnostische Logik
- `packages/data`: Persistenz, Migrationen, Repositories, Such- und Nutzungsabfragen
- IAM-Zielpackages (`packages/auth-runtime`, `packages/iam-core`, `packages/iam-admin`, `packages/iam-governance`, `packages/instance-registry`): serverseitige Rechte-, Upload-, Download- und Auditpfade
- `apps/sva-studio-react`: Bibliothek, Picker, Metadatenpflege, Verwendungsnachweis
- optional dedizierter Worker oder Job-Pfad für asynchrone Verarbeitung

Falls das Team kein neues Package einführen will, ist `packages/core/src/media/*` die zweitbeste Variante. Nicht empfohlen ist ein monolithisches `packages/media`, das gleichzeitig Domain, Persistenz, API und UI enthält.

## Host-Integration: Admin-Ressource plus spezialisierte Unterrouten

Der kanonische Einstieg für Medienmanagement wird als hosteigene Admin-Capability unter `/admin/media` modelliert. Dieser Einstieg bildet Bibliothek, Suche, Filter, Pagination, Detailwechsel, Rechteprüfung und Standardaktionen ab. Für Medien-spezifische Interaktionen, die nicht sinnvoll in eine reine Listen-/Detail-Metapher passen, darf der Host ergänzende Unterrouten materialisieren, etwa für:

- Fokuspunkt- und Crop-Bearbeitung
- Nutzungsanalyse und Usage-Impact
- geschützte Auslieferungs- oder Varianten-Detailansichten

Empfohlen ist ein Hybrid-Zuschnitt:

- hosteigene Admin-Ressource `media` für den kanonischen Einstieg
- hosteigene Spezialrouten unter `/admin/media/...` für nicht-tabellarische Workflows

Dadurch bleibt der Einstieg konsistent zur heutigen Admin-Resource-Architektur, ohne Medien-UX in das Muster der inhaltstypgebundenen Plugins zu zwängen.

### Admin-Resource-Vertrag

Medienmanagement nutzt den bestehenden hostseitigen Build-time-Registry- und Admin-Resource-Vertrag als führenden Integrationspunkt. Es entsteht keine zweite, konkurrierende Registrierungslogik für Navigation, Guards oder Search-Params.

Anders als News, Events und POI ist Medienmanagement keine `contentUi`-Spezialisierung auf einer Content-Ressource. Die Capability ist eine eigenständige hostseitige Ressource mit eigener Listen- und Detaillogik. Falls der bestehende `AdminResourceDefinition`-Vertrag dafür Ergänzungen braucht, werden diese hostseitig und generisch vorgenommen; es wird kein Medien-Sonderfall außerhalb des Vertrags eingeführt.

## Domänenmodell

### MediaAsset

Repräsentiert das führende Originalmedium.

Pflichtfelder im Zielbild:

- `id`
- `instanceId`
- `storageKey`
- `mediaType`
- `mimeType`
- `byteSize`
- technische Metadaten wie Breite, Höhe, Dauer oder Seitenzahl soweit anwendbar
- redaktionelle Metadaten wie Titel, Beschreibung, Alt-Text, Copyright, Lizenz
- bildspezifische Bearbeitungsmetadaten wie Fokuspunkt und optionaler redaktioneller Zuschnitt
- `visibility`
- `processingStatus`
- `uploadStatus`

### MediaVariant

Repräsentiert eine abgeleitete technische Variante eines Assets.

Pflichtfelder im Zielbild:

- `id`
- `assetId`
- `variantKey`
- `presetKey`
- `format`
- `width` und weitere transformationsrelevante Kennzeichen
- `storageKey`
- `generationStatus`

### MediaReference

Repräsentiert die fachliche Nutzung eines Assets durch einen anderen Domänenkontext.

Pflichtfelder im Zielbild:

- `id`
- `assetId`
- `targetType`
- `targetId`
- `role`
- optional Sortierung oder Slot-Information

## Referenzmodell und Content-Anbindung

Inhalte und andere Module referenzieren Medien nie über rohe URLs oder Dateipfade. Sie referenzieren ein `MediaAsset` in einer fachlichen Rolle wie `teaser_image`, `header_image`, `gallery_item` oder `download`.

Die Auswahl der konkreten technischen Variante erfolgt zentral über Presets und Ausgabeanforderungen. Dadurch bleiben Inhalte stabil, auch wenn Breitenstufen, Formate oder CDN-Regeln später angepasst werden.

Plugins binden Medien über einen hostseitigen Media-Picker an. Plugins deklarieren zulässige Rollen, Medientypen und optionale Preset-Anforderungen, erhalten aber keine direkte Storage-Schnittstelle und keine MinIO-Artefakte.

### Migrations- und Bridge-Pfad für bestehende Plugins

Der aktuelle Codebestand besitzt bereits URL-basierte Medienfelder in den Mainserver-nahen Plugins, insbesondere `sourceUrl`, `imageUrl` und `mediaContents`. Diese Realität wird vom Zielbild nicht ignoriert, sondern explizit überführt:

- News, Events und POI bleiben während der Migration funktionsfähig
- bestehende URL-basierte Felder werden nicht dauerhaft zum Zielvertrag erklärt
- der Host führt einen kontrollierten Bridge-Pfad ein, über den bestehende Inhalte schrittweise in `MediaAsset`- und `MediaReference`-Beziehungen überführt werden können

Der MVP muss nicht alle Altbestände sofort vollständig migrieren, aber er muss den Zielpfad spezifizieren:

- wie bestehende URL-basierte Eingaben im Übergang akzeptiert oder abgewiesen werden
- wie daraus hostseitige Medienreferenzen entstehen
- wie Plugins vom URL-Formular auf den hostseitigen Media-Picker wechseln
- wie Legacy-Felder später entfernt werden, ohne fachliche Inhalte zu verlieren

## Variantenstrategie

Die Spezifikation soll keinen einzelnen Bild- oder Processing-Stack erzwingen, aber den Vertrag festlegen:

- Original bleibt erhalten
- Varianten sind ableitbar und ersetzbar
- Presets werden zentral verwaltet
- Breitenstufen unterstützen responsive Auslieferung
- Fokuspunkt und redaktioneller Zuschnitt werden als strukturierte Asset- bzw. Rollenmetadaten gespeichert und bei der Variantengenerierung berücksichtigt
- übergroße Bilder werden gemäß zentraler Maximalabmessungen verkleinert, ohne das unveränderte Original als führendes Asset zu verlieren
- häufige Varianten dürfen eager erzeugt werden
- seltene Varianten dürfen lazy erzeugt werden

Empfohlen ist ein hybrider Ansatz aus eager und lazy generation, weil beim Upload die spätere Nutzung oft noch unbekannt ist.

### Bildbearbeitungsfunktionen im MVP

Der erste Bild-MVP umfasst keine freie Bildbearbeitung, aber drei verbindliche Funktionen:

- Fokuspunkt setzen, damit automatische Crops den relevanten Bildbereich erhalten
- Zuschnitt setzen, um für definierte Rollen oder Presets einen redaktionell kontrollierten Ausschnitt zu verwenden
- große Bilder beim Processing auf konfigurierte Maximalabmessungen verkleinern, damit Storage, Auslieferung und UI nicht von Originalgrößen abhängig werden

Diese Bearbeitungsinformationen gehören nicht in fachliche Content-Objekte. Sie werden am Medien-Asset oder an der rollenbezogenen Medienreferenz gespeichert und vom zentralen Processing-Pfad in Varianten übersetzt.

## Storage- und Auslieferungsvertrag

Die Spezifikation benennt MinIO als konkret zu unterstützenden S3-kompatiblen Objektspeicher. Der Code soll MinIO nicht in das fachliche Medienmodell hineinziehen, aber alle hostseitigen Storage-, Upload- und Auslieferungsschnittstellen müssen mit MinIO-kompatiblen Semantiken entworfen und getestet werden. Wichtig ist der Vertrag:

- Assets und Varianten werden mandantenfähig abgelegt
- Bucket, Object-Key, ETag, Content-Type, Content-Length und objektbezogene Metadaten werden als explizite technische Storage-Felder modelliert, nicht aus fachlichen Referenzen abgeleitet
- Upload-Pfade unterstützen MinIO-kompatible direkte Uploads über kontrolliert ausgestellte, kurzlebige signierte URLs oder einen gleichwertigen serverseitig geprüften Proxy-Pfad
- öffentliche und geschützte Medien sind unterscheidbar
- öffentliche URLs bleiben stabil genug für CDN und Caching
- geschützte Medien laufen über signierte oder anderweitig kontrollierte Zugriffspfade

Die Storage-Schicht ist keine Plugin-Verantwortung. Sie liegt beim Host und muss in Deployment-, Security- und Observability-Dokumentation mitgeführt werden. Implementierungscode außerhalb der Storage-Adapter darf keine direkten MinIO-Client-Aufrufe, Bucket-Namen oder Object-Keys als fachliche Kopplung verwenden; er spricht über den hostseitigen Medienvertrag und dedizierte Storage-Ports.

### Adapter-Entscheidung

Der MinIO-Storage-Adapter wird als eigener hostseitiger Adapter gegen einen internen Port implementiert; das S3-Protokoll selbst wird nicht selbst implementiert. Der Adapter soll ein etabliertes S3-kompatibles SDK nutzen, bevorzugt AWS SDK v3 (`@aws-sdk/client-s3` und `@aws-sdk/s3-request-presigner`) mit MinIO-Konfiguration (`endpoint`, `forcePathStyle`, Bucket, Credentials, Region). Dadurch bleibt MinIO als Runtime-Ziel explizit unterstützt, ohne das fachliche Medienmodell oder Content-/Plugin-Code an MinIO-spezifische Client-Typen zu koppeln.

Der interne Port umfasst mindestens:

- Upload-URL oder Upload-Proxy vorbereiten
- Objektmetadaten über `HEAD`/Stat lesen
- Objektstream für kontrollierte Auslieferung lesen
- Objekte und Varianten löschen
- technische Fehler in fachliche, auditierbare Fehlercodes übersetzen

## IAM und Audit

Medienoperationen werden als eigene Fachrechte modelliert, mindestens für:

- Lesen
- Upload initialisieren
- Metadaten pflegen
- Referenzen verwalten
- Löschen oder Archivieren
- geschützte Auslieferung freigeben

Zusätzlich muss die Capability an das inzwischen etablierte Modul- und Sichtbarkeitsmodell des Hosts anschließen. Das bedeutet:

- die UI-Sichtbarkeit von `/admin/media` und Medien-Unterseiten wird über denselben hostseitigen Guard- und Modulpfad gesteuert wie andere Admin-Capabilities
- falls Medienmanagement als zuweisbares Modul behandelt wird, erfolgt dies über denselben `moduleIam`-/Modulzuweisungsmechanismus wie bei pluginbasierten Fachmodulen
- falls Medienmanagement als immer vorhandene Core-Capability behandelt wird, bleibt trotzdem die feingranulare Autorisierung über `media.*`-Rechte serverseitig verbindlich

Die konkrete Entscheidung ist in der Umsetzung explizit festzuhalten; eine implizite Sonderbehandlung außerhalb des aktuellen Guard-Modells ist nicht zulässig.

Löschungen müssen gegen aktive Referenzen, rechtliche Haltefristen oder geschützte Betriebszustände fail-closed sein. Alle sicherheits- und fachrelevanten Medienereignisse erzeugen Audit-Events.

## MVP-Abgrenzung und Folgeumfang

Das MVP konzentriert sich auf den tragfähigen Kern: Medienvertrag, MinIO-Storage-Adapter, Varianten, Fokuspunkt/Zuschnitt, Upload-Status, referenzbasierte Nutzung, Usage-Impact, Löschschutz, IAM und Audit.

Erweiterte Governance- und Betriebsfunktionen werden bewusst in `extend-media-management-governance` verschoben. Dazu gehören Pflichtfeld-Konfiguration je Instanz/Medientyp, mehrsprachige Metadaten, Ordner, Tags, Kategorien, Duplikaterkennung, Upload-Replace mit Referenzerhalt, Malware-Scan, rollenbezogene Rate-Limits und Quota-Warnungen.

## Laufzeit- und Betriebswirkung

Die Capability erzeugt neue Laufzeitpfade:

- `/admin/media` als kanonischer Host-Einstieg
- spezialisierte Medien-Unterseiten unter `/admin/media/...`
- Upload initialisieren
- Objekt hochladen
- Metadaten extrahieren
- Varianten generieren
- Upload-Status und Fehlerdetails aktualisieren
- Referenzen anlegen oder entfernen
- Usage-Impact vor kritischen Änderungen berechnen
- Asset ausliefern
- Verwendung nachweisen

Damit sind mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Qualitätsanforderungen und Risiken betroffen. Wahrscheinlich ist zusätzlich eine ADR nötig, weil eine neue hostseitige Infrastrukturgrenze eingeführt wird.

## MVP-Empfehlung

Für die erste Iteration:

- Bilder zuerst
- zentrale Bibliothek unter `/admin/media`
- Metadatenpflege
- Fokuspunkt und einfacher Zuschnitt für Bilder
- automatische Verkleinerung übergroßer Bilder nach zentraler Konfiguration
- Upload-Status und Usage-Impact
- referenzbasierte Nutzung in `content-management`
- Media-Picker für Plugins und Migrationspfad für bestehende URL-basierte News-/Events-/POI-Medienfelder
- Breitenstufen und wenige zentrale Presets
- Verwendungsnachweis
- einfache geschützte vs. öffentliche Sichtbarkeit

Video, Audio, komplexe Freigaben und KI-Analysen bleiben explizit nachgelagert.
