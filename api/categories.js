const express = require("express");
const { Category } = require("../models");

const app = express();
app.use(express.json());

module.exports = app;

// Get all categories
app.get("/", async (req, res) => {
    try {
        const categories = await Category.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get single category
app.get("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Category ID is required." });
        }
        
        // Handle special case for "all"
        if (req.params.id === 'all') {
            const categories = await Category.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });
            return res.json(categories);
        }
        
        // Validate that ID is a number
        const categoryId = parseInt(req.params.id);
        if (isNaN(categoryId)) {
            return res.status(400).json({ error: "Invalid category ID. Must be a number." });
        }
        
        const category = await Category.findByPk(categoryId);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        
        res.json(category);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create/Update category (alias for /category)
app.post("/category", async (req, res) => {
    try {
        console.log('Category form data received:', req.body);
        
        const categoryData = {
            name: req.body.name,
            description: req.body.description,
            is_active: req.body.is_active !== false
        };

        if (req.body.id) {
            // Update existing category
            const category = await Category.findByPk(req.body.id);
            if (!category) {
                return res.status(404).json({ error: "Category not found" });
            }
            
            await category.update(categoryData);
            res.json({ message: "Category updated successfully", category });
        } else {
            // Create new category
            const newCategory = await Category.create(categoryData);
            res.status(201).json({ message: "Category created successfully", category: newCategory });
        }
    } catch (error) {
        console.error('Error saving category:', error);
        res.status(500).json({ error: 'Failed to save category' });
    }
});

// Create/Update category
app.post("/", async (req, res) => {
    try {
        const categoryData = {
            name: req.body.name,
            description: req.body.description,
            is_active: true
        };

        let category;
        if (req.body.id) {
            // Update existing category
            category = await Category.findByPk(req.body.id);
            if (category) {
                await category.update(categoryData);
            }
        } else {
            // Create new category
            category = await Category.create(categoryData);
        }

        res.json(category);
    } catch (error) {
        console.error('Error saving category:', error);
        res.status(500).json({ error: 'Failed to save category' });
    }
});

// Delete category (alias for /category/:id)
app.delete("/category/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Category ID is required." });
        }

        // Validate that ID is a number
        const categoryId = parseInt(req.params.id);
        if (isNaN(categoryId)) {
            return res.status(400).json({ error: "Invalid category ID. Must be a number." });
        }

        const category = await Category.findByPk(categoryId);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        await category.destroy();
        res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Delete category
app.delete("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Category ID is required." });
        }

        const category = await Category.findByPk(req.params.id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Soft delete - just mark as inactive
        await category.update({ is_active: false });
        
        res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

 

 