-- Funding Application Platform - Test Data
-- Seed 001: Sample Data for Development/Testing
-- Created: 2026-01-29
-- WARNING: This is test data only. Do not use in production.

-- =============================================================================
-- CLEAR EXISTING DATA (if any)
-- =============================================================================

TRUNCATE TABLE
    audit_logs,
    notification_logs,
    sessions,
    assessments,
    assignments,
    call_assessor_pool,
    confirmations,
    application_files,
    applications,
    assessors,
    funding_calls,
    users
CASCADE;

-- =============================================================================
-- USERS
-- =============================================================================

-- Password for all test users: "TestPassword123!" (bcrypt hash)
-- In production, use proper password hashing with unique salts

INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES
-- Coordinators
('11111111-1111-1111-1111-111111111111', 'coordinator@example.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'James Wilson', 'coordinator', TRUE, NOW() - INTERVAL '90 days'),
('11111111-1111-1111-1111-111111111112', 'admin@example.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Sarah Admin', 'admin', TRUE, NOW() - INTERVAL '120 days'),

-- Assessors (also have user accounts)
('22222222-2222-2222-2222-222222222221', 'maria.assessor@tech.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Maria Garcia', 'assessor', TRUE, NOW() - INTERVAL '60 days'),
('22222222-2222-2222-2222-222222222222', 'john.reviewer@finance.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'John Smith', 'assessor', TRUE, NOW() - INTERVAL '45 days'),
('22222222-2222-2222-2222-222222222223', 'lisa.expert@innovation.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Lisa Chen', 'assessor', TRUE, NOW() - INTERVAL '30 days'),

-- Applicants
('33333333-3333-3333-3333-333333333331', 'sarah.applicant@startup.io', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Sarah Thompson', 'applicant', TRUE, NOW() - INTERVAL '14 days'),
('33333333-3333-3333-3333-333333333332', 'david.founder@greentech.uk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'David Green', 'applicant', TRUE, NOW() - INTERVAL '10 days'),
('33333333-3333-3333-3333-333333333333', 'emma.ceo@healthinnovate.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Emma Roberts', 'applicant', TRUE, NOW() - INTERVAL '7 days'),
('33333333-3333-3333-3333-333333333334', 'michael.tech@aiventures.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Michael Brown', 'applicant', TRUE, NOW() - INTERVAL '5 days'),
('33333333-3333-3333-3333-333333333335', 'anna.director@socialimpact.org', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Anna Williams', 'applicant', TRUE, NOW() - INTERVAL '3 days'),

-- Scheme Owner (read-only oversight)
('44444444-4444-4444-4444-444444444441', 'director@fundingbody.gov.uk', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDAX.jZxZcIAa', 'Richard Director', 'scheme_owner', TRUE, NOW() - INTERVAL '180 days');

-- =============================================================================
-- FUNDING CALLS
-- =============================================================================

INSERT INTO funding_calls (id, name, description, open_at, close_at, status, requirements, criteria_config, retention_policy, edi_form_url, created_by) VALUES
-- Call 1: Closed call with completed assessments
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Innovation Growth Fund 2025',
 'Supporting innovative SMEs with growth potential. Grants of £50,000 to £250,000 available for technology-focused businesses.',
 NOW() - INTERVAL '60 days',
 NOW() - INTERVAL '30 days',
 'completed',
 '{
   "allowed_file_types": ["pdf", "docx"],
   "max_file_size_mb": 25,
   "required_confirmations": ["guidance_read", "edi_completed", "data_sharing_consent"],
   "guidance_text": "Please read the full guidance document before applying.",
   "guidance_url": "https://example.org/guidance/innovation-2025"
 }'::jsonb,
 '{
   "criteria": [
     {"id": "c1", "name": "Innovation & Technology", "description": "Degree of innovation and technological advancement", "max_points": 10, "weight": 1.5, "comments_required": true},
     {"id": "c2", "name": "Market Opportunity", "description": "Size and accessibility of target market", "max_points": 10, "weight": 1.0, "comments_required": true},
     {"id": "c3", "name": "Team Capability", "description": "Experience and skills of the team", "max_points": 10, "weight": 1.0, "comments_required": false},
     {"id": "c4", "name": "Financial Viability", "description": "Realistic financial projections and sustainability", "max_points": 10, "weight": 1.25, "comments_required": true},
     {"id": "c5", "name": "Impact Potential", "description": "Economic and social impact potential", "max_points": 10, "weight": 1.0, "comments_required": false}
   ],
   "assessors_per_application": 2,
   "variance_threshold": 3.0
 }'::jsonb,
 7,
 'https://example.org/edi-form',
 '11111111-1111-1111-1111-111111111111'),

-- Call 2: Currently in assessment phase
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'Green Technology Challenge 2026',
 'Funding for businesses developing sustainable technology solutions. Focus on carbon reduction and environmental impact.',
 NOW() - INTERVAL '45 days',
 NOW() - INTERVAL '7 days',
 'in_assessment',
 '{
   "allowed_file_types": ["pdf"],
   "max_file_size_mb": 50,
   "required_confirmations": ["guidance_read", "edi_completed", "data_sharing_consent"],
   "guidance_text": "Applications must demonstrate measurable environmental impact.",
   "guidance_url": "https://example.org/guidance/green-tech-2026"
 }'::jsonb,
 '{
   "criteria": [
     {"id": "g1", "name": "Environmental Impact", "description": "Potential for carbon reduction and environmental benefit", "max_points": 15, "weight": 2.0, "comments_required": true},
     {"id": "g2", "name": "Technical Feasibility", "description": "Technical approach and implementation plan", "max_points": 10, "weight": 1.0, "comments_required": true},
     {"id": "g3", "name": "Scalability", "description": "Potential for scale and wider adoption", "max_points": 10, "weight": 1.0, "comments_required": false},
     {"id": "g4", "name": "Value for Money", "description": "Cost-effectiveness and efficiency", "max_points": 10, "weight": 1.0, "comments_required": true}
   ],
   "assessors_per_application": 2,
   "variance_threshold": 4.0
 }'::jsonb,
 7,
 'https://example.org/edi-form',
 '11111111-1111-1111-1111-111111111111'),

