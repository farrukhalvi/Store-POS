const express = require("express");
const { Transaction, TransactionItem, Product, User, Customer, RawMaterial, ProductRawMaterial, sequelize } = require("../models");
const { Op } = require("sequelize");
const inventoryApi = require("./inventory");

const app = express();
app.use(express.json());

// Function to check raw material availability for a transaction
async function checkRawMaterialAvailability(items) {
    const insufficientMaterials = [];
    
    for (const item of items) {
        const productId = item.product_id || item._id || item.id;
        const product = await Product.findByPk(productId, {
            include: [{
                model: RawMaterial,
                as: 'rawMaterials',
                through: {
                    model: ProductRawMaterial,
                    attributes: ['quantity_required']
                }
            }]
        });
        
        if (!product || !product.rawMaterials || product.rawMaterials.length === 0) {
            continue; // No raw materials required for this product
        }
        
        for (const rawMaterial of product.rawMaterials) {
            const quantityRequired = rawMaterial.ProductRawMaterial.quantity_required;
            const totalRequired = quantityRequired * item.quantity;
            
            if (rawMaterial.quantity_in_stock < totalRequired) {
                insufficientMaterials.push({
                    product_name: product.name,
                    raw_material_name: rawMaterial.name,
                    required: totalRequired,
                    available: rawMaterial.quantity_in_stock,
                    shortfall: totalRequired - rawMaterial.quantity_in_stock
                });
            }
        }
    }
    
    return insufficientMaterials;
}

module.exports = app;

