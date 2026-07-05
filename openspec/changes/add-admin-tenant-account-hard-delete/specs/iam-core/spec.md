## ADDED Requirements

### Requirement: Tenant-Accounts können privilegiert physisch gelöscht werden

Das System SHALL für Tenant-Accounts einen privilegierten Admin-Delete-Pfad bereitstellen, der den Zielaccount physisch aus Studio und Keycloak entfernt. Der Pfad gilt nur für Accounts der aktiven `instanceId` und ist kein Self-Service- oder DSR-Standardpfad.

#### Scenario: Berechtigter Tenant-Admin löscht einen normalen Tenant-Account physisch

- **WENN** ein berechtigter Tenant-Admin einen Tenant-Account der aktiven `instanceId` löscht
- **DANN** widerruft das System aktive Sessions des Zielaccounts
- **UND** entfernt die zugehörige Identität in Keycloak
- **UND** entfernt den Tenant-Account physisch aus den Studio-Accounttabellen
- **UND** protokolliert das System den Vorgang auditierbar als privilegierte Admin-Mutation

#### Scenario: Self-Delete bleibt verboten

- **WENN** ein berechtigter Benutzer versucht, seinen eigenen Tenant-Account über diesen Admin-Pfad zu löschen
- **DANN** lehnt das System den Vorgang ab
- **UND** erfolgt keine Löschung in Keycloak oder Studio

### Requirement: Inhalts- und Referenzbehandlung wird vor dem Hard-Delete aufgelöst

Das System SHALL vor einem privilegierten Tenant-Account-Hard-Delete alle blockierenden Referenzen so behandeln, dass der Account physisch gelöscht werden kann, ohne fachlich unzulässige Datenzustände zu erzeugen.

#### Scenario: Inhalte folgen der wirksamen Löschstrategie des Accounts

- **WENN** der Zielaccount eigene Inhalte besitzt
- **DANN** wertet das System vor dem Hard-Delete die wirksame Tenant-/Account-Regel für diese Inhalte aus
- **UND** behandelt Inhalte bei `mit Eigentümer-Lifecycle mitbehandeln` in einen fachlich gelöschten oder gleichwertig referenzverträglichen Zustand
- **UND** anonymisiert bei `beibehalten` owner-/author-bezogene Personenreferenzen so, dass der Account physisch entfernt werden kann

#### Scenario: Referenzierende Historie darf anonymisiert erhalten bleiben

- **WENN** Audit-, Verlaufs- oder andere referenzierende Fachdatensätze den Zielaccount noch referenzieren
- **DANN** darf das System diese Datensätze erhalten
- **UND** setzt oder transformiert es die Account-Bezüge vor dem Hard-Delete in einen anonymisierten oder referenzverträglichen Zustand
- **UND** bricht es den Delete fail-closed ab, wenn ein erforderlicher Referenzpfad nicht regelkonform aufgelöst werden kann
