## 1. Vertrag und Persistenz

- [x] 1.1 Kanonische SSF-Permission-Menge und Claim-Namen festlegen
- [x] 1.2 Gewünschten und bestätigten Projektionszustand tenantgebunden persistieren
- [x] 1.3 Deterministische `authorizationRevision` aus der bestätigten Projektion berechnen
- [x] 1.4 Tenantgebundene Advisory-Lock und wiederaufnehmbare Zwischenzustände
      für den vollständigen externen Reconcile implementieren
- [x] 1.5 Effektive Studio-Permissions plugin-eigen und fail-closed auf
      unveränderte Tenant-Subjects, SSF-Rollen und SSF-Claims abbilden
- [x] 1.6 Effektive, aktive Tenant-Subjects samt SSF-Permission-Allowlist aus
      dem autoritativen Studio-IAM in einem Repeatable-Read-Snapshot lesen
- [x] 1.7 Hostseitige IAM-Quelle und plugin-eigenen Projektions-Reconcile über
      einen expliziten Runtime-Port verbinden

## 2. Keycloak-Projektion

- [x] 2.1 Tenantgebundenen, idempotenten Projektionsadapter mit injiziertem
      SSF-Client-Resolver für den gemeinsamen Tenant-Realm implementieren
- [x] 2.2 Projektion nach jedem Write vollständig zurücklesen und verifizieren
- [ ] 2.3 Den in `add-ssf-tenant-administration` deklarierten und provisionierten
      tenantlokalen SSF-Client produktiv auflösen
- [ ] 2.4 Lock-Schlüssel normalisieren, Primärfehler bei Unlock-Fehlern erhalten
      und alle externen Keycloak-/SSF-Aufrufe mit nachweislich begrenzten
      Laufzeiten ausführen
- [ ] 2.5 Teilfehler, Retry und konkurrierende Läufe im produktiven
      Plugin-Lifecycle fail-closed behandeln

## 3. Token und Session-Lifecycle

- [x] 3.1 Mapper und Benutzerattribute für die verifizierte Revision im
      tenantlokalen SSF-Client-Scope idempotent projizieren
- [x] 3.2 Die Tokenausstellung ausschließlich des betroffenen SSF-Clients vor
      dem ersten Projektions-Write sperren und erst nach Read-back und
      Session-Widerruf wieder freigeben; Studio-Client und Realm-Session bleiben
      unangetastet
- [ ] 3.3 Benutzertokenclaim, Host-Readiness und Runtime-Antwort revisionsgleich prüfen
- [ ] 3.4 Bestehende SSF-Sessions nach relevanten Permission-Änderungen über
      eine tenantgebundene SSF-Schnittstelle widerrufen

## 4. Betrieb und Nachweise

- [ ] 4.1 Audit, niedrig-kardinale Metriken und getrennte Readiness-Ursachen ergänzen
- [ ] 4.2 Zwei-Tenant-, Mismatch-, Lock-/Unlock-, Timeout-, Client-Sperr-,
      Ausfall-, Retry- und Widerrufstests ergänzen
- [ ] 4.3 Staging-E2E für Projektion → Token → Runtime → Widerruf an exakten Digest binden
- [ ] 4.4 Produktive Runtime-Freigabe erst nach grünem Staging-Nachweis aktivieren
