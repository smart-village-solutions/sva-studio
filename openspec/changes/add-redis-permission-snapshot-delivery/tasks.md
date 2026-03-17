## 1. Snapshot-Store

- [ ] 1.1 Redis-Key-Schema, TTL, Versionierung und Serialisierung für Permission-Snapshots spezifizieren
- [ ] 1.2 Lese- und Schreibpfad für Cache-Hit, Cache-Miss und Recompute spezifizieren
- [ ] 1.3 Fail-Closed-Verhalten bei Redis- und Recompute-Fehlern präzisieren

## 2. Invalidation

- [ ] 2.1 Mutationsmatrix für Rollen-, Permission-, Gruppen-, Membership- und Hierarchieänderungen festlegen
- [ ] 2.2 Eventformat und Consumer-Verhalten für Redis-Invalidierung spezifizieren
- [ ] 2.3 Metriken, Logs und Alerting-Anforderungen für Invalidation ergänzen

## 3. Performance und Abnahme

- [ ] 3.1 Endpoint-nahe Lastprofile und Messmethodik definieren
- [ ] 3.2 Lieferartefakte für Performance-Berichte unter `docs/reports/` festlegen
- [ ] 3.3 Abnahmegrenzen für Cache-Hit, Cache-Miss und Recompute dokumentieren

## 4. Dokumentation

- [ ] 4.1 Readiness- und Betriebsdokumentation für Redis-Snapshots ergänzen
- [ ] 4.2 Betroffene arc42-Abschnitte referenzieren
- [ ] 4.3 `openspec validate add-redis-permission-snapshot-delivery --strict` erfolgreich ausführen
