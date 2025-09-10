const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { RawMaterial, Product, ProductRawMaterial } = require("../models");

const app = express();
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, callback) {
        const uploadPath = path.join(__dirname, '../public/uploads/raw_materials');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        callback(null, uploadPath);
    },
    filename: function(req, file, callback) {
        callback(null, Date.now() + '.jpg');
    }
});

const upload = multer({ storage: storage });

module.exports = app;

// Create product-raw material association
app.post("/associate", async (req, res) => {
    try {
        const { product_id, raw_material_id, quantity_required } = req.body;
        
        if (!product_id || !raw_material_id || !quantity_required) {
            return res.status(400).json({ error: "Product ID, raw material ID, and quantity required are needed" });
        }
        
        // Check if product exists
        const product = await Product.findByPk(product_id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        // Check if raw material exists
        const rawMaterial = await RawMaterial.findByPk(raw_material_id);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }
        
        // Create or update association
        const [association, created] = await ProductRawMaterial.findOrCreate({
            where: {
                product_id: product_id,
                raw_material_id: raw_material_id
            },
            defaults: {
                quantity_required: quantity_required
            }
        });
        
        if (!created) {
            // Update existing association
            await association.update({ quantity_required: quantity_required });
        }
        
        res.json({ 
            message: "Product-raw material association created/updated successfully",
            association: association
        });
    } catch (error) {
        console.error('Error creating association:', error);
        res.status(500).json({ error: 'Failed to create association' });
    }
});

// Get all raw materials (alias for /raw-materials)
app.get("/raw-materials", async (req, res) => {
    try {
        const rawMaterials = await RawMaterial.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(rawMaterials);
    } catch (error) {
        console.error('Error fetching raw materials:', error);
        res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
});

// Get all raw materials
app.get("/", async (req, res) => {
    try {
        const rawMaterials = await RawMaterial.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        res.json(rawMaterials);
    } catch (error) {
        console.error('Error fetching raw materials:', error);
        res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
});

// Get single raw material (alias for /raw-material/:id)
app.get("/raw-material/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Raw material ID is required." });
        }
        
        // Validate that ID is a number
        const rawMaterialId = parseInt(req.params.id);
        if (isNaN(rawMaterialId)) {
            return res.status(400).json({ error: "Invalid raw material ID. Must be a number." });
        }
        
        const rawMaterial = await RawMaterial.findByPk(rawMaterialId);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }
        
        res.json(rawMaterial);
    } catch (error) {
        console.error('Error fetching raw material:', error);
        res.status(500).json({ error: 'Failed to fetch raw material' });
    }
});

// Get single raw material
app.get("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Raw material ID is required." });
        }
        
        // Handle special case for "raw-materials" (which seems to be a route conflict)
        if (req.params.id === 'raw-materials' || req.params.id === 'all') {
            const rawMaterials = await RawMaterial.findAll({
                where: { is_active: true },
                order: [['name', 'ASC']]
            });
            return res.json(rawMaterials);
        }
        
        // Validate that ID is a number
        const rawMaterialId = parseInt(req.params.id);
        if (isNaN(rawMaterialId)) {
            return res.status(400).json({ error: "Invalid raw material ID. Must be a number." });
        }
        
        const rawMaterial = await RawMaterial.findByPk(rawMaterialId);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }
        
        res.json(rawMaterial);
    } catch (error) {
        console.error('Error fetching raw material:', error);
        res.status(500).json({ error: 'Failed to fetch raw material' });
    }
});

// Create/Update raw material (alias for /raw-material)
app.post("/raw-material", upload.single('imagename'), async (req, res) => {
    try {
        console.log('Raw material form data received:', req.body);
        
        const rawMaterialData = {
            name: req.body.name,
            sku: req.body.sku,
            description: req.body.description,
            unit: req.body.unit || 'piece',
            cost_per_unit: parseFloat(req.body.unit_price || req.body.cost_per_unit) || 0,
            quantity_in_stock: parseFloat(req.body.quantity || req.body.quantity_in_stock) || 0,
            min_quantity: parseFloat(req.body.min_quantity) || 0,
            supplier: req.body.supplier,
            is_active: req.body.stock !== 'on' // If stock checkbox is checked, disable stock (set inactive)
        };

        // Handle image upload
        if (req.file) {
            rawMaterialData.image = req.file.filename;
        }

        if (req.body.id) {
            // Update existing raw material
            const rawMaterial = await RawMaterial.findByPk(req.body.id);
            if (!rawMaterial) {
                return res.status(404).json({ error: "Raw material not found" });
            }
            
            await rawMaterial.update(rawMaterialData);
            res.json({ message: "Raw material updated successfully", rawMaterial });
        } else {
            // Create new raw material
            const newRawMaterial = await RawMaterial.create(rawMaterialData);
            res.status(201).json({ message: "Raw material created successfully", rawMaterial: newRawMaterial });
        }
    } catch (error) {
        console.error('Error saving raw material:', error);
        res.status(500).json({ error: 'Failed to save raw material' });
    }
});

