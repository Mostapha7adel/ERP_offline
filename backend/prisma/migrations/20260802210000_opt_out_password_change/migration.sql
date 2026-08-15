-- Reset the forced password-change flag for existing users. New installs seed
-- mustChangePassword=false already; this brings existing databases in line so
-- no user is asked to change their password on next sign-in.
UPDATE "User" SET "mustChangePassword" = false WHERE "mustChangePassword" = true;
