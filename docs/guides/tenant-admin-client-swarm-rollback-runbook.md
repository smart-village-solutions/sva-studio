# Historischer Tenant-Admin-Client-Rollback

Status: **abgeschlossen – keine Betriebsanweisung**

Dieses Dokument bleibt nur als stabiler Verweis auf die frühere Rollback-Planung für den einmaligen Tenant-Admin-Client-Cutover erhalten. Manuelle Goose-Down- und Keycloak-Einzelschritte wurden entfernt, damit sie nicht als aktueller Recovery-Pfad missverstanden werden.

Aktuelle Recovery folgt den Grenzen des [kanonischen Studio-Rollouts](./studio-rollout-process.md) und dem [Swarm-Betriebsrunbook](./swarm-deployment-runbook.md): zunächst kompatiblen App-Digest bewerten, Datenbankmigrationen niemals automatisch zurückrollen und einen Restore nur nach expliziter Freigabe im Wartungsfenster durchführen.
