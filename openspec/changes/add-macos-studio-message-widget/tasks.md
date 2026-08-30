## 1. Architektur und Verträge

- [ ] 1.1 Neues ADR für den nativen Public-Client, externen Browser, PKCE, Claimed-HTTPS-Callback, Keychain-Grenze und die begrenzte Ausnahme von ADR-009 anlegen.
- [ ] 1.2 `docs/architecture/03-context-and-scope.md`, `05-building-block-view.md`, `06-runtime-view.md`, `07-deployment-view.md`, `08-cross-cutting-concepts.md`, `09-architecture-decisions.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` gemäß Proposal aktualisieren.
- [ ] 1.3 Frameworkunabhängigen, versionierten Nachrichten-, Provider- und API-Vertrag mit stabilen IDs, Priorität, Sensitivität, Ziel und optionalem Legacy-Zeitpunkt definieren.
- [ ] 1.4 Bestehende Changelog-Einträge weiterhin akzeptieren, `publishedAt` für neue Einträge verpflichtend validieren und die beim Start ausgelieferten 20 Einträge mit belegten Zeitpunkten nachtragen.
- [ ] 1.5 Entwickler- und Anwenderdokumentation für Nachrichtenbereich, native App, Datenschutzgrenzen und fehlende Echtzeitgarantie auf Deutsch ergänzen.

## 2. Persistenz und Gelesen-Stand

- [ ] 2.1 Vor der Migration `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` gegen den tatsächlichen IAM-Schemavertrag prüfen.
- [ ] 2.2 Idempotente Goose-Migration für `iam.account_message_receipts` mit zusammengesetztem Primärschlüssel, Membership-Fremdschlüssel, Constraints sowie aktivierter und erzwungener RLS hinzufügen.
- [ ] 2.3 Repository- und Service-Logik für instanz-/accountgebundene Reads und idempotente Upserts implementieren, ohne Nachrichtentexte zu persistieren.
- [ ] 2.4 Schema-Snapshot und Schema-Übersicht nach der Migration vollständig fortschreiben.
- [ ] 2.5 PostgreSQL-16-Up/Down/Up-, RLS-, Tenant-Isolations-, Membership-Lösch- und Query-Plan-Tests ergänzen.
- [ ] 2.6 Gelesen-Belege in vollständige DSR-Selbst-/Adminexporte aufnehmen und Exportautorisierung, Formate sowie Auditierung testen.
- [ ] 2.7 Gemeinsame validierte Aufbewahrungsfrist für Feed-Sichtbarkeit und Gelesen-Belege mit 365-Tage-Default, Dry Run, expliziter Freigabe bei Verkürzung, Legal-Hold-Sperre und periodischer Bereinigung implementieren und testen.

## 3. Nachrichtenfeed und Studio-API

- [ ] 3.1 Feed-Kernlogik mit Provider-Validierung, Deduplizierung, deterministischer Sortierung, Account-Sichtbarkeit und serverseitigem Limit implementieren.
- [ ] 3.2 Bestehenden Studio-Changelog-Katalog als ersten Provider adaptieren und sicheren Klartextauszug für native Clients erzeugen.
- [ ] 3.3 `GET /api/v1/account/messages/summary`, `GET /api/v1/account/messages`, `POST /api/v1/account/messages/read` und kurzlebige, einmalige, account-/instanzgebundene Browser-Übergaben mit strikter Eingabevalidierung, stabilen Fehlercodes und privatem `no-store` bereitstellen.
- [ ] 3.4 Browser-Session und native Bearer-Identität vor der Fachlogik in denselben instanzgebundenen Accountkontext überführen.
- [ ] 3.5 API-, Unit- und Integrationstests für Limits, Sichtbarkeit, Scopes, Gelesen-Status, Fehlerfälle und Log-Redaktion ergänzen.

## 4. Native Authentifizierung

- [ ] 4.1 Nativen öffentlichen OIDC-Client mit exakten Redirect-URIs, API-Audience und ausschließlich `studio.messages.read` sowie `studio.messages.read-state.update` in Registry und Keycloak-Vertrag modellieren; die vom Benutzer gewählte Studio-Instanz serverseitig validieren und in eine kurzlebige Login-Transaktion mit erlaubtem Realm/Issuer, Callback und API-Host auflösen.
- [ ] 4.2 Authorization Code mit PKCE S256, externem Systembrowser, State/Nonce, integritätsgeschützter Instanz-/Issuer-/Callback-/API-Host-Bindung und verifiziertem Claimed-HTTPS-Callback implementieren; eingebettete Login-WebViews, Client-Secrets und frei übernommene Host-/Realmwerte ausschließen.
- [ ] 4.3 Studio-Bearer-Prüfung für Signatur, Algorithmus, Issuer, Audience, Client, Zeitgrenzen, Scopes, Instanz, gebundenen API-Host und aktiven Account implementieren.
- [ ] 4.4 Keychain-Sharing für Container-App und Widget Extension auf die minimal erforderliche Access Group begrenzen; Token aus Preferences, App-Group-Dateien, Logs und Telemetrie ausschließen; Refresh-Rotation, Logout und Accountwechsel per gemeinsamer prozessübergreifender Sperre, erneutem Keychain-Read, Credential-Generation und Logout-Tombstone serialisieren.
- [ ] 4.5 Logout, Accountwechsel, konkurrierende App-/Widget-Refreshes, Lock-Timeout, Refresh-Rotation, Tombstone, Widerruf, Forced Reauth, Kontosperre und Membership-Verlust fail-closed mit Tests abdecken.
- [ ] 4.6 `pnpm check:server-runtime` früh für Änderungen an `packages/auth-runtime` und weiteren serverseitigen Packages ausführen.

