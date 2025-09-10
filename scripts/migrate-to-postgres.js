const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

// Get environment configuration
const config = env[process.env.NODE_ENV || 'development'];

// PostgreSQL client configuration
const client = new Client({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: 'postgres' // Connect to default postgres database first
});

async function createDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Check if database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = '${config.DB_NAME}'`
    );

    if (result.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${config.DB_NAME}"`);
      console.log(`Database '${config.DB_NAME}' created successfully`);
    } else {
      console.log(`Database '${config.DB_NAME}' already exists`);
    }

    await client.end();
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  }
}

async function migrateData() {
  const sequelize = require('../config/database');
  
  try {
    // Test connection to the new database
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL database successfully');

    // Load all models and their associations
    require('../models');
    console.log('Models and associations loaded');

    // Sync all models (create tables)
    await sequelize.sync({ force: true });
    console.log('Database tables created successfully');

    // Insert default data
    await insertDefaultData(sequelize);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

async function insertDefaultData(sequelize) {
  const { User, Category, Setting } = require('../models');

  try {
    // Create default admin user
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123', // In production, this should be hashed
      full_name: 'Administrator',
      email: 'admin@pos.com',
      role: 'admin',
      is_active: true
    });
    console.log('Default admin user created');

    // Create default categories
    const categories = [
      { name: 'Electronics', description: 'Electronic products' },
      { name: 'Clothing', description: 'Clothing and apparel' },
      { name: 'Food & Beverages', description: 'Food and drink items' },
      { name: 'Books', description: 'Books and publications' },
      { name: 'Home & Garden', description: 'Home and garden products' }
    ];

    for (const categoryData of categories) {
      await Category.create(categoryData);
    }
    console.log('Default categories created');

    // Create default settings
    const settings = [
      { key: 'store_name', value: 'My Store', type: 'string', description: 'Store name', is_public: true },
      { key: 'store_address', value: '123 Main St, City, State', type: 'string', description: 'Store address', is_public: true },
      { key: 'store_phone', value: '+1-555-0123', type: 'string', description: 'Store phone number', is_public: true },
      { key: 'tax_rate', value: '0.08', type: 'number', description: 'Default tax rate (8%)', is_public: false },
      { key: 'currency', value: 'USD', type: 'string', description: 'Default currency', is_public: true },
      { key: 'receipt_footer', value: 'Thank you for your business!', type: 'string', description: 'Receipt footer text', is_public: true }
    ];

    for (const settingData of settings) {
      await Setting.create(settingData);
    }
    console.log('Default settings created');

  } catch (error) {
    console.error('Error inserting default data:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting migration from SQLite to PostgreSQL...');
  
  // Step 1: Create database
  await createDatabase();
  
  // Step 2: Migrate data
  await migrateData();
  
  console.log('Migration completed successfully!');
  console.log('You can now start your application with: npm start');
}

// Run migration if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createDatabase, migrateData };
