## Context
Der bestehende Medien-Flow im Studio trennt aus Enduser-Sicht zu stark zwischen Upload-Initialisierung und eigentlichem Datei-Transfer. Die Spec fuer `media-management` erlaubt bereits kontrollierte MinIO-/S3-kompatible Upload-Pfade ueber signierte URLs und verlangt, dass ein Asset erst nach verifiziertem Upload als nutzbar markiert wird. Zusaetzlich existiert bereits ein Bridge-Pfad fuer unregistrierte Bucket-Objekte, der aber nicht den primaeren Redaktionsflow fuer neue Uploads bilden soll.

## Goals / Non-Goals
- Goals:
  - Einen echten Single-File-Upload direkt aus `/admin/media` fuer Enduser verfuegbar machen
  - Den Erfolgspfad auf `Datei auswaehlen -> hochladen -> finalisieren -> Detailansicht` reduzieren
  - Nach erfolgreichem Upload ein persistiertes `MediaAsset` mit Minimalmetadaten sicherstellen
  - Fehlerpfade fuer Initialisierung, Upload und Finalisierung getrennt sichtbar machen
- Non-Goals:
  - Kein Mehrfachupload
  - Keine Pflicht-Metadaten vor dem Upload
  - Keine freie Metadatenbearbeitung inline in der Bibliothek
  - Keine neue media-spezifische Async-Plattform; nachgelagerte Verarbeitung bleibt an bestehende bzw. geplante Verarbeitungswege gebunden

## Decisions
- Decision: Der Flow bleibt auf dem bestehenden kontrollierten Upload-Vertrag mit signierter URL aufgesetzt.
  - Rationale: Die bestehende Spec und API-Richtung kapseln S3-/MinIO-Artefakte bereits sauber. Ein neuer Upload-Grundvertrag waere fuer den ersten Enduser-Flow zu gross.

- Decision: Der Browser fuehrt nach `initialize upload` den eigentlichen Datei-Upload sofort an die signierte URL aus.
  - Rationale: Das priorisiert den eigentlichen Upload, ohne den Host-Storage-Vertrag aufzubrechen.

- Decision: Die Persistierung des nutzbaren Medienobjekts wird als expliziter Finalisierungsschritt nach erfolgreichem Datei-Transfer modelliert.
  - Rationale: So bleibt die Fachsicht konsistent mit dem Benutzerziel. Ein S3-Erfolg ohne DB-Eintrag bleibt zwar ein Fehlerfall, wird aber nicht als erfolgreicher Abschluss angezeigt.

- Decision: Minimalmetadaten werden automatisch abgeleitet statt vorab erzwungen.
  - Rationale: Fuer Phase 1 soll nichts den Upload blockieren. `fileName`, `mimeType`, `byteSize`, `storageKey`, Default-`visibility` und ein aus dem Dateinamen abgeleiteter Titel reichen fuer die erste nutzbare Persistierung.

## Alternatives considered
- Alternative: Bestehenden Create-Screen nur kosmetisch umbauen und die signierte URL weiter manuell verwenden.
  - Rejected: Loest das Kernproblem fuer Enduser nicht.

- Alternative: Datei zuerst in den Bucket laden und danach ueber den Unregistered-Flow registrieren.
  - Rejected: Ist als Recovery-/Bridge-Pfad nuetzlich, aber fuer neue Uploads ein unnoetiger Umweg mit falscher Nutzerfuehrung.

- Alternative: Einen komplett neuen kombinierten Upload-/Finalize-Endpoint einziehen.
  - Deferred: Kann spaeter sinnvoll sein, ist fuer den ersten Enduser-Flow aber groesser als noetig.

## Risks / Trade-offs
- Ein erfolgreicher S3-Upload mit gescheiterter Finalisierung erzeugt einen technischen Teilzustand im Bucket.
  - Mitigation: UI kennzeichnet diesen Fall explizit als Finalisierungsfehler; Server-/Ops-Folgen werden dokumentiert und duerfen spaeter um Remediation erweitert werden.

- Der bestehende Backend-Vertrag koennte heute Asset-Persistierung bereits zu frueh anlegen.
  - Mitigation: Implementierung muss den Ist-Zustand des Endpoints pruefen und den Zielzustand konsistent machen; falls noetig ist die Finalisierung im Backend klarer zu schneiden.

- Der Single-File-Flow fuehrt noch keinen endgueltigen Mehrfachupload-Vertrag ein.
  - Mitigation: Scope ist bewusst eng; Komponenten und Statusmodell sollen aber spaeter auf Mehrfachupload erweiterbar bleiben.

## Migration Plan
1. UI-Upload-CTA in `/admin/media` an echten Dateipicker fuer genau eine Datei anbinden.
2. Vorhandenen Upload-Initialisierungspfad um Browser-Upload und Finalisierung orchestration erweitern.
3. Erfolgsnavigation in die Detailansicht verdrahten.
4. Relevante UI-, Hook-, API- und E2E-Tests auf den neuen Enduser-Flow umstellen.

## Open Questions
- Ob der bestehende Backend-Endpoint die DB-Persistierung bereits waehrend `initialize upload` anlegt oder erst bei einem spaeteren Abschluss sauber finalisiert, muss im Implementierungsschritt verifiziert werden.
