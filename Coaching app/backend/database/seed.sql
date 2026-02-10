-- Seed data for development and testing

-- Insert default program modules
INSERT INTO program_modules (module_key, module_name, description, is_default) VALUES
('dashboard', 'Dashboard', 'Main dashboard with client overview and statistics', true),
('client_management', 'Client Management', 'Create, edit, and manage client profiles', true),
('journey_steps', 'Journey Steps', 'Track client progress through coaching journey', true),
('gauges', 'Cockpit Gauges', 'Visual gauge system for client assessments', true),
('ai_assistant', 'AI Assistant Coach', 'AI-powered coaching assistant', false),
('advanced_analytics', 'Advanced Analytics', 'Detailed reports and trend analysis', false),
('group_coaching', 'Group Coaching', 'Manage group coaching sessions', false),
('assessments', 'Assessments & Ecochart', 'Psychological assessments and eco-chart tools', false),
('mlnp', 'MLNP (Gesigkaarte)', 'MLNP facial expression mapping tool', false),
('reports', 'Report Generation', 'Generate and export coaching reports', false),
('training_library', 'Training Library', 'Access to training materials and resources', false);

-- Note: User passwords should be hashed in production
-- Default password for all demo users: "CoachingApp2025!"
-- This is bcrypt hash of "CoachingApp2025!"
-- In production, generate this using: bcryptjs.hash('your_password', 10)

-- Insert admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) VALUES
('admin@coachingapp.com', '$2a$10$YourHashedPasswordHere', 'Admin', 'User', 'admin', true);

-- Insert sample coaches
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) VALUES
('coach1@example.com', '$2a$10$YourHashedPasswordHere', 'Sarah', 'Johnson', 'coach', true),
('coach2@example.com', '$2a$10$YourHashedPasswordHere', 'Michael', 'Chen', 'coach', true);

-- Enable all default modules for coaches (coach_id 2 and 3)
INSERT INTO coach_program_access (coach_id, module_id, is_enabled, enabled_by)
SELECT
    u.id as coach_id,
    pm.id as module_id,
    true as is_enabled,
    1 as enabled_by
FROM users u
CROSS JOIN program_modules pm
WHERE u.role = 'coach' AND pm.is_default = true;

-- Enable AI assistant for coach 1 only (as an example)
INSERT INTO coach_program_access (coach_id, module_id, is_enabled, enabled_by)
SELECT 2, id, true, 1 FROM program_modules WHERE module_key = 'ai_assistant';

-- Sample clients for coach 1 (Sarah Johnson)
INSERT INTO clients (coach_id, name, email, preferred_lang, status, dream, current_step, progress_completed, progress_total, last_session) VALUES
(2, 'Lia van der Merwe', 'lia@example.com', 'Afrikaans', 'active', 'Build a successful freelance business and achieve work-life balance', 3, 3, 15, CURRENT_DATE - INTERVAL '2 days'),
(2, 'Johan Smith', 'johan@example.com', 'English', 'active', 'Transition to executive leadership role', 5, 5, 15, CURRENT_DATE - INTERVAL '5 days'),
(2, 'Maria Santos', 'maria@example.com', 'English', 'active', 'Overcome anxiety and build confidence', 2, 2, 15, CURRENT_DATE - INTERVAL '1 day');

-- Sample clients for coach 2 (Michael Chen)
INSERT INTO clients (coach_id, name, email, preferred_lang, status, dream, current_step, progress_completed, progress_total, last_session) VALUES
(3, 'Alex Thompson', 'alex@example.com', 'English', 'active', 'Launch tech startup and scale to profitability', 4, 4, 15, CURRENT_DATE - INTERVAL '3 days'),
(3, 'Emma Wilson', 'emma@example.com', 'English', 'active', 'Career pivot into data science', 1, 1, 15, CURRENT_DATE);

-- Sample client steps for Lia van der Merwe (client_id will be 1)
INSERT INTO client_steps (client_id, step_id, step_name, step_order, completed, completed_at) VALUES
(1, 'kwadrant', '4 Quadrant Exercise', 1, true, CURRENT_TIMESTAMP - INTERVAL '14 days'),
(1, 'present-gap-future', 'Present-Gap-Future', 2, true, CURRENT_TIMESTAMP - INTERVAL '10 days'),
(1, 'flight-plan', 'Flight Plan', 3, true, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(1, 'deep-dive', 'Deep Dive', 4, false, NULL),
(1, 'assessments', 'Assessments & Ecochart', 5, false, NULL);

-- Sample gauge readings for Lia
INSERT INTO client_gauges (client_id, gauge_key, gauge_value, recorded_at) VALUES
(1, 'fuel', 65, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'horizon', 70, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'thrust', 55, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'engine', 60, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'compass', 75, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'positive', 68, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'weight', 52, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'nav', 72, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 'negative', 45, CURRENT_TIMESTAMP - INTERVAL '2 days');

-- Sample coaching session
INSERT INTO client_sessions (client_id, coach_id, session_date, duration_minutes, summary, key_insights, action_items, mood_before, mood_after) VALUES
(1, 2, CURRENT_DATE - INTERVAL '2 days', 60,
 'Discussed progress on freelance business launch. Client showing good momentum but struggling with time management.',
 ARRAY['Client has strong technical skills but needs structure', 'Family support is crucial factor', 'Fear of failure is main blocker'],
 ARRAY['Create weekly schedule with blocked focus time', 'Research 3 project management tools', 'Practice saying no to non-essential commitments'],
 6, 8);

-- Sample AI learning data (coaching style patterns)
INSERT INTO ai_learning_data (coach_id, client_id, data_type, data_content, importance_score) VALUES
(2, NULL, 'coaching_style',
 '{"approach": "solution-focused", "communication_style": "empathetic and direct", "typical_questions": ["What would success look like?", "What is one small step you can take?"], "strengths": ["building rapport", "action-oriented planning"]}',
 0.9),
(2, 1, 'client_profile',
 '{"personality_traits": ["ambitious", "perfectionist", "family-oriented"], "communication_preferences": ["direct feedback", "visual tools"], "triggers": ["time pressure", "financial uncertainty"], "motivators": ["freedom", "family time", "creative expression"]}',
 0.85);

-- Sample AI conversation
INSERT INTO ai_conversations (coach_id, client_id, role, content, ai_provider, tokens_used) VALUES
(2, 1, 'user', 'What should I focus on in my next session with Lia?', NULL, NULL),
(2, 1, 'assistant', 'Based on Lia''s recent progress and her dream of building a successful freelance business, I recommend focusing on: 1) Time management systems - she completed the Flight Plan step but mentioned struggling with structure. 2) Addressing her fear of failure which appeared in the last session. 3) Building on her progress - she''s shown good momentum (gauges improving), so reinforce wins. Consider using the Deep Dive step to explore her time management challenges more deeply.', 'claude', 450);
