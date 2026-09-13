## 1. Freigabe und Rollout

- [ ] 1.1 Merge- und GitHub-Gates des Implementierungs-Changes bestätigen
- [ ] 1.2 Image-Digest aus dem kanonischen Build festhalten
- [ ] 1.3 Denselben Digest nach Dev und Staging promoten

## 2. Staging-Abnahme

- [ ] 2.1 `ready`, `missing`, beide Partialvarianten, `stale` und `unavailable`
      ohne Secretwerte nachweisen
- [ ] 2.2 Null Mainserver-Upstream-Aufrufe für nicht bereite Zustände belegen
- [ ] 2.3 Snapshot-Erhalt und principalgenaue Isolation belegen

## 3. Production-Abnahme

- [ ] 3.1 Denselben freigegebenen Digest nach Production promoten
- [ ] 3.2 Bad Belzig und Prignitz read-only prüfen
- [ ] 3.3 Evidenz auf Status, Presence-Bools, pseudonymisierte Referenz und
      Fingerprint-Presence begrenzen
- [ ] 3.4 Rollout-Ergebnis dokumentieren; neue Betriebsbefunde separat triagieren
