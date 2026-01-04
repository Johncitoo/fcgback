-- Fix UUID defaults using gen_random_uuid() (PostgreSQL 10+ native function)
-- This fixes the NOT NULL violation errors when inserting without providing id

-- Main entity tables
ALTER TABLE admin_verification_codes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE applicants ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_background_checks ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_committee_evaluations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_documents ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_evaluations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_interview_panelists ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_interviews ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_milestones ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_presentations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE application_social_media ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE applications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_documents ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_eligibility_criterias ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_evaluation_criterias ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_evaluation_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE call_institutions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE calls ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE committee_members ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE email_batches ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE email_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE email_quota_tracking ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE email_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE files_metadata ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE form_field_responses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE form_fields ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE form_submissions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE forms ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE institutions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE interview_schedules ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE invites ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE milestones ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE refresh_token_whitelist ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reviewer_assignments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_invitations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
