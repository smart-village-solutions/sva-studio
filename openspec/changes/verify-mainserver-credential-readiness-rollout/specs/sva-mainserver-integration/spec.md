## ADDED Requirements

### Requirement: Credential-Readiness wird digestgleich und secretfrei abgenommen

Das System SHALL die Mainserver-Credential-Readiness mit demselben immutable
Image-Digest zuerst in Staging und danach in Production abnehmen. Der
Betriebsnachweis SHALL keine Credentialwerte, Tokens oder vollständigen
Benutzeridentitäten enthalten und SHALL Production nicht verändern.

#### Scenario: Staging blockiert nicht bereite Credentials

- **GIVEN** der freigegebene Digest läuft in Staging
- **WHEN** `missing`, `partial`, `stale` oder `unavailable` geprüft wird
- **THEN** startet Studio keinen Mainserver-Upstream-Aufruf für den betroffenen Principal
- **AND** enthält der Nachweis nur redigierte Statusinformationen

#### Scenario: Production wird read-only bestätigt

- **GIVEN** derselbe in Staging geprüfte Digest läuft in Production
- **WHEN** Bad Belzig und Prignitz geprüft werden
- **THEN** verändert die Abnahme weder Credentials noch Accounts oder Keycloak-Zustand
- **AND** dokumentiert sie keine Credentialwerte oder vollständigen Benutzeridentitäten
