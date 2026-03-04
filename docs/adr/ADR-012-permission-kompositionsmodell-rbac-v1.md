# ADR-012: Permission-Kompositionsmodell für RBAC v1

**Status:** Accepted  
**Entscheidungsdatum:** 2026-02-27  
**Entschieden durch:** IAM/Core Team  
**GitHub Issue:** TBD  
**GitHub PR:** TBD

---

## Kontext

Child C (`add-iam-authorization-rbac-v1`) benötigt vor Implementierungsstart eine verbindliche Regel, wie mehrere Permissions zu einer Autorisierungsentscheidung kombiniert werden.
Laut Masterplan/Decision-Checklist war genau diese Teilentscheidung als letzter Must-Blocker offen.

Randbedingungen:

- Mandanten-Scoping erfolgt kanonisch über `instanceId` (siehe ADR-011).
- Child C implementiert RBAC v1 ohne ABAC-Kontextregeln.
- Entscheidungen müssen deterministisch und als `allowed` + `reason` nachvollziehbar sein.
- Konflikte zwischen Rollen, Organisationskontexten und späteren ABAC-Regeln dürfen nicht implizit oder inkonsistent ausgewertet werden.

## Entscheidung

Für RBAC v1 gilt ein **additives Kompositionsmodell (OR)** innerhalb des aktiven `instanceId`-Scopes.

Konkret:

- Ein Zugriff ist erlaubt, wenn mindestens eine effektive Rolle im aktiven Kontext die angefragte Permission gewährt.
- Es gibt in RBAC v1 **keine expliziten Deny-Permissions**.
- Fehlt eine passende Allow-Permission, ist das Ergebnis `allowed=false` mit passendem `reason`.
- Organisationskontext wirkt als zusätzlicher Filter auf die bereits aggregierten Allows; er erweitert den Instanz-Scope nicht.
- Widersprüche werden in RBAC v1 fail-closed behandelt: Bei unklarem oder inkonsistentem Scope wird denied.

## Begründung

1. Das Modell ist für Child C minimal, deterministisch und schnell implementierbar.
2. Additive Aggregation passt zur Seed-/Runtime-Konfiguration von Rollen ohne starre Vorab-Matrix.
3. Verzicht auf Deny-Regeln reduziert Konfliktkomplexität im ersten Produktivschnitt.
4. Das Modell ist kompatibel mit einer späteren ABAC-Erweiterung in Child D.

## Konfliktauflösung

1. **Instanzgrenze zuerst:** Anfragen außerhalb der aktiven `instanceId` werden immer denied.
2. **Organisationsfilter danach:** Nur Rollen/Zuordnungen im relevanten Org-Kontext sind für die Entscheidung wirksam.
3. **Permission-Aggregation zuletzt:** Alle verbleibenden Allows werden per OR kombiniert.
4. **Unvollständiger Kontext:** Fehlende Pflichtattribute (`instanceId`, unbekannter Org-Kontext) führen zu deny.

## Alternativen

### Alternative A: Restriktive Aggregation (AND)

**Vorteile:**
- Höhere Vorsicht bei mehrdeutigen Rollenzuordnungen

**Nachteile:**
- Hoher Konfigurationsaufwand und schlechtere Nutzbarkeit in Multi-Role-Szenarien
- Erhöhtes Risiko ungewollter Denials trotz gültiger Rolle

**Warum verworfen:**
Für RBAC v1 zu restriktiv und operativ schwerer erklärbar.

### Alternative B: Explizite Deny-Overrides in RBAC v1

**Vorteile:**
- Feinere Konfliktsteuerung

**Nachteile:**
- Zusätzliche Modell- und Testkomplexität
- Höheres Fehlkonfigurationsrisiko im Erstschnitt

**Warum verworfen:**
Wird bei Bedarf in Child D (ABAC/Policy-Layer) gezielt ergänzt statt in RBAC v1 vorgezogen.

## Konsequenzen

### Positive Konsequenzen

- Einheitliches, reproduzierbares Entscheidungsverhalten für `POST /iam/authorize`
- Klare Grundlage für Reason-Codes und Testmatrix in Child C
- Gute Basis für Performance-Ziel P95 < 50 ms

### Negative Konsequenzen

- Kein expliziter Deny-Mechanismus in RBAC v1
- Komplexere Ausnahmefälle werden auf Child D verschoben

### Mitigationen

- Fail-closed bei Scope-Unsicherheit
- Verbindlicher Reason-Code-Katalog für alle Denials
- Erweiterungspfad für Deny/ABAC-Regeln in Child D dokumentieren

## Verwandte ADRs

- ADR-009: Keycloak als zentraler Identity Provider
- ADR-011: `instanceId` als kanonischer Mandanten-Scope
- Geplant: ADR zum RBAC+ABAC-Hybridmodell (Child C/D Schnittstelle)

## Gültigkeitsdauer

Diese ADR gilt für RBAC v1 (Child C), bis ein erweitertes Policy-Modell mit expliziten Deny-Regeln beschlossen wird.
