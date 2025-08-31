const app = require( "express")();
const server = require( "http" ).Server( app );
const bodyParser = require( "body-parser" );
const Datastore = require( "@seald-io/nedb" );
const btoa = require('btoa');
const async = require( "async" );
const path = require("path");
const config = require("./config");

// Ensure directories exist
config.ensureDirectories();

app.use( bodyParser.json() );

module.exports = app;

 
let usersDB = new Datastore( {
    filename: path.join(config.databasePath, "users.db"),
    autoload: true
} );


usersDB.ensureIndex({ fieldName: '_id', unique: true });


app.get( "/", function ( req, res ) {
    res.send( "Users API" );
} );


  
app.get( "/user/:userId", function ( req, res ) {
    if ( !req.params.userId ) {
        res.status( 500 ).send( "ID field is required." );
    }
    else{
    usersDB.findOne( {
        _id: parseInt(req.params.userId)
}, function ( err, docs ) {
        res.send( docs );
    } );
    }
} );



app.get( "/logout/:userId", function ( req, res ) {
    if ( !req.params.userId ) {
        res.status( 500 ).send( "ID field is required." );
    }
    else{ usersDB.update( {
            _id: parseInt(req.params.userId)
        }, {
            $set: {
                status: 'Logged Out_'+ new Date()
            }
        }, {},
    );

    res.sendStatus( 200 );
 
    }
});



app.post( "/login", function ( req, res ) {  
    console.log("Login attempt for username:", req.body.username);
    
    usersDB.findOne( {
        username: req.body.username,
        password: btoa(req.body.password)
    }, function ( err, docs ) {
        if (err) {
            console.error("Database error during login:", err);
            res.status(500).send({ error: "Database error" });
            return;
        }
        
        if(docs) {
            console.log("User found, updating status");
            usersDB.update( {
                _id: docs._id
            }, {
                $set: {
                    status: 'Logged In_'+ new Date()
                }
            }, {}, function(updateErr) {
                if (updateErr) {
                    console.error("Error updating user status:", updateErr);
                }
            });
        } else {
            console.log("No user found with these credentials");
        }
        
        res.send( docs );
    } );
} );




app.get( "/all", function ( req, res ) {
    usersDB.find( {}, function ( err, docs ) {
        res.send( docs );
    } );
} );



app.delete( "/user/:userId", function ( req, res ) {
    usersDB.remove( {
        _id: parseInt(req.params.userId)
    }, function ( err, numRemoved ) {
        if ( err ) res.status( 500 ).send( err );
        else res.sendStatus( 200 );
    } );
} );

 
app.post( "/post" , function ( req, res ) {   
    let User = { 
            "username": req.body.username,
            "password": btoa(req.body.password),
            "fullname": req.body.fullname,
            "perm_products": req.body.perm_products == "on" ? 1 : 0,
            "perm_categories": req.body.perm_categories == "on" ? 1 : 0,
            "perm_raw_materials": req.body.perm_raw_materials == "on" ? 1 : 0,
            "perm_transactions": req.body.perm_transactions == "on" ? 1 : 0,
            "perm_users": req.body.perm_users == "on" ? 1 : 0,
            "perm_settings": req.body.perm_settings == "on" ? 1 : 0,
            "status": ""
          }

    if(req.body.id == "") { 
       // Generate a unique ID that won't conflict with admin user (ID 1)
       User._id = Math.max(2, Math.floor(Date.now() / 1000));
       usersDB.insert( User, function ( err, user ) {
            if ( err ) {
                console.error("Error creating user:", err);
                res.status( 500 ).send( err );
            } else {
                console.log("User created successfully:", user);
                res.send( user );
            }
        });
    }
    else { 
        usersDB.update( {
            _id: parseInt(req.body.id)
                    }, {
                        $set: {
                            username: req.body.username,
                            password: btoa(req.body.password),
                            fullname: req.body.fullname,
                            perm_products: req.body.perm_products == "on" ? 1 : 0,
                            perm_categories: req.body.perm_categories == "on" ? 1 : 0,
                            perm_raw_materials: req.body.perm_raw_materials == "on" ? 1 : 0,
                            perm_transactions: req.body.perm_transactions == "on" ? 1 : 0,
                            perm_users: req.body.perm_users == "on" ? 1 : 0,
                            perm_settings: req.body.perm_settings == "on" ? 1 : 0
                        }
                    }, {}, function (
            err,
            numReplaced,
            user
        ) {
            if ( err ) res.status( 500 ).send( err );
            else res.sendStatus( 200 );
        } );

    }

});


app.get( "/check", function ( req, res ) {
    usersDB.findOne( {
        _id: 1
}, function ( err, docs ) {
        if(!docs) {
            let User = { 
                "_id": 1,
                "username": "admin",
                "password": btoa("admin"),
                "fullname": "Administrator",
                "perm_products": 1,
                "perm_categories": 1,
                "perm_raw_materials": 1,
                "perm_transactions": 1,
                "perm_users": 1,
                "perm_settings": 1,
                "status": ""
              }
            usersDB.insert( User, function ( err, user ) {
                if (err) {
                    console.error("Error creating admin user:", err);
                } else {
                    console.log("Admin user created successfully");
                }
            });
        } else {
            console.log("Admin user already exists");
        }
        res.sendStatus(200);
    } );
} );

// Add endpoint to reset admin user (for troubleshooting)
app.post("/reset-admin", function(req, res) {
    console.log("Resetting admin user...");
    
    // First, remove existing admin user
    usersDB.remove({ _id: 1 }, {}, function(err, numRemoved) {
        if (err) {
            console.error("Error removing existing admin user:", err);
            res.status(500).send({ error: "Failed to remove existing admin user" });
            return;
        }
        
        console.log("Removed existing admin user, creating new one...");
        
        // Create new admin user
        let AdminUser = { 
            "_id": 1,
            "username": "admin",
            "password": btoa("admin"),
            "fullname": "Administrator",
            "perm_products": 1,
            "perm_categories": 1,
            "perm_raw_materials": 1,
            "perm_transactions": 1,
            "perm_users": 1,
            "perm_settings": 1,
            "status": ""
        };
        
        usersDB.insert(AdminUser, function(err, user) {
            if (err) {
                console.error("Error creating new admin user:", err);
                res.status(500).send({ error: "Failed to create new admin user" });
            } else {
                console.log("Admin user reset successfully:", user);
                res.send({ message: "Admin user reset successfully", user: user });
            }
        });
    });
});