## 5. Studio-Nachrichtenbereich

- [ ] 5.1 Typsichere Route für den Studio-Nachrichtenbereich mit vorhandenen shadcn/ui-/Design-System-Primitiven ergänzen.
- [ ] 5.2 Dargestellte Nachrichten erst nach erfolgreichem Laden markieren; Browser-Übergaben nur bei exakter Übereinstimmung von nativer und Browseridentität konsumieren und vor einem nötigen Accountwechsel weder Inhalt darstellen noch Gelesen-Belege verändern.
- [ ] 5.3 Relative Nachrichtenziele serverseitig allowlisten, kurzlebige einmalige Browser-Übergaben an Instanz, Account und Ziel binden und externe beziehungsweise protokollfremde Links ablehnen.
- [ ] 5.4 Deutsche und englische Übersetzungen, Tastaturbedienung, Fokusführung, semantische Überschriften und zugängliche Lade-/Leer-/Fehlerzustände ergänzen.
- [ ] 5.5 Gezielte Unit-, Route-, A11y- und E2E-Tests für Liste, Zähler, Markierung und Deep Links ergänzen.

## 6. Native macOS-App und WidgetKit

- [ ] 6.1 Vor dem Scaffolding den vorgeschriebenen `nx-generate`-Workflow ausführen und nur bei fehlendem geeignetem Generator das dokumentierte manuelle Sonderfall-Setup verwenden.
- [ ] 6.2 `apps/sva-studio-macos` mit Container-App, Widget Extension, gemeinsamem Swift-Modell und Nx-Targets für Build, native Tests und statische Prüfung anlegen.
- [ ] 6.3 Kleines Widget als reinen Ungelesen-Zähler ohne Abruf von Nachrichtentexten implementieren.
- [ ] 6.4 Mittleres Widget mit höchstens drei und großes Widget mit höchstens fünf automatisch gewählten Nachrichten implementieren.
- [ ] 6.5 Privacy-Redaktion für Titel und Texte, neutrale Sperrzustandsanzeige sowie Lade-, Leer-, Offline-, Fehler- und Reauth-Zustände implementieren.
- [ ] 6.6 Widget-Reads frei von Gelesen-Mutationen halten; Widget-Interaktionen über die Container-App und frisch angeforderte account-/instanzgebundene Browser-Übergaben auf Nachrichtenbereich und Einzelnachricht führen.
- [ ] 6.7 Logout löscht Keychain-Credentials und abgeleitete lokale Zustände und fordert eine Neuladung aller Widget-Timelines an.
- [ ] 6.8 Native Unit-, UI-, Snapshot-, VoiceOver-, Dynamic-Type-, Kontrast- und Redaktionsprüfungen für alle Widget-Größen ergänzen.
- [ ] 6.9 Die begrenzte XCTest-/Xcode-Toolchain-Ausnahme von der Vitest-Standardregel in der aktuellen Testdokumentation festhalten, ohne TypeScript-Testpfade zu verändern.

## 7. Build, Distribution und Betrieb

- [ ] 7.1 Separaten Nx-/GitHub-Actions-Pfad für reproduzierbare native Build- und Testartefakte ergänzen, ohne den kanonischen Studio-Rollout zu verändern.
- [ ] 7.2 Produktive Pilotveröffentlichung ohne Apple-Signatur, Notarisierungsnachweis, Checksummen und nachvollziehbare Quellrevision hart blockieren.
- [ ] 7.3 Versionierungs- und Rückwärtskompatibilitätsvertrag zwischen Studio-API und nativem Client einschließlich Erzeugung und Konsum der Browser-Übergabe testen und dokumentieren; inkompatible Server-Promotion blockieren, bis alle betroffenen unterstützten Clientversionen migriert oder aus dem Supportfenster gefallen sind.
- [ ] 7.4 Staging-Abnahme für servervalidierte Instanzauswahl, externen Browserlogin, State-/Issuer-/Callback-/API-Host-Bindung, Tokenrefresh, Logout/Widerruf, Account-Deaktivierung, Tenant-Konflikt und Widget-Timelines durchführen.
- [ ] 7.5 Betriebsdokumentation klar vom normativen `docs/guides/studio-rollout-process.md` abgrenzen; keinen zweiten Studio-Deploypfad definieren.

## 8. Abschluss-Gates

- [ ] 8.1 Kleinste relevante Unit-, Type-, Server-Runtime-, Migrations-, native Build-/Test- und A11y-Gates nach jedem abgeschlossenen Änderungsblock ausführen.
- [ ] 8.2 `openspec validate add-macos-studio-message-widget --strict`, `pnpm check:file-placement`, `pnpm check:studio-changelog` und `git diff --check` ausführen.
- [ ] 8.3 Vor dem initialen Code-PR-Push den betroffenen Scope messen und nach Möglichkeit `pnpm test:pr` ausführen; breite Folgefix-Runs gemäß Repository-Regeln vermeiden.
- [ ] 8.4 Nach Eröffnung des PR den verpflichtenden deutschen Eintrag `docs/changelog/entries/pr-<nummer>.json` ergänzen und committed validieren.
- [ ] 8.5 Security-, Privacy-, Accessibility- und Architekturreview einschließlich neuer ADR-, Token-, RLS-, Deep-Link- und Widget-Snapshot-Grenzen abschließen.
