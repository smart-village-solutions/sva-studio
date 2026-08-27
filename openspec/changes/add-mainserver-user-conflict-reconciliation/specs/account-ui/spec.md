## ADDED Requirements

### Requirement: Benutzer-Detailansicht löst bestätigte Mainserver-E-Mail-Konflikte gezielt auf

Das System SHALL einem berechtigten `system_admin` in der Benutzer-Detailansicht einen redigierten Mainserver-Konfliktbefund und eine direkte Reconcile-Aktion anzeigen, wenn Studio und Mainserver dieselbe normalisierte E-Mail-Adresse bestätigen. Die Ansicht SHALL vor der Mutation Wirkung und Fresh-Reauth-Anforderung erklären und SHALL keine Credentials, Tokens, vollständigen Upstream-Antworten oder unmaskierten fremden Identitätsdaten anzeigen.

#### Scenario: System-Admin prüft und löst bestätigten E-Mail-Konflikt auf

- **GIVEN** Studio und Mainserver bestätigen dieselbe normalisierte E-Mail-Adresse
- **AND** der System-Admin besitzt eine gültige Fresh-Reauth-Evidenz
- **WHEN** er die Wirkung bestätigt und die Reconcile-Aktion ausführt
- **THEN** zeigt die Detailansicht den laufenden Zustand und anschließend das verifizierte Ergebnis
- **AND** verlangt sie keine zweite administrative Freigabe

#### Scenario: E-Mail-Adressen stimmen nicht überein

- **WHEN** die Read-only-Prüfung keine Gleichheit der normalisierten E-Mail-Adressen bestätigt
- **THEN** bietet die Detailansicht keinen Rebind an
- **AND** erklärt sie den weiterhin bestehenden Konflikt ohne fremde Identitätsdaten offenzulegen

#### Scenario: Fresh Reauth fehlt

- **WHEN** ein berechtigter System-Admin die Reconcile-Aktion ohne gültige Fresh-Reauth-Evidenz ausführt
- **THEN** fordert die UI eine serverseitig kontrollierte Re-Authentisierung an
- **AND** startet sie keine Mainserver-Mutation
