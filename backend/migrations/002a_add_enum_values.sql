-- JSAN 2025 - Migration 002a
-- ⚠️ EXÉCUTER CE FICHIER SEUL, puis valider (Run).
-- Ne pas enchaîner avec 002b dans la même requête.
--
-- PostgreSQL exige que les nouvelles valeurs d'enum soient
-- commitées avant d'être utilisées dans des fonctions/policies.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'participant';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organisateur';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
