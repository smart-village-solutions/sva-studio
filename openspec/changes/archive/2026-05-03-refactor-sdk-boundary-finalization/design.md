## Kontext

Die aktuelle Zielarchitektur trennt Plugin-Vertraege und Server-Runtime-Vertraege bereits fachlich auf. Gleichzeitig existiert mit `@sva/sdk` weiterhin ein oeffentlicher Einstieg, der grosse Teile von `@sva/plugin-sdk` re-exportiert und daneben eigene Legacy-Helper traegt. Historische Dokumente beschreiben teils noch `@sva/sdk` als Plugin-Boundary, waehrend neuere Dokumente `@sva/plugin-sdk` und `@sva/server-runtime` als Zielbild festlegen.

Im aktuellen Produktivcode ist die Migration allerdings schon weit fortgeschritten: aktive Packages und Apps konsumieren die Zielpackages bereits weitgehend direkt, waehrend die Hauptdrift in der Compat-Fassade `packages/sdk` und in widerspruechlichen Dokumenten liegt. Dadurch entsteht weniger ein Laufzeitfehler als ein Architektur- und Governance-Fehler: dieselbe Verantwortung hat mehrere oeffentliche Namen und unterschiedliche normative Quellen.

## Ziele

- einen einzigen kanonischen Vertrag fuer Plugin-Host-Integration festlegen
- einen einzigen kanonischen Vertrag fuer Server-Runtime-Helfer festlegen
- `@sva/sdk` auf eine klar begrenzte Uebergangsrolle reduzieren
- Doku-, Review- und Lint-Regeln auf denselben Architekturvertrag ausrichten
- den real verbleibenden Restbestand in `@sva/sdk` und der Dokumentation explizit erfassen
- Migration ohne abrupten Breaking Cut vorbereiten

## Nicht-Ziele

- kein grossflaechiges Umverdrahten produktiver Packages ohne nachgewiesenen Restbedarf
- kein sofortiges Entfernen aller bestehenden `@sva/sdk`-Re-Exports in einem Schritt
- kein Rueckbau von `@sva/plugin-sdk` zugunsten einer neuen Sammelfassade
- keine erneute Zusammenlegung von Plugin-, Runtime-, Routing- oder IAM-Verantwortungen

## Entscheidungen

- `@sva/plugin-sdk` ist der einzige kanonische oeffentliche Vertrag fuer Plugin-Metadaten, Registries, Admin-Ressourcen, Plugin-Actions, Content-Type-Erweiterungen, Plugin-i18n und vergleichbare Host-Erweiterungspunkte.
- `@sva/server-runtime` ist der einzige kanonische oeffentliche Vertrag fuer Request-Kontext, Logging, JSON-Fehlerantworten, Workspace-Kontext und OTEL-Bootstrap.
- `@sva/sdk` bleibt waehrend der Migration als deprecated Compatibility-Layer erlaubt, ist aber kein Zielpackage mehr und darf keine neue Ownership begruenden.
- Die finale Zuspitzung dieses Changes ist primaer dokumentarisch und governancelastig; Code-Aenderungen in `packages/sdk`, `plugin-sdk`, `server-runtime` oder ESLint erfolgen nur, wenn sie direkt zur Sichtbarmachung oder Absicherung des Compat-Status noetig sind.
- Neue fachliche oder architekturpraegende APIs duerfen nicht mehr in `@sva/sdk` eingefuehrt werden. Falls ein neuer Vertrag noetig ist, muss er direkt in das passende Zielpackage.
- Verbleibende Re-Exports in `@sva/sdk` sind nur zulaessig, wenn sie dokumentierte Altpfade stabilisieren. Jede neue Nutzung solcher Altpfade gilt als Architekturabweichung.
- Der Change inventarisiert explizit, welche `@sva/sdk`-Exports nur noch Compat-Pfade sind und welchem Zielpackage sie heute fachlich gehoeren.
- Normative Dokumente duerfen `@sva/sdk` nicht mehr als stabile Plugin-Boundary oder allgemeines Runtime-Zielpackage beschreiben. Historische Hinweise muessen als Altpfad, Compatibility-Layer oder supersedierte Entscheidung markiert werden.
- Bereits vorhandene Boundary-Enforcement-Regeln gelten als Teil des Ist-Zustands. Neue Lint- oder Review-Regeln werden nur dann hinzugefuegt, wenn eine konkrete und reproduzierbare Drift-Luecke nachgewiesen ist.

## Betroffene Quellen

- `packages/sdk/src/index.ts` und Subpath-Exporte als Compat-Fassade
- `docs/monorepo.md` als Entwickler-Einstieg mit derzeit veralteter Plugin-Boundary
- `docs/adr/ADR-034-plugin-sdk-vertrag-v1.md` als normative, derzeit widerspruechliche ADR
- aktive Architekturquellen mit Restverweisen auf `@sva/sdk`, insbesondere Logging-, Request-Flow- und Zustaendigkeitsdokumente
- bestehende ESLint-Regeln als bereits weitgehend implementiertes Enforcement

## Risiken / Trade-offs

- Die Migration fuehrt kurzfristig zu mehr expliziten Importpfaden in Dokumentation und Code.
  - Minderung: klare Mapping-Tabelle `@sva/sdk` -> Zielpackage und schrittweise Migration nach Consumer-Gruppen.
- Verbleibende Altpfade koennen laenger als geplant bestehen bleiben.
  - Minderung: Lint-Regeln, Doku-Hinweise und Review-Kriterien verhindern neue Drift.
- Der Change koennte zu breit werden, wenn er Dokumentationskonsolidierung und hypothetische Enforcement-Arbeit vermischt.
  - Minderung: nur reale Widersprueche und reale Restexports in den Scope aufnehmen; spekulative Folgearbeiten separat dokumentieren.
- Historische ADRs koennen fuer Verwirrung sorgen, wenn sie nicht sichtbar fortgeschrieben werden.
  - Minderung: ADR-034 wird direkt fortgeschrieben und in allen normativen Referenzen als weiterhin massgebliche, aber praezisierte Entscheidung kenntlich gemacht.

## Migrationsplan

1. Reale Restabweichungen erfassen:
   - verbliebene `@sva/sdk`-Re-Exports
   - widerspruechliche normative Doku
   - tatsaechlich noch offene Enforcement-Luecken
2. Architektur- und Entwicklerdokumentation auf einen einheitlichen Boundary-Vertrag umstellen.
3. `@sva/sdk` in README, Package-Docs und Review-Regeln explizit als deprecated Compatibility-Layer mit Mapping-Tabelle markieren.
4. ADR-034 sichtbar fortschreiben und alle normativen Querverweise auf denselben Boundary-Vertrag ausrichten.
5. Nur falls bei Schritt 1 eine echte Luecke belegt wird:
   - fehlende Boundary-Regel ergaenzen
   - Folgearbeit fuer konkrete Consumer-Migration separat zuschneiden

## Architekturentscheidung

- ADR-034 wird direkt fortgeschrieben. Eine neue supersedierende ADR ist fuer diesen Change nicht noetig, weil der Hard-Cut den bestehenden Plugin-Vertrag praezisiert statt ein neues konkurrierendes Modell einzufuehren.
