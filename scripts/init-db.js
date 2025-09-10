#!/usr/bin/env node

const { sequelize, User, Category, Product, Customer, Transaction, TransactionItem, RawMaterial, ProductRawMaterial, Setting } = require('../models');

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Sync all models (create tables)
    await sequelize.sync({ force: true });
    console.log('✅ Database tables created successfully!');
    
    // Create default admin user
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123', // In production, hash this password
      full_name: 'Administrator',
      email: 'admin@store.com',
      role: 'admin',
      is_active: true
    });
    console.log('✅ Default admin user created:', adminUser.username);
    
    // Create default categories
    const defaultCategories = [
      { name: 'Electronics', description: 'Electronic devices and accessories' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Food & Beverages', description: 'Food items and drinks' },
      { name: 'Home & Garden', description: 'Home improvement and garden items' },
      { name: 'Books', description: 'Books and publications' },
      { name: 'Sports', description: 'Sports equipment and accessories' }
    ];
    
    for (const cat of defaultCategories) {
      await Category.create(cat);
    }
    console.log('✅ Default categories created successfully!');
    
    // Create default settings
    const defaultSettings = [
      { key: 'store_name', value: 'My Store', description: 'Store name', type: 'string' },
      { key: 'store_address', value: '123 Main St', description: 'Store address', type: 'string' },
      { key: 'store_phone', value: '+1-555-0123', description: 'Store phone number', type: 'string' },
      { key: 'tax_rate', value: '8.5', description: 'Tax rate percentage', type: 'number' },
      { key: 'currency', value: 'USD', description: 'Store currency', type: 'string' },
      { key: 'receipt_footer', value: 'Thank you for your purchase!', description: 'Receipt footer message', type: 'string' },
      { key: 'low_stock_threshold', value: '10', description: 'Low stock threshold', type: 'number' },
      { key: 'enable_barcodes', value: 'true', description: 'Enable barcode scanning', type: 'boolean' },
      { key: 'enable_customer_loyalty', value: 'false', description: 'Enable customer loyalty program', type: 'boolean' }
    ];
    
    for (const setting of defaultSettings) {
      await Setting.create(setting);
    }
    console.log('✅ Default settings created successfully!');
    
    // Create sample products
    const sampleProducts = [
      {
        name: 'Sample Product 1',
        sku: 'SP001',
        barcode: '1234567890123',
        description: 'This is a sample product for testing',
        price: 29.99,
        cost: 15.00,
        quantity: 100,
        min_quantity: 10,
        category_id: 1 // Electronics
      },
      {
        name: 'Sample Product 2',
        sku: 'SP002',
        barcode: '1234567890124',
        description: 'Another sample product for testing',
        price: 49.99,
        cost: 25.00,
        quantity: 50,
        min_quantity: 5,
        category_id: 2 // Clothing
      }
    ];
    
    for (const product of sampleProducts) {
      await Product.create(product);
    }
    console.log('✅ Sample products created successfully!');
    
    // Create sample raw materials
    const sampleRawMaterials = [
      {
        name: 'Sample Material 1',
        description: 'A sample raw material for testing',
        unit: 'piece',
        cost_per_unit: 2.50,
        quantity: 200,
        min_quantity: 20,
        supplier: 'Sample Supplier Inc.'
      },
      {
        name: 'Sample Material 2',
        description: 'Another sample raw material',
        unit: 'kg',
        cost_per_unit: 5.00,
        quantity: 100,
        min_quantity: 10,
        supplier: 'Sample Supplier Inc.'
      }
    ];
    
    for (const material of sampleRawMaterials) {
      await RawMaterial.create(material);
    }
    console.log('✅ Sample raw materials created successfully!');
    
    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📋 Default credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Remember to change the default password in production!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;

