## 1. Spezifikation

- [x] 1.1 `monorepo-structure` um eine kanonische technische Plugin-Identitaet mit genau einem owning namespace erweitern
- [x] 1.2 `content-management` um namespace-pflichtige plugin-beigestellte `contentType`-Identifier erweitern
- [x] 1.3 `routing` um namespace-pflichtige IDs fuer registrierte Admin-Ressourcen erweitern
- [x] 1.4 `iam-auditing` um namespace-pflichtige Plugin-Audit-Event-Typen erweitern
- [x] 1.5 Scope explizit gegen `plugin-actions`, Lifecycle-, Tier- und Guardrail-Changes abgrenzen

## 2. Design

- [x] 2.1 In `design.md` das kanonische Namensmodell `<namespace>.<name>` fuer nicht-Action-Identifier festhalten
- [x] 2.2 Reservierte Core-Namespaces, Ownership-Pruefung und Fail-fast-Kollisionsmodell beschreiben
- [x] 2.3 Migrations- und Kompatibilitaetsfolgen fuer bestehende unqualifizierte Plugin-Identifier dokumentieren und Core-Identifier wie `generic` oder `legal` explizit abgrenzen

## 3. Umsetzung

- [x] 3.1 In `packages/sdk` eine kanonische technische Plugin-Identitaet mit owning namespace als Teil des Plugin-Vertrags modellieren
- [x] 3.2 In SDK- oder Registry-nahen Typen fully-qualified Identifier fuer plugin-beigestellte `contentType`, Admin-Ressourcen-ID und Audit-Event-Typ normieren
- [x] 3.3 Host- oder Registry-Validierung fuer reservierte Core-Namespaces, fremde Namespace-Nutzung und Kollisionen implementieren
- [x] 3.4 Content-Registrierung auf fully-qualified `contentType`-Identifier umstellen
- [x] 3.5 Admin-Ressourcen-Registrierung auf fully-qualified Ressourcen-IDs umstellen
- [x] 3.6 Plugin-beigestellte Audit-Event-Typen auf fully-qualified Event-Typen umstellen
- [x] 3.7 `packages/plugin-news` auf den neuen Namespace-Vertrag migrieren
- [x] 3.8 Falls fuer bestehende unqualifizierte Plugin-Identifier eine Kompatibilitaetsphase benoetigt wird, diese explizit implementieren oder bewusst ausschliessen und dokumentieren

## 4. Qualitaet und Dokumentation

- [x] 4.1 Unit-Tests fuer Namespace-Format, reservierte Core-Namespaces, Ownership-Fehler und Kollisionsfaelle ergaenzen
- [x] 4.2 Type-Checks fuer fully-qualified Identifier und den Plugin-Vertrag ueber die vorhandenen Projekt-Gates aktualisieren; fuer `sdk`, `auth` und `plugin-news` wurden mangels separater `test:types`-Targets die jeweiligen `lint`-/`tsc`-Checks und `check:server-runtime` verwendet
- [x] 4.3 Relevante Entwickler- und Architekturdokumentation fuer Plugin-Identitaet und registrierte Host-Identifier aktualisieren
- [x] 4.4 Relevante Nx-Targets fuer betroffene Projekte ausfuehren; ausgefuehrt wurden Unit-Tests sowie die verfuegbaren Typ-/Lint-/Runtime-Gates fuer `sdk`, `auth` und `plugin-news`

## 5. Validierung

- [x] 5.1 `openspec validate add-p1-plugin-extension-namespacing-governance --strict` erfolgreich ausfuehren
