let express = require("express"),
  http = require("http"),
  app = require("express")(),
  server = http.createServer(app),
  bodyParser = require("body-parser");

const env = require('./config/env');
const config = env[process.env.NODE_ENV || 'development'];
const PORT = process.env.PORT || config.PORT || 8001;

console.log("Server started");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.all("/*", function(req, res, next) {
 
  res.header("Access-Control-Allow-Origin", "*");  
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-type,Accept,X-Access-Token,X-Key"
  );
  if (req.method == "OPTIONS") {
    res.status(200).end();
  } else {
    next();
  }
});

app.get("/", function(req, res) {
  res.send("POS Server Online.");
});

// Initialize database and models
const { sequelize } = require('./models');

// Initialize database connection and sync models
async function initializeDatabase() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync all models (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('Database models synchronized successfully.');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Initialize database before starting server
initializeDatabase().then(() => {
  // Start server after database is ready
  server.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));
  
  // Setup API routes
  app.use("/api/inventory", require("./api/inventory"));
  app.use("/api/raw-materials", require("./api/raw-materials"));
  app.use("/api/customers", require("./api/customers"));
  app.use("/api/categories", require("./api/categories"));
  app.use("/api/settings", require("./api/settings"));
  app.use("/api/users", require("./api/users"));
  app.use("/api/transactions", require("./api/transactions"));
  app.use("/api", require("./api/transactions")); // Also mount at /api for legacy endpoints
  
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
