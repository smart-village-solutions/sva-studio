## 1. Vorbereitung
- [ ] 1.1 Redis-Setup für lokale Entwicklung definieren (Compose/Docs)
- [ ] 1.2 Konfigurationsparameter (REDIS_URL, TLS, TTL) festlegen

## 2. Implementierung
- [ ] 2.1 Redis-Session-Adapter in packages/auth implementieren
- [ ] 2.2 Session-API auf async umstellen (create/get/delete/update)
- [ ] 2.3 Logout/Revocation-Flow auf Redis umstellen

## 3. Qualität & Tests
- [ ] 3.1 Integrationstest für Session-Persistenz (HMR/Restart)
- [ ] 3.2 Security-Check: Token-Schutz, TTL, Revocation

## 4. Betrieb
- [ ] 4.1 Monitoring/Alerting-Anforderungen dokumentieren
- [ ] 4.2 Backup/Restore-Runbook skizzieren

## 5. Rollout
- [ ] 5.1 Staging-Konfiguration (Managed/Self-Hosted) festlegen
- [ ] 5.2 Production-HA-Variante (Sentinel/Cluster) definieren
