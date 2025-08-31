const app = require( "express" )();
const server = require( "http" ).Server( app );
const bodyParser = require( "body-parser" );
const multer = require( "multer" );
const Datastore = require( "nedb" );
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

 
let rawMaterialsDB = new Datastore( {
    filename: path.join(config.databasePath, "raw_materials.db"),
    autoload: true
} );


rawMaterialsDB.ensureIndex({ fieldName: '_id', unique: true });

 
app.get( "/", function ( req, res ) {
    res.send( "Raw Materials API" );
} );


 
app.get( "/raw-material/:materialId", function ( req, res ) {
    if ( !req.params.materialId ) {
        res.status( 500 ).send( "ID field is required." );
    } else {
        rawMaterialsDB.findOne( {
            _id: parseInt(req.params.materialId)
        }, function ( err, material ) {
            res.send( material );
        } );
    }
} );


 
app.get( "/raw-materials", function ( req, res ) {
    rawMaterialsDB.find( {}, function ( err, docs ) {
        res.send( docs );
    } );
} );


 
app.post( "/raw-material", upload.single('imagename'), function ( req, res ) {

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
    
    let RawMaterial = {
        _id: parseInt(req.body.id),
        name: req.body.name,
        description: req.body.description,
        unit: req.body.unit,
        quantity: req.body.quantity == "" ? 0 : req.body.quantity,
        unit_price: req.body.unit_price,
        supplier: req.body.supplier,
        category: req.body.category,
        stock: req.body.stock == "on" ? 0 : 1,    
        img: image        
    }

    if(req.body.id == "") { 
        RawMaterial._id = Math.floor(Date.now() / 1000);
        rawMaterialsDB.insert( RawMaterial, function ( err, material ) {
            if ( err ) res.status( 500 ).send( err );
            else res.send( material );
        });
    }
    else { 
        rawMaterialsDB.update( {
            _id: parseInt(req.body.id)
        }, RawMaterial, {}, function (
            err,
            numReplaced,
            material
        ) {
            if ( err ) res.status( 500 ).send( err );
            else res.sendStatus( 200 );
        } );

    }

});



 
app.delete( "/raw-material/:materialId", function ( req, res ) {
    rawMaterialsDB.remove( {
        _id: parseInt(req.params.materialId)
    }, function ( err, numRemoved ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
} );



app.post( "/raw-material/sku", function ( req, res ) {
    var request = req.body;
    rawMaterialsDB.findOne( {
            _id: parseInt(request.skuCode)
    }, function ( err, material ) {
         res.send( material );
    } );
} );



app.decrementRawMaterialInventory = function ( materials ) {

    async.eachSeries( materials, function ( transactionMaterial, callback ) {
        rawMaterialsDB.findOne( {
            _id: parseInt(transactionMaterial.id)
        }, function (
            err,
            material
        ) {
    
            if ( !material || !material.quantity ) {
                callback();
            } else {
                let updatedQuantity =
                    parseInt( material.quantity) -
                    parseInt( transactionMaterial.quantity );

                rawMaterialsDB.update( {
                        _id: parseInt(material._id)
                    }, {
                        $set: {
                            quantity: updatedQuantity
                        }
                    }, {},
                    callback
                );
            }
        } );
    } );
};