// Get all transactions
app.get("/transactions", async (req, res) => {
    try {
        const { user, status, start, end } = req.query;
        console.log('Transaction filters:', { user, status, start, end });
        
        // Build where clause based on filters
        let whereClause = {};
        
        // Filter by user (cashier)
        if (user) {
            whereClause.user_id = user;
        }
        
        // Filter by status (convert status values)
        if (status) {
            // Status filter: 1 = Paid (completed), 0 = Unpaid (pending)
            whereClause.status = status === '1' ? 'completed' : 'pending';
        }
        
        // Filter by date range
        if (start && end) {
            // Adjust for timezone - assume client is GMT+5 (Pakistan/India time)
            // When client sends "2025-09-09", they want to see transactions that display as Sept 9 in their timezone
            // A transaction at "2025-09-08T19:00:00Z" displays as "Sept 9" in GMT+5
            // So we need to search from (date-1) 19:00 UTC to (date) 18:59 UTC
            
            const startDate = new Date(start + 'T00:00:00.000Z');
            const endDate = new Date(end + 'T23:59:59.999Z');
            
            // Adjust for GMT+5 timezone (subtract 5 hours from start, add 19 hours to cover full day)
            const timezoneOffset = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
            const adjustedStartDate = new Date(startDate.getTime() - timezoneOffset);
            const adjustedEndDate = new Date(endDate.getTime() - timezoneOffset);
            
            whereClause.created_at = {
                [Op.between]: [adjustedStartDate, adjustedEndDate]
            };
            console.log('Date filter (timezone adjusted):', { 
                original: { start: startDate, end: endDate },
                adjusted: { start: adjustedStartDate, end: adjustedEndDate }
            });
        }
        
        const transactions = await Transaction.findAll({
            where: whereClause,
            include: [
                { 
                    model: User, 
                    attributes: ['username', 'full_name'],
                    as: 'user'
                },
                { 
                    model: Customer, 
                    attributes: ['name', 'email'],
                    as: 'customer'
                }
            ],
            order: [['created_at', 'DESC']]
        });
        
        console.log(`Found ${transactions.length} transactions with filters`);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get single transaction
app.get("/transaction/:id", async (req, res) => {
    try {
        console.log('Fetching transaction with ID:', req.params.id);
        
        if (!req.params.id) {
            return res.status(400).json({ error: "Transaction ID is required." });
        }
        
        const transaction = await Transaction.findByPk(req.params.id, {
            include: [
                { 
                    model: User, 
                    attributes: ['username', 'full_name'],
                    as: 'user'
                },
                { 
                    model: Customer, 
                    attributes: ['name', 'email', 'phone'],
                    as: 'customer'
                },
                {
                    model: TransactionItem,
                    as: 'items',
                    include: [{
                        model: Product,
                        as: 'product',
                        attributes: ['name', 'sku', 'price']
                    }]
                }
            ]
        });
        
        console.log('Transaction found:', transaction ? 'Yes' : 'No');
        if (transaction) {
            console.log('Transaction items count:', transaction.items ? transaction.items.length : 'No items');
        }
        
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        
        res.json(transaction);
    } catch (error) {
        console.error('Error fetching transaction:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction', details: error.message });
    }
});

// Create new transaction
app.post("/transaction", async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        console.log('Transaction POST request body:', JSON.stringify(req.body, null, 2));
        
        const {
            items,
            customer_id,
            customer,
            payment_method,
            payment_type,
            notes,
            user_id
        } = req.body;

        // Handle both customer_id and customer object from frontend
        const finalCustomerId = customer_id || (customer && customer._id) || null;
        
        // Handle both payment_method and payment_type from frontend
        let rawPaymentMethod = payment_method || payment_type || 'cash';
        
        // Normalize payment method to match database enum (lowercase)
        const validPaymentMethods = ['cash', 'card', 'mobile', 'bank_transfer'];
        const normalizedPaymentMethod = rawPaymentMethod.toLowerCase();
        const finalPaymentMethod = validPaymentMethods.includes(normalizedPaymentMethod) 
            ? normalizedPaymentMethod 
            : 'cash';
        
        console.log('Processed values:', {
            finalCustomerId,
            finalPaymentMethod,
            user_id,
            itemsCount: items ? items.length : 0
        });

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Transaction items are required" });
        }

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // Calculate totals
        let subtotal = 0;
        let total = 0;
        const tax_rate = 0.085; // Default tax rate, should come from settings

        for (const item of items) {
            console.log('Processing item:', JSON.stringify(item, null, 2));
            
            // Handle both product_id and _id from frontend
            const productId = item.product_id || item._id || item.id;
            
            if (!productId) {
                throw new Error(`Product ID is missing in item: ${JSON.stringify(item)}`);
            }
            
            const product = await Product.findByPk(productId);
            if (!product) {
                throw new Error(`Product with ID ${productId} not found`);
            }

            if (product.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}`);
            }

            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;
        }

        // Check raw material availability
        const insufficientMaterials = await checkRawMaterialAvailability(items);
        if (insufficientMaterials.length > 0) {
            const errorMessage = insufficientMaterials.map(material => 
                `Insufficient raw material "${material.raw_material_name}" for product "${material.product_name}": Required ${material.required}, Available ${material.available} (Shortfall: ${material.shortfall})`
            ).join('\n');
            
            return res.status(400).json({ 
                error: "Insufficient raw materials to fulfill this order",
                details: insufficientMaterials,
                message: errorMessage
            });
        }

        total = subtotal + (subtotal * tax_rate);

        // Generate transaction number
        const transactionNumber = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create transaction
        const transaction = await Transaction.create({
            transaction_number: transactionNumber,
            subtotal: subtotal,
            tax: subtotal * tax_rate,
            total: total,
            payment_method: finalPaymentMethod,
            status: 'completed',
            notes: notes,
            user_id: user_id,
            customer_id: finalCustomerId
        }, { transaction: t });

        // Create transaction items and update inventory
        for (const item of items) {
            // Handle both product_id and _id from frontend
            const productId = item.product_id || item._id || item.id;
            const product = await Product.findByPk(productId);
            
            // Create transaction item
            await TransactionItem.create({
                transaction_id: transaction.id,
                product_id: productId,
                quantity: item.quantity,
                unit_price: product.price,
                total_price: product.price * item.quantity,
                discount: item.discount || 0
            }, { transaction: t });

            // Update product quantity
            await product.update({
                quantity: product.quantity - item.quantity
            }, { transaction: t });
        }

        await t.commit();

        // Decrement raw materials after transaction is committed
        try {
            // Transform items to match the expected format for decrementInventory
            const productsForDecrement = items.map(item => ({
                id: item.product_id || item._id || item.id,
                quantity: item.quantity
            }));
            await inventoryApi.decrementInventory(productsForDecrement);
        } catch (error) {
            console.error('Error decrementing raw materials:', error);
            // Don't fail the transaction if raw materials update fails
            // Just log the error for debugging
        }

        // Fetch complete transaction with associations (after commit)
        try {
            const completeTransaction = await Transaction.findByPk(transaction.id, {
                include: [
                    { 
                        model: User, 
                        attributes: ['username', 'full_name'],
                        as: 'user'
                    },
                    { 
                        model: Customer, 
                        attributes: ['name', 'email'],
                        as: 'customer'
                    },
                    {
                        model: TransactionItem,
                        as: 'items',
                        include: [{
                            model: Product,
                            as: 'product',
                            attributes: ['name', 'sku', 'price']
                        }]
                    }
                ]
            });

            res.json(completeTransaction);
        } catch (fetchError) {
            // Transaction was already committed, so just return basic success
            console.error('Error fetching complete transaction (transaction was successful):', fetchError);
            res.json({ 
                id: transaction.id, 
                transaction_number: transaction.transaction_number,
                message: 'Transaction created successfully' 
            });
        }
    } catch (error) {
        // Only rollback if transaction hasn't been committed yet
        try {
            await t.rollback();
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError.message);
        }
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
});

// Update transaction status
app.put("/transaction/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: "Status is required" });
        }

        const transaction = await Transaction.findByPk(id);
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        await transaction.update({ status: status });
        
        res.json({ message: "Transaction status updated successfully" });
    } catch (error) {
        console.error('Error updating transaction status:', error);
        res.status(500).json({ error: 'Failed to update transaction status' });
    }
});

// Get transaction statistics
app.get("/stats", async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let whereClause = {};
        if (start_date && end_date) {
            // Create dates in UTC and adjust for GMT+5 timezone
            const startDate = new Date(start_date + 'T00:00:00.000Z');
            const endDate = new Date(end_date + 'T23:59:59.999Z');
            
            // Adjust for GMT+5 timezone
            const timezoneOffset = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
            const adjustedStartDate = new Date(startDate.getTime() - timezoneOffset);
            const adjustedEndDate = new Date(endDate.getTime() - timezoneOffset);
            
            whereClause.created_at = {
                [Op.between]: [adjustedStartDate, adjustedEndDate]
            };
            console.log('Stats date filter (timezone adjusted):', { 
                original: { start: startDate, end: endDate },
                adjusted: { start: adjustedStartDate, end: adjustedEndDate }
            });
        }

        const totalTransactions = await Transaction.count({ where: whereClause });
        const totalRevenue = await Transaction.sum('total', { where: whereClause });
        const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        // Get top selling products
        const topProducts = await TransactionItem.findAll({
            attributes: [
                'product_id',
                [sequelize.fn('SUM', sequelize.col('TransactionItem.quantity')), 'total_quantity'],
                [sequelize.fn('SUM', sequelize.col('TransactionItem.total_price')), 'total_revenue']
            ],
            include: [
                {
                    model: Product,
                    as: 'product',
                    attributes: ['name', 'sku']
                },
                {
                    model: Transaction,
                    as: 'transaction',
                    attributes: [],
                    where: whereClause
                }
            ],
            group: ['product_id', 'product.id'],
            order: [[sequelize.fn('SUM', sequelize.col('TransactionItem.quantity')), 'DESC']],
            limit: 10
        });

        res.json({
            total_transactions: totalTransactions,
            total_revenue: totalRevenue,
            average_transaction_value: avgTransactionValue,
            top_products: topProducts
        });
    } catch (error) {
        console.error('Error fetching transaction stats:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction statistics', details: error.message });
    }
});

// Refund transaction
app.post("/transaction/:id/refund", async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const transaction = await Transaction.findByPk(id, {
            include: [{
                model: TransactionItem,
                as: 'items'
            }]
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        if (transaction.status !== 'completed') {
            return res.status(400).json({ error: "Only completed transactions can be refunded" });
        }

        // Update transaction status
        await transaction.update({ status: 'refunded' }, { transaction: t });

        // Restore product quantities
        for (const item of transaction.items) {
            const product = await Product.findByPk(item.product_id);
            if (product) {
                await product.update({
                    quantity: product.quantity + item.quantity
                }, { transaction: t });
            }
        }

        await t.commit();
        
        res.json({ message: "Transaction refunded successfully" });
    } catch (error) {
        await t.rollback();
        console.error('Error refunding transaction:', error);
        res.status(500).json({ error: 'Failed to refund transaction' });
    }
});

// Get hold orders
app.get("/on-hold", async (req, res) => {
    try {
        const holdOrders = await Transaction.findAll({
            where: {
                status: 'pending'
            },
            include: [
                { 
                    model: User, 
                    attributes: ['username', 'full_name'],
                    as: 'user'
                },
                { 
                    model: Customer, 
                    attributes: ['name', 'email'],
                    as: 'customer'
                },
                {
                    model: TransactionItem,
                    as: 'items',
                    include: [{
                        model: Product,
                        as: 'product',
                        attributes: ['name', 'sku', 'price']
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(holdOrders);
    } catch (error) {
        console.error('Error fetching hold orders:', error);
        res.status(500).json({ error: 'Failed to fetch hold orders' });
    }
});

// Get customer orders
app.get("/customer-orders", async (req, res) => {
    try {
        const customerOrders = await Transaction.findAll({
            where: {
                customer_id: { [Op.ne]: null }
            },
            include: [
                { 
                    model: User, 
                    attributes: ['username', 'full_name'],
                    as: 'user'
                },
                { 
                    model: Customer, 
                    attributes: ['name', 'email'],
                    as: 'customer'
                },
                {
                    model: TransactionItem,
                    as: 'items',
                    include: [{
                        model: Product,
                        as: 'product',
                        attributes: ['name', 'sku', 'price']
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(customerOrders);
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
});

// Test endpoint for basic transactions
app.get("/by-date-simple", async (req, res) => {
    try {
        console.log('Testing simple transactions query...');
        const transactions = await Transaction.findAll({
            limit: 5
        });
        console.log('Simple query successful, found:', transactions.length);
        res.json({ message: 'Simple query works', count: transactions.length });
    } catch (error) {
        console.error('Simple query failed:', error.message);
        res.status(500).json({ error: 'Simple query failed', details: error.message });
    }
});

// Get transactions by date range and filters
app.get("/by-date", async (req, res) => {
    try {
        const { start, end, user, status, till } = req.query;
        console.log('by-date query params:', { start, end, user, status, till });
        
        // Return empty array for now to test if the endpoint works
        res.json([]);
        
    } catch (error) {
        console.error('Error in by-date endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
    }
});
