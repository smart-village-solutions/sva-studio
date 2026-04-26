## Kontext

Medienmanagement ist im Studio kein isoliertes Fachfeature, sondern eine hostseitige Querschnittsfunktion. Das Zielbild verlangt:

- zentrale Wiederverwendbarkeit über mehrere Module und Instanzen hinweg
- Trennung von fachlicher Nutzung und technischer Dateiausprägung
- kontrollierte Variantenbildung und Auslieferung
- Mandantenisolation, Rechte, Audit und Löschsicherheit

Die bestehende Plugin-Architektur ist dafür nicht der richtige Ort. Plugins dürfen heute fachliche Erweiterungen auf Basis des SDK liefern, aber keine hostseitigen Storage-, Sicherheits- oder Routing-Bypässe etablieren. Medienmanagement muss deshalb als Capability des Hosts modelliert werden, mit optionalen Extension Points für Fachmodule.

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
- `visibility`
- `processingStatus`

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

## Variantenstrategie

Die Spezifikation soll keinen einzelnen Bild- oder Processing-Stack erzwingen, aber den Vertrag festlegen:

- Original bleibt erhalten
- Varianten sind ableitbar und ersetzbar
- Presets werden zentral verwaltet
- Breitenstufen unterstützen responsive Auslieferung
- häufige Varianten dürfen eager erzeugt werden
- seltene Varianten dürfen lazy erzeugt werden

Empfohlen ist ein hybrider Ansatz aus eager und lazy generation, weil beim Upload die spätere Nutzung oft noch unbekannt ist.

## Storage- und Auslieferungsvertrag

Die Spezifikation benennt S3-kompatiblen Objektspeicher als Zielbild, ohne einen einzelnen Anbieter hart festzuschreiben. Wichtig ist der Vertrag:

- Assets und Varianten werden mandantenfähig abgelegt
- öffentliche und geschützte Medien sind unterscheidbar
- öffentliche URLs bleiben stabil genug für CDN und Caching
- geschützte Medien laufen über signierte oder anderweitig kontrollierte Zugriffspfade

Die Storage-Schicht ist keine Plugin-Verantwortung. Sie liegt beim Host und muss in Deployment-, Security- und Observability-Dokumentation mitgeführt werden.

## IAM und Audit

Medienoperationen werden als eigene Fachrechte modelliert, mindestens für:

- Lesen
- Upload initialisieren
- Metadaten pflegen
- Referenzen verwalten
- Löschen oder Archivieren
- geschützte Auslieferung freigeben

Löschungen müssen gegen aktive Referenzen, rechtliche Haltefristen oder geschützte Betriebszustände fail-closed sein. Alle sicherheits- und fachrelevanten Medienereignisse erzeugen Audit-Events.

## Laufzeit- und Betriebswirkung

Die Capability erzeugt neue Laufzeitpfade:

- Upload initialisieren
- Objekt hochladen
- Metadaten extrahieren
- Varianten generieren
- Referenzen anlegen oder entfernen
- Asset ausliefern
- Verwendung nachweisen

Damit sind mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Qualitätsanforderungen und Risiken betroffen. Wahrscheinlich ist zusätzlich eine ADR nötig, weil eine neue hostseitige Infrastrukturgrenze eingeführt wird.

## MVP-Empfehlung

Für die erste Iteration:

- Bilder zuerst
- zentrale Bibliothek
- Metadatenpflege
- referenzbasierte Nutzung in `content-management`
- Breitenstufen und wenige zentrale Presets
- Verwendungsnachweis
- einfache geschützte vs. öffentliche Sichtbarkeit

Video, Audio, komplexe Freigaben und KI-Analysen bleiben explizit nachgelagert.
