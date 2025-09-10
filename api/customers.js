const express = require("express");
const { Customer } = require("../models");

const app = express();
app.use(express.json());

module.exports = app;

// Get all customers
app.get("/", async (req, res) => {
    try {
        const customers = await Customer.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get single customer
app.get("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Customer ID is required." });
        }
        
        // Handle special case for "all"
        if (req.params.id === 'all') {
            const customers = await Customer.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });
            return res.json(customers);
        }
        
        // Validate that ID is a number
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
            return res.status(400).json({ error: "Invalid customer ID. Must be a number." });
        }
        
        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }
        
        res.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create/Update customer (alias for /customer)
app.post("/customer", async (req, res) => {
    try {
        console.log('Customer form data received:', req.body);
        
        const customerData = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address,
            city: req.body.city,
            state: req.body.state,
            zip_code: req.body.zip_code,
            is_active: req.body.is_active !== false
        };

        if (req.body.id) {
            // Update existing customer
            const customer = await Customer.findByPk(req.body.id);
            if (!customer) {
                return res.status(404).json({ error: "Customer not found" });
            }
            
            await customer.update(customerData);
            res.json({ message: "Customer updated successfully", customer });
        } else {
            // Create new customer
            const newCustomer = await Customer.create(customerData);
            res.status(201).json({ message: "Customer created successfully", customer: newCustomer });
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        res.status(500).json({ error: 'Failed to save customer' });
    }
});

// Create/Update customer
app.post("/", async (req, res) => {
    try {
        const customerData = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address,
            city: req.body.city,
            state: req.body.state,
            zip_code: req.body.zip_code,
            is_active: true
        };

        let customer;
        if (req.body.id) {
            // Update existing customer
            customer = await Customer.findByPk(req.body.id);
            if (customer) {
                await customer.update(customerData);
            }
        } else {
            // Create new customer
            customer = await Customer.create(customerData);
        }

        res.json(customer);
    } catch (error) {
        console.error('Error saving customer:', error);
        res.status(500).json({ error: 'Failed to save customer' });
    }
});

// Delete customer
app.delete("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Customer ID is required." });
        }

        const customer = await Customer.findByPk(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        // Soft delete - just mark as inactive
        await customer.update({ is_active: false });
        
        res.json({ message: "Customer deleted successfully" });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// Search customers
app.get("/search/:query", async (req, res) => {
    try {
        const query = req.params.query;
        if (!query) {
            return res.status(400).json({ error: "Search query is required." });
        }

        const customers = await Customer.findAll({
            where: {
                is_active: true,
                [require('sequelize').Op.or]: [
                    { name: { [require('sequelize').Op.like]: `%${query}%` } },
                    { email: { [require('sequelize').Op.like]: `%${query}%` } },
                    { phone: { [require('sequelize').Op.like]: `%${query}%` } }
                ]
            },
            order: [['name', 'ASC']],
            limit: 10
        });

        res.json(customers);
    } catch (error) {
        console.error('Error searching customers:', error);
        res.status(500).json({ error: 'Failed to search customers' });
    }
});

 

 