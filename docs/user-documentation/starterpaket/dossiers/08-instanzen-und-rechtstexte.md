# Dossier 8: Instanzen und Rechtstexte

## `admin.instances.list` – Instanzen verwalten

- **Route / Typ / Owner:** `/admin/instances`, Liste, Host.
- **Nutzerziel:** Registry-Einträge, Hostnamen und Lebenszyklus von Studio-Instanzen überblicken.
- **Produktfakten:** Die Liste führt Instanz-ID, Anzeigename, Hostname und Status zusammen und
  öffnet Detail oder Neuanlage. Provisioning- und Aktivierungszustände werden separat dargestellt.
- **Kontextabhängig:** Diese plattformnahe Verwaltung ist nicht mit der normalen Arbeit innerhalb
  einer ausgewählten Instanz gleichzusetzen.
- **Leitfragen / Stichwörter:** Welche Instanz ist aktiv oder noch im Aufbau? Welcher Hostname gehört
  dazu? Instanzliste, Registry, Hostname, Lebenszyklus.
- **Evidenz:** `routes/admin/instances/-instances-page.tsx`,
  `i18n/resources/de/admin/instances/`.

## `admin.instances.create` – Instanz anlegen

- **Route / Typ / Owner:** `/admin/instances/new`, Anlegen, Host.
- **Nutzerziel:** Registry, Keycloak-Grunddaten und optional Abfall-Datenquelle für eine neue Instanz
  vorbereiten.
- **Produktfakten:** Felder umfassen Instanz-ID, Anzeigename, Parent-Domain, Realm, Auth-Client,
  Issuer, Tenant-Admin-Client und initialen Tenant-Admin. Secrets können beim Provisioning erzeugt
  werden. Optional werden Supabase- beziehungsweise Datenbankdaten des Abfallmoduls erfasst.
- **Folge:** Die Anlage startet denselben Provisioning-Vertrag wie der Ops-Pfad und führt danach in
  den Setup-Abschluss.
- **Leitfragen / Stichwörter:** Welche IDs sind dauerhaft? Welche Secrets werden erzeugt statt
  eingegeben? Instanz anlegen, Realm, Client, Tenant-Admin, Provisioning.
- **Evidenz:** `routes/admin/instances/-instance-create-page.tsx`,
  `i18n/resources/de/admin/instances/form.resources.ts`.

## `admin.instances.detail` – Instanz bearbeiten

- **Route / Typ / Owner:** `/admin/instances/$instanceId`, Detail, Host.
- **Nutzerziel:** Betrieb, Diagnose und Konfiguration einer Instanz steuern.
- **Produktfakten:** Hauptbereiche sind Betrieb, Doctor und Einstellungen. Die Seite bündelt
  Provisioning-Läufe, Realm- und Keycloak-Status, Module, Konfiguration, Historie, Cockpit,
  Operationen und Tenant-IAM. Gespeicherte Secrets werden nur als vorhanden oder fehlend gezeigt.
- **Kontextabhängig:** Einzelne Reparatur-, Reconcile- oder Bootstrap-Aktionen benötigen besondere
  Rechte und bestätigte Betriebsdiagnose.
- **Leitfragen / Stichwörter:** Welche Ansicht beantwortet Status, Ursache oder Konfiguration? Wann
  ist eine Reparaturaktion zulässig? Instanzdetails, Doctor, Betrieb, Provisioning-Lauf, Module.
- **Evidenz:** `routes/admin/instances/-instance-detail-page.tsx` und zugehörige
  `-instance-detail-*-section.tsx`.

## `admin.instances.setup` – Instanz einrichten

- **Route / Typ / Owner:** `/admin/instances/$instanceId/setup`, Einrichtung, Host.
- **Nutzerziel:** Eine angelegte Instanz aktivieren und ihre geschützte Tenant-Admin-Struktur
  initialisieren.
