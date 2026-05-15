## ADDED Requirements
### Requirement: Expliziter Trust-Vertrag fuer Forwarded-Header

Die IAM- und Auth-Runtime SHALL `X-Forwarded-*`- und `Forwarded`-Header nur dann fuer Host-, Authority- oder Origin-Aufloesung verwenden, wenn der Reverse-Proxy-Betrieb serverseitig explizit aktiviert wurde.

#### Scenario: Produktionsrequest ohne expliziten Trust-Opt-in

- **WHEN** ein produktionsnaher Request `X-Forwarded-*`- oder `Forwarded`-Header mitsendet
- **AND** `SVA_TRUST_FORWARDED_HEADERS` ist nicht explizit auf `true` oder `1` gesetzt
- **THEN** ignoriert die Runtime diese Header fuer Host-, Authority- und Proto-Aufloesung
- **AND** verwendet stattdessen nur serverseitig beobachtbare Request-Daten wie `request.url` und den passenden `host`-Fallback

#### Scenario: Reverse-Proxy-Betrieb mit explizitem Trust-Opt-in

- **WHEN** ein Reverse-Proxy-Betrieb `SVA_TRUST_FORWARDED_HEADERS` explizit auf `true` oder `1` setzt
- **THEN** darf die Runtime `X-Forwarded-*`- und `Forwarded`-Header fuer Host-, Authority- und Proto-Aufloesung auswerten
- **AND** bleiben die bestehenden Plausibilitaets- und Fallback-Regeln fuer ungueltige oder fehlende Header aktiv

#### Scenario: Ungueltige Opt-in-Werte aktivieren keinen Header-Trust

- **WHEN** `SVA_TRUST_FORWARDED_HEADERS` einen leeren oder ungueltigen Wert traegt
- **THEN** behandelt die Runtime die Konfiguration wie deaktiviert
- **AND** klientseitig gelieferte Forwarded-Header beeinflussen keine Auth-Scope-, Redirect- oder Root-Host-Entscheidungen
