const app = require( "express" )();
const server = require( "http" ).Server( app );
const bodyParser = require( "body-parser" );
const Datastore = require( "@seald-io/nedb" );
const async = require( "async" );
const path = require("path");
const config = require("./config");

// Ensure directories exist
config.ensureDirectories();

app.use( bodyParser.json() );

module.exports = app;

 
let customersDB = new Datastore( {
    filename: path.join(config.databasePath, "customers.db"),
    autoload: true
} );


customersDB.ensureIndex({ fieldName: '_id', unique: true });


app.get( "/", function ( req, res ) {
    res.send( "Customer API" );
} );


app.get( "/customer/:customerId", function ( req, res ) {
    if ( !req.params.customerId ) {
        res.status( 500 ).send( "ID field is required." );
    } else {
        customersDB.findOne( {
            _id: req.params.customerId
        }, function ( err, customer ) {
            res.send( customer );
        } );
    }
} );

 
app.get( "/all", function ( req, res ) {
    customersDB.find( {}, function ( err, docs ) {
        res.send( docs );
    } );
} );

 
app.post( "/customer", function ( req, res ) {
    var newCustomer = req.body;
    customersDB.insert( newCustomer, function ( err, customer ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
} );



app.delete( "/customer/:customerId", function ( req, res ) {
    customersDB.remove( {
        _id: req.params.customerId
    }, function ( err, numRemoved ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
} );

 

 
app.put( "/customer", function ( req, res ) {
    let customerId = req.body._id;

    customersDB.update( {
        _id: customerId
    }, req.body, {}, function (
        err,
        numReplaced,
        customer
    ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
});



 