// Create/Update raw material
app.post("/", upload.single('imagename'), async (req, res) => {
    try {
        console.log('Raw material form data received (/):', req.body);
        
        const rawMaterialData = {
            name: req.body.name,
            sku: req.body.sku,
            description: req.body.description,
            unit: req.body.unit || 'piece',
            cost_per_unit: parseFloat(req.body.unit_price || req.body.cost_per_unit) || 0,
            quantity_in_stock: parseFloat(req.body.quantity || req.body.quantity_in_stock) || 0,
            min_quantity: parseFloat(req.body.min_quantity) || 0,
            supplier: req.body.supplier,
            is_active: req.body.stock !== 'on' // If stock checkbox is checked, disable stock (set inactive)
        };

        let rawMaterial;
        if (req.body.id) {
            // Update existing raw material
            rawMaterial = await RawMaterial.findByPk(req.body.id);
            if (rawMaterial) {
                await rawMaterial.update(rawMaterialData);
            }
        } else {
            // Create new raw material
            rawMaterial = await RawMaterial.create(rawMaterialData);
        }

        res.json(rawMaterial);
    } catch (error) {
        console.error('Error saving raw material:', error);
        res.status(500).json({ error: 'Failed to save raw material' });
    }
});

// Delete raw material (alias for /raw-material/:id)
app.delete("/raw-material/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Raw material ID is required." });
        }

        // Validate that ID is a number
        const rawMaterialId = parseInt(req.params.id);
        if (isNaN(rawMaterialId)) {
            return res.status(400).json({ error: "Invalid raw material ID. Must be a number." });
        }

        const rawMaterial = await RawMaterial.findByPk(rawMaterialId);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }

        await rawMaterial.destroy();
        res.json({ message: "Raw material deleted successfully" });
    } catch (error) {
        console.error('Error deleting raw material:', error);
        res.status(500).json({ error: 'Failed to delete raw material' });
    }
});

// Delete raw material
app.delete("/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Raw material ID is required." });
        }

        const rawMaterial = await RawMaterial.findByPk(req.params.id);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }

        // Soft delete - just mark as inactive
        await rawMaterial.update({ is_active: false });
        
        res.json({ message: "Raw material deleted successfully" });
    } catch (error) {
        console.error('Error deleting raw material:', error);
        res.status(500).json({ error: 'Failed to delete raw material' });
    }
});

// Update raw material quantity
app.post("/update-quantity", async (req, res) => {
    try {
        const { id, quantity, operation } = req.body;
        
        if (!id || quantity === undefined || !operation) {
            return res.status(400).json({ error: "ID, quantity, and operation are required." });
        }

        const rawMaterial = await RawMaterial.findByPk(id);
        if (!rawMaterial) {
            return res.status(404).json({ error: "Raw material not found" });
        }

        let newQuantity = rawMaterial.quantity;
        if (operation === 'add') {
            newQuantity += parseFloat(quantity);
        } else if (operation === 'subtract') {
            newQuantity -= parseFloat(quantity);
            if (newQuantity < 0) newQuantity = 0;
        } else if (operation === 'set') {
            newQuantity = parseFloat(quantity);
        }

        await rawMaterial.update({ quantity: newQuantity });
        
        res.json({ 
            message: "Quantity updated successfully",
            new_quantity: newQuantity
        });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ error: 'Failed to update quantity' });
    }
});

// Get low stock raw materials
app.get("/low-stock", async (req, res) => {
    try {
        const rawMaterials = await RawMaterial.findAll({
            where: {
                is_active: true,
                quantity: { [require('sequelize').Op.lte]: require('sequelize').col('min_quantity') }
            },
            order: [['quantity', 'ASC']]
        });

        res.json(rawMaterials);
    } catch (error) {
        console.error('Error fetching low stock raw materials:', error);
        res.status(500).json({ error: 'Failed to fetch low stock raw materials' });
    }
});

// Search raw materials
app.get("/search/:query", async (req, res) => {
    try {
        const query = req.params.query;
        if (!query) {
            return res.status(400).json({ error: "Search query is required." });
        }

        const rawMaterials = await RawMaterial.findAll({
            where: {
                is_active: true,
                [require('sequelize').Op.or]: [
                    { name: { [require('sequelize').Op.like]: `%${query}%` } },
                    { description: { [require('sequelize').Op.like]: `%${query}%` } },
                    { supplier: { [require('sequelize').Op.like]: `%${query}%` } }
                ]
            },
            order: [['name', 'ASC']],
            limit: 10
        });

        res.json(rawMaterials);
    } catch (error) {
        console.error('Error searching raw materials:', error);
        res.status(500).json({ error: 'Failed to search raw materials' });
    }
});
