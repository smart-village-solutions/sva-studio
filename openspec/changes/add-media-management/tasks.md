## 1. Spezifikation
- [ ] 1.1 Neue Capability `media-management` für Assets, Varianten, Referenzen, Metadaten, Nutzungstransparenz und Auslieferung spezifizieren
- [ ] 1.2 `content-management` um referenzbasierte Mediennutzung statt direkter Dateikopplung ergänzen
- [ ] 1.3 `iam-access-control` um Medienrechte für Upload, Pflege, Referenzierung, Löschung und geschützte Auslieferung ergänzen
- [ ] 1.4 `iam-auditing` um revisionssichere Auditspur für Medienereignisse ergänzen
- [ ] 1.5 Technische Entscheidungen zu Package-Zuschnitt, MinIO-basiertem Storage-Vertrag, Variantenstrategie, Referenzmodell und Worker-Schnitt in `design.md` dokumentieren; ADR-037 für Package-Zuschnitt und Storage-/Processing-Vertrag als Entwurf in `docs/adr/` anlegen (Querverweis zu ADR-034 herstellen) – **vor** Umsetzung in Abschnitt 2
- [ ] 1.6 Architekturwirkung und betroffene arc42-Abschnitte im Change explizit referenzieren; dabei arc42-03 (MinIO als S3-kompatibler Objektspeicher im Kontextdiagramm) und arc42-04 (Medienmanagement als hostseitige Querschnittsstrategie) prüfen und ggf. ergänzen

## 2. Umsetzung
- [ ] 2.1 Kanonischen Medienvertrag in einem hostseitigen Package modellieren (`packages/media` oder begründete Alternative im Core); `project.json` mit Scope-Tag `scope:core` versehen und `nx.json`-Modulgrenzen um `media`-Package erweitern – **kein Nachholen**, muss im selben PR erfolgen
- [ ] 2.2 Persistenzmodell für Assets, Varianten, Referenzen, Nutzungsauswertung, Upload-Status und Speicherkontingente mit versionierten Migrationen implementieren
- [ ] 2.3 Serverseitige Endpunkte für Upload-Initialisierung, Metadatenpflege, Referenzverwaltung, Verwendungsnachweis und kontrollierte Auslieferung implementieren; Upload- und Download-Schnittstellen gegen MinIO-kompatible Bucket/Object-Key-, ETag-, Content-Type- und signierte-URL-Semantik schneiden
- [ ] 2.3a Hostseitigen MinIO-Storage-Adapter mit klaren Ports implementieren; dafür ein etabliertes S3-kompatibles SDK verwenden (bevorzugt AWS SDK v3 mit `@aws-sdk/client-s3` und `@aws-sdk/s3-request-presigner`) statt S3-Protokollcode selbst zu bauen. Restlicher Code darf nicht direkt gegen den MinIO-/S3-Client koppeln und darf Bucket-/Object-Keys nicht als fachliche Referenzen speichern.
- [ ] 2.4 Rollen- und Rechteprüfung für Medienoperationen serverseitig und in der UI integrieren
- [ ] 2.5 Studio-UI für Medienbibliothek, Media-Picker, Metadatenpflege und Nutzungsanzeige implementieren
- [ ] 2.6 **MVP-Scope (Phase 1):** Metadaten-Extraktion und definierte häufige Varianten synchron im Upload-Handler erzeugen; Fokuspunkt, einfachen Zuschnitt und automatische Verkleinerung übergroßer Bilder in den Bild-Processing-Pfad aufnehmen; Upload-Status mit redigierten Fehlerdetails pflegen; seltene Varianten lazy on-demand ohne Job-Queue-Infrastruktur generieren; kein dedizierter async Worker in Phase 1. Async-Verarbeitungspfad als eigenständiger Folge-Change `add-media-async-processing` spezifizieren und als technische Schuld in `docs/architecture/11-risks-and-technical-debt.md` eintragen.
- [ ] 2.7 Anbindung an `content-management` und mindestens ein Fachmodul über referenzbasierte Medienrollen herstellen
- [ ] 2.7a Hostseitigen Media-Picker-SDK-Vertrag für Plugins implementieren; Plugins deklarieren Rollen/Medientypen/Preset-Anforderungen und erhalten keine Storage-Artefakte
- [ ] 2.7b Usage-Impact vor Metadatenänderung, Sichtbarkeitsänderung, Archivierung und Löschung implementieren
- [ ] 2.8 Audit- und Historienpfad für Medienereignisse implementieren, inklusive Upload-Status, Usage-Impact, Bildbearbeitung und Metadatenänderungen
- [ ] 2.9 i18n-Keys für Medienbibliothek-UI, Media-Picker, Metadatenfelder, Übersetzungen für Medienrollen (Rollen-IDs z. B. `teaser_image`, `header_image`; i18n-Keys gemäß Repo-Konvention in Dot-Notation, z. B. `media.roles.teaser_image`) und Fehlerzustände in `de` und `en` definieren; `check:i18n`-Gate muss grün bleiben

## 3. Qualität und Dokumentation
- [ ] 3.1 Unit-, Typ-, Integrations- und UI-Tests für Referenzen, Varianten, Rechtepfade, Löschschutz und Auslieferung ergänzen. Folgende Hochrisiko-Pfade müssen explizit durch Tests abgedeckt sein:
  - **Löschblockierung:** Negativtest `GIVEN Asset mit N aktiven Referenzen WHEN delete THEN 4xx/blocked` (begleitend zu Task 2.7–2.8, nicht nachgelagert)
  - **Mandantentrennung:** Repository-Isolation-Test – Asset einer Instanz ist von anderer Instanz nicht abrufbar (begleitend zu Task 2.2)
  - **IAM-Negativpfade:** Serverseitige Middleware-Unit-Tests für `media.read`, `media.create`, `media.delete` je mit fehlendem Recht (begleitend zu Task 2.4)
  - **Typ-Tests:** `MediaAsset`, `MediaVariant`, `MediaReference` als exportierte Typen aus `packages/media` über `test:types`
  - **Bildbearbeitung:** Unit-/Integrationstests für Fokuspunkt-Persistenz, Crop-Transformation und Verkleinerung übergroßer Bilder
  - **Upload-Status:** Unit-/Integrationstests für Upload-Status und redigierte Fehlerdetails
  - **Plugin-Picker:** UI-/Integrationstests für Media-Picker-Rechte, deklarierte Rollen/Medientypen und fehlende Storage-Artefakte im Plugin-Vertrag
  - **E2E-MVP-Scope:** Upload-Flow (Bild hochladen, Metadaten pflegen, Fokuspunkt setzen, Zuschnitt speichern) + Lösch-Blockierungs-Flow
- [ ] 3.2 Relevante Dokumentation unter `docs/` sowie die betroffenen arc42-Abschnitte (03–11) aktualisieren; folgende Guides als Stubs anlegen: `docs/guides/media-management.md` (Zielgruppe: Redakteure – Upload, Rollen, Nutzungstransparenz) und bestehenden `docs/guides/plugin-development.md` um Medien-Extension-Points und verbotene Direktzugriffe ergänzen
- [ ] 3.3 ADR-037 für Package-Zuschnitt `packages/media` und MinIO-basierten Storage-/Processing-Vertrag finalisieren (Entwurf aus Task 1.5); in `docs/architecture/09-architecture-decisions.md` verlinken; Querverweis zu ADR-034 (Plugin-SDK-Vertrag) sicherstellen
- [ ] 3.4 `openspec validate add-media-management --strict` ausführen
