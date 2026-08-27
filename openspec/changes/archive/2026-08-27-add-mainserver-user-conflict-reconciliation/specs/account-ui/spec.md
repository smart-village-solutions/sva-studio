## ADDED Requirements

### Requirement: Benutzer-Detailansicht erklärt Mainserver-Identitätskonflikte als Betriebsfall

Das System SHALL `mainserver_user_conflict` in der Benutzer-Detailansicht als Identitätskonflikt anzeigen, der vor einer erneuten Reprovisionierung durch den Mainserver-Betrieb korrigiert werden muss. Die Ansicht SHALL keine automatische Auflösung oder wiederholte Provisionierung als Abhilfe empfehlen und SHALL die vorhandene Request-ID als sichere Referenz für den Support anzeigen, sofern sie in der Fehlerantwort enthalten ist.

#### Scenario: Reprovisionierung trifft auf einen Identitätskonflikt

- **GIVEN** der Mainserver meldet für den Zielbenutzer `local_user_conflict`
- **WHEN** Studio den Fehler als `mainserver_user_conflict` anzeigt
- **THEN** erklärt die Detailansicht, dass eine Wiederholung den Konflikt nicht löst
- **AND** verweist sie auf den Mainserver-Betrieb
- **AND** zeigt sie eine vorhandene Request-ID ohne Credentials oder fremde Identitätsdaten an

#### Scenario: Operative Korrektur wurde abgeschlossen

- **GIVEN** der Mainserver-Betrieb hat die Zuordnung anhand derselben normalisierten E-Mail-Adresse korrigiert
- **WHEN** ein berechtigter Administrator die bestehende Reprovisionierung erneut ausführt
- **THEN** verwendet die Detailansicht unverändert den bestehenden Erfolgs- oder Fehlerpfad
