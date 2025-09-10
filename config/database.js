const { Sequelize } = require('sequelize');
const env = require('./env');

// Get environment configuration
const config = env[process.env.NODE_ENV || 'development'];

// PostgreSQL configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: console.log, // Set to console.log for debugging
  define: {
    timestamps: true, // Adds createdAt and updatedAt
    underscored: true // Use snake_case for column names
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Test database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize;

