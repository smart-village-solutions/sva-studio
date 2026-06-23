## Context
Das Zielmodell für Plattform- und Tenant-Rollen ist bereits auf einen engen Sonderrollenschnitt reduziert worden. In der laufenden Spezifikation und Teilen der Runtime steckt aber noch die ältere Annahme, dass studioverwaltete Rollen grundsätzlich mit Keycloak-Realm-Rollen gespiegelt werden. Dadurch entstehen gleichzeitig mehrere Rollenbilder:

- rohe Keycloak-Rollen in Session und `/auth/me`
- kanonisch projizierte Rollen in IAM-Detail- und Profilansichten
- effektive Permissions aus IAM-Rollen, Gruppen und Modulverträgen

Diese Mehrfachmodellierung ist nicht nur unübersichtlich, sondern erzeugt auch unnötige Kopplung zwischen Login-System und fachlicher Autorisierung.

## Goals / Non-Goals
- Goals:
  - Keycloak für fachliche Tenant-Rollen aus der normativen Autorisierung entfernen.
  - Keycloak als Identitäts- und Realm-System für OIDC, Benutzerkonto und wenige technische Sonderrollen beibehalten.
  - Session-, Guard- und UI-Projektionen auf eine kanonische tenantseitige Rollen- und Permission-Sicht ausrichten.
  - Legacy-Keycloak-Rollen in Bestands-Tenants sichtbar und reparierbar halten, ohne sie weiter als Sollmodell zu materialisieren.
  - Den Umbau in kleinen, betriebssicheren Schritten durchführen.
- Non-Goals:
  - Kompletter Rückbau sämtlicher Keycloak-Admin-Funktionalität in einem Schritt
  - Abschaffung von Keycloak als Identitätsprovider
  - Vollständige Neumodellierung aller Governance-Rollen im selben Change
  - Sofortige harte Löschung historischer Keycloak-Rollen in Bestandsumgebungen

## Decisions
- Decision: Keycloak bleibt System of Record für Identität, Login, Realm-Scope und technische Sonderrollen, aber nicht für tenantlokale Fachrollen.
  - Why: Das trennt Authentifizierung sauber von fachlicher Autorisierung, ohne den OIDC- und Admin-Betrieb neu aufzubauen.
- Decision: Tenantlokale Custom-Rollen und Gruppen werden normativ nur noch in der IAM-Datenbank gespeichert und ausgewertet.
  - Why: Dort liegen bereits die fachlichen Permissions, Modulverträge und effektiven Berechtigungsauflösungen.
- Decision: `system_admin` bleibt tenantlokal die einzige geschützte Sonderrolle, die bei Bedarf auch technisch in Keycloak abbildbar bleibt.
  - Why: Für Bootstrap, Zugriffsschutz und Letztadmin-Semantik braucht es weiterhin eine robuste Sonderrolle.
- Decision: `instance_registry_admin` bleibt die einzige relevante Plattformrolle im Root-Realm.
  - Why: Damit bleibt die Plattformverwaltung eindeutig vom Tenant-Scope getrennt.
- Decision: Rohrollen aus Keycloak dürfen in Session- oder Diagnoseobjekten weiterhin sichtbar sein, aber nicht mehr direkt als normative UI- oder Guard-Grundlage dienen.
  - Why: Das erlaubt Kompatibilität und Drift-Diagnose während der Übergangsphase.
- Decision: `/auth/me` und Session-Projektionen liefern zwei klar getrennte Rollensichten: kanonische IAM-Rollen (einschließlich impliziter Rollenwirkung aus Gruppenzuordnungen) und rohe Keycloak-Rollen.
  - Why: Damit bleiben Interop- und Diagnosefälle sichtbar, während Autorisierung strikt auf der kanonischen IAM-Sicht bleibt.
- Decision: Der Umbau erfolgt in drei Betriebsphasen: Lesepfade umstellen, Schreib-/Sync-Pfade einengen, Legacy-Abhängigkeiten tenantweise abbauen.
  - Why: So wird ein Big Bang vermieden.

## Risks / Trade-offs
- Risiko: Bestehende UI- oder API-Gates verlassen sich noch indirekt auf rohe Keycloak-Rollen.
  - Mitigation: Erst Guard- und Projektionspfade auf kanonische IAM-Sicht umstellen und mit Diagnosefeldern absichern.
- Risiko: Bestands-Tenants enthalten noch fachlich wirksame Keycloak-Rollen, die nach dem Umschalten unbemerkt Wirkung verlieren.
  - Mitigation: Vor dem Abschalten des breiten Syncs tenantweise Drift-Berichte und Kompatibilitätswarnungen bereitstellen.
- Risiko: Profile, `/auth/me` und Admin-Ansichten zeigen für eine Übergangszeit unterschiedliche Rollenbilder.
  - Mitigation: Ein explizites Doppelfeld-Modell verwenden (kanonische IAM-Sicht inkl. Gruppenableitungen plus rohe Keycloak-Sicht), Guards und APIs aber ausschließlich gegen die kanonische IAM-Sicht evaluieren.
- Risiko: Technische Sonderrollen werden versehentlich mit allgemeinen Studio-Rollen verwechselt.
  - Mitigation: Managed-Scope, Sync-Pfade und UI-Beschriftungen explizit zwischen technischen Sonderrollen und tenantlokalen Fachrollen trennen.

## Migration Plan
1. Spezifikation auf die neue Sync-Grenze ausrichten.
2. Lesepfade vereinheitlichen:
   - Session-/`/auth/me`-Projektion
   - Route- und API-Gates
   - Profil- und Admin-UI
3. Schreibpfade für tenantlokale Custom-Rollen auf IAM-only umstellen.
4. Reconcile- und Drift-Pfade so ändern, dass Legacy-Keycloak-Rollen nur noch berichtet und nicht mehr neu materialisiert werden.
5. Tenantweise Prüfung und Bereinigung von Altbeständen.
6. Nach erfolgreicher Stabilisierung breite Keycloak-Rollen-Synchronisierung aus dem Happy Path entfernen.

## Open Questions
- Soll `system_admin` langfristig technisch in Keycloak erhalten bleiben oder später ebenfalls rein aus IAM-Permissions abgeleitet werden?
- Welche bestehenden Governance-Routen sollen kurzfristig noch über kanonische Rollen und welche bereits direkt über Permissions geöffnet werden?
