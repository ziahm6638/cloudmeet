-- Password login for the single admin user.
-- Google Workspace for the admin domain was retired, so OAuth is no longer a
-- usable sign-in path; the Google routes remain for calendar connection only.
ALTER TABLE users ADD COLUMN password_hash TEXT;
