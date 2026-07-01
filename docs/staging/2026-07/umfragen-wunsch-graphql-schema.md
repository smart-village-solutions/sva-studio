# Wunsch-GraphQL-Schema für das Umfrage-Modul

## Ziel

Gewünschte GraphQL-Ziel-API für das im Issue `#618` beschriebene Umfrage-Modul.

## Ausgangslage

Im bestehenden Schema sind bereits einfache Survey-/Poll-Operationen vorhanden:

- `surveys`
- `surveyComments`
- `createOrUpdateSurveyPoll`
- `voteForSurvey`
- `votesForSurvey`
- `commentSurvey`

Diese Operationen decken einfache Einzel-Polls mit Votes und Kommentaren ab. Sie reichen fachlich nicht für das neue Umfrage-Modul aus, weil dort unter anderem folgende Anforderungen hinzukommen:

- vollständige Umfragen mit mehreren Fragen
- vereinfachtes Statusmodell für Entwurf, Aktiv und Archiv
- Zielgebiet-/Ortsteilbezug
- anonyme Teilnahme ohne Login
- geräteseitige Mehrfachteilnahme-Sperre
- getrennte Verwaltungs- und Public-Views
- Ergebnisanzeige im CMS
- kontrollierte öffentliche Ergebnisanzeige
- Exportfunktionen im Studio

Bestehende GraphQL-Operationen dürfen nicht breaking verändert werden. Entweder bleiben sie kompatibel erweitert bestehen oder das neue Umfrage-Modell wird über neue Operationen eingeführt.

## Leitplanken

- Die Prüfung auf bereits erfolgte Teilnahme findet auf dem Gerät statt.
- Öffentliche Ergebnisanzeigen dürfen keine ungeprüften Freitextantworten exponieren.
- Die API soll zukünftige Erweiterungen wie weitere Fragetypen, Moderation, sauberere Exportpfade oder härtere Teilnahme-Checks nicht verbauen.
- Bestehende GraphQL-Queries und -Mutations müssen abwärtskompatibel bleiben.
- Bestehende Operationen werden nur additiv erweitert oder das neue Modell läuft über neue Operationen.

## Wunsch-Schema