-- Call 3: Currently open for applications
('cccccccc-cccc-cccc-cccc-cccccccccccc',
 'Digital Skills Accelerator 2026',
 'Supporting organisations delivering digital skills training. Grants up to £100,000 for training programme delivery.',
 NOW() - INTERVAL '14 days',
 NOW() + INTERVAL '21 days',
 'open',
 '{
   "allowed_file_types": ["pdf", "docx", "xlsx"],
   "max_file_size_mb": 30,
   "required_confirmations": ["guidance_read", "data_sharing_consent"],
   "guidance_text": "Applicants must demonstrate existing capability in training delivery.",
   "guidance_url": "https://example.org/guidance/digital-skills-2026"
 }'::jsonb,
 '{
   "criteria": [
     {"id": "d1", "name": "Training Programme Quality", "description": "Quality and relevance of proposed training content", "max_points": 10, "weight": 1.5, "comments_required": true},
     {"id": "d2", "name": "Delivery Capability", "description": "Track record and capacity to deliver", "max_points": 10, "weight": 1.0, "comments_required": true},
     {"id": "d3", "name": "Reach & Accessibility", "description": "Plans to reach underserved communities", "max_points": 10, "weight": 1.25, "comments_required": false},
     {"id": "d4", "name": "Sustainability", "description": "Long-term sustainability of the programme", "max_points": 10, "weight": 1.0, "comments_required": false}
   ],
   "assessors_per_application": 2,
   "variance_threshold": 3.5
 }'::jsonb,
 7,
 'https://example.org/edi-form',
 '11111111-1111-1111-1111-111111111111'),

-- Call 4: Draft (not yet open)
('dddddddd-dddd-dddd-dddd-dddddddddddd',
 'Healthcare Innovation Fund 2026',
 'Funding for healthcare technology innovations. Focus on patient outcomes and NHS integration.',
 NOW() + INTERVAL '30 days',
 NOW() + INTERVAL '90 days',
 'draft',
 '{
   "allowed_file_types": ["pdf"],
   "max_file_size_mb": 40,
   "required_confirmations": ["guidance_read", "edi_completed", "data_sharing_consent"],
   "guidance_text": "Applications must address NHS compatibility requirements."
 }'::jsonb,
 '{
   "criteria": [
     {"id": "h1", "name": "Clinical Impact", "description": "Potential to improve patient outcomes", "max_points": 15, "weight": 2.0, "comments_required": true},
     {"id": "h2", "name": "NHS Integration", "description": "Feasibility of integration with NHS systems", "max_points": 10, "weight": 1.5, "comments_required": true},
     {"id": "h3", "name": "Evidence Base", "description": "Strength of clinical evidence", "max_points": 10, "weight": 1.0, "comments_required": true}
   ],
   "assessors_per_application": 3,
   "variance_threshold": 3.0
 }'::jsonb,
 10,
 'https://example.org/edi-form',
 '11111111-1111-1111-1111-111111111111');

