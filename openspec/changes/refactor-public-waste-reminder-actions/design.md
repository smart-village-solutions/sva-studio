## Context

Der Page-Handler entscheidet zuerst über konfigurierte Statusseiten und verarbeitet danach DOI- oder Abmeldepfade. Beim DOI-Pfad wird ein Bearer-Token gehasht und mutierend aktiviert. Beim Abmeldepfad muss zuerst die Subscription-ID aus dem signierten Token gelesen, das zugehörige Abo geladen und die Signatur gegen dessen gespeicherten Hash verifiziert werden, bevor eine Mutation zulässig ist.

Der Signup-Handler besitzt einen zweiten bestehenden Fallow-Befund. Seine Aufrufreihenfolge normalisiert und hasht die E-Mail, lädt die Standortbezeichnung, erzeugt IDs und Tokens, prüft IP- vor E-Mail-Rate-Limit und verwendet anschließend entweder die atomare limitgeprüfte Persistenz oder Count und Fallback-Persistenz.

## Goals / Non-Goals

- Goals:
  - DOI- und Abmeldeorchestrierung getrennt lesbar und testbar machen
  - vorhandene Prüfpriorität, Aufrufanzahl, Zeit- und Redirect-Semantik bewahren
  - Mutation vor erfolgreicher Tokenprüfung strukturell ausschließen
  - Signup-Rate-Limits und Persistenzpfade ohne Prioritäts- oder Exactly-once-Änderung entflechten
- Non-Goals:
  - Tokenformat, Kryptografie oder Secretquelle ändern
  - Repository-, Datenbank- oder Endpoint-Verträge ändern
  - Statusseiten, URLs oder sichtbare Texte ändern

## Decisions

- Decision: Konfigurierte Statusseiten bleiben die erste, seiteneffektfreie Entscheidung des öffentlichen Handlers.
- Decision: DOI und Abmeldung erhalten jeweils einen internen, schmalen I/O-Handler mit unveränderten Dependencies.
- Decision: Gemeinsame Response-Helfer werden nur für bereits identische Redirect- oder Fallback-Verträge verwendet; fachlich verschiedene Ergebnisse bleiben getrennt.
- Decision: Der bestehende Vertrag aus `@sva/waste-management-contracts/unsubscribe-token` bleibt alleiniger Owner für Lesen und Verifizieren signierter Abmeldetoken.
- Decision: Signup-Rate-Limit, Pending-Wertaufbau und Persistenz werden als interne Schritte getrennt; ID-/Token-Erzeugung, IP-vor-E-Mail-Priorität und atomare Persistenz bleiben unverändert.
- Alternatives considered: Ein generischer Action-Dispatcher oder zusätzliche Strategy-Abstraktionen würden mehr Ownership erzeugen, ohne weitere Konsumenten oder variable Implementierungen zu besitzen.

## Risks / Trade-offs

- Veränderte Branch-Reihenfolge könnte Tokeninformationen preisgeben oder eine falsche Subscription mutieren. Die vollständige Characterization fixiert Aufrufe, Reihenfolge, Redirects und Fallbacks vor dem Refactoring.
- Gemeinsame Helper könnten DOI- und Abmeldefehler versehentlich angleichen. Deshalb werden nur nachweislich identische technische Response-Entscheidungen geteilt.

## Migration Plan

Keine Daten- oder Vertragsmigration. Das Refactoring wird durch Altcode-Characterization, Zieltests, Types, Build, Complexity und New-only-Audits abgesichert und kann als einzelner Merge zurückgenommen werden.
