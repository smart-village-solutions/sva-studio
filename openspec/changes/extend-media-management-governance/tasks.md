## 1. Verträge und Datenmodell

- [ ] 1.1 Mehrsprachige globale Asset-Metadaten samt Instanzsprache, Fallback-Reihenfolge und tatsächlich aufgelöster Sprache modellieren
- [ ] 1.2 Instanzlokale Ordner, normalisierte Tags und kontrollierte Kategorien mit eindeutiger Semantik und referenzschonenden Änderungsregeln modellieren
- [ ] 1.3 Inhalts-Hash, interne Originalversion, Scan-Ergebnis und Quota-Warnschwellen in Domänen- und Persistenzverträgen ergänzen
- [ ] 1.4 Vor Datenbankänderungen den kanonischen Schema-Snapshot prüfen und Migration, `studio-db-schema-final.sql` sowie Schemadokumentation gemeinsam fortschreiben

## 2. Redaktionelle Governance

- [ ] 2.1 Mehrsprachige Metadatenpflege und deterministische Fallback-Auflösung serverseitig implementieren
- [ ] 2.2 Ordner-, Tag- und Kategorieverwaltung mit instanzisolierten Such- und Filterabfragen implementieren
- [ ] 2.3 Medienverwaltung, Media-Picker und Review um Sprachstatus, Taxonomiepflege und Filter ergänzen
- [ ] 2.4 Fallbacks, Umbenennen, Verschieben, Entfernen und Mandantentrennung durch Unit- und Integrationstests absichern

## 3. Upload- und Asset-Sicherheit

- [ ] 3.1 Instanzlokale Hash-Duplikaterkennung nach Inhaltsvalidierung implementieren
- [ ] 3.2 Kontrollierte Wiederverwendung, bestätigtes Duplikat und Abbruch einschließlich Berechtigungs- und Sichtbarkeitsprüfung implementieren
- [ ] 3.3 Produktneutralen Malware-Scanner-Port und fail-closed Scan-/Freigabevertrag implementieren
- [ ] 3.4 Replace als versionierten Übergang mit stabiler Asset- und Referenzidentität, atomarer Aktivierung und Varianten-Neugenerierung implementieren
- [ ] 3.5 Duplikat-, Scan- und Replace-UI mit redigierten Status- und Fehlerangaben ergänzen
- [ ] 3.6 Hash-, Scan- und Replace-Pfade einschließlich Parallelität, Fehlerfällen, Mandantentrennung und unveränderter Altversion testen

## 4. Quota-Frühwarnung und Audit

- [ ] 4.1 Konfigurierbare instanzbezogene Warnschwellen auf Basis der vorhandenen serverseitigen Speichernutzung implementieren
- [ ] 4.2 Warnstatus in Medienverwaltung und Upload-Kontext für berechtigte Benutzer anzeigen, ohne den bestehenden harten Quota-Pfad zu verändern
- [ ] 4.3 Revisionssichere, redigierte Audit-Ereignisse für Metadaten, Taxonomie, Duplikatentscheidungen, Scan, Replace und Warnschwellen implementieren
- [ ] 4.4 Quota-Warnungen und Audit-Payloads einschließlich Schwellenübergängen, Berechtigungen und PII-/Secret-Redaktion testen

## 5. Integration, Dokumentation und Abnahme

- [ ] 5.1 Scan- und Replace-Verarbeitung an die vorhandene synchrone Verarbeitung und, sobald verfügbar, an `add-media-async-processing` anbinden, ohne eigene Queue-/Retry-Infrastruktur einzuführen
- [ ] 5.2 Relevante Medien-, Betriebs- und arc42-Dokumentation auf Deutsch aktualisieren
- [ ] 5.3 Relevante Unit-, Integrations-, Type-, Server-Runtime- und Dateiplatzierungs-Gates ausführen
- [ ] 5.4 `openspec validate extend-media-management-governance --strict` ausführen
