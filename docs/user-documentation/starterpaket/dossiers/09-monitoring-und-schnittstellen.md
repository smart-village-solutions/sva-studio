# Dossier 9: Monitoring und Schnittstellen

## `interfaces.overview` – Schnittstellen

- **Route / Typ / Owner:** `/interfaces`, Übersicht, Host.
- **Nutzerziel:** Instanzbezogene technische Anbindungen konfigurieren und ihren Status prüfen.
- **Produktfakten:** Unterstützte Typen sind SVA Mainserver, S3, Supabase, PostgreSQL,
  Mail-Transport sowie Karte und Geocoding. Die Tabelle zeigt Typ, Endpoint, Status und letzte
  Prüfung. Schnittstellen lassen sich anlegen, bearbeiten, aktivieren und löschen; der Typ einer
  bestehenden Schnittstelle kann nicht geändert werden. Gespeicherte Secrets bleiben verborgen.
- **Kontextabhängig:** Supabase setzt das Abfallmodul voraus. Automatische Statusprüfungen sind nicht
  für jeden Typ vollständig implementiert. Kartenchecks unterstützen derzeit Geoapify.
- **Leitfragen / Stichwörter:** Welche Anbindung ist führend? Was bedeutet eingerichtet statt
  verbunden? Schnittstelle, Endpoint, Secret, Healthcheck, Kill-Switch.
- **Evidenz:** `routes/interfaces/-interfaces-page.tsx`,
  `i18n/resources/de/interfaces.resources.ts`.

## `monitoring.overview` – Monitoring

- **Route / Typ / Owner:** `/monitoring`, Übersicht, Host.
- **Nutzerziel:** Zu Plugin-Jobs wechseln oder den echten serverseitigen IAM-Authorize-Pfad messen.
- **Produktfakten:** Der Authorize-Benchmark erfasst Action-ID, Ressourcentyp sowie optional
  Ressourcen- und Organisations-ID. Er misst serverseitig Cache-Hit, Cache-Miss und Recompute und
  liefert p50, p95, p99 sowie JSON- und Markdown-Nachweis. Browser- und Renderingzeiten fließen
  nicht ein.
- **Kontextabhängig:** Der Lauf benötigt Monitoring-Berechtigung und verwendet die aktuelle
  Administrationssitzung.
- **Leitfragen / Stichwörter:** Ist dies Betriebsdokumentation statt Alltagsanleitung? Welche Werte
  dürfen in Beispielen stehen? Monitoring, Authorize, Benchmark, Cache, Perzentil.
- **Evidenz:** `routes/monitoring/-overview-page.tsx`,
  `i18n/resources/de/monitoring.resources.ts`.

## `monitoring.jobs-list` – Aufträge überwachen

- **Route / Typ / Owner:** `/monitoring/jobs`, Liste, Host.
- **Nutzerziel:** Laufende und historische Plugin-Operations-Jobs finden und öffnen.
- **Produktfakten:** Tabs trennen aktive Jobs und Historie. Filter bestehen für Suche nach Job-ID
  oder Korrelation, Status, Plugin und Jobtyp. Status sind eingeplant, läuft, erneuter Versuch,
  erfolgreich, fehlgeschlagen und abgebrochen. Die Liste zeigt Fortschritt, letztes Ereignis und
  Zeitstempel mit Pagination.
- **Leitfragen / Stichwörter:** Wann ist ein Job noch aktiv oder verwaist? Welche Korrelation hilft
  beim Support? Jobliste, Plugin-Job, Status, Korrelation, Fortschritt.
- **Evidenz:** `routes/monitoring/-jobs-page.tsx`,
  `i18n/resources/de/monitoring.resources.ts`.

## `monitoring.job-detail` – Auftragsdetails

- **Route / Typ / Owner:** `/monitoring/jobs/$jobId`, Detail, Host.
- **Nutzerziel:** Technischen Verlauf, Runtime, Ergebnis und Fehler eines Jobs untersuchen.
- **Produktfakten:** Die Seite zeigt Zusammenfassung, Live-Fortschritt, Batch- und Datensatzzahlen,
  letzte Aktivität, Schreibübersicht, Runtime, Ergebnis, Fehler und Ereignishistorie. Ein Hinweis
  markiert Läufe, die wegen ausbleibenden Fortschritts vermutlich feststecken.
- **Kontextabhängig:** „Vermutlich festgefahren“ ist eine Diagnose, kein sicherer Endstatus. Ein
  nicht gefundener Job und eine nicht erreichbare Jobdatenbank sind getrennte Fehler.
- **Leitfragen / Stichwörter:** Welche Kennung und welcher Fehlercode gehören in ein Ticket? Darf
  ein Lauf abgebrochen oder wiederholt werden? Jobdetail, Batch, Worker, Versuch, Ereignisverlauf.
- **Evidenz:** `routes/monitoring/-job-detail-page.tsx`,
  `routes/monitoring/-job-presentation.ts`.
