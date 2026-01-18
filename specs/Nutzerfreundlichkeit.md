# Nutzerfreundlichkeit

Die Nutzerfreundlichkeit des CMS 2.0 ist entscheidend für die Akzeptanz und effektive Nutzung durch Redakteur\:innen und Administrator\:innen.

---

## Gestaltung

* Light and Dark Mode
* Anpassbares Logo basierend auf dem App-Icon

---

## Usability

Intuitive und leicht erlernbare Bedienung.

**Messkriterium:**
- Nutzer\:innen benötigen < 2 Stunden Einarbeitung für Basisfunktionen
- Usability-Test mit SUS-Score ≥ 75

---

## Barrierefreiheit (BITV 2.0 / WCAG 2.1 Level AA)

Das CMS muss die Anforderungen der Barrierefreie-Informationstechnik-Verordnung (BITV 2.0) erfüllen, die auf die Web Content Accessibility Guidelines (WCAG) 2.1 Konformitätsstufe AA verweist. Dies gilt sowohl für die Backend-Oberfläche (Redaktionssystem) als auch für die über die API ausgelieferten Inhalte.

### Redaktionssystem (Backend-Oberfläche)

Die Verwaltungsoberfläche für Redakteur\:innen muss selbst barrierefrei sein:

* **Tastaturbedienbarkeit (WCAG 2.1.1):** Alle Funktionen, Steuerelemente, Navigation, Eingabefelder und Buttons müssen vollständig und in logischer Reihenfolge mit der Tastatur bedienbar sein (Tab, Shift+Tab, Enter, Space, Pfeiltasten).
* **Klarer Fokus-Indikator (WCAG 2.4.3, 2.4.7):** Der visuelle Fokus muss jederzeit klar erkennbar sein, wenn ein Element mit der Tastatur angesteuert wird (z.B. deutlicher Rahmen mit mindestens 2px Stärke und ausreichendem Kontrast).
* **Ausreichender Farbkontrast (WCAG 1.4.3):** Text und Bedienelemente müssen einen Kontrast von mindestens 4,5:1 zum Hintergrund aufweisen (7:1 für große Texte empfohlen). Gilt auch für Icons und grafische Elemente.
* **Konsistente Navigation (WCAG 3.2.3, 3.2.4):** Navigation, Bezeichnungen der Hauptmenüs und wiederkehrende Elemente müssen seitenübergreifend konsistent sein. Funktionen an gleicher Position und mit gleicher Benennung.
* **Verständliche Fehlerbehandlung (WCAG 3.3.1, 3.3.3):** Fehlermeldungen müssen klar verständlich sein, den Fehler identifizieren und konkrete Korrekturvorschläge bieten. Fehler werden zusätzlich zur Farbe auch durch Icons und Text gekennzeichnet.
* **Ausreichend große Klickflächen (WCAG 2.5.5):** Interaktive Elemente müssen mindestens 44×44 Pixel groß sein (außer bei Inline-Text-Links).
* **Screenreader-Kompatibilität:** Vollständige Kompatibilität mit gängigen Screenreadern (NVDA, JAWS, VoiceOver) durch korrekte ARIA-Labels, Landmark-Rollen und semantisches HTML.
* **Zoomfähigkeit (WCAG 1.4.4, 1.4.10):** Die Oberfläche muss bis 200% Zoom ohne Funktionsverlust oder horizontales Scrollen nutzbar sein. Unterstützung für Browser-Textvergrößerung.

### Content-Erstellung und Validierung

Das CMS muss Redakteur\:innen aktiv dabei unterstützen, barrierefreie Inhalte zu erstellen:

* **Pflicht-Alternativtexte (WCAG 1.1.1):** Bei Bild-Uploads muss die Eingabe eines aussagekräftigen Alternativtextes (Alt-Text) erzwungen werden. Leere Alt-Texte nur für dekorative Bilder erlaubt (mit expliziter Bestätigung). Hilfestellung: Maximallänge 125 Zeichen, Hinweise zur Formulierung.
* **Überschriftenhierarchie (WCAG 1.3.1):**
  * Der Editor muss korrekte semantische Überschriften (H1-H6) ohne Hierarchie-Sprünge erzwingen.
  * Automatische Validierung: Warnung bei übersprungenen Ebenen (z.B. H2 → H4).
  * Visuelle Kennzeichnung der Überschriftenebenen im Editor.
* **Semantische Strukturen (WCAG 1.3.1):**
  * Korrekte Auszeichnung von Listen (geordnet `<ol>`, ungeordnet `<ul>`, Definitionslisten `<dl>`).
  * Tabellen mit korrekten Header-Zellen (`<th>`), `<caption>` und optional `scope`-Attributen.
  * Korrekte Auszeichnung von Zitaten (`<blockquote>`, `<cite>`).
  * Verwendung von `<strong>` und `<em>` statt rein visueller Hervorhebungen.
* **Farbunabhängigkeit (WCAG 1.4.1):**
  * Informationen dürfen nicht ausschließlich durch Farbe vermittelt werden.
  * Pflichtfelder müssen zusätzlich durch Sternchen (*) oder "Pflichtfeld"-Text gekennzeichnet sein.
  * Status-Informationen benötigen Icons zusätzlich zur Farbcodierung.
