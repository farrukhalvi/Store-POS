const express = require("express");
const { User } = require("../models");

const app = express();
app.use(express.json());

// Check for admin user
app.get("/check", async (req, res) => {
    try {
        const adminUser = await User.findOne({
            where: { role: 'admin', is_active: true }
        });
        
        if (adminUser) {
            res.json({ exists: true, user: { id: adminUser.id, username: adminUser.username } });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking admin user:', error);
        res.status(500).json({ error: 'Failed to check admin user' });
    }
});

// User login
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }
        
        const user = await User.findOne({
            where: { username: username, is_active: true }
        });
        
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        // Simple password check (in production, use proper hashing)
        if (user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        // Update last login
        await user.update({ last_login: new Date() });
        
        res.json({ 
            message: "Login successful", 
            user: {
                _id: user.id,
                username: user.username,
                fullname: user.full_name,
                role: user.role,
                perm_products: user.perm_products ? 1 : 0,
                perm_categories: user.perm_categories ? 1 : 0,
                perm_raw_materials: user.perm_raw_materials ? 1 : 0,
                perm_transactions: user.perm_transactions ? 1 : 0,
                perm_users: user.perm_users ? 1 : 0,
                perm_settings: user.perm_settings ? 1 : 0
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User logout
app.get("/logout/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({ message: "Logout successful" });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Reset admin user
app.post("/reset-admin", async (req, res) => {
    try {
        // Find or create admin user
        let adminUser = await User.findOne({
            where: { role: 'admin' }
        });
        
        if (adminUser) {
            // Update existing admin
            await adminUser.update({
                username: 'admin',
                password: 'admin123',
                full_name: 'Administrator',
                email: 'admin@pos.com',
                is_active: true
            });
        } else {
            // Create new admin
            adminUser = await User.create({
                username: 'admin',
                password: 'admin123',
                full_name: 'Administrator',
                email: 'admin@pos.com',
                role: 'admin',
                is_active: true
            });
        }
        
        res.json({ 
            message: "Admin user reset successfully", 
            user: {
                _id: adminUser.id,
                username: adminUser.username,
                fullname: adminUser.full_name
            }
        });
    } catch (error) {
        console.error('Error resetting admin user:', error);
        res.status(500).json({ error: 'Failed to reset admin user' });
    }
});

module.exports = app;

// Get all users
app.get("/", async (req, res) => {
    try {
        const users = await User.findAll({
            where: { is_active: true },
            attributes: { exclude: ['password'] }, // Don't send passwords
            order: [['username', 'ASC']]
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user (alias for /user/:id)
app.get("/user/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "User ID is required." });
        }
        
        // Validate that ID is a number
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID. Must be a number." });
        }
        
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Get single user
app.get("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "User ID is required." });
        }
        
        // Handle special case for "all"
        if (req.params.id === 'all') {
            const users = await User.findAll({
                where: { is_active: true },
                attributes: { exclude: ['password'] },
                order: [['username', 'ASC']]
            });
            return res.json(users);
        }
        
        // Validate that ID is a number
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID. Must be a number." });
        }
        
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Create/Update user (alias for /post)
app.post("/post", async (req, res) => {
    try {
        console.log('User form data received:', req.body);
        
        const userData = {
            username: req.body.username,
            password: req.body.password,
            full_name: req.body.fullname || req.body.full_name,
            email: req.body.email,
            role: req.body.role || 'cashier',
            is_active: req.body.is_active !== false
        };

        if (req.body.id) {
            // Update existing user
            const user = await User.findByPk(req.body.id);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            
            // Don't update password if it's empty
            if (!userData.password) {
                delete userData.password;
            }
            
            await user.update(userData);
            res.json({ message: "User updated successfully", user });
        } else {
            // Create new user
            const newUser = await User.create(userData);
            res.status(201).json({ message: "User created successfully", user: newUser });
        }
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// Create/Update user
app.post("/", async (req, res) => {
    try {
        const userData = {
            username: req.body.username,
            password: req.body.password, // In production, hash this password
            full_name: req.body.fullname || req.body.full_name,
            email: req.body.email,
            role: req.body.role || 'cashier',
            is_active: true,
            perm_products: req.body.perm_products === 1 || req.body.perm_products === '1' || req.body.perm_products === true,
            perm_categories: req.body.perm_categories === 1 || req.body.perm_categories === '1' || req.body.perm_categories === true,
            perm_raw_materials: req.body.perm_raw_materials === 1 || req.body.perm_raw_materials === '1' || req.body.perm_raw_materials === true,
            perm_transactions: req.body.perm_transactions === 1 || req.body.perm_transactions === '1' || req.body.perm_transactions === true,
            perm_users: req.body.perm_users === 1 || req.body.perm_users === '1' || req.body.perm_users === true,
            perm_settings: req.body.perm_settings === 1 || req.body.perm_settings === '1' || req.body.perm_settings === true
        };

        let user;
        if (req.body.id) {
            // Update existing user
            user = await User.findByPk(req.body.id);
            if (user) {
                // Only update password if provided
                if (!userData.password) {
                    delete userData.password;
                }
                await user.update(userData);
            }
        } else {
            // Create new user
            user = await User.create(userData);
        }

        // Return user without password
        const userResponse = user.toJSON();
        delete userResponse.password;
        
        res.json(userResponse);
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// Delete user (alias for /user/:id)
app.delete("/user/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "User ID is required." });
        }

        // Validate that ID is a number
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID. Must be a number." });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await user.destroy();
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete user
app.delete("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "User ID is required." });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Soft delete - just mark as inactive
        await user.update({ is_active: false });
        
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// User login
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const user = await User.findOne({
            where: { 
                username: username,
                is_active: true
            }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // In production, use proper password hashing
        if (user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Update last login
        await user.update({ last_login: new Date() });

        // Return user without password
        const userResponse = user.toJSON();
        delete userResponse.password;
        
        res.json({
            message: "Login successful",
            user: userResponse
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Change password
app.post("/change-password", async (req, res) => {
    try {
        const { user_id, current_password, new_password } = req.body;
        
        if (!user_id || !current_password || !new_password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Verify current password
        if (user.password !== current_password) {
            return res.status(401).json({ error: "Current password is incorrect" });
        }

        // Update password
        await user.update({ password: new_password });
        
        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});