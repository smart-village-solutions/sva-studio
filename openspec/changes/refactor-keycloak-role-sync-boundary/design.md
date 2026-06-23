## Context
Das Zielmodell fuer Plattform- und Tenant-Rollen ist bereits auf einen engen Sonderrollenschnitt reduziert worden. In der laufenden Spezifikation und Teilen der Runtime steckt aber noch die aeltere Annahme, dass studioverwaltete Rollen grundsaetzlich mit Keycloak-Realm-Rollen gespiegelt werden. Dadurch entstehen gleichzeitig mehrere Rollenbilder:

- rohe Keycloak-Rollen in Session und `/auth/me`
- kanonisch projizierte Rollen in IAM-Detail- und Profilansichten
- effektive Permissions aus IAM-Rollen, Gruppen und Modulvertraegen

Diese Mehrfachmodellierung ist nicht nur unuebersichtlich, sondern erzeugt auch unnötige Kopplung zwischen Login-System und fachlicher Autorisierung.

## Goals / Non-Goals
- Goals:
  - Keycloak fuer fachliche Tenant-Rollen aus der normativen Autorisierung entfernen.
  - Keycloak als Identitaets- und Realm-System fuer OIDC, Benutzerkonto und wenige technische Sonderrollen beibehalten.
  - Session-, Guard- und UI-Projektionen auf eine kanonische tenantseitige Rollen- und Permission-Sicht ausrichten.
  - Legacy-Keycloak-Rollen in Bestands-Tenants sichtbar und reparierbar halten, ohne sie weiter als Sollmodell zu materialisieren.
  - Den Umbau in kleinen, betriebssicheren Schritten durchfuehren.
- Non-Goals:
  - Kompletter Rueckbau saemtlicher Keycloak-Admin-Funktionalitaet in einem Schritt
  - Abschaffung von Keycloak als Identitaetsprovider
  - Vollstaendige Neumodellierung aller Governance-Rollen im selben Change
  - Sofortige harte Loeschung historischer Keycloak-Rollen in Bestandsumgebungen

## Decisions
- Decision: Keycloak bleibt System of Record fuer Identitaet, Login, Realm-Scope und technische Sonderrollen, aber nicht fuer tenantlokale Fachrollen.
  - Why: Das trennt Authentifizierung sauber von fachlicher Autorisierung, ohne den OIDC- und Admin-Betrieb neu aufzubauen.
- Decision: Tenantlokale Custom-Rollen und Gruppen werden normativ nur noch in der IAM-Datenbank gespeichert und ausgewertet.
  - Why: Dort liegen bereits die fachlichen Permissions, Modulvertraege und effektiven Berechtigungsauflösungen.
- Decision: `system_admin` bleibt tenantlokal die einzige geschuetzte Sonderrolle, die bei Bedarf auch technisch in Keycloak abbildbar bleibt.
  - Why: Fuer Bootstrap, Zugriffsschutz und Letztadmin-Semantik braucht es weiterhin eine robuste Sonderrolle.
- Decision: `instance_registry_admin` bleibt die einzige relevante Plattformrolle im Root-Realm.
  - Why: Damit bleibt die Plattformverwaltung eindeutig vom Tenant-Scope getrennt.
- Decision: Rohrollen aus Keycloak duerfen in Session- oder Diagnoseobjekten weiterhin sichtbar sein, aber nicht mehr direkt als normative UI- oder Guard-Grundlage dienen.
  - Why: Das erlaubt Kompatibilitaet und Drift-Diagnose waehrend der Uebergangsphase.
- Decision: `/auth/me` und Session-Projektionen liefern zwei klar getrennte Rollensichten: kanonische IAM-Rollen (einschliesslich impliziter Rollenwirkung aus Gruppenzuordnungen) und rohe Keycloak-Rollen.
  - Why: Damit bleiben Interop- und Diagnosefaelle sichtbar, waehrend Autorisierung strikt auf der kanonischen IAM-Sicht bleibt.
- Decision: Der Umbau erfolgt in drei Betriebsphasen: Lesepfade umstellen, Schreib-/Sync-Pfade einengen, Legacy-Abhaengigkeiten tenantweise abbauen.
  - Why: So wird ein Big Bang vermieden.

## Risks / Trade-offs
- Risiko: Bestehende UI- oder API-Gates verlassen sich noch indirekt auf rohe Keycloak-Rollen.
  - Mitigation: Erst Guard- und Projektionspfade auf kanonische IAM-Sicht umstellen und mit Diagnosefeldern absichern.
- Risiko: Bestands-Tenants enthalten noch fachlich wirksame Keycloak-Rollen, die nach dem Umschalten unbemerkt Wirkung verlieren.
  - Mitigation: Vor dem Abschalten des breiten Syncs tenantweise Drift-Berichte und Kompatibilitaetswarnungen bereitstellen.
- Risiko: Profile, `/auth/me` und Admin-Ansichten zeigen fuer eine Uebergangszeit unterschiedliche Rollenbilder.
  - Mitigation: Ein explizites Doppelfeld-Modell verwenden (kanonische IAM-Sicht inkl. Gruppenableitungen plus rohe Keycloak-Sicht), Guards und APIs aber ausschliesslich gegen die kanonische IAM-Sicht evaluieren.
- Risiko: Technische Sonderrollen werden versehentlich mit allgemeinen Studio-Rollen verwechselt.
  - Mitigation: Managed-Scope, Sync-Pfade und UI-Beschriftungen explizit zwischen technischen Sonderrollen und tenantlokalen Fachrollen trennen.

## Migration Plan
1. Spezifikation auf die neue Sync-Grenze ausrichten.
2. Lesepfade vereinheitlichen:
   - Session-/`/auth/me`-Projektion
   - Route- und API-Gates
   - Profil- und Admin-UI
3. Schreibpfade fuer tenantlokale Custom-Rollen auf IAM-only umstellen.
4. Reconcile- und Drift-Pfade so aendern, dass Legacy-Keycloak-Rollen nur noch berichtet und nicht mehr neu materialisiert werden.
5. Tenantweise Pruefung und Bereinigung von Altbestaenden.
6. Nach erfolgreicher Stabilisierung breite Keycloak-Rollen-Synchronisierung aus dem Happy Path entfernen.

## Open Questions
- Soll `system_admin` langfristig technisch in Keycloak erhalten bleiben oder spaeter ebenfalls rein aus IAM-Permissions abgeleitet werden?
- Welche bestehenden Governance-Routen sollen kurzfristig noch ueber kanonische Rollen und welche bereits direkt ueber Permissions geoeffnet werden?