```graphql
scalar DateTime
scalar UUID
scalar JSON
scalar I18nJSON

enum SurveyStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum SurveyQuestionType {
  SINGLE_CHOICE
  MULTIPLE_CHOICE
  FREE_TEXT
  SINGLE_CHOICE_WITH_TEXT
  MULTIPLE_CHOICE_WITH_TEXT
}

enum SurveyFreeTextStatus {
  INTERNAL
  PUBLIC
}

enum SurveyResultVisibility {
  NONE
  AFTER_SUBMISSION
  AFTER_SURVEY_END
}

enum SurveyMutationAction {
  CREATED
  UPDATED
  DELETED
}

enum SurveyMutationErrorCode {
  VALIDATION_ERROR
  SURVEY_NOT_FOUND
  INVALID_STATUS_TRANSITION
  DELETE_REQUIRES_ID
  CONFLICTING_INPUT
  FORBIDDEN
  INTERNAL_ERROR
}

enum SurveySubmissionErrorCode {
  VALIDATION_ERROR
  SURVEY_NOT_FOUND
  SURVEY_NOT_ACTIVE
  FORBIDDEN
  INTERNAL_ERROR
}

type Survey {
  id: ID!
  title: I18nJSON!
  shortDescription: I18nJSON
  description: I18nJSON

  status: SurveyStatus!
  startAt: DateTime
  endAt: DateTime

  resultVisibility: SurveyResultVisibility!
  targetAreaIds: [ID!]!

  showResultsInApp: Boolean!
  isAnonymous: Boolean!

  privacyNotice: I18nJSON
  transparencyNotice: I18nJSON

  questions(
    ids: [ID!]
    offset: Int = 0
    limit: Int
  ): [SurveyQuestion!]!
  questionCount: Int!
  participationCount: Int!
  submissionCount: Int!
  results: SurveyResults

  createdAt: DateTime!
  updatedAt: DateTime!
  publishedAt: DateTime
  archivedAt: DateTime
}

type SurveyQuestion {
  id: ID!
  surveyId: ID!
  title: I18nJSON!
  description: I18nJSON
  type: SurveyQuestionType!
  required: Boolean!
  position: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  options: [SurveyQuestionOption!]!
}

type SurveyQuestionOption {
  id: ID!
  questionId: ID!
  title: I18nJSON!
  position: Int!
  enablesFreeText: Boolean!
}

type SurveyMutationError {
  code: SurveyMutationErrorCode!
  message: String!
  field: String
}

type SurveySubmissionError {
  code: SurveySubmissionErrorCode!
  message: String!
  field: String
}

type SurveyMutationPayload {
  success: Boolean!
  action: SurveyMutationAction
  survey: Survey
  deletedSurveyId: ID
  errors: [SurveyMutationError!]!
}

type SurveySubmissionPayload {
  success: Boolean!
  survey: Survey
  accepted: Boolean!
  message: String
  errors: [SurveySubmissionError!]!
}

type SurveyResults {
  surveyId: ID!
  participationCount: Int!
  submissionCount: Int!
  questions: [SurveyQuestionResults!]!
}

type SurveyQuestionResults {
  questionId: ID!
  type: SurveyQuestionType!
  totalResponses: Int!
  optionResults: [SurveyOptionResult!]!
  freeTextResponses: [SurveyFreeTextResult!]!
}

type SurveyOptionResult {
  optionId: ID!
  title: I18nJSON!
  votes: Int!
  percentage: Float
  freeTextResponses: [SurveyFreeTextResult!]!
}

type SurveyFreeTextResult {
  id: ID!
  text: String!
  status: SurveyFreeTextStatus!
  createdAt: DateTime!
}

input SurveyFilterInput {
  ids: [ID!]
  statuses: [SurveyStatus!]
  targetAreaIds: [ID!]
  includeArchived: Boolean = false
  ongoingOnly: Boolean = false
}

input UpsertSurveyInput {
  id: ID
  delete: Boolean
  title: I18nJSON
  shortDescription: I18nJSON
  description: I18nJSON
  status: SurveyStatus
  startAt: DateTime
  endAt: DateTime
  resultVisibility: SurveyResultVisibility
  targetAreaIds: [ID!]
  showResultsInApp: Boolean
  isAnonymous: Boolean
  privacyNotice: I18nJSON
  transparencyNotice: I18nJSON
  questions: [UpsertSurveyQuestionInput!]
  freeTextResponses: [UpsertSurveyFreeTextInput!]
}

input UpsertSurveyQuestionInput {
  id: ID
  delete: Boolean
  title: I18nJSON
  description: I18nJSON
  type: SurveyQuestionType
  required: Boolean
  position: Int
  options: [UpsertSurveyQuestionOptionInput!]
}

input UpsertSurveyQuestionOptionInput {
  id: ID
  delete: Boolean
  title: I18nJSON
  position: Int
  enablesFreeText: Boolean
}

input UpsertSurveyFreeTextInput {
  id: ID!
  status: SurveyFreeTextStatus!
}

input SubmitSurveyInput {
  surveyId: ID!
  uuid: UUID
  newParticipation: Boolean!
  answers: [SurveyAnswerInput!]!
}

input SurveyAnswerInput {
  questionId: ID!
  selectedOptionIds: [ID!]
  freeText: String
}

type Query {
  surveys(filter: SurveyFilterInput): [Survey!]!
}

type Mutation {
  createOrUpdateSurvey(input: UpsertSurveyInput!): SurveyMutationPayload!

  submitSurvey(input: SubmitSurveyInput!): SurveySubmissionPayload!
}
```

## Kurzregeln

- `Survey` ist die fachliche Root-Entität.
- `createOrUpdateSurvey` deckt Create, Update, Statuswechsel und Delete ab.
- `delete: true` erfordert `id`.
- Ein Update nur mit `id` ohne Änderungen ist ungültig.
- Bei Create prüft der Server die fachlich erforderlichen Felder.
- `submitSurvey` modelliert eine komplette Submission, nicht einzelne Votes.
- `submitSurvey.uuid` ist optional für spätere Submission-Referenzen.
- `submitSurvey.newParticipation` wird client-seitig gesetzt.
- `participationCount` zählt nur erste Teilnahmen.
- `submissionCount` zählt alle gespeicherten Submission-Vorgänge, auch Ergänzungen oder Korrekturen.
- Das Statusmodell ist auf `DRAFT`, `ACTIVE` und `ARCHIVED` reduziert.
- Zeitliche Wirkung ergibt sich über `startAt` und `endAt`, nicht über zusätzliche Statuswerte wie `SCHEDULED` oder `ENDED`.
- `surveys(filter)` ist die einzige Survey-Abfrage und liefert immer ein Array.
- Zugriff auf Non-Public-Surveys wird serverseitig über Credentials entschieden.
- Ergebnisdaten hängen an `Survey` über `results`.
- Freitextantworten in `results` sind credential-abhängig gefiltert:
  - öffentliche Credentials sehen nur `PUBLIC`
  - privilegierte Credentials sehen `PUBLIC` und `INTERNAL`
