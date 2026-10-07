# Aufgaben

- [x] 1. Die explizite Tenant-Admin-Übernahmefreigabe durch die bestehenden
      Create-/Draft-Readiness-/Plan-/MCP-Verträge führen und in den
      Sollzustands-Fingerprint aufnehmen.
- [x] 2. Readiness und Plan so erweitern, dass ein unmarkierter Admin nur bei
      expliziter Freigabe und eindeutiger normalisierter E-Mail-Übereinstimmung
      als übernehmbar gilt; der vorhandene Username bleibt erhalten und Befunde
      bleiben PII-frei.
- [x] 3. Den Worker die Identität direkt vor der Mutation erneut prüfen lassen;
      bei Abweichung ohne Profil-, Rollen- oder Ownership-Mutation abbrechen.
- [x] 4. Den bestehenden Account unter Erhalt von Passwort, Enabled-Status,
      fremden Attributen und fremden Rollen übernehmen und nur
      `system_admin` sowie instanzgebundene Ownership ergänzen.
- [x] 5. Gezielte Unit-/Adapter-/Execution-Tests für Zustimmung, Ablehnung,
      Identitätswechsel im Plan, mehrdeutige E-Mail, Rollen-/Attributerhalt,
      Persistenz und bestehende MCP-Verträge ergänzen.
- [x] 6. Die Instance-Provisioning-Spezifikation, aktuelle
      Keycloak-Provisioning-Dokumentation und die MCP-Toolbeschreibung
      aktualisieren; die separate manuelle Aktivierung festhalten.
- [x] 7. Relevante Auth-/Datenintegritäts-/Server-Runtime-Gates ausführen.
- [ ] 8. Readiness für alle 50 CSV-Tenants nach dem Rollout erneut nachweisen.
