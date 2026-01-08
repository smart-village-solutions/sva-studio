# BROWSER-SUPPORT

<!--
Overview: Dokumentiert unterstützte Browser, Assistive Technologies, Geräte sowie Test- und Update-Policy, um Kompatibilitäts-Erwartungen klar festzulegen.
-->

Stand: 2026-01-08 · Verantwortlich: UX/QA

Dieses Dokument beschreibt unterstützte Browser, Screenreader/ATs, Geräte und unsere Test- und Update-Policy.

## Einleitung

Ziel dieses Dokuments ist es, klare und überprüfbare Erwartungen an die technische Kompatibilität von SVA Studio festzulegen. Es unterstützt Produkt, Entwicklung, QA, Support und Barrierefreiheits-Audits dabei, Entscheidungen nachvollziehbar zu treffen und Risiken in der Nutzung verlässlich zu minimieren.

### Zweck
- Transparenz: Welche Browser/Versionen und Assistive Technologies werden offiziell unterstützt?
- Planung & Tests: Gegen welche Zielumgebungen wird entwickelt und getestet (Release-/Major-Frequenzen)?
- Support: Wie wird mit Legacy/Best-Effort-Umgebungen umgegangen und wie werden Probleme gemeldet?
- Barrierefreiheit: Welche Screenreader-Kombinationen sind Bestandteil der regelmäßigen Prüfungen?

### Geltungsbereich
- Frontend (Web-App, inkl. PWA-Funktionen) auf Desktop- und Mobile-Plattformen
- Nutzer- und Admin-Oberflächen; allgemeine Interaktionen wie Authentifizierung, Navigation, Eingabeformulare, Uploads
- Keine Zusagen für experimentelle Browserfunktionen außerhalb der definierten Mindestversionen

### Definitionen
- „Vollständig“ (✅): Aktive Unterstützung, regelmäßige Tests, Fixes mit hoher Priorität
- „Best Effort“ (⚠️): Keine Garantie; Fixes nach Aufwand/Risiko, ggf. Hinweise oder Degradation
- „Mindestversion“: Niedrigste offiziell unterstützte Major-Version je Browserfamilie
- „Legacy“: Unterhalb Mindestversion; Nutzung nur mit Hinweis/Beschränkung

### Nutzung
- Produkt & Architektur: Als Referenz für die Auswahl von Features (z.B. WebAuthn, Intl APIs)
- Entwicklung & QA: Als Zielmatrix für Build-Targets, Polyfills und manuelle/automatisierte Tests
- Support: Als Grundlage für Kommunikation, Workarounds und Eskalationen

### Verweise
- TESTING.md: Detaillierte Testabläufe und Verantwortlichkeiten
- DEVELOPMENT_RULES.md: Nicht verhandelbare Regeln (u.a. Accessibility/WCAG 2.1 AA)
- Release Notes/Changelog: Kommunikation von Änderungen an Mindestversionen

## Support-Policy
- Rolling Release: Letzte 2 Major-Versionen aller Evergreen-Browser
- Tests vor jedem Produktiv-Release gegen aktuelle Stable-Versionen
- Best Effort: Fixes nur bei geringem Risiko und reproduzierbaren Problemen
- Legacy-Browser erhalten einen Update-Hinweis

## Desktop-Browser

| Browser | Mindestversion | Betriebssysteme | Support |
| --- | --- | --- | --- |
| Chrome | 120+ | Windows, macOS, Linux | ✅ Vollständig |
| Firefox | 121+ | Windows, macOS, Linux | ✅ Vollständig |
| Safari | 17+ | macOS | ✅ Vollständig |
| Edge | 120+ | Windows, macOS | ✅ Vollständig |
| Opera | 106+ | Windows, macOS, Linux | ⚠️ Best Effort |
| Brave | 1.60+ | Windows, macOS, Linux | ⚠️ Best Effort |

## Mobile-Browser

