# ACCESSIBILITY REVIEW: SVA Studio IAM-Proposal
## WCAG 2.1 AA / BITV 2.0 Konformitätsprüfung

**Reviewer:** UX & Accessibility Specialist
**Datum:** 21. Januar 2026
**Scope:** Keycloak-Integration, IAM-Service-Architektur (Phases 1–3)
**Standard:** WCAG 2.1 Level AA, BITV 2.0
**Status:** 🔴 ABWEICHUNGEN GEFUNDEN – Handlungsbedarf in Phase 1 & 2

---

## EXECUTIVE SUMMARY

Das IAM-Proposal etabliert eine solide technische Grundlage für Authentifizierung und Autorisierung, **adressiert aber keine Frontend-Accessibility-Anforderungen explizit**. Dies ist ein kritisches Defizit, da das Login-System der **erste Touchpoint** für alle Nutzer ist – einschließlich Menschen mit Behinderungen.

**Zentrale Befunde:**
- ✅ Backend-Architektur ermöglicht Accessibility (separation of concerns)
- ⚠️ Frontend-Specs fehlen teilweise (Login UI, Error-Handling, Session-Management)
- 🔴 Keine expliziten WCAG AA-Anforderungen für Phase 1
- 🔴 Kritische Gaps: Tastaturbedienbarkeit, Screenreader, Error-Messaging, Focus-Management
- 🔴 2FA-Flow nicht für barrierefreien Zugang konzipiert

**Gesamtkonformität:** **NICHT WCAG AA-konform** ohne explizite Frontend-Accessibility-Requirements
**Empfehlung:** Accessibility-Anforderungen vor Phase 1 Integration hinzufügen, Task 1.3 (Frontend-Integration) erweitern.

---

## 1. WCAG 2.1 AA KONFORMITÄTSEINSCHÄTZUNG

### Allgemeine Bewertung

| Aspekt | Status | Begründung |
|--------|--------|-----------|
| **Tastaturbedienbarkeit (2.1.1)** | 🔴 Offen | Keine Specs zu Tab-Order, Fokus, Tastaturfallen |
| **Sichtkontrast (1.4.3)** | ⚠️ Offen | Keycloak-UI ist extern; SVA Login-UI nicht spezifiziert |
| **Screenreader (1.1.1, 4.1.2)** | 🔴 Offen | Keine ARIA-Labels, Semantic HTML nicht erwähnt |
| **Error-Messages (3.3.1)** | 🔴 Offen | Token-Fehler nur als HTTP-Codes; keine accessible UI-Fehler |
| **Form-Accessibility (1.3.5, 3.3)** | 🔴 Offen | Kein Login-Form-Design spezifiziert |
| **Focus-Management (2.4.3, 2.4.7)** | 🔴 Offen | Session-Timeout, Dialog-Fokus nicht behandelt |
| **Mobile Accessibility (2.5.5)** | ⚠️ Offen | Touch-Target-Size nicht definiert |
| **Sprache & Mehrsprachigkeit (3.1)** | ⚠️ Offen | Locale-Handling nicht erwähnt |

### BITV 2.0 Alignment

BITV 2.0 verlangt Konformität mit EN 301 549 (europäischer Standard). Das IAM-System betrifft folgende BITV-Kapitel:

| BITV-Kapitel | Anforderung | Status |
|--------------|-------------|--------|
| **5.1** | Barrierefreie Inhalte & Funktionen | 🔴 Nicht adressiert |
| **5.2** | Accessible Authentication | 🔴 Kritisch: Keine 2FA-Accessibility |
| **5.3** | Accessible Content | ⚠️ Teilweise (Backend ok, UI offen) |
| **5.4** | Context & Orientation | ⚠️ Session-Timeout-Warnung fehlt |
| **5.5** | Input Modalities | 🔴 Nicht adressiert |
| **5.6** | Languages | ⚠️ Offen |

---

## 2. SPEZIFISCHE WCAG-VERSTÖSSE

### 2.1 WCAG 2.1.1 – Keyboard Access (Level A)

**Status:** 🔴 **NICHT ADRESSIERT**

**Problem:**
- Das Frontend-Login ist nicht für Tastaturbedienung konzipiert
- No specs für Tab-Navigation, Enter-zum-Abschicken, Escape-zum-Schließen
- Keycloak-Login ist extern → Abhängigkeit von Keycloak's Accessibility (unklar)
- 2FA-Input (OTP, TOTP) nicht spezifiziert

**Norm-Referenz:**
- WCAG 2.1.1: "All functionality of the content is operable at minimum via keyboard input"
- BITV 2.0 Kapitel 5.5: "Content shall be operable through keyboard or other input modalities"

**Empfehlung:**
```
Neue Anforderung für Task 1.3:

1.3.A: KEYBOARD NAVIGATION
- Login-Form mit Tab-Navigation (Benutzername → Passwort → Login-Button)
- Enter-Taste zum Abschicken (Standard HTML)
- Tab-Order logisch & vorhersehbar (Top-to-Bottom, Left-to-Right)
- Shift+Tab funktioniert (Rückwärts-Navigation)
- No Keyboard Traps (keine Elemente, von denen Tab-Taste nicht entkommen kann)

1.3.B: OTP-INPUT ACCESSIBILITY (2FA)
- OTP-Eingabefeld als standard <input type="text"> (nicht custom component)
- Ermögliche Copy-Paste von OTP (nicht nur Tastaturinput)
- Paste-Button für Nutzer mit motorischen Beeinträchtigungen
- Screenreader gibt Feldtyp an ("Sechsstelliger Sicherheitscode")

1.3.C: KEYCLOAK-INTEGRATION AUDIT
- Verifiziere Keycloak v.X.Y Accessibility (Test mit NVDA, JAWS)
- Falls Keycloak nicht WCAG AA-konform: Custom Login-UI verwenden
```

---

### 2.2 WCAG 1.4.3 – Contrast (Minimum) (Level AA)

**Status:** ⚠️ **TEILWEISE OFFEN**

**Problem:**
- Login-UI ist nicht spezifiziert → Keycloak-Standard + ggf. SVA Branding
- Error-Messages (z.B. "Invalid token") werden wahrscheinlich nur rot eingefärbt
- Success-Messages verwenden wahrscheinlich nur grüne Farbe
- Keine Mention von Kontrastverhältnissen (4.5:1 für Normal-Text)

**Norm-Referenz:**
- WCAG 1.4.3: "Text and images of text have a contrast ratio of at least 4.5:1"
- WCAG 1.4.11: "The visual presentation of graphical elements and user interface components has a contrast ratio of at least 3:1"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.D: COLOR & CONTRAST SPEC
- Definiere Login-UI Farbpalette (Background, Text, Buttons, Inputs)
- Alle Text-Kontraste ≥ 4.5:1 (normal text)
- Button-Kontraste ≥ 3:1 (UI components)
- Validiere mit: WAVE, Axe DevTools, Color Contrast Checker
- Test mit: Color blindness simulator (Protanopia, Deuteranopia, Tritanopia)

