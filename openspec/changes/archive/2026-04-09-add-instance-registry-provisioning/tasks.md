## 1. Spezifikation und Architektur

- [x] 1.1 Delta-Specs fuer `deployment-topology`, `architecture-documentation` und `instance-provisioning` finalisieren
- [x] 1.2 ADR-Fortschreibung fuer den Wechsel von Env-Allowlist zu Registry-basierter Tenant-Freigabe erstellen
- [x] 1.3 arc42-Abschnitte `04`, `05`, `06`, `07`, `08`, `09`, `10` und `11` aktualisieren

## 2. Datenmodell und Kernlogik

- [x] 2.1 Registry-Datenmodell und SQL-Migrationen fuer Instanzen, Hostnamen, Status und Audit-Felder einfuehren; inklusive technischer Isolations-Constraints fuer `instanceId`-gebundene Reads/Writes
- [x] 2.2 Framework-agnostische Kernlogik fuer Host-Normalisierung, Registry-Lookup, Statuspruefung und fail-closed-Antworten implementieren
- [x] 2.3 Caching-Strategie fuer Registry-Lookups mit klarer Fuehrungsquelle und Invalidation implementieren
- [x] 2.4 Repro- und Edge-Case-Tests fuer Host-Aufloesung, unbekannte Hosts, gesperrte Instanzen, Cache-Verhalten und negative Cross-Tenant-Faelle ergaenzen

## 3. Runtime- und Auth-Integration

- [x] 3.1 SDK- und Auth-Pfade von env-basierter Allowlist auf Registry-basierte Tenant-Aufloesung umstellen
- [x] 3.2 Root-Host als kanonischen Auth-Host beibehalten und Redirect-/Return-Pfade fuer Tenant-Kontext kontrolliert modellieren
- [x] 3.3 Runtime-Profile und Deploy-Checks auf plattformweite Root-Konfiguration statt tenant-spezifische Einzelprofile umstellen
- [x] 3.4 Lokalen Dev-Vertrag fuer einfachen Modus und registry-nahen Multi-Tenant-Modus mit offizieller Hostname-Strategie festlegen
- [x] 3.5 Betroffene Unit-, Type- und Integrations-Tests nach jedem Aenderungsblock ausfuehren

## 4. Lokales Testing und Verifikation

- [x] 4.1 Seed-Daten und Test-Fixtures fuer mindestens zwei aktive und einen negativen Tenant-Fall einfuehren
- [x] 4.2 Lokalen Root-Host und Tenant-Hosts fuer Tests und manuelle Entwicklung reproduzierbar konfigurierbar machen
- [x] 4.3 Unit-, Integrations- und E2E-Testfaelle fuer Registry-Aufloesung, fail-closed-Verhalten und Provisioning ohne Redeploy implementieren
- [x] 4.4 Schnellen lokalen Standardpfad und realistischen Multi-Tenant-Testpfad getrennt dokumentieren und verifizieren

## 5. Provisioning und Steuerung

- [x] 5.1 Provisioning-Fassade mit idempotentem Statusmodell (`requested`, `validated`, `provisioning`, `active`, `failed`, `suspended`, `archived`) implementieren
- [x] 5.2 Nicht-interaktiven CLI-/Ops-Pfad fuer Instanzanlage, Aktivierung, Suspendierung und Archivierung implementieren
- [x] 5.3 Admin-seitigen Studio-Steuerungspfad fuer Instanzanlage auf denselben Vertrag spezifizieren (Umsetzung ggf. Folge-Change)
- [x] 5.4 Audit-Logs und Betriebsdiagnostik fuer Provisioning-Laeufe und Tenant-Mutationen einfuehren, inklusive Nachweis "keine Secrets in Logs"

## 6. Verifikation und Betriebsdoku

- [x] 6.1 Runbooks fuer DNS, TLS, Deploy, Smoke und neue Instanzanlage auf das Registry-Modell aktualisieren
- [x] 6.2 Runbooks fuer lokale Hosts, Seed-Instanzen, Dev-Proxy/DNS und Multi-Tenant-Tests aktualisieren
- [x] 6.3 Tests mindestens ueber `pnpm nx affected --target=test:unit --base=origin/main`, `pnpm test:types`, `pnpm test:eslint` und relevante affected-Targets verifizieren
- [x] 6.4 OpenSpec-Change mit `openspec validate add-instance-registry-provisioning --strict` validieren
