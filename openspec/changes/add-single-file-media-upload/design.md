## Kontext
Der bestehende Medien-Flow im Studio trennt aus Enduser-Sicht zu stark zwischen Upload-Initialisierung und eigentlichem Datei-Transfer. Die Spec für `media-management` erlaubt bereits kontrollierte MinIO-/S3-kompatible Upload-Pfade über signierte URLs und verlangt, dass ein Asset erst nach verifiziertem Upload als nutzbar markiert wird. Zusätzlich existiert bereits ein Bridge-Pfad für unregistrierte Bucket-Objekte, der aber nicht den primären Redaktionsflow für neue Uploads bilden soll.

## Ziele / Nicht-Ziele
- Ziele:
  - Einen echten Single-File-Upload direkt aus `/admin/media` für Enduser verfügbar machen
  - Den Erfolgspfad auf `Datei auswählen -> hochladen -> finalisieren -> Detailansicht` reduzieren
  - Nach erfolgreichem Upload ein persistiertes `MediaAsset` mit Minimalmetadaten sicherstellen
  - Fehlerpfade für Initialisierung, Upload und Finalisierung getrennt sichtbar machen
- Nicht-Ziele:
  - Kein Mehrfachupload
  - Keine Pflicht-Metadaten vor dem Upload
  - Keine freie Metadatenbearbeitung inline in der Bibliothek
  - Keine neue media-spezifische Async-Plattform; nachgelagerte Verarbeitung bleibt an bestehende bzw. geplante Verarbeitungswege gebunden

## Entscheidungen
- Entscheidung: Der Flow bleibt auf dem bestehenden kontrollierten Upload-Vertrag mit signierter URL aufgesetzt.
  - Begründung: Die bestehende Spec und API-Richtung kapseln S3-/MinIO-Artefakte bereits sauber. Ein neuer Upload-Grundvertrag wäre für den ersten Enduser-Flow zu groß.

- Entscheidung: Der Browser führt nach `initialize upload` den eigentlichen Datei-Upload sofort an die signierte URL aus.
  - Begründung: Das priorisiert den eigentlichen Upload, ohne den Host-Storage-Vertrag aufzubrechen.

- Entscheidung: Die Persistierung des nutzbaren Medienobjekts wird als expliziter Finalisierungsschritt nach erfolgreichem Datei-Transfer modelliert.
  - Begründung: So bleibt die Fachsicht konsistent mit dem Benutzerziel. Ein S3-Erfolg ohne DB-Eintrag bleibt zwar ein Fehlerfall, wird aber nicht als erfolgreicher Abschluss angezeigt.

- Entscheidung: Minimalmetadaten werden automatisch abgeleitet statt vorab erzwungen.
  - Begründung: Für Phase 1 soll nichts den Upload blockieren. `fileName`, `mimeType`, `byteSize`, `storageKey`, Default-`visibility` und ein aus dem Dateinamen abgeleiteter Titel reichen für die erste nutzbare Persistierung.

## Erwogene Alternativen
- Alternative: Bestehenden Create-Screen nur kosmetisch umbauen und die signierte URL weiter manuell verwenden.
  - Verworfen: Löst das Kernproblem für Enduser nicht.

- Alternative: Datei zuerst in den Bucket laden und danach über den Unregistered-Flow registrieren.
  - Verworfen: Ist als Recovery-/Bridge-Pfad nützlich, aber für neue Uploads ein unnötiger Umweg mit falscher Nutzerführung.

- Alternative: Einen komplett neuen kombinierten Upload-/Finalize-Endpoint einziehen.
  - Vertagt: Kann später sinnvoll sein, ist für den ersten Enduser-Flow aber größer als nötig.

## Risiken / Trade-offs
- Ein erfolgreicher S3-Upload mit gescheiterter Finalisierung erzeugt einen technischen Teilzustand im Bucket.
  - Gegenmaßnahme: Die UI kennzeichnet diesen Fall explizit als Finalisierungsfehler; Server-/Ops-Folgen werden dokumentiert und dürfen später um Remediation erweitert werden.

- Der bestehende Backend-Vertrag könnte heute die Asset-Persistierung bereits zu früh anlegen.
  - Gegenmaßnahme: Die Implementierung muss den Ist-Zustand des Endpoints prüfen und den Zielzustand konsistent machen; falls nötig ist die Finalisierung im Backend klarer zu schneiden.

- Der Single-File-Flow führt noch keinen endgültigen Mehrfachupload-Vertrag ein.
  - Gegenmaßnahme: Der Scope ist bewusst eng; Komponenten und Statusmodell sollen aber später auf Mehrfachupload erweiterbar bleiben.

## Migrationsplan
1. UI-Upload-CTA in `/admin/media` an echten Dateipicker für genau eine Datei anbinden.
2. Vorhandenen Upload-Initialisierungspfad um Browser-Upload und Finalisierungsorchestrierung erweitern.
3. Erfolgsnavigation in die Detailansicht verdrahten.
4. Relevante UI-, Hook-, API- und E2E-Tests auf den neuen Enduser-Flow umstellen.

## Offene Fragen
- Ob der bestehende Backend-Endpoint die DB-Persistierung bereits während `initialize upload` anlegt oder erst bei einem späteren Abschluss sauber finalisiert, muss im Implementierungsschritt verifiziert werden.
