const path = require('path');
const os = require('os');
const fs = require('fs');

// Cross-platform path configuration
function getAppDataPath() {
    // Use current directory for databases and uploads
    return process.cwd();
}

// Base paths
const appDataPath = getAppDataPath();
const appName = 'POS';

console.log("appDataPath", path.join(appDataPath, 'database',appName, 'server', 'databases'));
// Database paths
const databasePath = path.join(appDataPath, 'database',appName, 'server', 'databases');
const uploadsPath = path.join(appDataPath, 'database',appName, 'uploads');

// Ensure directories exist
function ensureDirectories() {
    const dirs = [databasePath, uploadsPath];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Export configuration
module.exports = {
    databasePath,
    uploadsPath,
    ensureDirectories,
    getAppDataPath
};
