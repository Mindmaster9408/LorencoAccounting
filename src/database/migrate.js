const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function migrate() {
  console.log('🚀 Starting database migration...');

  try {
    const schemaPath = path.join(__dirname, '../../docs/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Executing schema...');
    await db.query(schema);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
