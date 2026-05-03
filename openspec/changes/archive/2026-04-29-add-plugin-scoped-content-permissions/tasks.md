## 1. Spezifikation und Architektur
- [x] 1.1 Generischen SDK-Vertrag für plugin-deklarierte Rechtefamilien final festlegen (inkl. Namespace-Validierung: Format, Reserved-List, Duplikat-Prüfung)
- [x] 1.2 Zielmodell für plugin-spezifische Rechtefamilien (`news.*`, `events.*`, `poi.*`) als erste produktive Nutzung dieses Vertrags final festlegen; jedes Plugin definiert seine Rechte individuell
- [x] 1.3 Action-zu-Permission-Bindung als v1-Konvention festlegen: identische fully-qualified IDs sind zulässig, `requiredAction`-Indirektion bleibt als kanonischer Mapping-Pfad erhalten
- [x] 1.4 Harten Schnitt für produktive Fachplugins ohne `content.*`-Fallback spezifizieren (kein Migrationspfad nötig, da keine produktive Nutzung)
- [x] 1.5 Relevante arc42-Abschnitte `05`, `06`, `08`, `09` aktualisieren
- [x] 1.6 `docs/guides/plugin-development.md` aktualisieren, damit der bisherige `content.*`-Guard-Vertrag für produktive Fachplugins entfernt oder eindeutig als Legacy markiert ist
- [x] 1.7 Neue oder angepasste ADR für plugin-spezifische IAM-Rechte anlegen und in Abschnitt 9 verlinken; dabei ADR-034, ADR-012/013 und ADR-025 referenzieren
- [x] 1.8 OpenSpec-Change mit `openspec validate add-plugin-scoped-content-permissions --strict` validieren

## 2. Backend und Datenmodell
- [x] 2.1 SDK- und Build-Time-Registry um plugin-deklarierte Rechte erweitern
- [x] 2.2 Seeds direkt auf plugin-spezifische Rechte umstellen (gemäß Plugin-Deklaration), Persona-Zuordnungen anpassen
- [x] 2.3 Zentrale Autorisierungslogik für plugin-deklarierte Rechte implementieren
- [x] 2.4 Registry-Validierung ergänzen: `content.*`-Guards, fremde Namespaces, Reserved-Namespaces und Namespace-Duplikate fail-fast abweisen

## 3. Frontend und Admin-UI
- [x] 3.1 Rollenverwaltung um generisch bearbeitbare Plugin-Rechte aus der Registry erweitern
- [x] 3.2 Plugin-Routen, Navigation und UI-Aktionen auf plugin-spezifische Rechte umstellen
- [x] 3.3 Texte und Labels vollständig über i18n ergänzen

## 4. Qualität und Nachweise
- [x] 4.1 Unit- und Integrationstests für Permission-Registry, Routing-Guards und Admin-UI ergänzen
- [x] 4.2 Negative Tests für Namespace-Isolation und Cross-Plugin-Zugriffe ergänzen (Mindestmatrix: Szenarien aus iam-access-control/spec.md und routing/spec.md)
- [x] 4.3 Negative Tests für Registry-Fail-fast: `content.*`-Guard, fremder Namespace, Reserved-Namespace, Namespace-Duplikat, nicht-registrierte Permission
- [x] 4.4 Seed-Plan-Tests aktualisieren: Persona-Zuordnungen für plugin-deklarierte `news.*`, `events.*`, `poi.*`-Rechte verifizieren
- [x] 4.5 `pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint` und relevante Nx-Targets für betroffene Projekte grün ausführen

## 5. Deployment
- [x] 5.1 Rollout-Sequenz einhalten: Seeds/Migration → App-Deploy → Smoke-Test
- [x] 5.2 Smoke-Test: Plugin-Routen mit neuen Guards erreichbar, `content.*`-Guards nicht mehr aktiv
