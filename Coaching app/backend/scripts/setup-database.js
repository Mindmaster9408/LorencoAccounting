// Database setup script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function setupDatabase() {
    console.log('=================================');
    console.log('  Database Setup');
    console.log('=================================\n');

    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'coaching_app',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD
    });

    try {
        await client.connect();
        console.log('✓ Connected to database\n');

        // Read schema file
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Creating database schema...');
        await client.query(schema);
        console.log('✓ Schema created successfully\n');

        // Create default admin user
        console.log('Creating default admin user...');
        const adminPassword = 'Admin@2025!';
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

        await client.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (email) DO NOTHING`,
            ['admin@coachingapp.com', adminPasswordHash, 'Admin', 'User', 'admin', true]
        );
        console.log('✓ Admin user created');
        console.log('  Email: admin@coachingapp.com');
        console.log(`  Password: ${adminPassword}\n`);

        // Insert default program modules
        console.log('Creating default program modules...');
        const modules = [
            ['dashboard', 'Dashboard', 'Main dashboard with client overview and statistics', true],
            ['client_management', 'Client Management', 'Create, edit, and manage client profiles', true],
            ['journey_steps', 'Journey Steps', 'Track client progress through coaching journey', true],
            ['gauges', 'Cockpit Gauges', 'Visual gauge system for client assessments', true],
            ['ai_assistant', 'AI Assistant Coach', 'AI-powered coaching assistant', false],
            ['advanced_analytics', 'Advanced Analytics', 'Detailed reports and trend analysis', false],
            ['group_coaching', 'Group Coaching', 'Manage group coaching sessions', false],
            ['assessments', 'Assessments & Ecochart', 'Psychological assessments and eco-chart tools', false],
            ['mlnp', 'MLNP (Gesigkaarte)', 'MLNP facial expression mapping tool', false],
            ['reports', 'Report Generation', 'Generate and export coaching reports', false],
            ['training_library', 'Training Library', 'Access to training materials and resources', false]
        ];

        for (const [key, name, desc, isDefault] of modules) {
            await client.query(
                `INSERT INTO program_modules (module_key, module_name, description, is_default)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (module_key) DO NOTHING`,
                [key, name, desc, isDefault]
            );
        }
        console.log('✓ Program modules created\n');

        console.log('=================================');
        console.log('Database setup complete!');
        console.log('=================================\n');
        console.log('Next steps:');
        console.log('1. Update your .env file with database credentials');
        console.log('2. Run: npm start');
        console.log('3. Login with admin credentials above\n');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupDatabase();