1.3.E: ERROR & SUCCESS MESSAGE STYLING
- Error-Messages: NICHT nur rot; Icons + Text erforderlich
  * Icon: ❌ oder ⚠️ (deutlich sichtbar)
  * Text: "Fehler: Ungültige Anmeldedaten"
  * Farbe: Rot + Icon + Text (3-fache Redundanz)
- Success-Messages: Nicht nur grün
  * Text + Icon + optional Sound-Indikator
- Warnung vor Session-Timeout: Rot + Text + Counter-Display

Beispiel HTML:
<div role="alert" class="error-message" style="color: #d32f2f; border-left: 4px solid #d32f2f;">
  <span aria-label="Fehler">❌</span>
  <p>Ungültige Anmeldedaten. Bitte versuchen Sie es erneut.</p>
</div>
```

---

### 2.3 WCAG 4.1.2 – Name, Role, Value (Level A)

**Status:** 🔴 **KRITISCH OFFEN**

**Problem:**
- Keine Mention von ARIA-Attributen für Login-Form
- Token-Fehler werden Backend-side nur als HTTP-Codes returned (500, 401, 403)
- Frontend-Error-Handling nicht spezifiziert
- Session-Timeout-Dialog nicht designt
- Keine `role="alert"` für Error-Messages

**Norm-Referenz:**
- WCAG 4.1.2: "For all user interface components, the name and role can be programmatically determined"
- BITV 2.0: "All interactive components must be accessible to assistive technologies"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.F: SEMANTIC HTML & ARIA REQUIREMENTS

Login-Form Struktur:
<form id="login-form" role="form">
  <h1>SVA Studio Anmeldung</h1>

  <div>
    <label for="username-input" id="username-label">Benutzername</label>
    <input
      id="username-input"
      type="text"
      name="username"
      required
      aria-labelledby="username-label"
      aria-describedby="username-hint"
    />
    <small id="username-hint">Geben Sie Ihren Benutzernamen ein</small>
  </div>

  <div>
    <label for="password-input">Passwort</label>
    <input
      id="password-input"
      type="password"
      name="password"
      required
      aria-labelledby="password-label"
    />
  </div>

  <button type="submit" id="login-btn">Anmelden</button>
</form>

<!-- Error-Container mit ARIA Live Region -->
<div
  id="error-container"
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  style="display: none;"
></div>

Session-Timeout-Dialog:
<dialog id="session-timeout-dialog" role="alertdialog" aria-labelledby="timeout-title">
  <h2 id="timeout-title">Sitzung läuft ab</h2>
  <p aria-live="polite">
    Ihre Sitzung endet in <span id="countdown">5</span> Minuten.
  </p>
  <button id="extend-session">Sitzung verlängern</button>
  <button id="logout">Abmelden</button>
</dialog>

1.3.G: ARIA-LABELS REQUIREMENTS
- Alle Input-Felder: <label> oder aria-labelledby
- Error-Messages: role="alert" + aria-live="assertive"
- Session-Timeout: role="alertdialog" + aria-labelledby
- Keycloak-Redirect: Announce "Weitergeleitet zu Keycloak" (live region)
- Token-Validation-Fehler: aria-live="polite" + Fehler-Text

1.3.H: FORM-VALIDATION MESSAGES
- Inline Validation:
  * "Passwort muss ≥ 8 Zeichen sein" (aria-describedby)
  * Nicht nur rotes X-Icon
- On-Blur Validation:
  * aria-live="polite" Region für Fehlermeldungen
- On-Submit Validation:
  * Summary-Fehler: role="alert" + aria-live="assertive"
  * Fokus auf erstes fehlerhaftes Feld
```

---

### 2.4 WCAG 2.4.3 – Focus Order (Level A)

**Status:** 🔴 **KRITISCH OFFEN**

**Problem:**
- Keycloak-Redirect: Fokus-Management nicht erwähnt
- Nach Login-Redirect zu Dashboard: Fokus-Position unklar
- Session-Timeout-Dialog: Fokus-Trap nicht definiert
- Back-Button-Verhalten bei Session-Expiration nicht spezifiziert

**Norm-Referenz:**
- WCAG 2.4.3: "Focus order is logical and meaningful"
- WCAG 2.4.7: "At minimum, the keyboard focus indicator is visible"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.I: FOCUS MANAGEMENT SPEC

Login-Redirect:
1. User klickt "Login"
2. Focus sollte auf Keycloak-UI gehen (announce: "Weitergeleitet zu Keycloak")
3. Nach erfolgreichem Login: Focus auf main content (Dashboard)
   - NICHT auf "Willkommen, [Name]" Header (zu weit oben)
   - Auf erste interaktive Komponente (z.B. News-List)
   - Announce via aria-live: "Anmeldung erfolgreich, Sie sind im Dashboard"

Session-Timeout-Dialog:
- Dialog öffnet → Focus auf "Sitzung verlängern" Button (default action)
- Tab-Navigation zyklisch (Dialog-Trap) – verlässt Dialog nicht ohne Action
- ESC-Taste: Schließt Dialog + Logout
- Nach Sitzung-Verlängerung: Focus zurück zu vorherigem Element