- Der Freitext-Status kann über `createOrUpdateSurvey` mit `freeTextResponses` auf `PUBLIC` gesetzt werden.
- Exportformate werden im Studio erzeugt, nicht über eigene Server-Operationen.
- Fragen sind nach `position` aufsteigend und bei Gleichstand nach `createdAt` aufsteigend sortiert.
- `questions(ids, offset, limit)` dient für gezielte oder paginierte Fragenabfragen.
- Listen-Semantik:
  - Feld fehlt: keine Änderung
  - leeres Array: bewusst leeren
  - Einträge vorhanden: Upsert-/Delete-Semantik anwenden
- Fachliche Fehler sollen primär strukturiert im Payload zurückkommen, nicht nur als Top-Level-GraphQL-Errors.

## Beispielabfragen und -mutationen

Die folgenden Beispiele zeigen die gewünschte Nutzung der API mit den aktuell beschriebenen Feldern und Optionen.

### Surveys nach IDs laden

```graphql
query SurveysByIds($filter: SurveyFilterInput) {
  surveys(filter: $filter) {
    id
    title
    status
    startAt
    endAt
    targetAreaIds
  }
}
```

```json
{
  "filter": {
    "ids": ["survey-1", "survey-2"]
  }
}
```

### Surveys nach Status und Zielgebieten laden

```graphql
query SurveysFiltered($filter: SurveyFilterInput) {
  surveys(filter: $filter) {
    id
    title
    status
    resultVisibility
    targetAreaIds
    showResultsInApp
    publishedAt
  }
}
```

```json
{
  "filter": {
    "statuses": ["ACTIVE", "ARCHIVED"],
    "targetAreaIds": ["district-1", "district-2"],
    "includeArchived": false,
    "ongoingOnly": true
  }
}
```

### Einzelne Survey mit Fragen, Pagination und Ergebnissen laden

```graphql
query SurveyDetail($filter: SurveyFilterInput) {
  surveys(filter: $filter) {
    id
    title
    status
    questionCount
    allQuestions: questions {
      id
      title
      type
      position
      createdAt
    }
    pagedQuestions: questions(offset: 3, limit: 3) {
      id
      title
      type
      required
      position
      createdAt
      updatedAt
      options {
        id
        title
        position
        enablesFreeText
      }
    }
    results {
      surveyId
      participationCount
      submissionCount
      questions {
        questionId
        type
        totalResponses
        optionResults {
          optionId
          title
          votes
          percentage
          freeTextResponses {
            id
            text
            status
            createdAt
          }
        }
        freeTextResponses {
          id
          text
          status
          createdAt
        }
      }
    }
  }
}
```

```json
{
  "filter": {
    "ids": ["survey-1"]
  }
}
```

### Gezielte Fragen per IDs laden

```graphql
query SurveyQuestionsByIds($filter: SurveyFilterInput) {
  surveys(filter: $filter) {
    id
    title
    questions(ids: ["question-3", "question-7"]) {
      id
      title
      type
      position
      createdAt
    }
  }
}
```

```json
{
  "filter": {
    "ids": ["survey-1"]
  }
}
```

### Survey anlegen

