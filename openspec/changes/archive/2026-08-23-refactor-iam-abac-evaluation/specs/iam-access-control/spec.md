## ADDED Requirements

### Requirement: ABAC-Refactoring erhält fail-closed Entscheidungsparität

Das System MUST die bestehende Reihenfolge und Semantik kontextueller ABAC-Entscheidungen bei einer internen Zerlegung der Authorize-Engine vollständig erhalten. Fehlender Pflichtkontext, Organisations- und Geo-Restriktionen, Geo-Freigaben, Zeitfenster, Acting-as und Force-Deny MUST weiterhin in der bestehenden Reihenfolge ausgewertet werden. Allow-/Deny-Ergebnis, Reason, Provenance, Scope-, Owner-, Organisations- und DataProvider-Semantik dürfen sich dadurch nicht ändern.

#### Scenario: Kollidierende Regeln werden unverändert priorisiert

- **GIVEN** ein passender Allow-Grant enthält gleichzeitig erfüllte und blockierende ABAC-Regeln
- **WHEN** die zentrale Authorize-Engine den Grant auswertet
- **THEN** liefert sie dieselbe erste blockierende Entscheidung wie vor der internen Zerlegung
- **AND** Reason und Provenance bleiben unverändert

#### Scenario: Fehlender Kontext bleibt fail-closed

- **GIVEN** eine aktive ABAC-Regel benötigt einen nicht vorhandenen Kontextwert
- **WHEN** die zentrale Authorize-Engine den Grant auswertet
- **THEN** verweigert sie den Zugriff mit dem bestehenden Reason
- **AND** führt keine interne Teilentscheidung zu einem permissiven Fallback

#### Scenario: Öffentliche Authorize-API bleibt stabil

- **WHEN** ein Aufrufer die IAM-Autorisierung auswertet
- **THEN** bleibt `evaluateAuthorizeDecision` der öffentliche Einstiegspunkt
- **AND** interne Regel-Evaluatoren werden nicht Teil der Package-API
