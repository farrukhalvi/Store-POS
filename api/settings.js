const express = require("express");
const { Setting } = require("../models");

const app = express();
app.use(express.json());

module.exports = app;

// Get all settings (alias for /get)
app.get("/get", async (req, res) => {
    try {
        const settings = await Setting.findAll({
            order: [['key', 'ASC']]
        });
        
        // Convert to key-value pairs for easier frontend consumption
        const settingsObj = {};
        settings.forEach(setting => {
            let value = setting.value;
            
            // Convert value based on type
            if (setting.type === 'number') {
                value = parseFloat(value);
            } else if (setting.type === 'boolean') {
                value = value === 'true' || value === '1';
            } else if (setting.type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = value;
                }
            }
            
            settingsObj[setting.key] = value;
        });
        
        // Map database keys to frontend expected keys
        const frontendSettings = {
            store: settingsObj.store_name || 'My Store',
            address_one: settingsObj.store_address || '',
            address_two: settingsObj.store_address2 || '',
            contact: settingsObj.store_phone || '',
            tax: settingsObj.vat_number || '',
            symbol: settingsObj.currency_symbol || '$',
            percentage: settingsObj.tax_rate || '0',
            charge_tax: settingsObj.charge_tax || false,
            footer: settingsObj.receipt_footer || 'Thank you for your business!',
            img: settingsObj.store_logo || '',
            app: settingsObj.app_type || 'Desktop Point of Sale',
            mac: settingsObj.mac_address || '',
            till: settingsObj.till_number || 1
        };
        
        res.json({ settings: frontendSettings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Get all settings
app.get("/", async (req, res) => {
    try {
        const settings = await Setting.findAll({
            order: [['key', 'ASC']]
        });
        
        // Convert to key-value pairs for easier frontend consumption
        const settingsObj = {};
        settings.forEach(setting => {
            let value = setting.value;
            
            // Convert value based on type
            if (setting.type === 'number') {
                value = parseFloat(value);
            } else if (setting.type === 'boolean') {
                value = value === 'true' || value === '1';
            } else if (setting.type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = value;
                }
            }
            
            settingsObj[setting.key] = value;
        });
        
        // Map database keys to frontend expected keys
        const frontendSettings = {
            store: settingsObj.store_name || 'My Store',
            address_one: settingsObj.store_address || '',
            address_two: settingsObj.store_address2 || '',
            contact: settingsObj.store_phone || '',
            tax: settingsObj.vat_number || '',
            symbol: settingsObj.currency_symbol || '$',
            percentage: settingsObj.tax_rate || '0',
            charge_tax: settingsObj.charge_tax || false,
            footer: settingsObj.receipt_footer || 'Thank you for your business!',
            img: settingsObj.store_logo || '',
            app: settingsObj.app_type || 'Desktop Point of Sale',
            mac: settingsObj.mac_address || '',
            till: settingsObj.till_number || 1
        };
        
        res.json({ settings: frontendSettings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Get single setting
app.get("/:key", async (req, res) => {
    try {
        if (!req.params.key) {
            return res.status(400).json({ error: "Setting key is required." });
        }
        
        const setting = await Setting.findOne({
            where: { 
                key: req.params.key
            }
        });
        
        if (!setting) {
            return res.status(404).json({ error: "Setting not found" });
        }
        
        let value = setting.value;
        
        // Convert value based on type
        if (setting.type === 'number') {
            value = parseFloat(value);
        } else if (setting.type === 'boolean') {
            value = value === 'true' || value === '1';
        } else if (setting.type === 'json') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = value;
            }
        }
        
        res.json({
            key: setting.key,
            value: value,
            type: setting.type,
            description: setting.description
        });
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
});

// Create/Update setting (alias for /post) - handles bulk settings from frontend
app.post("/post", async (req, res) => {
    try {
        const formData = req.body;
        
        // Map frontend form fields to setting keys
        const settingMappings = {
            'store': { key: 'store_name', description: 'Store name', type: 'string' },
            'address_one': { key: 'store_address', description: 'Store address line 1', type: 'string' },
            'address_two': { key: 'store_address2', description: 'Store address line 2', type: 'string' },
            'contact': { key: 'store_phone', description: 'Store contact number', type: 'string' },
            'tax': { key: 'vat_number', description: 'VAT/Tax number', type: 'string' },
            'symbol': { key: 'currency_symbol', description: 'Currency symbol', type: 'string' },
            'percentage': { key: 'tax_rate', description: 'Tax rate percentage', type: 'number' },
            'charge_tax': { key: 'charge_tax', description: 'Charge tax on sales', type: 'boolean' },
            'footer': { key: 'receipt_footer', description: 'Receipt footer text', type: 'string' },
            'img': { key: 'store_logo', description: 'Store logo filename', type: 'string' },
            'app': { key: 'app_type', description: 'Application type', type: 'string' },
            'mac': { key: 'mac_address', description: 'MAC address', type: 'string' },
            'till': { key: 'till_number', description: 'Till number', type: 'number' }
        };

        const results = [];
        
        // Process each field from the form
        for (const [fieldName, value] of Object.entries(formData)) {
            if (settingMappings[fieldName] && value !== undefined && value !== '') {
                const mapping = settingMappings[fieldName];
                
                // Check if setting exists
                const existingSetting = await Setting.findOne({ where: { key: mapping.key } });
                
                let processedValue = value;
                if (mapping.type === 'boolean') {
                    processedValue = value === 'on' || value === true || value === 'true' || value === '1';
                } else if (mapping.type === 'number') {
                    processedValue = parseFloat(value) || 0;
                }
                
                if (existingSetting) {
                    // Update existing setting
                    await existingSetting.update({
                        value: processedValue.toString(),
                        description: mapping.description,
                        type: mapping.type
                    });
                    results.push({ key: mapping.key, action: 'updated', setting: existingSetting });
                } else {
                    // Create new setting
                    const newSetting = await Setting.create({
                        key: mapping.key,
                        value: processedValue.toString(),
                        description: mapping.description,
                        type: mapping.type
                    });
                    results.push({ key: mapping.key, action: 'created', setting: newSetting });
                }
            }
        }
        
        res.json({ 
            message: "Settings saved successfully", 
            results: results,
            count: results.length
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Create/Update setting
app.post("/", async (req, res) => {
    try {
        const { key, value, description, type } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: "Setting key is required" });
        }

        // Validate type
        const validTypes = ['string', 'number', 'boolean', 'json'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({ error: "Invalid setting type" });
        }

        // Convert value to string for storage
        let stringValue = value;
        if (type === 'json') {
            stringValue = JSON.stringify(value);
        } else if (type === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else if (type === 'number') {
            stringValue = value.toString();
        }

        const settingData = {
            key: key,
            value: stringValue,
            description: description || '',
            type: type || 'string',
            is_active: true
        };

        let setting = await Setting.findOne({ where: { key: key } });
        
        if (setting) {
            // Update existing setting
            await setting.update(settingData);
        } else {
            // Create new setting
            setting = await Setting.create(settingData);
        }

        res.json({
            key: setting.key,
            value: value, // Return original value, not stringified
            type: setting.type,
            description: setting.description
        });
    } catch (error) {
        console.error('Error saving setting:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// Delete setting
app.delete("/:key", async (req, res) => {
    try {
        if (!req.params.key) {
            return res.status(400).json({ error: "Setting key is required." });
        }

        const setting = await Setting.findOne({
            where: { key: req.params.key }
        });
        
        if (!setting) {
            return res.status(404).json({ error: "Setting not found" });
        }

        // Soft delete - just mark as inactive
        await setting.update({ is_active: false });
        
        res.json({ message: "Setting deleted successfully" });
    } catch (error) {
        console.error('Error deleting setting:', error);
        res.status(500).json({ error: 'Failed to delete setting' });
    }
});

// Bulk update settings
app.post("/bulk", async (req, res) => {
    try {
        const settings = req.body;
        
        if (!Array.isArray(settings)) {
            return res.status(400).json({ error: "Settings must be an array" });
        }

        const results = [];
        
        for (const settingData of settings) {
            try {
                const { key, value, description, type } = settingData;
                
                if (!key) {
                    results.push({ key, success: false, error: "Key is required" });
                    continue;
                }

                // Validate type
                const validTypes = ['string', 'number', 'boolean', 'json'];
                if (type && !validTypes.includes(type)) {
                    results.push({ key, success: false, error: "Invalid type" });
                    continue;
                }

                // Convert value to string for storage
                let stringValue = value;
                if (type === 'json') {
                    stringValue = JSON.stringify(value);
                } else if (type === 'boolean') {
                    stringValue = value ? 'true' : 'false';
                } else if (type === 'number') {
                    stringValue = value.toString();
                }

                const data = {
                    key: key,
                    value: stringValue,
                    description: description || '',
                    type: type || 'string',
                    is_active: true
                };

                let setting = await Setting.findOne({ where: { key: key } });
                
                if (setting) {
                    await setting.update(data);
                } else {
                    setting = await Setting.create(data);
                }

                results.push({ key, success: true });
            } catch (error) {
                results.push({ key: settingData.key, success: false, error: error.message });
            }
        }

        res.json({ results });
    } catch (error) {
        console.error('Error bulk updating settings:', error);
        res.status(500).json({ error: 'Failed to bulk update settings' });
    }
});

// Reset settings to defaults
app.post("/reset", async (req, res) => {
    try {
        const defaultSettings = [
            { key: 'store_name', value: 'My Store', description: 'Store name', type: 'string' },
            { key: 'store_address', value: '123 Main St', description: 'Store address', type: 'string' },
            { key: 'store_phone', value: '+1-555-0123', description: 'Store phone number', type: 'string' },
            { key: 'tax_rate', value: '8.5', description: 'Tax rate percentage', type: 'number' },
            { key: 'currency', value: 'USD', description: 'Store currency', type: 'string' },
            { key: 'receipt_footer', value: 'Thank you for your purchase!', description: 'Receipt footer message', type: 'string' },
            { key: 'low_stock_threshold', value: '10', description: 'Low stock threshold', type: 'number' },
            { key: 'enable_barcodes', value: 'true', description: 'Enable barcode scanning', type: 'boolean' },
            { key: 'enable_customer_loyalty', value: 'false', description: 'Enable customer loyalty program', type: 'boolean' }
        ];

        // Deactivate all existing settings
        await Setting.update({ is_active: false }, { where: {} });

        // Create new default settings
        for (const setting of defaultSettings) {
            await Setting.create(setting);
        }

        res.json({ message: "Settings reset to defaults successfully" });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({ error: 'Failed to reset settings' });
    }
});

 