## 1. Rollenvertrag und serverseitige Defaults

- [x] 1.1 Rollen-Create-Vertrag so erweitern, dass `roleLevel` für Custom-Rollen optional ist und bei fehlendem Wert serverseitig `0` verwendet wird
- [x] 1.2 Framework-agnostische, deterministische Normalisierung für technische Rollenschlüssel einschließlich Umlauten, sonstigen Diakritika, Mindest-/Maximallänge, leerem Fallback und längensicherer Suffixbildung implementieren
- [x] 1.3 Instanzweite Kollisionsauflösung transaktional und idempotent absichern; Parallel- und Retry-Fälle testen
- [x] 1.4 Bestehende Update-Verträge so absichern, dass ein nicht gesendetes `roleLevel` den persistierten Wert unverändert lässt
- [x] 1.5 Fehlermeldungen für geschützte Rollen- und Zielkontengrenzen ohne sichtbare numerische Hierarchiestufe formulieren und lokalisierbar ausliefern

## 2. Rollenverwaltung vereinfachen

- [x] 2.1 `roleLevel` aus normaler Rollenliste, Rollenanlage und bearbeitbaren Rollendetails entfernen; technische Sonderrollen und interne Read-Model-Kompatibilität unverändert lassen
- [x] 2.2 Rollenanlage auf Anzeigename und optionale Beschreibung umstellen und den serverseitig erzeugten Schlüssel nach Anlage nur unter zugänglichen „Technischen Details“ anzeigen
- [x] 2.3 Gemeinsame normalisierte Dirty-State-Hilfslogik für allgemeine Rollendaten und Permission-Zuordnungen verwenden
- [x] 2.4 Save-Aktionen ohne Änderungen deaktivieren, nach Erfolg wieder in den deaktivierten Zustand überführen und bei Fehlern dirty sowie wiederholbar lassen
- [x] 2.5 Rechtebereiche, Aktionen und `own`/`organization`/`all` vollständig in Deutsch und Englisch fachlich beschriften und technische IDs nur ergänzend anzeigen
- [x] 2.6 `content.publish` und `content.changeStatus` in der Rechteauswahl getrennt und verständlich erläutern, ohne neue Plugin-Publish-Permissions einzuführen

## 3. Eigenes Push-Recht

- [x] 3.1 `news.pushNotification` als vollständig qualifizierte News-Permission in Plugin-, Modul- und kanonischen IAM-Katalogen registrieren
- [x] 3.2 Reconcile/Materialisierung so erweitern, dass die Definition verfügbar wird, bestehende Custom-Rollen aber keinen automatischen Grant erhalten und `system_admin` dem bestehenden Vollzugriffsvertrag folgt
- [x] 3.3 News-Editoroption anhand der hostaufgelösten `news.pushNotification`-Entscheidung anzeigen beziehungsweise sperren
- [x] 3.4 News-Create und -Update bei `pushNotification = true` zusätzlich serverseitig mit `news.pushNotification` schützen und vor jedem Mainserver-Aufruf fail-closed ablehnen
- [x] 3.5 Basis-, Push- und gegebenenfalls Publish-Autorisierung getrennt auditieren und strukturierte `required_permissions` ausliefern

## 4. Tests und Nachweise

- [x] 4.1 Unit-Tests für Schlüsselnormalisierung, Umlaute und sonstige Diakritika, Mindest-/Maximallänge, Kollisionen, Parallelität, explizite Legacy-Schlüssel und Idempotency ergänzen
- [x] 4.2 Handler- und Repository-Tests für `roleLevel = 0`, Update-Erhalt, technische Sonderrollen und verständliche Schutzfehler ergänzen
- [x] 4.3 Rollen-UI-Tests für ausgeblendetes `roleLevel`, technische Details, lokalisierte Scope-Erklärungen und Dirty-/Saving-/Saved-/Error-Zustände ergänzen
- [x] 4.4 Positive und negative Mainserver-/Plugin-Tests für Create/Update mit und ohne `news.pushNotification` sowie unabhängige Publish-/Push-Kombinationen ergänzen
- [x] 4.5 Rollenanlage und News-Push als tastatur- und screenreader-bedienbare E2E-Flows einschließlich direkter unberechtigter Requests absichern
- [x] 4.6 Betroffene Unit- und Type-Targets blockweise ausführen; bei IAM-/Server-Package-Änderungen früh `pnpm check:server-runtime` ausführen

## 5. Dokumentation und Abschluss

- [x] 5.1 `docs/architecture/08-cross-cutting-concepts.md` um die interne, nicht normative `roleLevel`-Behandlung und das eigenständige Push-Recht ergänzen
- [x] 5.2 `docs/architecture/11-risks-and-technical-debt.md` fortschreiben: UI-Ausblendung ist kein vollständiger `roleLevel`-Rückbau
- [x] 5.3 Relevante IAM-, Rollen- und News-Administrationsdokumentation auf automatische Schlüssel, Rechtebegriffe und Push-Vergabe aktualisieren
- [x] 5.4 OpenSpec strikt validieren sowie File-Placement-, i18n-, Changelog- und die kleinsten relevanten Nx-Gates ausführen
- [x] 5.5 Issue #626 anhand der umgesetzten und nachgewiesenen Akzeptanzfälle aktualisieren; Vorlagen und vollständigen `roleLevel`-Rückbau nicht als Bestandteil dieses Changes darstellen