- **Produktfakten:** Der Setup-Flow ist erst abgeschlossen, wenn die Instanz aktiv und die
  Tenant-Admin-Struktur initialisiert ist. Dabei werden `system_admin` und die IAM-Basis der
  ausgewählten Module synchronisiert. Ein temporäres Tenant-Admin-Passwort ist nur nötig, wenn der
  Workflow es setzen soll.
- **Leitfragen / Stichwörter:** Welcher Pflichtschritt fehlt? Welche Module sollen initial enthalten
  sein? Setup, Aktivierung, Tenant-Admin, IAM-Basis, temporäres Passwort.
- **Evidenz:** `routes/admin/instances/-instance-setup-page.tsx`,
  `i18n/resources/de/admin/instances/setup.resources.ts`.

## `admin.legal-texts.list` – Rechtstexte verwalten

- **Route / Typ / Owner:** `/admin/legal-texts`, Liste, Host.
- **Nutzerziel:** Rechtstextversionen, Sprachen, Status, Zielgruppen und Akzeptanzen überblicken.
- **Produktfakten:** Suche erfasst UUID, Name, Version, Sprache und Inhalt; Filter unterscheiden
  Entwurf, gültig und archiviert. Kennzahlen zeigen Gesamtversionen, gültige Versionen,
  Sprachvarianten und aktive Akzeptanzen.
- **Leitfragen / Stichwörter:** Welche Version und Sprache ist gültig? Für welche Rollen oder
  Gruppen gilt sie? Rechtstext, Version, Sprache, Zielgruppe, Akzeptanz.
- **Evidenz:** `routes/admin/legal-texts/-legal-texts-page.tsx`,
  `i18n/resources/de/admin/legalTexts.resources.ts`.

## `admin.legal-texts.create` – Rechtstext anlegen

- **Route / Typ / Owner:** `/admin/legal-texts/new`, Anlegen, Host.
- **Nutzerziel:** Eine neue sprach- und versionsbezogene Rechtstextfassung erstellen.
- **Produktfakten:** Felder sind Name, Version, Sprache, Status, Veröffentlichungszeitpunkt,
  Zielrollen, Zielgruppen und HTML-Inhalt. Der gemeinsame Richtext-Editor bietet Überschriften,
  Absätze, Listen, Links und Textformatierung. Über den Umschalter kann derselbe Inhalt wahlweise
  visuell oder als rohes HTML bearbeitet werden; beim Wechsel zurück wird das HTML bereinigt.
- **Validierung:** Eine gültige Version benötigt ein Veröffentlichungsdatum in Europe/Berlin; eine
  bereits vorhandene Kombination erzeugt einen Konflikt.
- **Leitfragen / Stichwörter:** Ist es eine neue Version oder Sprachvariante? Wer muss akzeptieren?
  Rechtstext anlegen, HTML, Zielrollen, Zielgruppen, veröffentlicht.
- **Evidenz:** `routes/admin/legal-texts/-legal-text-create-page.tsx`,
  `i18n/resources/de/admin/legalTexts.resources.ts`.

## `admin.legal-texts.detail` – Rechtstext bearbeiten

- **Route / Typ / Owner:** `/admin/legal-texts/$legalTextVersionId`, Detail, Host.
- **Nutzerziel:** Inhalt und Metadaten einer konkreten Rechtstextversion aktualisieren.
- **Produktfakten:** Bearbeitbar sind dieselben fachlichen Felder wie bei der Anlage. Löschen
  entfernt die Version dauerhaft; bereits dokumentierte Akzeptanzen bleiben unverändert bestehen.
  Die visuelle und die HTML-Ansicht stehen auch beim Bearbeiten zur Verfügung.
- **Leitfragen / Stichwörter:** Darf eine bereits gültige Fassung verändert werden oder ist eine
  neue Version nötig? Was bleibt nach dem Löschen nachweisbar? Rechtstext bearbeiten, Akzeptanz,
  Version löschen.
- **Evidenz:** `routes/admin/legal-texts/-legal-text-detail-page.tsx`,
  `routes/admin/legal-texts/-legal-text-detail-form.tsx`.
