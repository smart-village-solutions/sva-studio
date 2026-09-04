# ADR-060: Keycloak-Serviceidentitäten und Doctor-Evidenz trennen

**Status:** Accepted
**Entscheidungsdatum:** 2026-09-02
**Entschieden durch:** SVA Studio Team

## Kontext

Der Tenant-IAM-Doctor leitete aus einer leeren Keycloak-Clientsuche ab, dass der
Login-Client fehlt. Dieselbe Antwort kann jedoch entstehen, wenn die verwendete
Serviceidentität keine ausreichende Clientsicht besitzt. Zudem enthielt der
Tenant-IAM-Sollvertrag `manage-clients`, obwohl Clientmutationen fachlich dem
Provisioner gehören.

## Entscheidung

1. Der Doctor ist ein Aggregator und keine zusätzliche privilegierte
   Keycloak-Identität.
2. Strukturstatus stammt aus Provisioning-Evidenz; Tenant-IAM-Zugriff wird mit
   der tenantgebundenen Tenant-IAM-Identität geprüft; Reconcile bleibt eine
   eigene Evidenzachse.
3. Ein leeres Suchergebnis darf nur mit nachgewiesener Lesesicht als fehlendes
   Objekt interpretiert werden. Im Tenant-IAM-Access-Pfad wird ein mehrdeutiges
   leeres Ergebnis als `AUTH_CLIENT_VISIBILITY_UNCONFIRMED` und `unknown`
   ausgegeben.
4. Tenant-IAM erhält `view-clients`, aber kein `manage-clients`. Der
   Provisioning-Abgleich ergänzt zuerst ausschließlich das Leserecht. Das
   frühere Schreibrecht wird erst nach erfolgreichem Staging-Nachweis in einem
   getrennten, ausdrücklich autorisierten Migrationsschritt entzogen.
5. Diagnoseachsen nennen ihre logische Serviceidentität. Doctor-Probes bleiben
   read-only; Reparaturen sind separate, autorisierte Operationen.
6. Fehlende Tenant-IAM-Credentials führen niemals zu einem stillen
   Provisioner-Fallback.

## Konsequenzen

- Vorhandene Clients werden nicht mehr aufgrund fehlender Sichtbarkeit als
  fehlend gemeldet.
- Tenant-IAM kann den Login-Client für Benutzer- und Diagnoseabläufe lesen,
  aber weder Clients noch Secrets verändern.
- UI, Audit und MCP können Struktur-, Access- und Reconcile-Befunde ihrer
  technischen Identität zuordnen.
- Bestandsinstanzen erhalten `view-clients` beim nächsten expliziten
  Provisioning- oder Reconcile-Lauf. `manage-clients` bleibt während dieser
  additiven Phase bestehen und wird nicht durch diesen Codeblock entzogen; die
  Software allein verändert keine produktive Keycloak-Instanz.

## Alternativen

- Nur den UI-Text ändern: verworfen, weil Server- und MCP-Verträge falsch
  blieben.
- Alle Prüfungen mit dem Provisioner ausführen: verworfen, weil dadurch die
  tatsächliche Tenant-IAM-Betriebsfähigkeit nicht geprüft würde.
- `manage-clients` beibehalten: verworfen, weil Lese- und Schreibhoheit
  vermischt blieben.
