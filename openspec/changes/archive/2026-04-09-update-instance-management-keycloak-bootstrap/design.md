## Context

Die bestehende Instanzverwaltung ist Root-Host-zentriert und darf nur von Plattform-Admins mit `instance_registry_admin` genutzt werden. Tenant-spezifische Keycloak-Realm-Konfigurationen werden heute nur teilweise durch Studio modelliert (`authRealm`, `authClientId`, optional `authIssuerUrl`). Für einen betriebsfähigen Tenant-Login fehlen jedoch zusätzlich:

- tenant-spezifisches OIDC-Client-Secret
- `instanceId`-Protocol-Mapper
- tenant-spezifische Redirect-/Logout-/Origin-URLs
- initialer Tenant-Admin mit `system_admin`

## Decisions

### Führende Datenquelle

- Registry bleibt führend für Realm-Zuordnung, Realm-Modus, Client-ID, optionalen Issuer und das tenant-spezifische Client-Secret
- temporäre Admin-Passwörter bleiben write-only und werden nicht persistiert
- Keycloak-Status, Preflight und Plan werden serverseitig on-demand berechnet
- Provisioning-Läufe und Schrittprotokolle werden persistent gespeichert

### Sicherheitsmodell

- globale Instanzverwaltung bleibt nur auf dem Root-Host verfügbar
- alle neuen Mutationen bleiben an `instance_registry_admin` gebunden
- Secrets werden mit der bestehenden Feldverschlüsselung aus `@sva/core/security` gespeichert
- Responses und Logs geben niemals Klartext-Secrets oder Einmalpasswörter zurück
- Keycloak-Mutationen laufen erst nach explizitem Preflight und blockieren bei fehlenden technischen oder fachlichen Voraussetzungen

### Provisioning-Verhalten

Provisioning ist idempotent, realm-modusbewusst und erzwingt pro Instanz:

- Realm existiert und ist aktiviert
- OIDC-Client `authClientId`
- tenant-spezifische `rootUrl`, `redirectUris`, `webOrigins`, `post.logout.redirect.uris`
- `instanceId`-Mapper auf dem Client
- Tenant-Admin existiert, trägt `attributes.instanceId=<instanceId>` und hat genau `system_admin` als Minimalrolle
- `instance_registry_admin` wird aktiv entfernt, wenn dem Tenant-Admin versehentlich zugewiesen
- jeder Lauf erzeugt einen persistenten Run mit Schrittprotokoll, Request-ID und Drift-Zusammenfassung
- `Registry speichern` und `Provisioning ausführen` bleiben getrennte Aktionen

### UI-Modell

- Instanzliste bleibt kompakt
- Instanzdetail wird zur gefuehrten Steuerungsflaeche
- die UI zeigt Vorbedingungen, Realm-Modus, Konfiguration, Vorschau, Ausfuehrung und Protokoll
- Keycloak-Status ist read-only, Provisioning ist explizit auszulösen
- Client-Secret und temporäre Admin-Passwörter sind write-only
