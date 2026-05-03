## 1. Spezifikation
- [ ] 1.1 Governance- und Betriebsanforderungen für `media-management` spezifizieren
- [ ] 1.2 IAM-Anforderungen für rollen-/instanzbezogene Upload-Limits ergänzen
- [ ] 1.3 Audit-Anforderungen für Duplikaterkennung, Malware-Scan, Replace und Taxonomieänderungen ergänzen

## 2. Umsetzung
- [ ] 2.1 Persistenzmodell für mehrsprachige Metadaten, Pflichtfeld-Konfiguration, Ordner, Tags, Kategorien, Content-Hashes, Replace-Historie und Quota-/Limit-Warnungen ergänzen
- [ ] 2.2 Hash-basierte Duplikaterkennung pro Instanz implementieren
- [ ] 2.3 Upload-Replace mit stabilen `MediaReference`-IDs und Varianten-Neugenerierung implementieren
- [ ] 2.4 Malware-Scanner-Port und Processing-Gate implementieren
- [ ] 2.5 Rollen- und instanzbezogene Rate-/Größenlimits implementieren
- [ ] 2.6 Quota-Warnungen vor harter Speichergrenze implementieren
- [ ] 2.7 Studio-UI für Pflichtfelder, mehrsprachige Metadaten, Ordner, Tags, Kategorien, Duplikatentscheidung, Replace und Quota-Warnungen ergänzen
- [ ] 2.8 Audit- und Historienpfad für Governance-/Betriebsereignisse ergänzen

## 3. Qualität und Dokumentation
- [ ] 3.1 Unit-/Integrationstests für Pflichtfeldvalidierung, mehrsprachige Fallbacks, Ordner/Tags/Kategorien und Suchfilter ergänzen
- [ ] 3.2 Unit-/Integrationstests für Hash-Duplikaterkennung, Malware-Scan-Blockierung, Replace mit stabilen Referenzen, rollen-/instanzbasierte Limits und Quota-Warnungen ergänzen
- [ ] 3.3 Relevante Guides und arc42-Abschnitte für Governance-/Betriebsumfang aktualisieren
- [ ] 3.4 `openspec validate extend-media-management-governance --strict` ausführen
