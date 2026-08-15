-- Reinstate the forced credential-change flag for existing users. This reverses
-- the earlier opt_out migration so every user is asked to update their email and
-- password on their next sign-in.
UPDATE "User" SET "mustChangePassword" = true WHERE "mustChangePassword" = false;