-- =============================================================================
-- ASSESSORS
-- =============================================================================

INSERT INTO assessors (id, user_id, name, email, organisation, expertise_tags, is_active, invited_at, invitation_accepted_at) VALUES
('55555555-5555-5555-5555-555555555551', '22222222-2222-2222-2222-222222222221', 'Maria Garcia', 'maria.assessor@tech.org', 'Tech Research Institute', '["technology", "innovation", "software"]'::jsonb, TRUE, NOW() - INTERVAL '90 days', NOW() - INTERVAL '89 days'),
('55555555-5555-5555-5555-555555555552', '22222222-2222-2222-2222-222222222222', 'John Smith', 'john.reviewer@finance.org', 'Financial Advisory Ltd', '["finance", "business", "growth"]'::jsonb, TRUE, NOW() - INTERVAL '90 days', NOW() - INTERVAL '88 days'),
('55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222223', 'Lisa Chen', 'lisa.expert@innovation.co', 'Innovation Consulting', '["innovation", "technology", "sustainability"]'::jsonb, TRUE, NOW() - INTERVAL '60 days', NOW() - INTERVAL '59 days'),
('55555555-5555-5555-5555-555555555554', NULL, 'Robert Johnson', 'robert.j@external-review.com', 'External Review Services', '["technology", "market-analysis"]'::jsonb, TRUE, NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days'),
('55555555-5555-5555-5555-555555555555', NULL, 'Patricia Davis', 'p.davis@green-consulting.org', 'Green Consulting Group', '["sustainability", "environment", "policy"]'::jsonb, TRUE, NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days');

-- =============================================================================
-- CALL ASSESSOR POOLS
-- =============================================================================

INSERT INTO call_assessor_pool (call_id, assessor_id, added_at, added_by) VALUES
-- Innovation Growth Fund 2025 assessors
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555551', NOW() - INTERVAL '55 days', '11111111-1111-1111-1111-111111111111'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555552', NOW() - INTERVAL '55 days', '11111111-1111-1111-1111-111111111111'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '50 days', '11111111-1111-1111-1111-111111111111'),

-- Green Technology Challenge 2026 assessors
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '40 days', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555554', NOW() - INTERVAL '40 days', '11111111-1111-1111-1111-111111111111'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '40 days', '11111111-1111-1111-1111-111111111111'),

-- Digital Skills Accelerator 2026 assessors
('cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555551', NOW() - INTERVAL '10 days', '11111111-1111-1111-1111-111111111111'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555552', NOW() - INTERVAL '10 days', '11111111-1111-1111-1111-111111111111');

-- =============================================================================
-- APPLICATIONS
-- =============================================================================

INSERT INTO applications (id, call_id, applicant_id, applicant_name, applicant_email, applicant_organisation, reference_number, status, submitted_at, created_at) VALUES
-- Innovation Growth Fund 2025 applications (completed call)
('66666666-6666-6666-6666-666666666661', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333331', 'Sarah Thompson', 'sarah.applicant@startup.io', 'TechStart Ltd', 'INNO-2025-0001', 'submitted', NOW() - INTERVAL '35 days', NOW() - INTERVAL '40 days'),
('66666666-6666-6666-6666-666666666662', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333332', 'David Green', 'david.founder@greentech.uk', 'GreenTech Solutions', 'INNO-2025-0002', 'submitted', NOW() - INTERVAL '33 days', NOW() - INTERVAL '38 days'),
('66666666-6666-6666-6666-666666666663', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Emma Roberts', 'emma.ceo@healthinnovate.org', 'HealthInnovate CIC', 'INNO-2025-0003', 'submitted', NOW() - INTERVAL '31 days', NOW() - INTERVAL '36 days'),

-- Green Technology Challenge 2026 applications (in assessment)
('66666666-6666-6666-6666-666666666664', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333332', 'David Green', 'david.founder@greentech.uk', 'GreenTech Solutions', 'GREE-2026-0001', 'submitted', NOW() - INTERVAL '10 days', NOW() - INTERVAL '20 days'),
('66666666-6666-6666-6666-666666666665', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333334', 'Michael Brown', 'michael.tech@aiventures.com', 'AI Ventures', 'GREE-2026-0002', 'submitted', NOW() - INTERVAL '9 days', NOW() - INTERVAL '18 days'),
('66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333335', 'Anna Williams', 'anna.director@socialimpact.org', 'Social Impact Foundation', 'GREE-2026-0003', 'submitted', NOW() - INTERVAL '8 days', NOW() - INTERVAL '15 days'),

-- Digital Skills Accelerator 2026 applications (open call - mix of draft and submitted)
('66666666-6666-6666-6666-666666666667', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Emma Roberts', 'emma.ceo@healthinnovate.org', 'HealthInnovate CIC', 'DIGI-2026-0001', 'submitted', NOW() - INTERVAL '3 days', NOW() - INTERVAL '7 days'),
('66666666-6666-6666-6666-666666666668', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333334', 'Michael Brown', 'michael.tech@aiventures.com', 'AI Ventures', 'DIGI-2026-0002', 'draft', NULL, NOW() - INTERVAL '2 days'),
('66666666-6666-6666-6666-666666666669', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333335', 'Anna Williams', 'anna.director@socialimpact.org', 'Social Impact Foundation', NULL, 'draft', NULL, NOW() - INTERVAL '1 day');

-- =============================================================================
-- APPLICATION FILES
-- =============================================================================

INSERT INTO application_files (id, application_id, filename, original_filename, file_path, file_size, mime_type, file_hash, scan_status, scanned_at, is_primary, category, uploaded_at) VALUES
-- Application 1 files
('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661', 'app_66666661_form.pdf', 'TechStart_Application_Form.pdf', 's3://funding-files/2025/01/app_66666661_form.pdf', 2500000, 'application/pdf', 'a1b2c3d4e5f6...', 'clean', NOW() - INTERVAL '35 days', TRUE, 'application_form', NOW() - INTERVAL '40 days'),
('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666661', 'app_66666661_pitch.pdf', 'TechStart_Pitch_Deck.pdf', 's3://funding-files/2025/01/app_66666661_pitch.pdf', 5000000, 'application/pdf', 'b2c3d4e5f6g7...', 'clean', NOW() - INTERVAL '35 days', FALSE, 'pitch_deck', NOW() - INTERVAL '39 days'),

-- Application 2 files
('77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666662', 'app_66666662_form.pdf', 'GreenTech_Application.pdf', 's3://funding-files/2025/01/app_66666662_form.pdf', 3200000, 'application/pdf', 'c3d4e5f6g7h8...', 'clean', NOW() - INTERVAL '33 days', TRUE, 'application_form', NOW() - INTERVAL '35 days'),
('77777777-7777-7777-7777-777777777774', '66666666-6666-6666-6666-666666666662', 'app_66666662_support.pdf', 'Letter_of_Support.pdf', 's3://funding-files/2025/01/app_66666662_support.pdf', 500000, 'application/pdf', 'd4e5f6g7h8i9...', 'clean', NOW() - INTERVAL '33 days', FALSE, 'support_letter', NOW() - INTERVAL '34 days'),

-- Application 3 files
('77777777-7777-7777-7777-777777777775', '66666666-6666-6666-6666-666666666663', 'app_66666663_form.pdf', 'HealthInnovate_Application.pdf', 's3://funding-files/2025/01/app_66666663_form.pdf', 2800000, 'application/pdf', 'e5f6g7h8i9j0...', 'clean', NOW() - INTERVAL '31 days', TRUE, 'application_form', NOW() - INTERVAL '33 days'),

-- Application 4 files (Green Tech)
('77777777-7777-7777-7777-777777777776', '66666666-6666-6666-6666-666666666664', 'app_66666664_form.pdf', 'GreenTech_GreenChallenge.pdf', 's3://funding-files/2026/01/app_66666664_form.pdf', 4100000, 'application/pdf', 'f6g7h8i9j0k1...', 'clean', NOW() - INTERVAL '10 days', TRUE, 'application_form', NOW() - INTERVAL '12 days'),
('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666664', 'app_66666664_impact.pdf', 'Environmental_Impact_Assessment.pdf', 's3://funding-files/2026/01/app_66666664_impact.pdf', 1500000, 'application/pdf', 'g7h8i9j0k1l2...', 'clean', NOW() - INTERVAL '10 days', FALSE, 'supporting_document', NOW() - INTERVAL '11 days'),

-- Application 5 files
('77777777-7777-7777-7777-777777777778', '66666666-6666-6666-6666-666666666665', 'app_66666665_form.pdf', 'AIVentures_Application.pdf', 's3://funding-files/2026/01/app_66666665_form.pdf', 3500000, 'application/pdf', 'h8i9j0k1l2m3...', 'clean', NOW() - INTERVAL '9 days', TRUE, 'application_form', NOW() - INTERVAL '11 days'),

-- Application 6 files
('77777777-7777-7777-7777-777777777779', '66666666-6666-6666-6666-666666666666', 'app_66666666_form.pdf', 'SocialImpact_GreenApp.pdf', 's3://funding-files/2026/01/app_66666666_form.pdf', 2900000, 'application/pdf', 'i9j0k1l2m3n4...', 'clean', NOW() - INTERVAL '8 days', TRUE, 'application_form', NOW() - INTERVAL '10 days'),

-- Application 7 files (Digital Skills)
('77777777-7777-7777-7777-77777777777a', '66666666-6666-6666-6666-666666666667', 'app_66666667_form.pdf', 'HealthInnovate_DigitalSkills.pdf', 's3://funding-files/2026/01/app_66666667_form.pdf', 2200000, 'application/pdf', 'j0k1l2m3n4o5...', 'clean', NOW() - INTERVAL '3 days', TRUE, 'application_form', NOW() - INTERVAL '5 days'),

-- Application 8 files (draft)
('77777777-7777-7777-7777-77777777777b', '66666666-6666-6666-6666-666666666668', 'app_66666668_draft.pdf', 'AIVentures_Draft.pdf', 's3://funding-files/2026/01/app_66666668_draft.pdf', 1800000, 'application/pdf', 'k1l2m3n4o5p6...', 'clean', NOW() - INTERVAL '1 day', TRUE, 'application_form', NOW() - INTERVAL '2 days');

-- =============================================================================
-- CONFIRMATIONS
-- =============================================================================

INSERT INTO confirmations (application_id, type, confirmed_at, ip_address) VALUES
-- Application 1 confirmations
('66666666-6666-6666-6666-666666666661', 'guidance_read', NOW() - INTERVAL '35 days', '192.168.1.100'),
('66666666-6666-6666-6666-666666666661', 'edi_completed', NOW() - INTERVAL '35 days', '192.168.1.100'),
('66666666-6666-6666-6666-666666666661', 'data_sharing_consent', NOW() - INTERVAL '35 days', '192.168.1.100'),

-- Application 2 confirmations
('66666666-6666-6666-6666-666666666662', 'guidance_read', NOW() - INTERVAL '33 days', '10.0.0.50'),
('66666666-6666-6666-6666-666666666662', 'edi_completed', NOW() - INTERVAL '33 days', '10.0.0.50'),
('66666666-6666-6666-6666-666666666662', 'data_sharing_consent', NOW() - INTERVAL '33 days', '10.0.0.50'),

-- Application 3 confirmations
('66666666-6666-6666-6666-666666666663', 'guidance_read', NOW() - INTERVAL '31 days', '172.16.0.25'),
('66666666-6666-6666-6666-666666666663', 'edi_completed', NOW() - INTERVAL '31 days', '172.16.0.25'),
('66666666-6666-6666-6666-666666666663', 'data_sharing_consent', NOW() - INTERVAL '31 days', '172.16.0.25'),

-- Application 4 confirmations (Green Tech)
('66666666-6666-6666-6666-666666666664', 'guidance_read', NOW() - INTERVAL '10 days', '10.0.0.50'),
('66666666-6666-6666-6666-666666666664', 'edi_completed', NOW() - INTERVAL '10 days', '10.0.0.50'),
('66666666-6666-6666-6666-666666666664', 'data_sharing_consent', NOW() - INTERVAL '10 days', '10.0.0.50'),

-- Application 5 confirmations
('66666666-6666-6666-6666-666666666665', 'guidance_read', NOW() - INTERVAL '9 days', '192.168.2.200'),
('66666666-6666-6666-6666-666666666665', 'edi_completed', NOW() - INTERVAL '9 days', '192.168.2.200'),
('66666666-6666-6666-6666-666666666665', 'data_sharing_consent', NOW() - INTERVAL '9 days', '192.168.2.200'),

-- Application 6 confirmations
('66666666-6666-6666-6666-666666666666', 'guidance_read', NOW() - INTERVAL '8 days', '10.10.10.10'),
('66666666-6666-6666-6666-666666666666', 'edi_completed', NOW() - INTERVAL '8 days', '10.10.10.10'),
('66666666-6666-6666-6666-666666666666', 'data_sharing_consent', NOW() - INTERVAL '8 days', '10.10.10.10'),

-- Application 7 confirmations (Digital Skills)
('66666666-6666-6666-6666-666666666667', 'guidance_read', NOW() - INTERVAL '3 days', '172.16.0.25'),
('66666666-6666-6666-6666-666666666667', 'data_sharing_consent', NOW() - INTERVAL '3 days', '172.16.0.25');

-- =============================================================================
-- ASSIGNMENTS
-- =============================================================================

INSERT INTO assignments (id, application_id, assessor_id, assigned_at, assigned_by, due_at, status, first_viewed_at) VALUES
-- Innovation Growth Fund 2025 assignments (completed)
('88888888-8888-8888-8888-888888888881', '66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '27 days'),
('88888888-8888-8888-8888-888888888882', '66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555552', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '26 days'),
('88888888-8888-8888-8888-888888888883', '66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555551', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '25 days'),
('88888888-8888-8888-8888-888888888884', '66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '27 days'),
('88888888-8888-8888-8888-888888888885', '66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555552', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '26 days'),
('88888888-8888-8888-8888-888888888886', '66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '28 days', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '14 days', 'completed', NOW() - INTERVAL '25 days'),

-- Green Technology Challenge 2026 assignments (in progress)
('88888888-8888-8888-8888-888888888887', '66666666-6666-6666-6666-666666666664', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'completed', NOW() - INTERVAL '4 days'),
('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666664', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'in_progress', NOW() - INTERVAL '3 days'),
('88888888-8888-8888-8888-888888888889', '66666666-6666-6666-6666-666666666665', '55555555-5555-5555-5555-555555555554', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'in_progress', NOW() - INTERVAL '2 days'),
('88888888-8888-8888-8888-88888888888a', '66666666-6666-6666-6666-666666666665', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'assigned', NULL),
('88888888-8888-8888-8888-88888888888b', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555553', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'assigned', NULL),
('88888888-8888-8888-8888-88888888888c', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555554', NOW() - INTERVAL '5 days', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '9 days', 'assigned', NULL);

-- =============================================================================
-- ASSESSMENTS
-- =============================================================================

INSERT INTO assessments (id, assignment_id, scores_json, overall_score, comments, coi_confirmed, status, submitted_at) VALUES
-- Innovation Growth Fund 2025 assessments (all completed)
('99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888881',
 '{"c1": {"score": 9, "comment": "Highly innovative AI-driven approach"}, "c2": {"score": 8, "comment": "Strong market opportunity"}, "c3": {"score": 7, "comment": "Capable team"}, "c4": {"score": 8, "comment": "Solid financials"}, "c5": {"score": 8, "comment": "Good potential impact"}}'::jsonb,
 40.00, 'Strong application overall. Recommend for funding.', TRUE, 'submitted', NOW() - INTERVAL '20 days'),

('99999999-9999-9999-9999-999999999992', '88888888-8888-8888-8888-888888888882',
 '{"c1": {"score": 8, "comment": "Good innovation level"}, "c2": {"score": 7, "comment": "Market needs validation"}, "c3": {"score": 8, "comment": "Experienced team"}, "c4": {"score": 7, "comment": "Some financial concerns"}, "c5": {"score": 7, "comment": "Moderate impact"}}'::jsonb,
 37.00, 'Good application but needs market validation work.', TRUE, 'submitted', NOW() - INTERVAL '18 days'),

('99999999-9999-9999-9999-999999999993', '88888888-8888-8888-8888-888888888883',
 '{"c1": {"score": 8, "comment": "Green technology innovation"}, "c2": {"score": 9, "comment": "Large addressable market"}, "c3": {"score": 8, "comment": "Strong technical team"}, "c4": {"score": 8, "comment": "Realistic projections"}, "c5": {"score": 9, "comment": "High environmental impact"}}'::jsonb,
 42.00, 'Excellent application with strong environmental focus.', TRUE, 'submitted', NOW() - INTERVAL '19 days'),

('99999999-9999-9999-9999-999999999994', '88888888-8888-8888-8888-888888888884',
 '{"c1": {"score": 7, "comment": "Solid but incremental innovation"}, "c2": {"score": 8, "comment": "Growing market"}, "c3": {"score": 9, "comment": "Very experienced founders"}, "c4": {"score": 8, "comment": "Good financial planning"}, "c5": {"score": 8, "comment": "Good impact potential"}}'::jsonb,
 40.00, 'Recommend funding. Strong team compensates for moderate innovation.', TRUE, 'submitted', NOW() - INTERVAL '17 days'),

('99999999-9999-9999-9999-999999999995', '88888888-8888-8888-8888-888888888885',
 '{"c1": {"score": 9, "comment": "Healthcare AI innovation"}, "c2": {"score": 7, "comment": "Regulated market challenges"}, "c3": {"score": 8, "comment": "Clinical expertise"}, "c4": {"score": 6, "comment": "Long path to revenue"}, "c5": {"score": 9, "comment": "High social impact"}}'::jsonb,
 39.00, 'Promising healthcare application with regulatory pathway challenges.', TRUE, 'submitted', NOW() - INTERVAL '16 days'),

('99999999-9999-9999-9999-999999999996', '88888888-8888-8888-8888-888888888886',
 '{"c1": {"score": 8, "comment": "Good healthcare innovation"}, "c2": {"score": 6, "comment": "Niche market"}, "c3": {"score": 7, "comment": "Clinical but limited business experience"}, "c4": {"score": 7, "comment": "Needs more detail"}, "c5": {"score": 9, "comment": "Strong patient benefit"}}'::jsonb,
 37.00, 'Decent application but business planning needs work.', TRUE, 'submitted', NOW() - INTERVAL '15 days'),

-- Green Technology Challenge 2026 assessments (mixed status)
('99999999-9999-9999-9999-999999999997', '88888888-8888-8888-8888-888888888887',
 '{"g1": {"score": 14, "comment": "Excellent carbon reduction potential"}, "g2": {"score": 9, "comment": "Technically sound"}, "g3": {"score": 8, "comment": "Good scalability"}, "g4": {"score": 8, "comment": "Cost-effective solution"}}'::jsonb,
 39.00, 'Outstanding green technology application. Highly recommend.', TRUE, 'submitted', NOW() - INTERVAL '2 days'),

('99999999-9999-9999-9999-999999999998', '88888888-8888-8888-8888-888888888888',
 '{"g1": {"score": 12, "comment": "Good environmental impact"}, "g2": {"score": 7, "comment": "Some technical risks"}, "g3": {"score": 0, "comment": ""}, "g4": {"score": 0, "comment": ""}}'::jsonb,
 NULL, 'Draft in progress - need to complete review.', FALSE, 'draft', NULL),

('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888889',
 '{"g1": {"score": 10, "comment": "Moderate environmental benefit"}, "g2": {"score": 8, "comment": "Well planned"}, "g3": {"score": 7, "comment": "Limited scalability"}, "g4": {"score": 0, "comment": ""}}'::jsonb,
 NULL, 'Reviewing financials section.', FALSE, 'draft', NULL);

-- =============================================================================
-- AUDIT LOGS (Sample entries)
-- =============================================================================

INSERT INTO audit_logs (actor_id, actor_role, actor_email, action, target_type, target_id, details, ip_address, timestamp) VALUES
-- Call creation
('11111111-1111-1111-1111-111111111111', 'coordinator', 'coordinator@example.org', 'call.created', 'funding_call', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"name": "Innovation Growth Fund 2025"}'::jsonb, '10.0.0.1', NOW() - INTERVAL '90 days'),

-- Application submissions
('33333333-3333-3333-3333-333333333331', 'applicant', 'sarah.applicant@startup.io', 'application.submitted', 'application', '66666666-6666-6666-6666-666666666661', '{"reference": "INNO-2025-0001"}'::jsonb, '192.168.1.100', NOW() - INTERVAL '35 days'),
('33333333-3333-3333-3333-333333333332', 'applicant', 'david.founder@greentech.uk', 'application.submitted', 'application', '66666666-6666-6666-6666-666666666662', '{"reference": "INNO-2025-0002"}'::jsonb, '10.0.0.50', NOW() - INTERVAL '33 days'),

-- Assessor assignments
('11111111-1111-1111-1111-111111111111', 'coordinator', 'coordinator@example.org', 'assignment.created', 'assignment', '88888888-8888-8888-8888-888888888881', '{"assessor": "Maria Garcia", "application": "INNO-2025-0001"}'::jsonb, '10.0.0.1', NOW() - INTERVAL '28 days'),

-- Assessment submissions
('22222222-2222-2222-2222-222222222221', 'assessor', 'maria.assessor@tech.org', 'assessment.submitted', 'assessment', '99999999-9999-9999-9999-999999999991', '{"overall_score": 40.00, "application": "INNO-2025-0001"}'::jsonb, '192.168.5.10', NOW() - INTERVAL '20 days'),

-- File downloads
('11111111-1111-1111-1111-111111111111', 'coordinator', 'coordinator@example.org', 'file.downloaded', 'application_file', '77777777-7777-7777-7777-777777777771', '{"filename": "TechStart_Application_Form.pdf"}'::jsonb, '10.0.0.1', NOW() - INTERVAL '25 days'),

-- Login events
('11111111-1111-1111-1111-111111111111', 'coordinator', 'coordinator@example.org', 'user.login', 'user', '11111111-1111-1111-1111-111111111111', '{"method": "password"}'::jsonb, '10.0.0.1', NOW() - INTERVAL '1 day'),
('22222222-2222-2222-2222-222222222221', 'assessor', 'maria.assessor@tech.org', 'user.login', 'user', '22222222-2222-2222-2222-222222222221', '{"method": "password"}'::jsonb, '192.168.5.10', NOW() - INTERVAL '2 days');

-- =============================================================================
-- NOTIFICATION LOGS (Sample entries)
-- =============================================================================

INSERT INTO notification_logs (recipient_email, recipient_id, notification_type, subject, call_id, application_id, external_message_id, status, sent_at, delivered_at) VALUES
-- Submission receipts
('sarah.applicant@startup.io', '33333333-3333-3333-3333-333333333331', 'submission_receipt', 'Application Received: INNO-2025-0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666661', 'msg_001_abc123', 'delivered', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days' + INTERVAL '30 seconds'),
('david.founder@greentech.uk', '33333333-3333-3333-3333-333333333332', 'submission_receipt', 'Application Received: INNO-2025-0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666662', 'msg_002_def456', 'delivered', NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days' + INTERVAL '25 seconds'),

-- Assignment notifications
('maria.assessor@tech.org', '22222222-2222-2222-2222-222222222221', 'assignment', 'New Assessment Assignment: Innovation Growth Fund 2025', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'msg_003_ghi789', 'delivered', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days' + INTERVAL '20 seconds'),
('john.reviewer@finance.org', '22222222-2222-2222-2222-222222222222', 'assignment', 'New Assessment Assignment: Innovation Growth Fund 2025', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'msg_004_jkl012', 'delivered', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days' + INTERVAL '22 seconds'),

-- Reminder emails
('p.davis@green-consulting.org', NULL, 'reminder', 'Assessment Reminder: Green Technology Challenge 2026', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'msg_005_mno345', 'sent', NOW() - INTERVAL '1 day', NULL);

-- =============================================================================
-- VERIFICATION QUERIES (Run these to verify seed data)
-- =============================================================================

-- Uncomment to run verification:
/*
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'Funding Calls', COUNT(*) FROM funding_calls
UNION ALL SELECT 'Applications', COUNT(*) FROM applications
UNION ALL SELECT 'Application Files', COUNT(*) FROM application_files
UNION ALL SELECT 'Confirmations', COUNT(*) FROM confirmations
UNION ALL SELECT 'Assessors', COUNT(*) FROM assessors
UNION ALL SELECT 'Call Assessor Pool', COUNT(*) FROM call_assessor_pool
UNION ALL SELECT 'Assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'Assessments', COUNT(*) FROM assessments
UNION ALL SELECT 'Audit Logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'Notification Logs', COUNT(*) FROM notification_logs;
*/