Fokus-Indicator Styling:
button:focus-visible {
  outline: 3px solid #1976D2;  /* Kontrast ≥ 3:1 */
  outline-offset: 2px;
}
input:focus-visible {
  border: 2px solid #1976D2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}
```

---

### 2.5 WCAG 3.3.1 – Error Identification (Level A)

**Status:** 🔴 **KRITISCH OFFEN**

**Problem:**
- Backend returned HTTP Codes (401, 403, 500)
- Frontend-Error-Handling nicht spezifiziert
- Token-Fehler keine benutzerfreundlichen Nachrichten
- Benutzer erhält wahrscheinlich: "401 Unauthorized" statt "Ungültige Anmeldedaten"
- 2FA-Fehler (z.B. falsche OTP) nicht designt

**Norm-Referenz:**
- WCAG 3.3.1: "If an input error is detected, the item that is in error is identified and described to the user"
- WCAG 3.3.4: "Error Prevention (Legal, Financial, Data Deletion)"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.J: USER-FRIENDLY ERROR MESSAGES

HTTP-Code → User Message Mapping:

401 Unauthorized:
❌ "Invalid token" (Backend-Fehler)
✅ "Anmeldedaten ungültig. Bitte überprüfen Sie Benutzername und Passwort."

403 Forbidden:
❌ "Insufficient permissions" (Backend-Fehler)
✅ "Sie haben keine Berechtigung, diese Seite zu öffnen. Kontaktieren Sie Ihren Administrator."

500 Internal Server Error:
❌ "Server error"
✅ "Ein Systemfehler ist aufgetreten. Bitte versuchen Sie es in einigen Minuten erneut."

2FA-Fehler (Token-Validation):
- OTP ungültig/abgelaufen:
  "Der Sicherheitscode ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Code an."
- Zu viele Versuche:
  "Zu viele ungültige Codes. Versuchen Sie es in 15 Minuten erneut."

Session-Timeout:
- Aktive Warnung (vor Logout):
  ⏰ "Ihre Sitzung endet in 5 Minuten durch Untätigkeit."
  [Sitzung verlängern] [Jetzt abmelden]

- Nach Timeout:
  ⚠️ "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."

1.3.K: ERROR-MESSAGE UI IMPLEMENTATION

<div class="error-message" role="alert" aria-live="assertive">
  <svg class="icon" aria-hidden="true" width="24" height="24">
    <!-- Error Icon SVG -->
  </svg>
  <div>
    <strong>Anmeldedaten ungültig</strong>
    <p>Überprüfen Sie Ihren Benutzernamen und Ihr Passwort.</p>
  </div>
  <button aria-label="Fehler schließen" onclick="closeError()">×</button>
</div>

Styling:
.error-message {
  background-color: #FFEBEE;  /* Hell rot */
  border-left: 4px solid #D32F2F;  /* Dunkel rot, ≥3:1 Kontrast */
  color: #B71C1C;  /* Dunkelrot, ≥4.5:1 mit Background */
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

1.3.L: 2FA ERROR HANDLING

OTP-Input-Fehler:
<div role="alert" aria-live="polite">
  <span class="error-icon" aria-hidden="true">❌</span>
  <span>Ungültiger Sicherheitscode. Bitte überprüfen Sie Ihre Eingabe.</span>
</div>

Option zum OTP-Neuversand:
<p>Haben Sie den Code nicht erhalten?</p>
<button onclick="resendOTP()">Neuen Code per SMS/E-Mail anfordern</button>
```

---

### 2.6 WCAG 2.5.2 – Pointer Cancellation (Level A)

**Status:** ⚠️ **TEILWEISE OFFEN**

**Problem:**
- Mobile-Nutzer möglicherweise versehentlich Buttons tappen
- No "Confirm" Dialog vor kritischen Aktionen (z.B. Logout)
- Touch-Target-Größe nicht spezifiziert

**Norm-Referenz:**
- WCAG 2.5.2: "For functionality that can be operated using a single pointer, at least one of the following is true: No Down-Event, Abort or Undo, Up-Event"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.M: POINTER CANCELLATION (Mobile)

Login-Button:
- Up-Event (touch end): Button wird aktiviert
- NOT down-event (touch start)
- Ermöglicht "Cancellation": User kann auf Button tippen, dann Finger bewegen außerhalb Button, dann loslassen → keine Aktivierung

Logout-Button:
- <button onclick="showConfirmLogout()">Abmelden</button>
- Zeigt Bestätigung: "Abmelden?" [Abbrechen] [Abmelden]
- Benutzerfehler wird verhindert

1.3.N: TOUCH-TARGET SIZE (44x44px minimum)

Alle Button & Input-Felder:
- Minimum Height: 44px
- Minimum Width: 44px
- Padding: min. 8px um target area

SVA Login-Button:
<button style="min-height: 44px; min-width: 140px;">
  Anmelden
</button>

Test mit: Mobile Browser DevTools, Touch-Simulation
```

---

### 2.7 WCAG 3.1 – Language (Level A)

**Status:** ⚠️ **TEILWEISE OFFEN**

**Problem:**
- Locale-Handling nicht erwähnt
- SVA könnte mehrsprachig sein (Deutsch, ggf. weitere Sprachen)
- Keycloak-Integration: Sprache wird konfiguriert?
- `<html lang="de">` vermutlich nicht erwähnt

**Norm-Referenz:**
- WCAG 3.1.1: "The default human language of each web page can be programmatically determined"

**Empfehlung:**
```
Task 1.3 erweitern:

1.3.O: LANGUAGE SPECIFICATION

HTML-Markup:
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SVA Studio – Anmeldung</title>
</head>
```

If mehrsprachig:
1. Benutzer-Sprache aus Browser-Locale ermitteln
2. Keycloak mit Sprache konfigurieren (URL-Parameter oder Cookie)
3. SVA Frontend die Locale respektieren
```

---

### 2.8 WCAG 2.3.1 – Three Flashes or Below (Level A)

**Status:** ⚠️ **NICHT RELEVANT**

Keine Animationen spezifiziert → Nicht relevant für Phase 1.

---

## 3. KRITISCHE ACCESSIBILITY-MÄNGEL

### 3.1 🔴 KRITISCH: Keine 2FA-Accessibility

**Problem:**
- 2FA ist Sicherheitsanforderung (good), aber nicht für Accessibility konzipiert
- OTP-Input wahrscheinlich ein maskeniertes Feld (nur Zahlen)
- Copy-Paste nicht möglich → Nutzer mit motorischen Beeinträchtigungen können OTP nicht eingeben
- Totp-App-Integration nicht spezifiziert (Screen-Magnifier-Probleme)

**Impact:** Nutzer mit Motorbeeinträchtigung kann sich NICHT anmelden.

**Empfehlung:**
```
Task 2.X: 2FA ACCESSIBILITY (neue Task vor Phase 1)

2FA-Anforderungen:
1. OTP-Input als Text-Feld (nicht Nummernfeld mit Masken)
2. Copy-Paste funktioniert
3. Screenreader gibt an: "Sicherheitscode, 6 Ziffern"
4. Alternative: "Backup-Codes" (Long-Form, Copy-Paste-freundlich)
5. TOTP-App-Integration: QR-Code + Text-Code (Alt für Screen-Reader-Nutzer)

Implementation:
<input
  type="text"
  inputmode="numeric"
  pattern="[0-9]{6}"
  maxlength="6"
  id="otp-input"
  aria-label="Sicherheitscode, 6 Ziffern"
  placeholder="000000"
/>

Backup-Codes Display:
<pre id="backup-codes" aria-label="Backup-Codes">
XXXX-XXXX
XXXX-XXXX
...
</pre>
<button onclick="copyBackupCodes()">Backup-Codes kopieren</button>

QR-Code Alternative:
<!-- QR-Code -->
<p>Oder manuell eingeben:</p>
<code id="secret-code">JBSWY3DPEBLW64TMMQ======</code>
<button onclick="copySecretCode()">Geheimschlüssel kopieren</button>
```

---

### 3.2 🔴 KRITISCH: Session-Timeout ohne Zugängliche Vorwarnung

**Problem:**
- Design erwähnt Session-Timeout (Token-Expiration)
- Aber keine UI-Specs für Timeout-Warnung
- Nutzer wird einfach abgemeldet → Datenverlust möglich
- Screenreader-Nutzer merkt eventuell nicht, dass Sitzung endet

**Impact:** Nutzer verliert ggf. ihre Arbeit ohne Warnung.

**Empfehlung:**
```
Task 1.5: SESSION TIMEOUT ACCESSIBILITY (neue Task)

Anforderungen:
1. 5-10 Min vor Timeout: Modal-Dialog mit aria-live="polite"
2. Countdown-Display (kontinuierlich aktualisiert, sprechbar für SR)
3. "Sitzung verlängern" Button (default focus)
4. Sound-Indikator optional (muss nicht sein, hilft aber)
5. Nach Logout: Clear Error Message + Logout-Grund

Implementation:

<!-- Timeout-Dialog -->
<dialog id="session-timeout-modal" role="alertdialog" aria-modal="true">
  <h2 id="modal-title">Ihre Sitzung läuft ab</h2>
  <div aria-live="polite" aria-atomic="true">
    <p>
      Aufgrund von Untätigkeit endet Ihre Sitzung in
      <strong><span id="timeout-counter">5</span> Minuten</strong>.
    </p>
  </div>
  <div class="button-group">
    <button id="extend-btn" class="primary">
      Sitzung verlängern
    </button>
    <button id="logout-btn">
      Jetzt abmelden
    </button>
  </div>
</dialog>

JavaScript:
let timeoutMinutes = 5;
setInterval(() => {
  timeoutMinutes--;
  document.getElementById('timeout-counter').textContent = timeoutMinutes;
  if (timeoutMinutes === 0) {
    showSessionExpiredDialog();
  }
}, 60000);

function extendSession() {
  // Refresh Token, close dialog, announce
  document.querySelector('[aria-live]').textContent =
    'Ihre Sitzung wurde um 30 Minuten verlängert.';
  document.getElementById('session-timeout-modal').close();
}

Nach Timeout:
<div role="alert" aria-live="assertive">
  <span class="error-icon" aria-hidden="true">⏰</span>
  <p>Ihre Sitzung ist aufgrund von Untätigkeit abgelaufen.</p>
  <p>Bitte <a href="/login">melden Sie sich erneut an</a>.</p>
</div>
```

---

### 3.3 🔴 KRITISCH: Multi-Org-Switch ohne Accessible Navigation

**Problem:**
- Task 2.3 & 2.4: "Organization-Tree UI-Komponente" erwähnt
- Aber keine Specs: DropDown? Modal? Sidebar?
- DropDown-Menü oft nicht accessible
  * Tastatur-Navigation unklar
  * Screenreader kann verschachtelte Struktur nicht navigieren
  * Hierarchische Orgs (County → Municipality → District) = tiefe Nesting

**Impact:** Nutzer mit Beeinträchtigung kann Org nicht wechseln.

**Empfehlung:**
```
Task 2.4: ORG-SWITCH ACCESSIBILITY (erweitern)

Anforderungen:
1. NICHT DropDown-Menü
2. Accessible Listbox oder Tree-Navigation
3. Keyboard-Navigation: Arrow-Keys, Enter
4. Screenreader: Announces Struktur ("County [3 Sub-Items]")

Implementation (Listbox Pattern):

<div role="region" aria-label="Organisationen wechseln">
  <label for="org-listbox" id="org-label">
    Wählen Sie Ihre Organisation:
  </label>
  <div
    id="org-listbox"
    role="listbox"
    aria-labelledby="org-label"
    aria-multiselectable="false"
  >
    <div role="option" aria-selected="false">
      <span aria-expanded="false" role="button" tabindex="0">
        📍 County XY
      </span>
      <div role="group" aria-label="Municipalities" hidden>
        <div role="option">
          📍 Municipality XY-1
        </div>
        <div role="option">
          📍 Municipality XY-2
        </div>
      </div>
    </div>
  </div>
</div>

JavaScript für Tastatur-Navigation:
- Arrow-Down/Up: Nächste Option
- Arrow-Right: Öffne Sub-Items
- Arrow-Left: Schließe Sub-Items
- Enter: Wähle Option + Org wechseln
- Escape: Schließe Menü

Alternative (einfacher): Tree-View Pattern
<div role="tree">
  <div role="treeitem" aria-level="1">
    <button aria-expanded="false">County XY</button>
    <div role="group" hidden>
      <div role="treeitem" aria-level="2">
        <button>Municipality XY-1</button>
      </div>
    </div>
  </div>
</div>

Test mit:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (Mac)
- Tastatur-only Navigation
```

---

### 3.4 🔴 KRITISCH: Rollenassignment UI nicht accessible designt

**Problem:**
- Task 3.5: "UI für Admin: Nutzer zu Organisationen zuweisen"
- Aber keine Specs für Accessibility
- Wahrscheinlich: Drag-and-Drop UI (nicht keyboard-accessible)
- Checkboxen ohne Labels
- Rollen-Beschreibungen nicht vorhanden

**Impact:** Admin mit Behinderung kann Rollen nicht zuweisen.

**Empfehlung:**
```
Task 3.5: ROLE ASSIGNMENT UI ACCESSIBILITY (erweitern)

Anforderungen:
1. Keine Drag-and-Drop (nicht accessible)
2. Checkbox-Liste mit Labels
3. Rollen-Beschreibungen (tooltip oder collapsible)
4. Bulk-Actions keyboard-accessible
5. Feedback nach Zuweisung

Implementation:

<fieldset>
  <legend>Rollen zuweisen für: <strong>Anna Müller</strong> (anna@example.com)</legend>

  <div class="role-group">
    <label>
      <input type="checkbox" name="role" value="redakteur" />
      <span>Redakteur</span>
      <button
        type="button"
        aria-label="Rollen-Beschreibung anzeigen: Redakteur"
        onclick="toggleDescription('redakteur-desc')"
      >
        ℹ️
      </button>
    </label>
    <p id="redakteur-desc" class="description" hidden>
      Kann Nachrichten und Events erstellen, bearbeiten und für Review einreichen.
    </p>
  </div>

  <div class="role-group">
    <label>
      <input type="checkbox" name="role" value="designer" />
      <span>Designer</span>
      <button aria-label="Rollen-Beschreibung anzeigen: Designer">ℹ️</button>
    </label>
    <p id="designer-desc" class="description" hidden>
      Kann Branding, Layouts und Module anpassen.
    </p>
  </div>

  <button type="submit" onclick="assignRoles()">
    Rollen speichern
  </button>
</fieldset>

Success-Message:
<div role="alert" aria-live="polite">
  ✓ Rollen für Anna Müller erfolgreich aktualisiert.
</div>
```

---

### 3.5 ⚠️ OFFEN: Audit-Log Export Accessibility

**Problem:**
- Task 3.6.3: "Activity-Log Export (CSV, JSON)"
- Aber keine Specs für Accessibility
- CSV-Export wahrscheinlich nicht labeled/described
- Admin-Dashboard könnte Tabelle ohne accessible Headers haben

**Empfehlung:**
```
Task 3.6.4: AUDIT-LOG ACCESSIBILITY

Anforderungen für Admin-Dashboard:
1. Tabelle mit <thead> (Spalten-Header)
2. scope="col" auf <th>
3. Sortier-Links keyboard-accessible
4. Export-Buttons mit aussagekräftigen Labels
5. Filter-Felder mit Labels

Implementation:

<table role="table" aria-label="IAM-Aktivitätsprotokolle">
  <thead>
    <tr>
      <th scope="col">
        <button onclick="sortBy('timestamp')">
          Zeitstempel
          <span aria-label="sortierbar" aria-hidden="true">▼</span>
        </button>
      </th>
      <th scope="col">
        <button onclick="sortBy('user')">
          Benutzer
        </button>
      </th>
      <th scope="col">Event-Typ</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2026-01-21 14:23:00</td>
      <td>anna@example.com</td>
      <td>role_assigned</td>
    </tr>
  </tbody>
</table>

Export-Buttons:
<div class="export-controls">
  <button onclick="exportCSV()">
    Protokoll als CSV exportieren
  </button>
  <button onclick="exportJSON()">
    Protokoll als JSON exportieren
  </button>
</div>
```

---

### 3.6 ⚠️ OFFEN: Hilfe- & Dokumentation Accessibility

**Problem:**
- Proposal erwähnt: "Developer-Dokumentation (SDK, API, Examples)"
- Aber keine Specs für barrierefreie Dokumentation
- Code-Samples wahrscheinlich ohne Syntax-Highlighting-Alternatives
- Tabellen in Docs möglich ohne Headers

**Empfehlung:**
```
Task 3.8.5: DOCUMENTATION ACCESSIBILITY

Anforderungen:
1. Alle Seiten: Heading-Struktur (H1, H2, H3 — keine Skip-Levels)
2. Code-Blocks:
   - <pre><code> mit language identifier
   - Copy-Button accessible
   - Alternative: Text-Version der Code-Snippets
3. Bilder:
   - alt-Text (informativ, nicht "image.png")
   - Diagramme: Beschreibung + verlinkter Text-Äquivalent
4. Tabellen:
   - <thead>, <th scope="col">, <th scope="row">
   - Keine Layout-Tabellen
5. Links:
   - Aussagekräftige Link-Texte ("Docs lesen" statt "hier")
6. Listen:
   - Semantisches HTML: <ul>, <ol>, <li>

Beispiel Code-Block:
<figure>
  <pre>
    <code class="language-typescript">
      async function canUserPerformAction(
        userId: string,
        action: string
      ): Promise&lt;boolean&gt; {
        // ...
      }
    </code>
  </pre>
  <figcaption>
    Beispiel: Permission-Check Funktion
  </figcaption>
</figure>
<button onclick="copyCode()">Code kopieren</button>

Diagramm mit Alt:
<figure>
  <img src="auth-flow.png" alt="OAuth 2.0 Authorization Code Flow mit PKCE-Variante" />
  <figcaption>
    <p>Authorization Code Flow Sequenzdiagramm:</p>
    <ol>
      <li>User klickt Login</li>
      <li>Frontend generiert PKCE Challenge</li>
      ...
    </ol>
  </figcaption>
</figure>
```

---

## 4. BARRIEREFREIHEITS-EMPFEHLUNGEN (Konkret & Umsetzbar)

### 4.1 Phase 1 Frontend-Integration (Task 1.3)

**Neue Acceptance Criteria für Accessibility:**

```
Task 1.3 – ERWEITERTE ACCESSIBILITY ACCEPTANCE CRITERIA:

✅ Keyboard Navigation:
   - Tab-Reihenfolge: Username → Password → Login-Button
   - Alle interaktiven Elemente keyboard-erreichbar
   - Keine Keyboard-Traps
   - Fokus-Indikator sichtbar (≥3:1 Kontrast)

✅ Semantisches HTML:
   - <form>, <label>, <input>, <button> korrekt verwendet
   - role="alert" für Error-Messages
   - role="alertdialog" für Session-Timeout
   - Headings richtig hierarchisiert (H1, H2)

✅ ARIA-Attribute:
   - Alle Inputs: aria-labelledby oder <label>
   - aria-describedby für Hinweistexte
   - aria-live="polite|assertive" für dynamische Inhalte
   - aria-label für Icon-Buttons

✅ Error Messages:
   - Text + Icon + Farbe (nicht nur Farbe)
   - role="alert" + aria-live="assertive"
   - Klare, nutzerzentrierte Sprache
   - Links zu Support/Docs

✅ Kontrast:
   - Text ≥4.5:1 (normal), ≥3:1 (large)
   - Buttons ≥3:1
   - Fokus-Indikatoren ≥3:1

✅ Screenreader-Test:
   - Mit NVDA oder JAWS getestet
   - Form ist vollständig navigierbar
   - Errors werden announced
   - Erfolgreicher Login wird announced

✅ Tastatur-Test:
   - Tab-Navigation funktioniert
   - Enter submitted Form
   - Escape schließt Dialoge
   - Keine Keyboard-Traps
```

---

### 4.2 Phase 2 Organization-Navigation (Task 2.4)

**Konkrete Accessibility-Requirements:**

```
Task 2.4 ERWEITERT – ORG-TREE ACCESSIBILITY:

❌ NICHT verwenden:
   - <select> Dropdown für hierarchische Strukt.
   - Drag-and-Drop
   - Custom Keyboard-Implementierung ohne Testing

✅ VERWENDEN:
   - ARIA Listbox oder Treeview Pattern
   - Standard Arrow-Keys + Enter
   - Hierarchie-Expandability (Arrow-Right/Left)

✅ Implementierung prüfen:
   - Expand/Collapse ist keyboard-navigierbar
   - Screenreader announces Struktur ("3 Unterpunkte")
   - Performance: < 500ms auch mit 1000+ Orgs
   - Mobile: 44x44px Touch-Targets

✅ Tests:
   - VoiceOver (Mac), NVDA (Windows), JAWS (Windows)
   - Tastatur-Navigation mit Screenreader
   - Mobile-Touch-Navigation
```

---

### 4.3 Phase 3 Role Assignment UI (Task 3.5)

**UI Pattern für Accessibility:**

```
Task 3.5 ERWEITERT – ROLE ASSIGNMENT UI:

✅ Pattern: Checkbox-Liste (accessible by default)
   - Statt Drag-and-Drop
   - Statt Custom-Toggle-UI

✅ Pro Rolle:
   - <label> + <input type="checkbox">
   - Rollen-Beschreibung (Tooltip oder inline)
   - Rollen-Icon (optional, aber mit aria-hidden)

✅ Bulk-Aktionen:
   - "Alle deselektieren" Button
   - "Häufige Kombinationen" Preset-Buttons
   - Keyboard-navigierbar

✅ Feedback nach Save:
   - role="alert" + Success-Message
   - Fokus auf Success-Message
   - Undo-Option (falls möglich)

✅ Tests:
   - Ohne Maus funktioniert
   - Screenreader announced Rollen-Beschreibungen
   - Erfolgreiche Speicherung wird announced
```

---

### 4.4 Session Management (New Task)

```
NEW TASK 1.5: SESSION TIMEOUT ACCESSIBILITY

🕐 Session-Timeout Anforderungen:
   - 5-10 Minuten vor Ablauf: Modal-Dialog
   - Countdown in Sekunden/Minuten (continuous update)
   - aria-live="polite" für Countdown-Updates
   - "Sitzung verlängern" als Default-Focus
   - ESC-Taste schließt Dialog + Logout
   - Nach Timeout: Klare Error-Message + Redirect zu Login

✅ Implementation:
   - Dialog mit role="alertdialog"
   - aria-modal="true"
   - aria-labelledby auf Dialog-Title
   - Buttons mit aria-label Falls nötig

✅ Testing:
   - Screenreader announces Timeout
   - Countdown wird aktualisiert + announced
   - "Sitzung verlängern" funktioniert
   - Nach Logout: Benutzer wird zur Login-Seite geleitet
```

---

### 4.5 2FA Accessibility (New Task)

```
NEW TASK 2.X: 2FA ACCESSIBILITY

🔐 OTP-Input Anforderungen:
   - Text-Input (nicht masked/hidden)
   - Copy-Paste funktioniert
   - aria-label: "Sicherheitscode, 6 Ziffern"
   - autocomplete="one-time-code" (Browser-Support)
   - inputmode="numeric" optional (Mobile UX)

✅ Backup-Codes:
   - <pre>-Block für Copy-Paste
   - Monospace Font
   - "Backup-Codes kopieren" Button

✅ TOTP-Setup:
   - QR-Code + Text-Code (Alt)
   - Text-Code ist copybar
   - "In Authenticator-App eingeben" Anleitung
   - Verification mit generierten Codes

✅ Testing:
   - OTP-Input mit Screenreader
   - Backup-Codes Accessibility
   - TOTP-Setup ohne QR-Scanner (Text-Code)
```

---

## 5. FRONTEND-REQUIREMENTS FÜR ACCESSIBILITY

### 5.1 HTML-Struktur Template

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="SVA Studio Anmeldung" />
  <title>SVA Studio – Anmeldung</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" alt="SVA Logo" />
</head>
<body>
  <!-- Skip Link (optional, aber recommended) -->
  <a href="#main-content" class="skip-link">Zum Hauptinhalt</a>

  <!-- Header -->
  <header role="banner">
    <img src="/logo.svg" alt="SVA Studio" />
    <h1>SVA Studio</h1>
  </header>

  <!-- Main Content -->
  <main id="main-content" role="main">
    <h2>Anmeldung</h2>

    <!-- Error Alert Region -->
    <div id="error-region" role="alert" aria-live="assertive" aria-atomic="true"></div>

    <!-- Login Form -->
    <form id="login-form" novalidate>
      <div class="form-group">
        <label for="username">Benutzername</label>
        <input
          id="username"
          type="text"
          name="username"
          required
          aria-describedby="username-hint"
        />
        <small id="username-hint">Ihre E-Mail-Adresse oder Benutzername</small>
      </div>

      <div class="form-group">
        <label for="password">Passwort</label>
        <input
          id="password"
          type="password"
          name="password"
          required
        />
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="remember-me" />
          Anmeldedaten speichern
        </label>
      </div>

      <button type="submit" class="btn btn-primary">
        Anmelden
      </button>
    </form>

    <p>
      <a href="/forgot-password">Passwort vergessen?</a>
    </p>
  </main>

  <!-- Footer -->
  <footer role="contentinfo">
    <p>&copy; 2026 SVA. <a href="/accessibility">Barrierefreiheit</a></p>
  </footer>
</body>
</html>
```

### 5.2 CSS für Accessibility

```css
/* 1. Skip Link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

/* 2. Fokus-Indikator */
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 3px solid #1976D2;
  outline-offset: 2px;
}

