# Dossier 3: Medien verwalten

## Nutzerreise

Medien durchlaufen mehrere unterscheidbare Schritte: Datei auswählen, Upload technisch
initialisieren, Datei übertragen, Asset registrieren beziehungsweise verarbeiten, Metadaten pflegen
und in Inhalten referenzieren. Die Nutzungsansicht zeigt, welche Referenzen Änderungen oder
Löschen beeinflussen.

## `host.media.list` – Medien verwalten

- **Route / Typ / Owner:** `/admin/media`, Liste, Host.
- **Nutzerziel:** Assets suchen, priorisieren, öffnen und neue Dateien hochladen.
- **Produktfakten:** Die Bibliothek durchsucht Titel, Alternativtext, Copyright und MIME-Typ und
  paginiert mit 25, 50 oder 100 Einträgen. Sie unterscheidet unter anderem blockierte, neue und
  ungenutzte Assets. Ein Schnell-Intake akzeptiert Dateien per Auswahl oder Drag-and-drop und öffnet
  nach erfolgreichem Upload die Detailansicht.
- **Kontextabhängig:** Nutzungszahlen können laden oder nicht verfügbar sein. Ob eine Vorschau
  möglich ist, hängt vom Dateityp und Auslieferungszustand ab.
- **Redaktionelle Leitfragen:** Wie findet man unvollständig gepflegte oder ungenutzte Assets? Was
  bedeutet „nicht registriert“? Welche Formate und Größen sind tatsächlich erlaubt?
- **Stichwörter / Querverweise:** Medienbibliothek, Asset, Upload, MIME-Typ, ungenutzt, blockiert;
  weiter zu Upload, Detail und Medienverwendung.
- **Evidenz:** `routing/admin-resources.ts`, `routes/admin/media/-media-library-page.tsx`,
  `i18n/resources/de/media.resources.ts`.

## `host.media.create` – Medium hochladen

- **Route / Typ / Owner:** `/admin/media/new`, Anlegen, Host.
- **Nutzerziel:** Upload-Ziel und Asset technisch vorbereiten.
- **Produktfakten:** Erfasst werden MIME-Typ, erwartete Bytegröße und Sichtbarkeit. Der erste Schritt
  reserviert Asset-ID, Upload-Session und signierte Ziel-URL; er überträgt noch keine Datei. Danach
  folgen Dateitransfer, Metadatenprüfung und Referenzierung.
- **Kontextabhängig:** Sichtbarkeit ist öffentlich oder geschützt. Die signierte Upload-URL ist nur
  bis zum angegebenen Zeitpunkt gültig.
- **Redaktionelle Leitfragen:** Welche Eingaben sind Planungswerte und welche werden aus der Datei
  erkannt? Wie wird der eigentliche Transfer ausgelöst? Was tun bei abgelaufener Session?
- **Stichwörter / Querverweise:** Upload initialisieren, Asset-ID, Upload-Session, signierte URL,
  Sichtbarkeit; weiter zur Mediendetailansicht.
- **Evidenz:** `routes/admin/media/-media-create-page.tsx`,
  `i18n/resources/de/media.resources.ts`.

## `host.media.detail` – Medium bearbeiten

- **Route / Typ / Owner:** `/admin/media/$mediaId`, Detail, Host.
- **Nutzerziel:** Vorschau, Delivery, Qualitätsstatus, Metadaten und Verwendung gemeinsam prüfen.
- **Produktfakten:** Bearbeitbar sind Titel, Alternativtext, Beschreibung, Copyright, Lizenz,
  Sichtbarkeit sowie Bildfokus und Zuschnitt. Technische Angaben umfassen Asset-ID, Storage-Key,
  MIME-Typ, Größe, Upload- und Verarbeitungsstatus. Öffentliche URLs können kopiert und als QR-Code
  ausgegeben werden.
- **Kontextabhängig:** Aktive Referenzen können Änderung oder Löschen blockieren. Ein Objekt aus dem
  Bucket kann zunächst unregistriert sein und muss als Medium registriert werden.
- **Redaktionelle Leitfragen:** Welche Metadaten sind für Barrierefreiheit erforderlich? Wann ist ein
  Asset auslieferbar? Welche Wirkung haben Fokuspunkt und Zuschnitt?
- **Stichwörter / Querverweise:** Alternativtext, Lizenz, Fokuspunkt, Zuschnitt, Delivery-URL,
  QR-Code, Verarbeitung; weiter zur Nutzungsansicht.
- **Evidenz:** `routes/admin/media/-media-detail-page.tsx`,
  `routes/admin/media/-media-unregistered-detail-page.tsx`.

## `media.overview` – Medienübersicht

- **Route / Typ / Owner:** `/media`, Übersicht, Host.
- **Nutzerziel:** Einen allgemeinen Einstieg in die Medienverwaltung erhalten.
- **Produktfakten:** Die Route verwendet dieselbe `MediaPage`-Fassade wie der administrative
  Medienbereich und führt in die Medienbibliothek beziehungsweise deren verfügbare Zustände.
- **Kontextabhängig:** Die tatsächlich sichtbaren Aktionen folgen Modul- und Medienberechtigungen;
  der alternative Pfad begründet keine zusätzlichen Rechte.
- **Redaktionelle Leitfragen:** Soll die Anwenderdokumentation diese Route als Einstieg oder als
  Alias erklären? Welche Zielgruppen sehen `/media` statt `/admin/media`?
- **Stichwörter / Querverweise:** Medienübersicht, Medienbibliothek, alternativer Einstieg.
- **Evidenz:** `routing/app-route-bindings.tsx`, `packages/routing/src/app.routes.shared.ts`.

## `media.usage` – Medienverwendung

- **Route / Typ / Owner:** `/admin/media/$mediaId/usage`, Verwendung, Host.
- **Nutzerziel:** Alle aktiven Referenzen eines Assets und deren fachliche Rollen prüfen.
- **Produktfakten:** Die Seite zeigt Referenzanzahl, verknüpfte Host- oder Fachmodule,
  Sortierreihenfolge und Rollen wie Thumbnail, Teaserbild, Headerbild, Galerie, Download oder
  Hero-Bild. Bei fehlenden Referenzen erscheint ein eigener Leerzustand.
- **Kontextabhängig:** Die ermittelte Nutzung beeinflusst, ob ein Asset geändert oder gelöscht
  werden kann.
- **Redaktionelle Leitfragen:** Wie gelangt man zum referenzierenden Inhalt? Welche Referenz muss vor
  dem Löschen entfernt werden? Kann eine Referenz technisch veraltet sein?
- **Stichwörter / Querverweise:** Usage-Impact, Referenz, Medienrolle, Löschblocker; zurück zum
  Mediendetail oder weiter zum referenzierenden Inhalt.
- **Evidenz:** `routes/admin/media/-media-usage-page.tsx`,
  `i18n/resources/de/media.resources.ts`.
