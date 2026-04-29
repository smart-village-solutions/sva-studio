# ADR-039: Medienmanagement als Host-Capability mit Storage- und Processing-Vertrag

**Status:** Akzeptiert
**Entscheidungsdatum:** 2026-04-29
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** n/a
**GitHub PR:** n/a

## Kontext

SVA Studio benötigt ein zentrales Medienmanagement für Upload, Varianten, Metadatenpflege, referenzbasierte Nutzung, geschützte Auslieferung und Nutzungstransparenz. Diese Anforderungen betreffen mehrere Architekturgrenzen gleichzeitig:

1. Fachmodule dürfen Medien nicht mehr über rohe URL-Felder oder technische Storage-Artefakte als führenden Vertrag modellieren.
2. Storage, Mandantentrennung, geschützte Auslieferung, Variantenbildung und Audit sind Host-Verantwortung und keine Plugin-Aufgabe.
3. Das bestehende Host-Modell mit Admin-Ressourcen, modulgebundener Sichtbarkeit und Plugin-SDK-Verträgen darf nicht durch einen Medien-Sonderpfad umgangen werden.

Zusätzlich muss die Entscheidung mit dem Plugin-SDK-Vertrag aus ADR-034 kompatibel bleiben. Plugins sollen den hostseitigen Media-Picker und deklarative Medienrollen nutzen können, aber keine MinIO-/S3-Clients, Bucket-Namen, Object-Keys oder presigned URLs als öffentliche Boundary erhalten.

## Entscheidung

- Medienmanagement wird als hostseitige Capability und nicht als Fachplugin umgesetzt.
- Der kanonische Einstieg wird unter `/admin/media` als hosteigene Admin-Ressource materialisiert; spezialisierte Workflows dürfen unter `/admin/media/...` ergänzt werden.
- Der kanonische Domänenvertrag wird in `packages/media` modelliert.
- Persistenz und Repository-Zugriffe liegen in `packages/data` und `packages/data-repositories`.
- Runtime-seitige Ports, Services und spätere HTTP-Endpunkte liegen in `packages/auth-runtime`.
- Plugins binden Medien ausschließlich über den Plugin-SDK-Vertrag und hostseitige UI-Bausteine an.
- Der Host kapselt MinIO über einen internen Storage-Port und einen S3-kompatiblen Adapter; bevorzugt wird AWS SDK v3 mit MinIO-Konfiguration.
- Fachliche Referenzen speichern `MediaAsset`-/`MediaReference`-Identitäten, aber keine Bucket-, Object-Key- oder signierten URL-Artefakte.
- Varianten werden im MVP hybrid behandelt: häufige Varianten synchron beim Upload, seltene Varianten lazy on demand; ein dedizierter Async-Worker ist Folgearbeit.

## Begründung

### Positive Konsequenzen

- Eine einzige Host-Capability erzwingt konsistente Rechte-, Audit-, Storage- und Löschregeln.
- Fachmodule bleiben von Storage-Details entkoppelt und können Medien referenzbasiert wiederverwenden.
- Der bestehende Host-Pfad für Admin-Ressourcen, Guards und Modulzuweisung bleibt führend.
- `packages/media` trennt den fachlichen Medienvertrag sauber von React, Persistenz und Runtime-Adaptern.
- Die Kapselung des S3-kompatiblen Clients reduziert spätere Anbieterbindung und verhindert direkte SDK-Kopplung im Fachcode.

### Negative Konsequenzen

- Die erste Einführung erzeugt neue Querschnittsabhängigkeiten zwischen `media`, `data`, `auth-runtime`, Host-UI und Plugin-SDK.
- Der MVP enthält noch keinen dedizierten Async-Processing-Worker für aufwendige Bild- oder Folgemedientyp-Verarbeitung.
- Bestehende URL-basierte Felder in News, Events und POI benötigen einen Bridge- und Migrationspfad statt eines harten Schnitts.

## Verworfene Alternativen

### 1. Medienmanagement als eigenes Plugin

Verworfen, weil damit Storage, Auslieferung, IAM und Audit über eine Plugin-Grenze laufen würden, obwohl sie Host-Verantwortung sind.

### 2. Domänenvertrag unter `packages/core/src/media/*`

Nur zweitbeste Option. Verworfen zugunsten von `packages/media`, weil ein eigenständiges Package die Medien-Capability sichtbarer macht und die Boundary langfristig klarer hält.

### 3. Direkte MinIO-/S3-Nutzung aus Plugins oder Fachmodulen

Verworfen, weil dadurch technische Storage-Artefakte in fachliche Verträge und UI-Grenzen auslaufen würden.

### 4. Ausschließlich asynchrone Variantenverarbeitung im MVP

Verworfen, weil der erste produktive Schnitt damit unnötig Worker-, Queue- und Betriebsaufwand erzwingen würde.

## Konsequenzen für Umsetzung und Betrieb

- `packages/media` wird als neue hostseitige Domänen-Boundary eingeführt.
- Persistenzmodell umfasst Assets, Varianten, Referenzen, Upload-Sessions und instanzbezogene Storage-Usage.
- Spätere Server-Endpunkte schneiden Upload- und Download-Pfade gegen einen internen Storage-Port statt gegen MinIO direkt.
- News, Events und POI migrieren schrittweise von URL-basierten Medienfeldern auf hostseitige Medienreferenzen.
- Die Architektur- und Betriebsdokumentation muss Medienmanagement in arc42 03 bis 11 nachziehen.
- Ein Folge-Change `add-media-async-processing` beschreibt den dedizierten Worker-/Queue-Pfad.

## Umsetzungsstand im MVP

Zum angenommenen Entscheidungsstand gehören bereits:

- `packages/media` als kanonischer Domänenvertrag
- Persistenzmodell für Assets, Varianten, Referenzen, Upload-Sessions und Storage-Usage
- hostseitige Runtime-Pfade für Upload-Initialisierung, Upload-Abschluss, Referenzverwaltung, Usage-Impact, Delivery und Löschschutz
- hostseitiger S3-/MinIO-Adapter hinter einem internen Storage-Port
- Host-UI unter `/admin/media`
- Plugin-SDK- und UI-Verträge für hostseitige Media-Picker

Nicht Bestandteil dieses ADR-Abschlusses sind weitergehende Governance- und Betriebsfunktionen aus `extend-media-management-governance` sowie der dedizierte Async-Worker aus `add-media-async-processing`.

## Verwandte ADRs

- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-038](ADR-038-instanz-modul-zuordnung-und-fail-closed-modulaktivierung.md)