/* 3. Error-Styles (nicht nur Farbe) */
.error-message {
  background-color: #FFEBEE;
  border-left: 4px solid #D32F2F;
  color: #B71C1C;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

.error-message::before {
  content: "❌ ";
}

/* 4. Kontrast-Test Breakpoint */
@media (prefers-contrast: more) {
  body {
    font-weight: 600;  /* Increased weight for high contrast */
  }
}

/* 5. Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* 6. Input-Fokus */
input:focus-visible {
  border: 2px solid #1976D2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}

/* 7. Button-Größe (44x44px mindestens) */
button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### 5.3 JavaScript für Accessibility

```typescript
// 1. Error Message Announcement
function showError(message: string): void {
  const errorRegion = document.getElementById('error-region');
  errorRegion.textContent = message;
  errorRegion.style.display = 'block';
  errorRegion.scrollIntoView({ behavior: 'smooth' });

  // Focus on error for keyboard users
  errorRegion.focus();
}

// 2. Form Validation
function validateForm(form: HTMLFormElement): boolean {
  const username = form.querySelector<HTMLInputElement>('input[name="username"]');
  const password = form.querySelector<HTMLInputElement>('input[name="password"]');

  if (!username?.value) {
    showError('Benutzername ist erforderlich.');
    username?.focus();
    return false;
  }

  if (!password?.value) {
    showError('Passwort ist erforderlich.');
    password?.focus();
    return false;
  }

  return true;
}

// 3. Session Timeout Management
function initSessionTimeout(timeoutMinutes: number): void {
  const warningMinutes = 5;
  const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

  setTimeout(() => {
    showSessionTimeoutWarning(warningMinutes);
  }, warningMs);
}

function showSessionTimeoutWarning(minutesRemaining: number): void {
  const dialog = document.getElementById('session-timeout-dialog') as HTMLDialogElement;
  const counter = document.getElementById('timeout-counter');

  dialog.showModal();
  counter.textContent = minutesRemaining.toString();

  // Update countdown every 60 seconds
  const interval = setInterval(() => {
    minutesRemaining--;
    counter.textContent = minutesRemaining.toString();

    if (minutesRemaining === 0) {
      clearInterval(interval);
      performLogout();
    }
  }, 60000);

  // Allow extend
  document.getElementById('extend-btn')?.addEventListener('click', () => {
    clearInterval(interval);
    extendSession();
    dialog.close();
  });
}

// 4. Keyboard Navigation Helper
function setupKeyboardNavigation(element: HTMLElement): void {
  element.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      element.style.display = 'none';
    }
  });
}
```

---

## 6. REDAKTIONS-WORKFLOW IMPACT

### 6.1 Betroffene Stakeholder

| Stakeholder | Impact |
|-------------|--------|
| **Entwickler** | Task 1.3 + neue Tasks für Accessibility; Testing-Zeit +15–20% |
| **QA/Tester** | Zusätzliche Test-Cases für WCAG AA (Screenreader, Keyboard) |
| **UX Designer** | Login UI accessible designen (Kontrast, Error-Messages) |
| **Admin/DocOps** | Dokumentation accessible schreiben (Headings, Alt-Text) |
| **IT-Security** | Keycloak-Version prüfen: WCAG AA konform? |

### 6.2 Zeitaufschlag

| Task | Original | +Accessibility | Delta |
|------|----------|-----------------|-------|
| 1.3 Frontend-Integration | 5d | 6–7d | +20–40% |
| 1.5 Security & Testing | 3d | 4–5d | +30–50% |
| 2.4 Org-Tree UI | 3d | 4–5d | +30–40% |
| 3.5 Role Assignment UI | 3d | 4–5d | +30–40% |
| 3.8 Testing & Docs | 4d | 5–6d | +20–30% |

**Gesamtaufschlag Phase 1–3: ~15–25%**

---

## 7. TESTING-ANFORDERUNGEN (Screenreader, Tastatur, etc.)

### 7.1 Test-Matrix

| Test-Typ | Tools | Coverage | Phase |
|----------|-------|----------|-------|
| **Automated WCAG Scanning** | Axe DevTools, Wave | Initial checks | 1.3 |
| **Keyboard Navigation** | Manual | 100% von Forms & Dialogs | 1.3 |
| **Screenreader (Windows)** | NVDA | Login, Error-Handling, Org-Switch | 1.3, 2.4 |
| **Screenreader (Mac)** | VoiceOver | Dito | 1.3, 2.4 |
| **Screenreader (Mobile)** | TalkBack (Android), VoiceOver (iOS) | Login Flow | 1.3 |
| **Kontrast** | Color Contrast Analyzer | Alle Farben ≥4.5:1 | 1.3 |
| **Farbblindheit** | Sim. (Protanopia, Deuteranopia) | Error-Messages, Status | 1.3 |
| **Zoom** | Browser 200% | Keine Layout-Breaks, Text lesbar | 1.3 |
| **Reduced Motion** | `prefers-reduced-motion` | Keine störenden Animationen | 1.3 |
| **Voice Navigation** | Dragon NaturallySpeaking (optional) | Voice commands funktionieren | 1.5 |

### 7.2 Konkrete Test-Cases

```gherkin
Feature: Login Form Accessibility

  Scenario: Login form is keyboard navigable
    Given I open the login page
    And I press Tab
    Then Focus moves to username input
    When I press Tab
    Then Focus moves to password input
    When I press Tab
    Then Focus moves to login button
    When I press Tab
    Then Focus moves to "Forgot password" link
    When I press Shift+Tab
    Then Focus moves back to login button

  Scenario: Error message is announced to screenreader
    Given I open login page with NVDA running
    And I fill invalid credentials
    When I click Login button
    Then NVDA announces: "Error: Invalid credentials"
    And Error message has role="alert"
    And aria-live="assertive"

  Scenario: Session timeout warning is accessible
    Given I am logged in
    And 25 minutes pass (5 min before timeout)
    Then Session timeout dialog appears
    And Dialog has role="alertdialog"
    And Focus moves to "Extend session" button
    When I press Tab
    Then I can navigate between buttons
    When I press Escape
    Then Dialog closes (or I'm logged out)

  Scenario: Org switch is keyboard navigable
    Given I am logged in
    When I press Alt+O (org switch shortcut)
    Then Org list opens or becomes focused
    When I press Arrow-Down
    Then Next org is highlighted
    When I press Enter
    Then Org changes + screen updates

  Scenario: 2FA input accepts paste
    Given I'm on 2FA page
    And I have OTP copied: "123456"
    When I paste into OTP field (Ctrl+V)
    Then OTP is entered correctly
    When I press Enter
    Then 2FA is submitted

  Scenario: Contrast is ≥4.5:1
    Given I inspect all text elements
    And I use Color Contrast Analyzer
    Then All text has contrast ≥4.5:1
    And All UI components have contrast ≥3:1

  Scenario: Error message is not color-only
    Given Login fails
    When Error message appears
    Then Error message has:
      - Icon (❌ or ⚠️)
      - Text message
      - Red color
    And Icon is not aria-hidden
    And Screenreader announces full message
```

### 7.3 Test-Checkliste

```markdown
## Pre-Launch Accessibility Checklist

### Phase 1: Keycloak-Integration

- [ ] HTML-Struktur
  - [ ] Alle Inputs haben <label> oder aria-labelledby
  - [ ] Form hat <form> Tag
  - [ ] Headings hierarchisch (H1, H2)
  - [ ] Keine skip-Levels in Headings
  - [ ] Links haben aussagekräftige Text ("Anmelden" statt "Klick hier")

- [ ] Keyboard Navigation
  - [ ] Tab-Reihenfolge logisch
  - [ ] Shift+Tab funktioniert
  - [ ] Enter submitted Form
  - [ ] Escape schließt Dialoge
  - [ ] Fokus-Indikator sichtbar
  - [ ] Keine Keyboard-Traps

- [ ] Screenreader-Tests (NVDA, JAWS, VoiceOver)
  - [ ] Form ist navigierbar
  - [ ] Labels werden announced
  - [ ] Error-Messages werden announced
  - [ ] Erfolgreiche Login wird announced
  - [ ] Keycloak-Redirect wird announced

- [ ] Kontrast
  - [ ] Text ≥4.5:1
  - [ ] Buttons ≥3:1
  - [ ] Fokus-Indikator ≥3:1
  - [ ] Validator: Axe oder Wave

- [ ] Error-Messages
  - [ ] Text + Icon + Farbe (nicht nur Farbe)
  - [ ] aria-live="assertive"
  - [ ] role="alert"
  - [ ] Klare Sprache

- [ ] Mobile
  - [ ] Touch-Targets ≥44x44px
  - [ ] VoiceOver (iOS) funktioniert
  - [ ] TalkBack (Android) funktioniert

### Phase 2: Organization Navigation

- [ ] Org-Switch UI
  - [ ] Keyboard-navigierbar
  - [ ] Screenreader-tested
  - [ ] Hierarchie wird announced

### Phase 3: Role Assignment

- [ ] Role Assignment UI
  - [ ] Checkboxes mit Labels
  - [ ] Keine Drag-and-Drop
  - [ ] Rollen-Beschreibungen accessible
  - [ ] Erfolg-Message announced

### Dokumentation

- [ ] Alle Docs haben Heading-Struktur
- [ ] Code-Blocks haben <pre><code>
- [ ] Bilder haben aussagekräftiges alt-Text
- [ ] Tabellen haben <thead> + scope="col"
- [ ] Links sind aussagekräftig
```

---

## 8. IMPLEMENTIERUNGS-ROADMAP

### Phase 0 (Vorbereitung – vor Phase 1)

```
Task 0.1: Accessibility Standards Setup
- [ ] WCAG 2.1 AA Compliance-Dokument erstellen
- [ ] BITV 2.0 Mapping erarbeiten
- [ ] Accessibility Champion in Team benennen
- [ ] Tools setup (Axe, WAVE, Color Contrast)
- [ ] Screenreader-Lizenzen (NVDA kostenlos, JAWS $$)

Task 0.2: Keycloak Accessibility Audit
- [ ] Keycloak-Version prüfen
- [ ] Mit NVDA/JAWS testen
- [ ] Falls nicht WCAG AA: Alternative planen (Custom UI)

Task 0.3: Design System Accessibility
- [ ] Farb-Palette mit Kontrast-Werten
- [ ] Fokus-Indikator-Design (3px, 2px offset, #1976D2)
- [ ] Error/Success/Info Message Styles
- [ ] Button-Sizing (min 44x44px)
```

### Phase 1 (Frontend-Integration)

```
Task 1.3: Login-Flow mit Accessibility ✅
- [ ] Requirement 1.3.A: Keyboard-Navigation
- [ ] Requirement 1.3.B: OTP-Input
- [ ] Requirement 1.3.D: Kontrast & Farben
- [ ] Requirement 1.3.E: Error-Message Styling
- [ ] Requirement 1.3.F: Semantic HTML & ARIA
- [ ] Requirement 1.3.I: Focus-Management

Task 1.5: Session Management ✅
- [ ] Requirement 1.3.J: Error-Messages
- [ ] Session-Timeout Dialog
- [ ] aria-live für Countdown
- [ ] NVDA/JAWS Teste
```

### Phase 2 (Organizations)

```
Task 2.4: Org-Switch UI ✅
- [ ] Listbox oder Treeview Pattern
- [ ] Keyboard-Navigation (Arrow-Keys)
- [ ] Screenreader-Testing

Task 2.X: 2FA Accessibility (optional) ✅
- [ ] OTP-Input (Copy-Paste-friendly)
- [ ] Backup-Codes
- [ ] TOTP QR + Text
```

### Phase 3 (Role Assignment)

```
Task 3.5: Role Assignment UI ✅
- [ ] Checkbox-Liste (kein Drag-and-Drop)
- [ ] Rollen-Beschreibungen
- [ ] Bulk-Actions
- [ ] Accessibility-Testing

Task 3.6.4: Audit-Dashboard ✅
- [ ] Accessible Tabelle
- [ ] Sort-Links
- [ ] Export-Buttons
```

---

## 9. ABSCHLIESSENDE EMPFEHLUNGEN

### 9.1 Kritische Nächste Schritte

1. **Accessibility Requirements in Phase 1 integrieren** (nicht verschieben auf später)
   - Task 1.3 um 40% erweitern für Accessibility
   - Neue Task 1.5 für Session-Management
   - Zielzeit: 1 Woche Zusatz

2. **Keycloak-Version auditieren**
   - Ist Keycloak v.X.Y WCAG AA-konform?
   - Falls nein: Custom SVA Login-UI bauen (+ 1–2 Wochen)

3. **Screenreader-Lizenzen besorgen**
   - NVDA: kostenlos (Windows)
   - JAWS: $100/Jahr (Windows)
   - VoiceOver: kostenlos (Mac/iOS)
   - Tester schulen (4–8 Std)

4. **Accessibility Champion benennen**
   - Designer oder Developer mit SR-Erfahrung
   - Teil-Zeit (20–30%) während Phase 1–3
   - Responsible für Accessibility-Reviews

### 9.2 Governance & Compliance

**Definition of Done (DoD) für alle Frontend-Tasks:**

```
Accessibility DoD:
- [ ] Automated WCAG Scan: 0 Fehler (Axe/Wave)
- [ ] Keyboard-Navigation: 100% funktional
- [ ] Screenreader-Test: Mit NVDA oder VoiceOver
- [ ] Kontrast-Check: ≥4.5:1 Text, ≥3:1 UI
- [ ] Error-Messages: Nicht nur Farbe
- [ ] Mobile: 44x44px Targets, VoiceOver/TalkBack getestet
- [ ] Documentation: Alt-Text, Headings, accessible Tables
- [ ] Code-Review: Accessibility-Reviewer included
```

### 9.3 Kosten & Ressourcen

| Ressource | Kosten | Anmerkung |
|-----------|--------|----------|
| **JAWS Lizenz** | $100/Jahr | Für QA-Tester |
| **Axe Pro** | $99/Jahr | Optional (kostenlos Plugin ok) |
| **Training** | 4–8 Std | Screenreader-Workshop |
| **Entwickler (Zusatz)** | +20–25% Zeitaufschlag Phase 1–3 | ~2–3 Wochen extra |
| **QA/Testing (Zusatz)** | +30–40% Zeitaufschlag | ~1–2 Wochen extra |

**Gesamtbudget:** ~€5–10k (abhängig von Team-Größe & Stundensätze)

### 9.4 Externe Ressourcen

- **WCAG 2.1 Spec:** https://www.w3.org/WAI/WCAG21/quickref/
- **BITV 2.0:** https://www.gesetze-im-internet.de/bitv_2_0/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **WebAIM:** https://webaim.org/ (Tutorials, Checklisten)
- **Deque Axe:** https://www.deque.com/axe/devtools/
- **WAVE:** https://wave.webaim.org/
- **Screen Reader Testing:** NVDA (free), JAWS ($$), VoiceOver (Mac/iOS)

---

## 10. FAZIT & GESAMTBEWERTUNG

### Gesamtkonformität

| Aspekt | Status | Begründung |
|--------|--------|-----------|
| **WCAG 2.1 AA Konformität** | 🔴 NICHT KONFORM | Frontend-Specs unzureichend; keine Accessibility-Requirements |
| **BITV 2.0 Alignment** | 🔴 NICHT KONFORM | Keine accessible Authentication definiert |
| **Technische Machbarkeit** | ✅ GUT | Backend-Architektur ermöglicht Accessibility |
| **Umsetzungsaufwand** | ⚠️ MODERAT | +20–25% Zeitaufschlag; managebar |
| **Risiko bei Nicht-Compliance** | 🔴 HOCH | Ausschluss von Nutzern mit Behinderungen; potenzielle rechtliche Konsequenzen (BITV, AODA) |

### Handlungsempfehlung

**🟢 EMPFEHLUNG: Genehmigung mit Accessibility-Bedingungen**

Das IAM-Proposal ist technisch solide und lässt sich mit Accessibility-Anforderungen umsetzen. **Bedingungen:**

1. **Vor Phase 1 Start:**
   - Accessibility Requirements (aus diesem Review) in Tasks 1.3, 1.5, 2.X, 3.5 integrieren
   - Keycloak-Version auf WCAG AA Konformität prüfen
   - Accessibility Champion bestätigen
   - JAWS-Lizenz besorgen

2. **Während Phase 1–3:**
   - Screenreader-Testing in jedem Sprint
   - Accessibility-Review in Code-Reviews (neben Security-Review)
   - DoD um Accessibility erweitern

3. **Nach Phase 3:**
   - Full WCAG 2.1 AA Audit (externer Dienstleister empfohlen)
   - Nutzer-Testing mit echten Screenreader-Nutzern
   - BITV 2.0 Konformitätserklärung erstellen

### Abschluss

Das SVA Studio IAM-System hat das **Potenzial, vollständig WCAG 2.1 AA und BITV 2.0 konform** zu sein – mit expliziten Accessibility-Requirements und systematischem Testing. Dies ist **nicht optional**, sondern **rechtlich erforderlich** für öffentliche Systeme (BITV 2.0 ist Gesetz in Deutschland).

Die in diesem Review empfohlenen Maßnahmen sind **umsetzbar, nachvollziehbar und kosten-effektiv**. Eine Investition von ~€5–10k + 2–3 Wochen Zusatzzeit zahlt sich aus durch:
- ✅ Rechtliche Compliance (BITV 2.0, möglicherweise AODA)
- ✅ Inklusivität (Zugang für Menschen mit Behinderungen)
- ✅ Bessere UX für ALLE (auch Nutzer ohne Behinderungen profitieren)
- ✅ Bessere SEO (accessible HTML = besser indexierbar)

---

**Reviewer:** UX & Accessibility Specialist
**Datum:** 21. Januar 2026
**Version:** 1.0 (Final)
