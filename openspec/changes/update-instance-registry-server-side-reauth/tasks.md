## 1. Spezifikation
- [ ] 1.1 Fresh-Reauth-Anforderung fuer kritische Instanz-Mutationen im Capability-Vertrag `instance-provisioning` praezisieren.
- [ ] 1.2 Serverseitigen Fresh-Reauth-Nachweis und Nicht-Akzeptanz klientseitiger Bestaetigungen im Capability-Vertrag `iam-core` spezifizieren.

## 2. Umsetzung
- [ ] 2.1 Session-Modell um einen serverseitig gebundenen Fresh-Reauth-Nachweis oder aequivalente bestehende Reauth-Evidenz erweitern.
- [ ] 2.2 Kritische Instance-Registry- und Keycloak-Mutationen ausschliesslich gegen diesen serverseitigen Nachweis pruefen.
- [ ] 2.3 Klientseitige Fresh-Reauth-Header als Sicherheitsbeweis aus den Guard-Pfaden entfernen.
- [ ] 2.4 Explizites Nicht-Produktiv-Verhalten fuer lokale Dev-/Mock-Auth-Profile implementieren oder einen serverseitigen Dev-Nachweis bereitstellen.

## 3. Verifikation
- [ ] 3.1 Unit-Tests fuer positive und negative Fresh-Reauth-Guardszenarien ergaenzen.
- [ ] 3.2 Regressionstests fuer lokale Entwicklungsprofile und Root-Host-Control-Plane-Mutationen ergaenzen.
- [ ] 3.3 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder begruendet als unveraendert dokumentieren.
