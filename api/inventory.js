const app = require( "express" )();
const server = require( "http" ).Server( app );
const bodyParser = require( "body-parser" );
const multer = require( "multer" );
const Datastore = require( "@seald-io/nedb" );
const async = require( "async" );
const fs = require( "fs" );
const path = require("path");
const config = require("./config");

// Ensure directories exist
config.ensureDirectories();

const storage = multer.diskStorage({
    destination: config.uploadsPath,
    filename: function(req, file, callback){
        callback(null, Date.now() + '.jpg'); // 
    }
});


let upload = multer({storage: storage});

app.use(bodyParser.json());


module.exports = app;

 
let inventoryDB = new Datastore( {
    filename: path.join(config.databasePath, "inventory.db"),
    autoload: true
} );


inventoryDB.ensureIndex({ fieldName: '_id', unique: true });

 
app.get( "/", function ( req, res ) {
    res.send( "Inventory API" );
} );


 
app.get( "/product/:productId", function ( req, res ) {
    if ( !req.params.productId ) {
        res.status( 500 ).send( "ID field is required." );
    } else {
        inventoryDB.findOne( {
            _id: parseInt(req.params.productId)
        }, function ( err, product ) {
            res.send( product );
        } );
    }
} );


 
app.get( "/products", function ( req, res ) {
    inventoryDB.find( {}, function ( err, docs ) {
        res.send( docs );
    } );
} );


 
app.post( "/product", upload.single('imagename'), function ( req, res ) {

    let image = '';

    if(req.body.img != "") {
        image = req.body.img;        
    }

    if(req.file) {
        image = req.file.filename;  
    }
 

    if(req.body.remove == 1) {
        const path = './resources/app/public/uploads/product_image/'+ req.body.img;
        try {
          fs.unlinkSync(path)
        } catch(err) {
          console.error(err)
        }

        if(!req.file) {
            image = '';
        }
    }
    
    // Process raw materials
    let rawMaterials = [];
    if (req.body.raw_materials && req.body.raw_material_quantities) {
        const materials = Array.isArray(req.body.raw_materials) ? req.body.raw_materials : [req.body.raw_materials];
        const quantities = Array.isArray(req.body.raw_material_quantities) ? req.body.raw_material_quantities : [req.body.raw_material_quantities];
        
        materials.forEach((materialId, index) => {
            if (materialId && quantities[index] && parseFloat(quantities[index]) > 0) {
                rawMaterials.push({
                    material_id: parseInt(materialId),
                    quantity: parseFloat(quantities[index])
                });
            }
        });
    }

    let Product = {
        _id: parseInt(req.body.id),
        price: req.body.price,
        category: req.body.category,
        quantity: req.body.quantity == "" ? 0 : req.body.quantity,
        name: req.body.name,
        stock: req.body.stock == "on" ? 0 : 1,    
        img: image,
        raw_materials: rawMaterials
    }

    if(req.body.id == "") { 
        Product._id = Math.floor(Date.now() / 1000);
        inventoryDB.insert( Product, function ( err, product ) {
            if ( err ) res.status( 500 ).send( err );
            else res.send( product );
        });
    }
    else { 
        inventoryDB.update( {
            _id: req.body.id
        }, Product, {}, function (
            err,
            numReplaced,
            product
        ) {
            if ( err ) res.status( 500 ).send( err );
            else res.sendStatus( 200 );
        } );

    }

});



 
app.delete( "/product/:productId", function ( req, res ) {
    inventoryDB.remove( {
        _id: parseInt(req.params.productId)
    }, function ( err, numRemoved ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
} );

 

app.post( "/product/sku", function ( req, res ) {
    var request = req.body;
    inventoryDB.findOne( {
            _id: request.skuCode
    }, function ( err, product ) {
         res.send( product );
    } );
} );

 


app.decrementInventory = function ( products ) {

    async.eachSeries( products, function ( transactionProduct, callback ) {
        inventoryDB.findOne( {
            _id: transactionProduct.id
        }, function (
            err,
            product
        ) {
    
            if ( !product ) {
                callback();
            } else {
                // Decrement raw materials for this product (regardless of product stock tracking)
                if (product.raw_materials && product.raw_materials.length > 0) {
                    app.decrementRawMaterials(product.raw_materials, transactionProduct.quantity, function(rawMaterialErr) {
                        if (rawMaterialErr) {
                            callback(rawMaterialErr);
                        } else {
                            // Now handle product quantity if stock tracking is enabled
                            if (product.stock == 1 && product.quantity) {
                                let updatedQuantity =
                                    parseInt( product.quantity) -
                                    parseInt( transactionProduct.quantity );

                                // Use direct update with proper error handling
                                inventoryDB.update(
                                    { _id: product._id },
                                    { $set: { quantity: updatedQuantity } },
                                    { multi: false, upsert: false },
                                    function(err, numReplaced, upsert) {
                                        if (err) {
                                            console.error('Error updating product quantity:', err);
                                            callback(err);
                                        } else if (numReplaced === 0) {
                                            console.warn('No product updated for ID:', product._id, '- trying alternative approach');
                                            // Alternative: find and update manually
                                            inventoryDB.findOne({_id: product._id}, function(err, doc) {
                                                if (err || !doc) {
                                                    console.error('Product not found for manual update:', product._id);
                                                    callback(err);
                                                } else {
                                                    doc.quantity = updatedQuantity;
                                                    inventoryDB.update({_id: product._id}, doc, {}, function(err, numReplaced) {
                                                        if (err) {
                                                            console.error('Manual update failed:', err);
                                                        } else {
                                                            console.log('Manual update successful for product:', product._id, 'to', updatedQuantity);
                                                        }
                                                        callback(err);
                                                    });
                                                }
                                            });
                                        } else {
                                            console.log('Updated product quantity:', product._id, 'to', updatedQuantity);
                                            callback(null);
                                        }
                                    }
                                );
                            } else {
                                callback();
                            }
                        }
                    });
                } else {
                    // No raw materials, just handle product quantity if stock tracking is enabled
                    if (product.stock == 1 && product.quantity) {
                        let updatedQuantity =
                            parseInt( product.quantity) -
                            parseInt( transactionProduct.quantity );

                        // Use direct update with proper error handling
                        inventoryDB.update(
                            { _id: product._id },
                            { $set: { quantity: updatedQuantity } },
                            { multi: false, upsert: false },
                            function(err, numReplaced, upsert) {
                                if (err) {
                                    console.error('Error updating product quantity:', err);
                                    callback(err);
                                } else if (numReplaced === 0) {
                                    console.warn('No product updated for ID:', product._id, '- trying alternative approach');
                                    // Alternative: find and update manually
                                    inventoryDB.findOne({_id: product._id}, function(err, doc) {
                                        if (err || !doc) {
                                            console.error('Product not found for manual update:', product._id);
                                            callback(err);
                                        } else {
                                            doc.quantity = updatedQuantity;
                                            inventoryDB.update({_id: product._id}, doc, {}, function(err, numReplaced) {
                                                if (err) {
                                                    console.error('Manual update failed:', err);
                                                } else {
                                                    console.log('Manual update successful for product:', product._id, 'to', updatedQuantity);
                                                }
                                                callback(err);
                                            });
                                        }
                                    });
                                } else {
                                    console.log('Updated product quantity:', product._id, 'to', updatedQuantity);
                                    callback(null);
                                }
                            }
                        );
                    } else {
                        callback();
                    }
                }
            }
        } );
    } );
};

// Function to decrement raw materials
app.decrementRawMaterials = function ( rawMaterials, productQuantity, callback ) {
    const Datastore = require( "@seald-io/nedb" );
    const path = require("path");
    const config = require("./config");
    
    let rawMaterialsDB = new Datastore( {
        filename: path.join(config.databasePath, "raw_materials.db"),
        autoload: true
    } );
    
    async.eachSeries( rawMaterials, function ( rawMaterial, materialCallback ) {
        rawMaterialsDB.findOne( {
            _id: rawMaterial.material_id
        }, function (
            err,
            material
        ) {
    
            if ( !material || !material.quantity ) {
                materialCallback();
            } else {
                let totalRequiredQuantity = rawMaterial.quantity * productQuantity;
                let updatedQuantity = material.quantity - totalRequiredQuantity;

                // Ensure quantity doesn't go below 0
                if (updatedQuantity < 0) {
                    updatedQuantity = 0;
                }

                // Use direct update with proper error handling
                rawMaterialsDB.update(
                    { _id: material._id },
                    { $set: { quantity: updatedQuantity } },
                    { multi: false, upsert: false },
                    function(err, numReplaced, upsert) {
                        if (err) {
                            console.error('Error updating raw material quantity:', err);
                            materialCallback(err);
                        } else if (numReplaced === 0) {
                            console.warn('No raw material updated for ID:', material._id, '- trying alternative approach');
                            // Alternative: find and update manually
                            rawMaterialsDB.findOne({_id: material._id}, function(err, doc) {
                                if (err || !doc) {
                                    console.error('Raw material not found for manual update:', material._id);
                                    materialCallback(err);
                                } else {
                                    doc.quantity = updatedQuantity;
                                    rawMaterialsDB.update({_id: material._id}, doc, {}, function(err, numReplaced) {
                                        if (err) {
                                            console.error('Manual update failed:', err);
                                        } else {
                                            console.log('Manual update successful for raw material:', material._id, 'to', updatedQuantity);
                                        }
                                        materialCallback(err);
                                    });
                                }
                            });
                        } else {
                            console.log('Updated raw material quantity:', material._id, 'to', updatedQuantity);
                            materialCallback(null);
                        }
                    }
                );
            }
        } );
    }, callback );
};