* **Link-Texte (WCAG 2.4.4, 2.4.9):**
  * Warnung bei generischen Link-Texten wie "hier klicken", "mehr", "weiterlesen".
  * Empfehlung: Links sollen aus dem Kontext heraus verständlich sein.
* **Sprachauszeichnung (WCAG 3.1.1, 3.1.2):**
  * Hauptsprache des Dokuments muss festgelegt werden (`lang`-Attribut).
  * Fremdsprachige Textpassagen müssen mit entsprechendem `lang`-Attribut ausgezeichnet werden können.
* **Video- und Audio-Unterstützung (WCAG 1.2.1, 1.2.2, 1.2.3):**
  * Pflichtfelder für Untertitel (WebVTT, SRT) bei Video-Uploads.
  * Felder für Transkripte bei Audio- und Video-Inhalten.
  * Optional: Gebärdensprache-Videos für wichtige Inhalte.
* **Dokument-Uploads (WCAG 1.3.1):**
  * Warnung bei Upload von nicht-barrierefreien PDFs.
  * Empfehlung: PDFs sollten getaggt und maschinenlesbar sein (PDF/UA-Standard).
  * Alternative: HTML-Version anbieten.
* **Kontrast-Checker (WCAG 1.4.3):**
  * Integriertes Tool zur Überprüfung von Farbkombinationen bei Text und Hintergründen.
  * Warnung bei unzureichendem Kontrast (< 4,5:1 für normalen Text, < 3:1 für großen Text).
* **Vorschau-Modus:**
  * Barrierefreiheits-Vorschau mit Simulation von Farbfehlsichtigkeit (Deuteranopie, Protanopie, Tritanopie).
  * Screenreader-Vorschau: Wie wird der Inhalt vorgelesen?

### API-Output und Datenübertragung

Die über die API bereitgestellten Daten müssen alle für Barrierefreiheit notwendigen Informationen enthalten:

* **Metadaten-Übertragung:**
  * Alternativtexte (`alt`), Bild-Beschreibungen (`longdesc` falls vorhanden).
  * Semantische Strukturinformationen (Überschriftenebenen, Listen-Typen, Tabellen-Struktur).
  * Sprachinformationen (`lang`) für Hauptsprache und fremdsprachige Abschnitte.
  * Link-Beschreibungen und Zielhinweise (öffnet in neuem Fenster, lädt Datei herunter).
* **Strukturiertes Datenformat:**
  * JSON-API mit klar definierten Attributen für semantische Elemente.
  * Beispiel: `{"type": "heading", "level": 2, "text": "Überschrift"}`.
  * Verschachtelte Strukturen für Listen, Tabellen, Blockquotes.
* **Medien-Informationen:**
  * Video/Audio: URLs zu Untertitel-Dateien (WebVTT), Transkripten, Gebärdensprache-Videos.
  * Bild-Metadaten: Dimensionen, Dateigröße, MIME-Type, Aufnahmedatum (falls relevant).
* **Accessibility-Tree:**
  * Die API sollte optional eine Accessibility-Tree-Repräsentation des Contents ausgeben können.
  * Ermöglicht assistiven Technologien optimale Interpretation.

### Testing und Validierung

* **Automatisierte Tests:**
  * Integration von Accessibility-Testing-Tools (axe-core, Pa11y, WAVE).
  * Automatische Überprüfung bei jedem Content-Deploy.
  * CI/CD-Pipeline blockiert bei kritischen Barrierefreiheits-Fehlern.
* **Manuelle Überprüfung:**
  * Regelmäßige Tests mit echten Screenreadern (NVDA, JAWS, VoiceOver).
  * User-Tests mit Menschen mit Behinderungen.
  * Dokumentation der Test-Ergebnisse.
* **BITV-Selbstbewertung:**
  * Jährliche Selbstbewertung nach BITV-Test.
  * Veröffentlichung einer Barrierefreiheitserklärung.
  * Feedback-Mechanismus für Barrierefreiheits-Probleme.

**Messkriterium:**
* BITV-Test (Selbstbewertung) mit mindestens 90/100 Punkten.
* WCAG 2.1 Level AA-Konformität bestätigt durch automatisierte Tests (100% Pass-Rate für kritische Regeln).
* Erfolgreicher Screenreader-Test (alle Kernfunktionen mit NVDA, JAWS, VoiceOver bedienbar).
* Tastatur-Navigationstest: 100% der Funktionen ohne Maus erreichbar.
* Kontrast-Test: 100% der Text-/UI-Elemente erfüllen 4,5:1 Kontrast (normale Schrift) bzw. 3:1 (große Schrift/Icons).

---

## Benutzerfreundlicher Editor

Inhalte sollen einfach erstellt werden können.

**Messkriterium:**
- Mindestens 80 % der Testpersonen bewerten die Inhaltsbearbeitung als „einfach" oder „sehr einfach"

---

## Lokalisierung

Unterstützung mehrerer Sprachen und regionaler Anpassungen.

**Messkriterium:**
- UI in mindestens Deutsch und Englisch vollständig verfügbar
