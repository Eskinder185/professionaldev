ALTER TABLE application_users ADD COLUMN issuer VARCHAR(500);

UPDATE application_users SET issuer = 'local-dev' WHERE issuer IS NULL;

ALTER TABLE application_users ALTER COLUMN issuer SET NOT NULL;
ALTER TABLE application_users DROP CONSTRAINT uk_application_users_subject;

ALTER TABLE application_users
    ADD CONSTRAINT uk_application_users_issuer_subject UNIQUE (issuer, subject),
    ADD CONSTRAINT ck_application_users_issuer_not_blank CHECK (btrim(issuer) <> '');
