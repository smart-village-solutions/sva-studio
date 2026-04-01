## Context
Die Redis-basierte Session-Infrastruktur ist inzwischen technisch weitgehend umgesetzt. Der ursprüngliche Change enthielt aber noch Annahmen, offene Fragen und Folgearbeiten aus einer frühen Untersuchungsphase, die nicht mehr zum heutigen Stand passten. Dieser Change wurde deshalb auf den realen Lieferumfang neu geschnitten und anschließend um konkrete Betriebsentscheidungen ergänzt.

Parallel wurde das fachliche Session-Modell separat weiterentwickelt:
- `Session.expiresAt` ist heute die führende fachliche Gültigkeitsquelle.
- Redis-TTL ist ein technischer Puffer über der verbleibenden Sessiondauer.
- Forced Reauth und Silent SSO werden durch eigene Spezifikation gesteuert und sind kein eigener Kernumfang dieses Changes.

Dieser Change fokussiert daher nur noch die Redis-basierte Persistenz und Absicherung aktiver App-Sessions.

## Goals / Non-Goals
- Goals:
  - Persistente App-Sessions über Restarts hinweg sicherstellen
  - Redis als geteilten Session-Store für horizontalen Betrieb verankern
  - Token-Persistenz in Redis absichern
  - Session-Invalidierung auf Redis-basierter Persistenz sauber unterstützen
  - den ersten operativen Zuschnitt für Staging und Production verbindlich festlegen
  - Audit-, Compliance- und Betriebsanforderungen im selben Change weiterführen
- Non-Goals:
  - dedizierte Admin- oder Self-Service-UI für Session-Management
  - sofortige Einführung eines Redis-Clusters oder komplexer HA-Orchestrierung

## Decisions
- Redis ist der primäre Store für aktive App-Sessions.
- Die fachliche Session-Gültigkeit folgt `Session.expiresAt`; Cookie-Laufzeit und Redis-TTL werden daraus abgeleitet.
- Tokens bleiben serverseitig und werden bei Redis-Persistenz verschlüsselt gespeichert.
- Die bestehende Transportlösung für den Session-Identifier bleibt Bestandteil der technischen Basis und wird nicht in diesem Change erneut konzeptionell geöffnet.
- Staging verwendet `Self-Hosted Redis`.
- Production startet bewusst mit `Single Redis + Backup/Restore` als erstem belastbaren Betriebsmodell.
- Audit-Trail, GDPR-spezifische Löschflows, dedizierte Redis-Gesundheitsendpunkte und Alerting bleiben innerhalb dieses Changes im Scope.

## Alternatives considered
- In-Memory-Store: verworfen wegen Verlust bei Restart und fehlender horizontaler Skalierung.
- DB-only Sessions: verworfen wegen höherer Latenz und unnötiger Datenbanklast auf Hot Paths.
- Cookie-only oder komplett stateless: verworfen wegen Revocation-, Rotations- und Token-Schutz-Anforderungen.

## Risks / Trade-offs
- Redis bleibt eine zusätzliche Laufzeitabhängigkeit und benötigt betriebliche Pflege.
- Die Qualität der Session-Stabilität hängt von sauberer TTL-Ableitung, Revocation und Transportpfad ab.
- Ein einzelner Redis-Knoten bietet zunächst kein echtes HA-Failover; Ausfallsicherheit wird vorerst nur über Restore- und Betriebsprozesse begrenzt verbessert.
- Audit-, Compliance- und Operations-Umfang machen den Change wieder größer, vermeiden aber weitere künstliche Aufspaltung.

## Migration Plan
1. Lokale und testnahe Redis-Nutzung absichern.
2. Redis-basierte Session-Persistenz als Standardpfad der App-Sessions verwenden.
3. Self-Hosted Redis für Staging verbindlich ausprägen.
4. Production mit `Single Redis + Backup/Restore` als erstem Betriebsmodell absichern.
5. Audit-, Compliance- und Operations-Anforderungen im selben Change ergänzen und verifizieren.
