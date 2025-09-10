const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Product, Category, RawMaterial, ProductRawMaterial } = require("../models");

const app = express();
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, callback) {
        const uploadPath = path.join(__dirname, '../public/uploads/product_image');
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

 
// Duplicate endpoint removed - using the complete one below that includes raw materials

// Get single product (alias for /product/:id)
app.get("/product/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Product ID is required." });
        }
        
        // Validate that ID is a number
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: "Invalid product ID. Must be a number." });
        }
        
        const product = await Product.findByPk(productId, {
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['name']
                }
            ]
        });
        
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Search product by SKU (alias for /product/sku)
app.post("/product/sku", async (req, res) => {
    try {
        const { sku } = req.body;
        
        if (!sku) {
            return res.status(400).json({ error: "SKU is required." });
        }
        
        const product = await Product.findOne({
            where: { sku: sku, is_active: true },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['name']
                }
            ]
        });
        
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error fetching product by SKU:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Duplicate endpoint removed - using the more complete one below

// Delete product (alias for /product/:id)
app.delete("/product/:id", async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "Product ID is required." });
        }

        // Validate that ID is a number
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: "Invalid product ID. Must be a number." });
        }

        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        await product.destroy();
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

app.get("/", function (req, res) {
    res.send("Inventory API");
});

// Get single product
app.get("/product/:productId", async (req, res) => {
    try {
        if (!req.params.productId) {
            return res.status(400).json({ error: "Product ID is required." });
        }

        const product = await Product.findByPk(req.params.productId, {
            include: [
                { model: Category, as: 'category' },
                { model: RawMaterial, as: 'rawMaterials', through: { attributes: ['quantity_required'] } }
            ]
        });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Get all products
app.get("/products", async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [
                { model: Category, as: 'category' },
                { model: RawMaterial, as: 'rawMaterials', through: { attributes: ['quantity_required'] } }
            ],
            order: [['name', 'ASC']]
        });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});


 
// Create/Update product
app.post("/product", upload.single('imagename'), async (req, res) => {
    try {
        console.log('Product creation/update request received');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        let image = '';

        if (req.body.img && req.body.img !== "") {
            image = req.body.img;
        }

        if (req.file) {
            image = req.file.filename;
        }

        if (req.body.remove == 1) {
            const imagePath = path.join(__dirname, '../public/uploads/product_image/', req.body.img);
            try {
                fs.unlinkSync(imagePath);
            } catch (err) {
                console.error('Error deleting image:', err);
            }

            if (!req.file) {
                image = '';
            }
        }

        const productData = {
            name: req.body.name,
            sku: req.body.sku || null,
            barcode: req.body.barcode || null,
            description: req.body.description || null,
            price: parseFloat(req.body.price) || 0,
            cost: parseFloat(req.body.cost) || 0,
            quantity: parseInt(req.body.quantity) || 0,
            min_quantity: parseInt(req.body.min_quantity) || 0,
            max_quantity: req.body.max_quantity ? parseInt(req.body.max_quantity) : null,
            image: image,
            category_id: req.body.category_id ? parseInt(req.body.category_id) : null,
            is_active: true
        };

        let product;
        if (req.body.id && req.body.id !== "") {
            // Update existing product
            product = await Product.findByPk(req.body.id);
            if (product) {
                await product.update(productData);
            } else {
                return res.status(404).json({ error: "Product not found" });
            }
        } else {
            // Create new product
            product = await Product.create(productData);
        }

        // Handle raw materials
        if (req.body.raw_materials && req.body.raw_material_quantities) {
            const materials = Array.isArray(req.body.raw_materials) ? req.body.raw_materials : [req.body.raw_materials];
            const quantities = Array.isArray(req.body.raw_material_quantities) ? req.body.raw_material_quantities : [req.body.raw_material_quantities];
            
            // Clear existing raw material associations
            await ProductRawMaterial.destroy({
                where: { product_id: product.id }
            });

            // Add new raw material associations
            for (let i = 0; i < materials.length; i++) {
                const materialId = materials[i];
                const quantity = quantities[i];
                
                if (materialId && quantity && parseFloat(quantity) > 0) {
                    await ProductRawMaterial.create({
                        product_id: product.id,
                        raw_material_id: parseInt(materialId),
                        quantity_required: parseFloat(quantity)
                    });
                }
            }
        }

        // Return updated product with associations
        const updatedProduct = await Product.findByPk(product.id, {
            include: [
                { model: Category, as: 'category' },
                { model: RawMaterial, as: 'rawMaterials', through: { attributes: ['quantity_required'] } }
            ]
        });

        res.json(updatedProduct);
    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).json({ error: 'Failed to save product' });
    }
});



 
// Delete product
app.delete("/product/:productId", async (req, res) => {
    try {
        if (!req.params.productId) {
            return res.status(400).json({ error: "Product ID is required." });
        }

        const product = await Product.findByPk(req.params.productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Soft delete - mark as inactive
        await product.update({ is_active: false });
        
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Get product by SKU
app.post("/product/sku", async (req, res) => {
    try {
        const { skuCode } = req.body;
        
        if (!skuCode) {
            return res.status(400).json({ error: "SKU code is required" });
        }

        const product = await Product.findOne({
            where: { sku: skuCode },
            include: [
                { model: Category, as: 'category' },
                { model: RawMaterial, as: 'rawMaterials', through: { attributes: ['quantity_required'] } }
            ]
        });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        console.error('Error fetching product by SKU:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

 


// Decrement inventory for products
app.decrementInventory = async function (products) {
    try {
        for (const transactionProduct of products) {
            const product = await Product.findByPk(transactionProduct.id, {
                include: [{ model: RawMaterial, as: 'rawMaterials', through: { attributes: ['quantity_required'] } }]
            });

            if (!product) {
                console.warn(`Product with ID ${transactionProduct.id} not found`);
                continue;
            }

            // Decrement raw materials for this product
            if (product.rawMaterials && product.rawMaterials.length > 0) {
                await app.decrementRawMaterials(product.rawMaterials, transactionProduct.quantity);
            }

            // Decrement product quantity
            if (product.quantity !== null && product.quantity > 0) {
                const updatedQuantity = Math.max(0, product.quantity - transactionProduct.quantity);
                await product.update({ quantity: updatedQuantity });
                console.log(`Updated product ${product.id} quantity to ${updatedQuantity}`);
            }
        }
    } catch (error) {
        console.error('Error decrementing inventory:', error);
        throw error;
    }
};

// Function to decrement raw materials
app.decrementRawMaterials = async function (rawMaterials, productQuantity) {
    try {
        for (const rawMaterial of rawMaterials) {
            // Access the raw material ID and quantity from the association
            const rawMaterialId = rawMaterial.id;
            const quantityRequired = rawMaterial.ProductRawMaterial.quantity_required;
            
            const material = await RawMaterial.findByPk(rawMaterialId);
            
            if (!material || !material.quantity_in_stock) {
                console.warn(`Raw material with ID ${rawMaterialId} not found or no stock`);
                continue;
            }

            const totalRequiredQuantity = quantityRequired * productQuantity;
            const updatedQuantity = Math.max(0, material.quantity_in_stock - totalRequiredQuantity);

            await material.update({ quantity_in_stock: updatedQuantity });
            console.log(`Updated raw material ${material.id} quantity to ${updatedQuantity}`);
        }
    } catch (error) {
        console.error('Error decrementing raw materials:', error);
        throw error;
    }
};