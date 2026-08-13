# ADR-052: Create-Policy, Read-Scope und Bestandsprincipal trennen

**Status:** Accepted

**Entscheidungsdatum:** 2026-08-13

**Entschieden durch:** SVA Studio Team

## Kontext

ADR-045 koppelte `contentAuthorPolicy` zu eng an die allgemeine Mainserver-Credential-Auflösung. Das ist für neue Inhalte verständlich, reicht aber für Listen und bestehende Inhalte nicht aus: Eine Autorenregel für neue Inhalte ändert weder den IAM-Read-Scope noch den ursprünglichen Inhaber eines vorhandenen Mainserver-Inhalts.

## Entscheidung

1. `contentAuthorPolicy` entscheidet ausschließlich, ob ein neuer Inhalt organisatorisch oder wahlweise persönlich erstellt werden darf. Bei `org_or_personal` ist die aktive Organisation der Standard.
2. Der Read-Scope folgt den IAM-Berechtigungen. In einem Organisationskontext umfasst er die eigenen und die organisatorischen Inhalte, unabhängig von der Create-Policy.
3. Bei bestehenden Inhalten bestimmt die automatisch bestätigte DataProvider-/Ownership-Bindung den Principal. Ein Projection-Treffer oder eine frühere UI-Auswahl ist dafür kein Beweis.
4. Administrative Bestandsmutationen verwenden ebenfalls nur den persönlichen Account oder die aktive Organisation des Administrators. Es gibt keinen dritten Admin-Principal.
5. `GET /api/v1/iam/me/context` liefert die `contentAuthorPolicy` membership-gefiltert für jede auswählbare Organisation. Content-Routen benötigen keinen administrativen Organisationsdetail-Read.
6. Ist der aktive Organisationskontext unvollständig oder widersprüchlich, bleibt die Principal-Auflösung sichtbar `unavailable`; es gibt keinen stillen persönlichen Fallback.
7. Kann eine erforderliche Listen-Sicht nicht geladen werden, bleiben vorhandene Daten sichtbar, die Liste und ihre Gesamtzahl werden aber ausdrücklich als unvollständig gekennzeichnet.
8. Wird ein Benutzer gelöscht, entsteht kein neuer Eigentümer. Die konfigurierte Löschregel löscht seine Inhalte oder entfernt die aktive Benutzerzuordnung; verbleibende lokale Anzeigen verwenden `NULL` beziehungsweise „Gelöschter Benutzer“.
9. Die IAM-Detailprojektion autorisiert Mainserver-Inhalte mit der Read-Action ihres Content-Typ-Namespace (`news.read`, `events.read`, `poi.read`, `generic-items.read`, `faq.read`, `cockpit-cards.read`, `projects.read` oder `surveys.read`). `content.read` bleibt der Fallback für generische beziehungsweise unbekannte Content-Typen.

## Konsequenzen

- Create-Dialoge dürfen eine Auswahl anbieten, Bestandseditoren dagegen nur den ressourcenbezogen bestätigten Principal anzeigen.
- Status- und Delete-Aktionen müssen den Principal pro Inhalt auflösen und bei fehlender Zuordnung gesperrt bleiben.
- Mehrere erforderliche Credential-Sichten benötigen getrennte Snapshots und einen sichtbaren Teilfehlervertrag.
- Credential-, Secret-, Cache- und Tenant-Isolationsregeln aus ADR-045 bleiben unverändert gültig.

## Verwandte ADRs

- [ADR-021](./ADR-021-per-user-sva-mainserver-delegation.md)
- [ADR-045](./ADR-045-organisationsgebundene-mainserver-credentials-und-policy-gesteuerte-delegation.md), durch diese ADR superseded
- [ADR-050](./ADR-050-zentraler-scopegebundener-ui-zugriff.md)
- [ADR-051](./ADR-051-technische-accounts-und-organisations-mainserver-provisioning.md)