```graphql
mutation CreateSurvey($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    deletedSurveyId
    survey {
      id
      title
      status
      questions {
        id
        title
        type
        position
      }
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "title": {
      "de": "Bürgerbefragung Stadtpark"
    },
    "shortDescription": {
      "de": "Kurze Umfrage zur Nutzung des Stadtparks"
    },
    "description": {
      "de": "Bitte beantworten Sie einige Fragen zur Nutzung und Aufenthaltsqualität."
    },
    "status": "DRAFT",
    "resultVisibility": "AFTER_SURVEY_END",
    "targetAreaIds": ["district-1"],
    "showResultsInApp": true,
    "isAnonymous": true,
    "privacyNotice": {
      "de": "Die Teilnahme erfolgt anonym."
    },
    "transparencyNotice": {
      "de": "Die Ergebnisse werden nach Ende veröffentlicht."
    },
    "questions": [
      {
        "title": {
          "de": "Wie oft besuchen Sie den Stadtpark?"
        },
        "type": "SINGLE_CHOICE",
        "required": true,
        "position": 1,
        "options": [
          {
            "title": {
              "de": "Täglich"
            },
            "position": 1,
            "enablesFreeText": false
          },
          {
            "title": {
              "de": "Wöchentlich"
            },
            "position": 2,
            "enablesFreeText": false
          }
        ]
      },
      {
        "title": {
          "de": "Was sollte verbessert werden?"
        },
        "type": "FREE_TEXT",
        "required": false,
        "position": 2
      }
    ]
  }
}
```

### Survey aktualisieren

```graphql
mutation UpdateSurvey($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    survey {
      id
      title
      status
      updatedAt
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "id": "survey-1",
    "title": {
      "de": "Bürgerbefragung Stadtpark 2026"
    },
    "questions": [
      {
        "id": "question-1",
        "title": {
          "de": "Wie häufig besuchen Sie den Stadtpark?"
        },
        "position": 1
      },
      {
        "title": {
          "de": "Welche Angebote nutzen Sie im Park?"
        },
        "type": "MULTIPLE_CHOICE",
        "required": false,
        "position": 3,
        "options": [
          {
            "title": {
              "de": "Spielplatz"
            },
            "position": 1,
            "enablesFreeText": false
          },
          {
            "title": {
              "de": "Sonstiges"
            },
            "position": 2,
            "enablesFreeText": true
          }
        ]
      }
    ]
  }
}
```

### Freitextantworten auf public setzen

```graphql
mutation PublishFreeTextResponses($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    survey {
      id
      results {
        surveyId
        questions {
          questionId
          freeTextResponses {
            id
            status
          }
          optionResults {
            optionId
            freeTextResponses {
              id
              status
            }
          }
        }
      }
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "id": "survey-1",
    "freeTextResponses": [
      {
        "id": "freetext-1",
        "status": "PUBLIC"
      },
      {
        "id": "freetext-2",
        "status": "PUBLIC"
      }
    ]
  }
}
```

### Nur den Status einer Survey ändern

```graphql
mutation UpdateSurveyStatus($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    survey {
      id
      status
      publishedAt
      archivedAt
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "id": "survey-1",
    "status": "ACTIVE"
  }
}
```

### Frage und Antwortoption löschen

```graphql
mutation DeleteSurveyQuestionAndOption($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    survey {
      id
      updatedAt
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "id": "survey-1",
    "questions": [
      {
        "id": "question-2",
        "delete": true
      },
      {
        "id": "question-3",
        "options": [
          {
            "id": "option-7",
            "delete": true
          }
        ]
      }
    ]
  }
}
```

### Survey löschen

```graphql
mutation DeleteSurvey($input: UpsertSurveyInput!) {
  createOrUpdateSurvey(input: $input) {
    success
    action
    deletedSurveyId
    survey {
      id
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "id": "survey-1",
    "delete": true
  }
}
```

### Antworten auf eine Survey absenden

```graphql
mutation SubmitSurvey($input: SubmitSurveyInput!) {
  submitSurvey(input: $input) {
    success
    accepted
    message
    survey {
      id
      title
      status
    }
    errors {
      code
      message
      field
    }
  }
}
```

```json
{
  "input": {
    "surveyId": "survey-1",
    "uuid": "submission-550e8400-e29b-41d4-a716-446655440000",
    "newParticipation": true,
    "answers": [
      {
        "questionId": "question-1",
        "selectedOptionIds": ["option-2"]
      },
      {
        "questionId": "question-2",
        "freeText": "Mehr Schattenplätze und Sitzmöglichkeiten."
      },
      {
        "questionId": "question-3",
        "selectedOptionIds": ["option-7"],
        "freeText": "Yoga-Fläche"
      }
    ]
  }
}
```