| Browser | Mindestversion | Betriebssysteme | Support |
| --- | --- | --- | --- |
| Safari | 17+ | iOS 17+ | ✅ Vollständig |
| Chrome | 120+ | Android 12+ | ✅ Vollständig |
| Samsung Internet | 24+ | Android 12+ | ⚠️ Best Effort |
| Firefox | 121+ | Android 12+ | ⚠️ Best Effort |

**Mobile-Spezifika**: Touch-Gesten, PWA-Offlinemodus, responsives Layout (320px–2560px).

## Assistive Technologies (Screenreader)

### Desktop

| Screenreader | Version | Browser | Betriebssystem | Support |
| --- | --- | --- | --- | --- |
| NVDA | 2023.1+ | Firefox, Chrome | Windows | ✅ Vollständig |
| JAWS | 2023+ | Chrome, Edge, Firefox | Windows | ✅ Vollständig |
| VoiceOver | macOS 14+ | Safari | macOS | ✅ Vollständig |
| Narrator | Windows 11 | Edge | Windows 11 | ⚠️ Best Effort |

### Mobile

| Screenreader | Version | Browser | Betriebssystem | Support |
| --- | --- | --- | --- | --- |
| VoiceOver | iOS 17+ | Safari | iOS | ✅ Vollständig |
| TalkBack | Android 12+ | Chrome | Android | ✅ Vollständig |

**Test-Frequenz**
- NVDA + Firefox: jedes Release
- JAWS + Chrome: jedes Major-Release
- VoiceOver (macOS): jedes Major-Release
- VoiceOver (iOS): jedes Major-Release
- TalkBack: quartalsweise

## Polyfills & Fallbacks
- CSS Grid/Flexbox: Autoprefixer setzt Vendor-Prefixes
- ES2022-Features: Transpilation für Legacy-Ziele bei Bedarf
- Fetch API: Polyfill nur laden, falls Legacy-Ziel es benötigt
- Intersection Observer: Polyfill bei Legacy-Browsern bedarfsweise laden
- Resize Observer: Bei Bedarf polyfillen für ältere Safari-Versionen
- Intl APIs (Locale/PluralRules/RelativeTime): Nur für Legacy-Browser nachladen

**Ladestrategie**
- Feature-Detection vor dem Laden von Polyfills (keine pauschale Belastung moderner Browser)
- Conditional Loading über dynamische Imports oder Polyfill-Service mit Targeting
- Bundle-Size-Kontrolle: Polyfills in separaten Chunks, die nur Legacy-Targets beziehen
- Regression-Tests: Bei neuen Polyfills Smoke-Test auf mindestens einem Legacy-Browser

**Legacy (Best Effort)**: Chrome 90–119, Firefox 100–120, Safari 15–16. Nutzer:innen zum Aktualisieren auffordern.

## Geräte-Guidance
- Desktop: 1280×720 Minimum, bis 4K (3840×2160); HiDPI/Retina unterstützt
- Tablet: iPad (2020+), iPad Pro; Android-Tablets (z.B. Galaxy Tab S7+); Surface Pro
- Mobile: iPhone 12+ (iOS 17+); Samsung Galaxy S21+ (Android 12+); Google Pixel 6+ (Android 12+)

## Test-Matrix

**Kritisch je Release**
- [ ] Chrome (Desktop, Windows)
- [ ] Firefox (Desktop, Windows)
- [ ] Safari (Desktop, macOS)
- [ ] Safari (Mobile, iOS)
- [ ] Chrome (Mobile, Android)

**Screenreader-Checks (laut Frequenz oben)**
- [ ] NVDA + Firefox (Windows)
- [ ] JAWS + Chrome (Windows)
- [ ] VoiceOver (macOS)
- [ ] VoiceOver (iOS)

**Tools**: BrowserStack, Sauce Labs, lokale VMs (Windows/macOS/Linux).

Siehe auch TESTING.md für detaillierte Testabläufe und Verantwortlichkeiten.

