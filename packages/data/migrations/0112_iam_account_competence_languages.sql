-- +goose Up
ALTER TABLE iam.accounts ADD COLUMN competence_languages text[] NOT NULL DEFAULT '{}';
ALTER TABLE iam.accounts ADD CONSTRAINT accounts_competence_languages_count_chk CHECK (cardinality(competence_languages) <= 40);

-- +goose Down
ALTER TABLE iam.accounts DROP COLUMN competence_languages;
