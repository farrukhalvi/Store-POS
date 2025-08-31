// Test script to troubleshoot admin login issues
const Datastore = require('@seald-io/nedb');
const path = require('path');

// Connect to the users database
const usersDB = new Datastore({
    filename: path.join(__dirname, 'database/POS/server/databases/users.db'),
    autoload: true
});

console.log('Testing admin user access...\n');

// Check if admin user exists
usersDB.findOne({ _id: 1 }, function(err, adminUser) {
    if (err) {
        console.error('Database error:', err);
        return;
    }
    
    if (adminUser) {
        console.log('✅ Admin user found:');
        console.log('   ID:', adminUser._id);
        console.log('   Username:', adminUser.username);
        console.log('   Fullname:', adminUser.fullname);
        console.log('   Password (encoded):', adminUser.password);
        console.log('   Permissions:', {
            products: adminUser.perm_products,
            categories: adminUser.perm_categories,
            transactions: adminUser.perm_transactions,
            users: adminUser.perm_users,
            settings: adminUser.perm_settings
        });
        
        // Test password encoding
        const btoa = require('btoa');
        const testPassword = btoa('admin');
        console.log('   Expected password (encoded):', testPassword);
        console.log('   Password match:', adminUser.password === testPassword ? '✅' : '❌');
        
    } else {
        console.log('❌ Admin user not found!');
        console.log('Creating admin user...');
        
        const btoa = require('btoa');
        const newAdminUser = {
            _id: 1,
            username: 'admin',
            password: btoa('admin'),
            fullname: 'Administrator',
            perm_products: 1,
            perm_categories: 1,
            perm_transactions: 1,
            perm_users: 1,
            perm_settings: 1,
            status: ''
        };
        
        usersDB.insert(newAdminUser, function(err, user) {
            if (err) {
                console.error('❌ Error creating admin user:', err);
            } else {
                console.log('✅ Admin user created successfully:', user);
            }
        });
    }
});

// List all users
usersDB.find({}, function(err, allUsers) {
    if (err) {
        console.error('Error fetching all users:', err);
        return;
    }
    
    console.log('\n📋 All users in database:');
    if (allUsers.length === 0) {
        console.log('   No users found');
    } else {
        allUsers.forEach(user => {
            console.log(`   ID: ${user._id}, Username: ${user.username}, Fullname: ${user.fullname}`);
        });
    }
});

// Test login functionality
console.log('\n🔐 Testing login functionality...');
const testLogin = {
    username: 'admin',
    password: require('btoa')('admin')
};

usersDB.findOne(testLogin, function(err, user) {
    if (err) {
        console.error('Login test error:', err);
        return;
    }
    
    if (user) {
        console.log('✅ Login test successful - user found');
    } else {
        console.log('❌ Login test failed - no user found with admin credentials');
    }
});
