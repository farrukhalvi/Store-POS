const sequelize = require('../config/database');

// Import models
const User = require('./User')(sequelize, require('sequelize').DataTypes);
const Category = require('./Category')(sequelize, require('sequelize').DataTypes);
const Product = require('./Product')(sequelize, require('sequelize').DataTypes);
const Customer = require('./Customer')(sequelize, require('sequelize').DataTypes);
const Transaction = require('./Transaction')(sequelize, require('sequelize').DataTypes);
const TransactionItem = require('./TransactionItem')(sequelize, require('sequelize').DataTypes);
const RawMaterial = require('./RawMaterial')(sequelize, require('sequelize').DataTypes);
const ProductRawMaterial = require('./ProductRawMaterial')(sequelize, require('sequelize').DataTypes);
const Setting = require('./Setting')(sequelize, require('sequelize').DataTypes);

// Define associations
// User associations
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category associations
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// Product associations
Product.hasMany(TransactionItem, { foreignKey: 'product_id', as: 'transactionItems' });
TransactionItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Transaction associations
Transaction.hasMany(TransactionItem, { foreignKey: 'transaction_id', as: 'items' });
TransactionItem.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

// Raw Material associations (Many-to-Many with Product)
Product.belongsToMany(RawMaterial, { 
  through: ProductRawMaterial, 
  foreignKey: 'product_id',
  otherKey: 'raw_material_id',
  as: 'rawMaterials'
});
RawMaterial.belongsToMany(Product, { 
  through: ProductRawMaterial, 
  foreignKey: 'raw_material_id',
  otherKey: 'product_id',
  as: 'products'
});

// Customer associations
Customer.hasMany(Transaction, { foreignKey: 'customer_id', as: 'transactions' });
Transaction.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Customer,
  Transaction,
  TransactionItem,
  RawMaterial,
  ProductRawMaterial,
  Setting
};

