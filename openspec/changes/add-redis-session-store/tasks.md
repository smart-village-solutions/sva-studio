## 0. Vorarbeit (Bereits erledigt ✅)
- [x] 0.1 Unit-Tests für Session-Management geschrieben (33 Tests, alle grün)
- [x] 0.2 Cookie-Handling und Serialisierung getestet
- [x] 0.3 TanStack Router Set-Cookie Problem identifiziert und dokumentiert
- [x] 0.4 Integration-Tests für OAuth-Callback-Flow

## 1. Vorbereitung
- [ ] 1.1 Redis-Setup für lokale Entwicklung definieren (Compose/Docs)
- [ ] 1.2 Konfigurationsparameter (REDIS_URL, TLS, TTL) festlegen
- [ ] 1.3 **Session-ID Transport-Mechanismus designen** (wegen Set-Cookie Problem)

## 2. Implementierung
- [ ] 2.1 Redis-Session-Adapter in packages/auth implementieren
- [ ] 2.2 Session-API auf async umstellen (create/get/delete/update)
- [ ] 2.3 Logout/Revocation-Flow auf Redis umstellen

## 3. Qualität & Tests
- [x] 3.1 Unit-Tests für Session-CRUD (Session-Management, Cookie-Parsing)
- [ ] 3.2 Integrationstest für Session-Persistenz (HMR/Restart mit Redis)
- [ ] 3.3 Security-Check: Token-Schutz, TTL, Revocation
- [ ] 3.4 **E2E-Test für Session-ID Transport** (alternativer Mechanismus statt Cookies)

## 4. Betrieb
- [ ] 4.1 Monitoring/Alerting-Anforderungen dokumentieren
- [ ] 4.2 Backup/Restore-Runbook skizzieren

## 5. Rollout
- [ ] 5.1 Staging-Konfiguration (Managed/Self-Hosted) festlegen
- [ ] 5.2 Production-HA-Variante (Sentinel/Cluster) definieren