## Bekannte Issues & Workarounds
Dokumentiere reproduzierbare Browser-/AT-Issues mit Mitigation und Ticket.

Beispiel:
```markdown
#### Safari 17.0 – Flexbox gap
Problem: Flexbox-`gap` rendert inkonsistent.
Workaround: Margin-basiertes Spacing nutzen.
Status: Behoben in Safari 17.1
Ticket: #1234
```

## Pflege
- Mindestversionen quartalsweise oder bei Breaking Changes der Hersteller prüfen
- Mit TESTING.md und Accessibility-Guidelines abgleichen; Matrizen synchron halten
- Aktualisieren, wenn neue Plattformen hinzukommen, Mindestversionen steigen oder Testfrequenzen sich ändern

## Prozess: Mindestversionen anheben
- Trigger: Sicherheitsfix, signifikantes Marktanteils-Minus, fehlende Engine-Unterstützung für neue Features
- Vorgehen: Ankündigung im Changelog/Release-Notes + Hinweis im Produkt (Banner/Support-Hinweis) mit mindestens einer Release Vorlauf
- Tests: Gegen neue Mindestversionen vollständig durch die kritische Test-Matrix
- Grace-Period: Für Best-Effort-Browser mindestens ein Release lang akzeptierte Nutzung, danach Hinweis erzwingen

## Feedback & Reporting
- Kanal: Support-Portal oder GitHub-Issues (intern)
- Erforderliche Angaben: Browser + Version, Betriebssystem, ggf. Screenreader + Version, User-Agent-String, reproduzierbare Schritte, erwartetes vs. tatsächliches Verhalten, Screenshot/Video, relevante Fehlermeldungen/Console-Logs, betroffene URL(s)
- SLA: Kritische Probleme (Blocker) werden priorisiert geprüft; Best-Effort-Browser nach Aufwand

## Legacy-Browser: Hinweise & Sperren
- Warnbanner: Bei nicht unterstützten Browsern klarer Hinweis mit Update-Empfehlung
- Sperren: Bei hohen Sicherheitsrisiken/inkompatiblen Engines Zugang blockieren (Login/Schlüsselpfade)
- Feature-Degradation: Sicherheits-/Hardware-gebundene Features (z.B. WebAuthn/FIDO) werden für Legacy-Browser deaktiviert oder durch sichere Alternativen ersetzt

## Monitoring & Telemetrie (RUM/Canary)
- Canary-Rollout: Änderungen an Mindestversionen schrittweise ausrollen (kleiner Nutzeranteil), Metriken beobachten
- RUM-Metriken: Fehlerquote, JS-Fehler, LCP/INP/FID, Erfolgsraten kritischer Flows (Login/Upload)
- Rollback-Kriterium: z.B. Fehlerquote > X% über Y Minuten bei betroffenen Browsern → Änderung zurücknehmen, Ursachenanalyse

## API-Kompatibilität & Fallbacks
- Kritische APIs: Intl, WebCrypto, WebSockets/EventSource, WebAuthn, Intersection/Resize Observer
- Fallback-Strategie:
	- Feature-Detection und Polyfills nur für fehlende Features
	- Server-seitige Fallbacks (z.B. Formatierung/Internationalisierung) bei fehlenden Client-Fähigkeiten
	- Downgrade-Pfade für Echtzeit (Fallback auf Polling, wenn WebSockets nicht verfügbar)

## Rationale & Kommunikation
- Auswahl Mindestversionen: Marktanteile, Sicherheitspatches, Supportaufwand, Kompatibilität mit eingesetzten Frameworks
- Kommunikation: Änderungen werden im Changelog/Release-Notes dokumentiert und im Produkt (Banner) angekündigt

## Änderungsprozess & Ticketing
- Bei neuen Browser-/AT-Issues ein Ticket mit den Angaben aus „Feedback & Reporting“ erstellen
- Verweise: TESTING.md (Abläufe), Issue Creation Guide (falls vorhanden) für Struktur und Checklisten
