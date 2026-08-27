# ADR-054: Kontrollierter Inhabertransfer für Inhalte

**Datum:** 27. August 2026
**Status:** ✅ Accepted
**Kontext:** Content Management, IAM, Mainserver, Audit und Editor-UX
**Entscheider:** SVA Studio Team

---

## Entscheidung

Das Studio behandelt den aktuellen Inhaber eines Mainserver-Inhalts als den am Datensatz frisch gelesenen `dataProvider`. Ein Transfer ist eine eigene, mit `content.transferOwnership` autorisierte Aktion und niemals ein Nebeneffekt einer normalen Inhaltsbearbeitung.

Der Browser wählt ausschließlich einen typisierten Principal (`account` oder `organization`). Credentials, DataProvider-ID und aktuelle Binding-Version werden serverseitig aufgelöst und unmittelbar vor dem Provider-Write unter einer datensatzbezogenen Sperre erneut geprüft. Lokale Studio-Inhalte verwenden denselben UI- und Permission-Vertrag, ändern aber atomar genau eines der lokalen Owner-Felder.

## Begründung

- Bearbeiten, Mutationsprincipal und Inhaberschaft sind fachlich verschiedene Konzepte.
- Freie DataProvider-IDs aus dem Browser würden Autorisierung und Binding-Evidenz umgehen.
- Ein normaler Save darf weder unbemerkt Eigentum übertragen noch eine Autorenangabe umschreiben.
- Mainserver-Timeouts können einen bereits erfolgreichen Write verdecken und brauchen deshalb Target-/Source-Re-Reads statt eines behaupteten Rollbacks.

## Laufzeitvertrag

1. Das Studio liest den aktuellen DataProvider frisch am Mainserver-Datensatz.
2. Source-Scope und `content.transferOwnership` werden geprüft.
3. Unter Advisory Lock werden Quell-DataProvider, Ziel-Principal, Credentials und Binding-Version erneut validiert.
4. Das Mutationsjournal hält erwarteten Quell- und Ziel-DataProvider vor dem Write fest.
5. Ein bestätigter Ziel-DataProvider finalisiert den Transfer. Bei verlorenem Response folgen Target- und Source-Re-Read; uneindeutige Evidenz endet in `reconciliation_required`.
6. Das Audit enthält technische Principal-/Provider-Referenzen und Binding-Version, aber keine E-Mail-Adressen oder Secrets.

## UI-Vertrag

Der Inhaberbereich erscheint im Bearbeitungsmodus genau einmal am Anfang des ersten fachlichen Tabs. „Bearbeiten als“ bleibt davon getrennt. Der Bereich und die Speichern-Aktion weisen darauf hin, dass ein normaler Save den Inhaber nicht ändert. Nicht unterstützte Typen zeigen den aktuellen Inhaber ohne aktive Transferaktion.

## Grenzen

News, Events, POI und Root-GenericItems einschließlich der Studio-Typen FAQ, Cockpit Cards und Featured Projects sind transferfähig. Surveys bleiben sichtbar, aber nicht transferfähig. Der verifizierte Mainserver-Vertrag akzeptiert `dataProviderId` auch für Touren; mangels redaktionellem Tour-Editor im Studio bleibt dafür jedoch bewusst keine Transferaktion registriert. Legacy SurveyPolls und Batch-Importe sind ausgeschlossen.

## Folgen

- Der bestehende Mutationsjournal- und Auditvertrag wird wiederverwendet; es entsteht keine neue Studio-Datenbankstruktur.
- Ein bestätigter Mainserver-Erfolg wird durch einen lokalen Projektionsfehler nicht zurückgenommen.
- Rollout und Aktivierung bleiben an den verifizierten Schema-Snapshot und die geschützten Standardpfade gebunden.

**Links:**

- `openspec/changes/add-content-ownership-transfer/`
- `docs/reference/content-ownership-transfer.md`
- `docs/development/runbook-sva-mainserver.md`
