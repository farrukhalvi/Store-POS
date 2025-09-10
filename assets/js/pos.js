let cart = [];
let index = 0;
let allUsers = [];
let allProducts = [];
let allCategories = [];
let allTransactions = [];
let sold = [];
let state = [];
let sold_items = [];
let item;
let auth;
let holdOrder = 0;
let vat = 0;
let perms = null;
let deleteId = 0;
let paymentType = 0;
let receipt = '';
let totalVat = 0;
let subTotal = 0;
let method = '';
let order_index = 0;
let user_index = 0;
let product_index = 0;
let transaction_index;
let host = 'localhost';
let path = require('path');
let port = '8001';
let moment = require('moment');
let Swal = require('sweetalert2');
let { ipcRenderer } = require('electron');
let dotInterval = setInterval(function () { $(".dot").text('.') }, 3000);

// Replace electron-store with localStorage-based storage
class LocalStorage {
    constructor() {
        this.prefix = 'pos_';
    }
    
    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : undefined;
        } catch (e) {
            console.warn('Error reading from localStorage:', e);
            return undefined;
        }
    }
    
    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (e) {
            console.warn('Error writing to localStorage:', e);
        }
    }
    
    delete(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (e) {
            console.warn('Error deleting from localStorage:', e);
        }
    }
}

let storage = new LocalStorage();

let img_path = './public/uploads/';
let api = 'http://' + host + ':' + port + '/api/';
console.log('API URL constructed:', api);

// Function to wait for server to be ready
async function waitForServer(maxRetries = 10, delay = 500) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await $.get(api.slice(0, -5)); // Remove '/api/' to test root endpoint
            console.log('✅ Server is ready!');
            return true;
        } catch (error) {
            console.log(`⏳ Waiting for server... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    console.error('❌ Server failed to start after', maxRetries, 'attempts');
    return false;
}

// Function to make API calls with retry logic
function apiGet(endpoint, successCallback, errorCallback) {
    $.get(api + endpoint)
        .done(successCallback)
        .fail(function(xhr, status, error) {
            console.error(`API call failed: ${endpoint}`, error);
            if (errorCallback) errorCallback(xhr, status, error);
        });
}
let btoa = require('btoa');
let jsPDF = require('jspdf');
let html2canvas = require('html2canvas');
let JsBarcode = require('jsbarcode');
let macaddress = require('macaddress');
let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let totalPrice = 0;
let orderTotal = 0;
let auth_error = 'Incorrect username or password';
let auth_empty = 'Please enter a username and password';
let holdOrderlocation = $("#randerHoldOrders");
let customerOrderLocation = $("#randerCustomerOrders");
let settings;
let platform;
let user = {};
let start = moment().startOf('month');
let end = moment();
let start_date = moment(start).toDate();
let end_date = moment(end).toDate();
let by_till = 0;
let by_user = 0;
let by_status = 1;

$(function () {

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + '  -  ' + end.format('MMMM D, YYYY'));
    }

    $('#reportrange').daterangepicker({
        startDate: start,
        endDate: end,
        autoApply: true,
        timePicker: true,
        timePicker24Hour: true,
        timePickerIncrement: 10,
        timePickerSeconds: true,
        // minDate: '',
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
            'Last 7 Days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
            'Last 30 Days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);

    cb(start, end);

});


$.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function () {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};


auth = storage.get('auth');
user = storage.get('user');

console.log('Stored auth data:', auth);
console.log('Stored user data:', user);

// Check if user data is corrupted and clear it
if (user && typeof user === 'object' && !user._id && !user.id) {
    console.warn('User data appears corrupted, clearing storage');
    storage.delete('auth');
    storage.delete('user');
    auth = undefined;
    user = undefined;
}

if (auth == undefined) {
    console.log('No auth data found, checking for admin user...');
    $.get(api + 'users/check/', function (data) { 
        console.log('Admin check response:', data);
    });
    $("#loading").show();
    authenticate();

} else {

    $('#loading').show();

    setTimeout(function () {
        $('#loading').hide();
    }, 2000);

    platform = storage.get('settings');

    if (platform != undefined) {

        if (platform.app == 'Network Point of Sale Terminal') {
            api = 'http://' + platform.ip + ':' + port + '/api/';
            perms = true;
        }
    }

    // Initialize API calls after server is ready
    waitForServer().then(serverReady => {
        if (!serverReady) return;
        
        // Add safety check for user._id
        if (user && user._id) {
            apiGet('users/user/' + user._id, function (data) {
                user = data;
                $('#loggedin-user').text(user.fullname);
            });
        } else {
            console.error('User object is missing or has no _id:', user);
            console.error('User object keys:', user ? Object.keys(user) : 'user is null/undefined');
            // Check if user has 'id' instead of '_id'
            if (user && user.id) {
                console.log('User has id instead of _id, using id:', user.id);
                apiGet('users/user/' + user.id, function (data) {
                    user = data;
                    $('#loggedin-user').text(user.fullname);
                });
            } else {
                // Redirect to login if user data is invalid
                authenticate();
            }
        }
        
        // Load settings
        apiGet('settings/get', function (data) {
            settings = data.settings;
        });
        
        // Load users
        apiGet('users/all', function (users) {
            allUsers = [...users];
        });
    });





    $(document).ready(function () {

        $(".loading").hide();


        if (settings && settings.symbol) {
            $("#price_curr, #payment_curr, #change_curr").text(settings.symbol);
        }


        setTimeout(function () {
            if (settings == undefined && auth != undefined) {
                $('#settingsModal').modal('show');
            }
            else {
                vat = parseFloat(settings.percentage);
                $("#taxInfo").text(settings.charge_tax ? vat : 0);
            }

        }, 1500);



        $("#settingsModal").on("hide.bs.modal", function () {

            setTimeout(function () {
                if (settings == undefined && auth != undefined) {
                    $('#settingsModal').modal('show');
                }
            }, 1000);

        });


        // Hide features based on permissions (handle both boolean and numeric values)
        if (!user.perm_products || user.perm_products === 0) { $(".p_one").hide() };
        if (!user.perm_categories || user.perm_categories === 0) { $(".p_two").hide() };
        if (!user.perm_raw_materials || user.perm_raw_materials === 0) { $(".p_six").hide() };
        if (!user.perm_transactions || user.perm_transactions === 0) { $(".p_three").hide() };
        if (!user.perm_users || user.perm_users === 0) { $(".p_four").hide() };
        if (!user.perm_settings || user.perm_settings === 0) { $(".p_five").hide() };

        function loadProducts() {
            console.log('🔄 Loading products from API...');

            apiGet('inventory/products', function (data) {
                console.log('✅ Products loaded:', data.length, 'products');

                data.forEach(item => {
                    item.price = parseFloat(item.price).toFixed(2);
                });

                allProducts = [...data];

                loadProductList();

                $('#parent').text('');
                $('#categories').html(`<button type="button" id="all" class="btn btn-categories btn-white waves-effect waves-light">All</button> `);

                data.forEach(item => {

                    if (!categories.includes(item.category)) {
                        categories.push(item.category);
                    }

                    let item_info = `<div class="col-lg-2 box ${item.category}"
                                onclick="addToCart(${item._id}, ${item.quantity}, ${item.stock})">
                            <div class="widget-panel widget-style-2 ">                    
                            <div id="image"><img src="${!item.image || item.image == "" ? "./assets/images/default.jpg" : img_path + "product_image/" + item.image}" id="product_img" alt=""></div>                    
                                        <div class="text-muted m-t-5 text-center">
                                        <div class="name" id="product_name">${item.name}</div> 
                                        <span class="sku">${item.sku || item._id}</span>
                                        <span class="stock">STOCK </span><span class="count">${item.quantity || 'N/A'}</span></div>
                                        <sp class="text-success text-center"><b data-plugin="counterup">${settings && settings.symbol ? settings.symbol : '$'}${item.price}</b> </sp>
                            </div>
                        </div>`;
                    $('#parent').append(item_info);
                });

                categories.forEach(category => {

                    let c = allCategories.filter(function (ctg) {
                        return ctg._id == category;
                    })

                    $('#categories').append(`<button type="button" id="${category}" class="btn btn-categories btn-white waves-effect waves-light">${c.length > 0 ? c[0].name : ''}</button> `);
                });

            });

        }

        function loadCategories(callback) {
            apiGet('categories/all', function (data) {
                allCategories = data;
                loadCategoryList();
                $('#category').html(`<option value="0">Select</option>`);
                allCategories.forEach(category => {
                    $('#category').append(`<option value="${category._id}">${category.name}</option>`);
                });
                
                // Call callback when categories are loaded
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        }

        // Helper function to ensure categories are loaded before products
        function refreshProductsWithCategories() {
            if (allCategories.length === 0) {
                // Categories not loaded yet, load them first
                loadCategories(() => {
                    loadProducts();
                });
            } else {
                // Categories already loaded, just refresh products
                loadProducts();
            }
        }


        function loadCustomers() {

            apiGet('customers/all', function (customers) {

                $('#customer').html(`<option value="0" selected="selected">Walk in customer</option>`);

                customers.forEach(cust => {

                    let customer = `<option value='{"id": ${cust._id}, "name": "${cust.name}"}'>${cust.name}</option>`;
                    $('#customer').append(customer);
                });

                //  $('#customer').chosen();

            });

        }

        // Load all data after server is ready
        waitForServer().then(serverReady => {
            if (serverReady) {
                // Load categories first, then other data when categories are ready
                loadCategories(() => {
                    loadProducts();
                    loadCustomers();
                    loadRawMaterials();
                });
            }
        });

        // Global function for onclick calls
        window.addToCart = function (id, count, stock) {
            if (stock == 1) {
                if (count > 0) {
                    $.get(api + 'inventory/product/' + id, function (data) {
                        $().addProductToCart(data);
                    });
                }
                else {
                    Swal.fire(
                        'Out of stock!',
                        'This item is currently unavailable',
                        'info'
                    );
                }
            }
            else {
                $.get(api + 'inventory/product/' + id, function (data) {
                    $().addProductToCart(data);
                });
            }
        };

        $.fn.addToCart = function (id, count, stock) {

            if (stock == 1) {
                if (count > 0) {
                    $.get(api + 'inventory/product/' + id, function (data) {
                        $(this).addProductToCart(data);
                    });
                }
                else {
                    Swal.fire(
                        'Out of stock!',
                        'This item is currently unavailable',
                        'info'
                    );
                }
            }
            else {
                $.get(api + 'inventory/product/' + id, function (data) {
                    $(this).addProductToCart(data);
                });
            }

        };


        function barcodeSearch(e) {

            e.preventDefault();
            $("#basic-addon2").empty();
            $("#basic-addon2").append(
                $('<i>', { class: 'fa fa-spinner fa-spin' })
            );

            let req = {
                skuCode: $("#skuCode").val()
            }

            $.ajax({
                url: api + 'inventory/product/sku',
                type: 'POST',
                data: JSON.stringify(req),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function (data) {

                    if (data._id != undefined && data.quantity >= 1) {
                        $(this).addProductToCart(data);
                        $("#searchBarCode").get(0).reset();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-ok' })
                        )
                    }
                    else if (data.quantity < 1) {
                        Swal.fire(
                            'Out of stock!',
                            'This item is currently unavailable',
                            'info'
                        );
                    }
                    else {

                        Swal.fire(
                            'Not Found!',
                            '<b>' + $("#skuCode").val() + '</b> is not a valid barcode!',
                            'warning'
                        );

                        $("#searchBarCode").get(0).reset();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-ok' })
                        )
                    }

                }, error: function (data) {
                    if (data.status === 422) {
                        $(this).showValidationError(data);
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-remove' })
                        )
                    }
                    else if (data.status === 404) {
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-remove' })
                        )
                    }
                    else {
                        $(this).showServerError();
                        $("#basic-addon2").empty();
                        $("#basic-addon2").append(
                            $('<i>', { class: 'glyphicon glyphicon-warning-sign' })
                        )
                    }
                }
            });

        }


        $("#searchBarCode").on('submit', function (e) {
            barcodeSearch(e);
        });



        $('body').on('click', '#jq-keyboard button', function (e) {
            let pressed = $(this)[0].className.split(" ");
            if ($("#skuCode").val() != "" && pressed[2] == "enter") {
                barcodeSearch(e);
            }
        });



        $.fn.addProductToCart = function (data) {
            if (!data || !data._id) {
                return;
            }
            
            // Check stock availability before adding
            if (data.quantity !== undefined && data.quantity <= 0) {
                Swal.fire({
                    title: 'Out of Stock!',
                    text: `"${data.name}" is currently out of stock.`,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                return;
            }
            
            item = {
                id: data._id,
                product_name: data.name,
                sku: data.sku || data._id, // Use _id as sku if sku field doesn't exist
                price: parseFloat(data.price), // Ensure price is a number
                quantity: 1
            };

            if ($(this).isExist(item)) {
                $(this).qtIncrement(index);
            } else {
                cart.push(item);
                $('#cartTable').renderTable(cart)
            }
        }


        $.fn.isExist = function (data) {
            let toReturn = false;
            $.each(cart, function (index, value) {
                if (value.id == data.id) {
                    $(this).setIndex(index);
                    toReturn = true;
                }
            });
            return toReturn;
        }

        // Helper function to get product stock information
        $.fn.getProductStock = function (productId) {
            let product = allProducts.filter(function (selected) {
                return selected._id == parseInt(productId);
            });
            return product[0] || null;
        }


        $.fn.setIndex = function (value) {
            index = value;
        }


        $.fn.calculateCart = function () {
            let total = 0;
            let grossTotal;
            $('#total').text(cart.length);
            $.each(cart, function (index, data) {
                total += data.quantity * parseFloat(data.price);
            });
            total = total - $("#inputDiscount").val();
            $('#price').text(settings.symbol + total.toFixed(2));

            subTotal = total;

            if ($("#inputDiscount").val() >= total) {
                $("#inputDiscount").val(0);
            }

            if (settings.charge_tax) {
                totalVat = ((total * vat) / 100);
                grossTotal = total + totalVat
            }

            else {
                grossTotal = total;
            }

            orderTotal = grossTotal.toFixed(2);

            $("#gross_price").text(settings.symbol + grossTotal.toFixed(2));
            $("#payablePrice").val(grossTotal);
        };



        $.fn.renderTable = function (cartList) {
            // Clear the table body completely
            $('#cartTable tbody').empty();
            $(this).calculateCart();
            $.each(cartList, function (index, data) {
                $('#cartTable > tbody').append(
                    $('<tr>').append(
                        $('<td>', { text: index + 1 }),
                        $('<td>', { text: data.product_name }),
                        $('<td>').append(
                            $('<div>', { class: 'input-group' }).append(
                                $('<div>', { class: 'input-group-btn btn-xs' }).append(
                                    $('<button>', {
                                        class: 'btn btn-default btn-xs',
                                        onclick: '$(this).qtDecrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-minus' })
                                    )
                                ),
                                $('<input>', {
                                    class: 'form-control',
                                    type: 'number',
                                    value: data.quantity,
                                    oninput: '$(this).qtInput(' + index + ')'
                                }),
                                $('<div>', { class: 'input-group-btn btn-xs' }).append(
                                    $('<button>', {
                                        class: 'btn btn-default btn-xs',
                                        onclick: '$(this).qtIncrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-plus' })
                                    )
                                )
                            )
                        ),
                        $('<td>', { text: settings.symbol + (parseFloat(data.price) * data.quantity).toFixed(2) }),
                        $('<td>').append(
                            $('<button>', {
                                class: 'btn btn-danger btn-xs',
                                onclick: '$(this).deleteFromCart(' + index + ')'
                            }).append(
                                $('<i>', { class: 'fa fa-times' })
                            )
                        )
                    )
                )
            })
        };


        $.fn.deleteFromCart = function (index) {
            cart.splice(index, 1);
            $('#cartTable').renderTable(cart);
        }


        $.fn.qtIncrement = function (i) {

            item = cart[i];

            let product = allProducts.filter(function (selected) {
                return selected._id == parseInt(item.id);
            });

            if (product[0].quantity !== undefined) {
                if (item.quantity < product[0].quantity) {
                    item.quantity += 1;
                    $('#cartTable').renderTable(cart);
                }

                else {
                    Swal.fire({
                        title: 'Insufficient Stock!',
                        text: `Cannot add more "${item.product_name}". Only ${product[0].quantity} units available in stock.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                }
            }
            else {
                item.quantity += 1;
                $('#cartTable').renderTable(cart);
            }

        }


        $.fn.qtDecrement = function (i) {
            item = cart[i];
            if (item.quantity > 1) {
                item.quantity -= 1;
                $('#cartTable').renderTable(cart);
            } else {
                // Show message when trying to go below minimum quantity
                Swal.fire({
                    title: 'Minimum Quantity!',
                    text: `Minimum quantity is 1 for "${item.product_name}". Use the delete button to remove the item.`,
                    icon: 'info',
                    confirmButtonText: 'OK'
                });
            }
        }


        $.fn.qtInput = function (i) {
            item = cart[i];
            let newQuantity = parseInt($(this).val()) || 1;
            
            // Check stock availability
            let product = allProducts.filter(function (selected) {
                return selected._id == parseInt(item.id);
            });
            
            if (product[0] && product[0].quantity !== undefined) {
                if (newQuantity > product[0].quantity) {
                    Swal.fire({
                        title: 'Insufficient Stock!',
                        text: `Cannot set quantity to ${newQuantity}. Only ${product[0].quantity} units available in stock for "${item.product_name}".`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    // Reset to maximum available quantity
                    item.quantity = product[0].quantity;
                    $(this).val(item.quantity);
                } else if (newQuantity < 1) {
                    // Minimum quantity is 1
                    item.quantity = 1;
                    $(this).val(1);
                } else {
                    item.quantity = newQuantity;
                }
            } else {
                // No stock limit, but ensure minimum quantity
                item.quantity = newQuantity < 1 ? 1 : newQuantity;
                if (newQuantity < 1) {
                    $(this).val(1);
                }
            }
            
            $('#cartTable').renderTable(cart);
        }


        $.fn.cancelOrder = function () {

            if (cart.length > 0) {
                Swal.fire({
                    title: 'Are you sure?',
                    text: "You are about to remove all items from the cart.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, clear it!'
                }).then((result) => {

                    if (result.value) {

                        cart = [];
                        $('#cartTable').renderTable(cart);
                        holdOrder = 0;

                        Swal.fire(
                            'Cleared!',
                            'All items have been removed.',
                            'success'
                        )
                    }
                });
            }

        }


        $("#payButton").on('click', function () {
            if (cart.length != 0) {
                $("#paymentModel").modal('toggle');
            } else {
                Swal.fire(
                    'Oops!',
                    'There is nothing to pay!',
                    'warning'
                );
            }

        });


        $("#hold").on('click', function () {

            if (cart.length != 0) {

                $("#dueModal").modal('toggle');
            } else {
                Swal.fire(
                    'Oops!',
                    'There is nothing to hold!',
                    'warning'
                );
            }
        });


        function printJobComplete() {
            alert("print job complete");
        }


        $.fn.submitDueOrder = function (status) {

            let items = "";
            let payment = 0;

            cart.forEach(item => {

                items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + parseFloat(item.price).toFixed(2) + "</td></tr>";

            });

            let currentTime = new Date(moment());

            let discount = $("#inputDiscount").val();
            let customer = JSON.parse($("#customer").val());
            let date = moment(currentTime).format("YYYY-MM-DD HH:mm:ss");
            let paid = $("#payment").val() == "" ? "" : parseFloat($("#payment").val()).toFixed(2);
            let change = $("#change").text() == "" ? "" : parseFloat($("#change").text()).toFixed(2);
            let refNumber = $("#refNumber").val();
            let orderNumber = holdOrder;
            let type = "";
            let tax_row = "";


            switch (paymentType) {

                case 1: type = "Cheque";
                    break;

                case 2: type = "Card";
                    break;

                default: type = "Cash";

            }


            if (paid != "") {
                payment = `<tr>
                        <td>Paid</td>
                        <td>:</td>
                        <td>${settings.symbol + paid}</td>
                    </tr>
                    <tr>
                        <td>Change</td>
                        <td>:</td>
                        <td>${settings.symbol + Math.abs(change).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Method</td>
                        <td>:</td>
                        <td>${type}</td>
                    </tr>`
            }



            if (settings.charge_tax) {
                tax_row = `<tr>
                    <td>Vat(${settings.percentage})% </td>
                    <td>:</td>
                    <td>${settings.symbol}${parseFloat(totalVat).toFixed(2)}</td>
                </tr>`;
            }



            if (status == 0) {

                if ($("#customer").val() == 0 && $("#refNumber").val() == "") {
                    Swal.fire(
                        'Reference Required!',
                        'You either need to select a customer <br> or enter a reference!',
                        'warning'
                    )

                    return;
                }
            }


            $(".loading").show();


            if (holdOrder != 0) {

                orderNumber = holdOrder;
                method = 'PUT'
            }
            else {
                orderNumber = Math.floor(Date.now() / 1000);
                method = 'POST'
            }


            receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${!settings.img || settings.img == "" ? "" : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + "settings/" + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
        </p>
        <hr>
        <left>
            <p>
            Order No : ${orderNumber} <br>
            Ref No : ${refNumber == "" ? orderNumber : refNumber} <br>
            Customer : ${customer == 0 ? 'Walk in customer' : customer.name} <br>
            Cashier : ${user.fullname ?? 'Unknown User'} <br>
            Date : ${date}<br>
            </p>

        </left>
        <hr>
        <table width="100%">
            <thead style="text-align: left;">
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
            </tr>
            </thead>
            <tbody>
            ${items}                
     
            <tr>                        
                <td><b>Subtotal</b></td>
                <td>:</td>
                <td><b>${settings.symbol}${subTotal.toFixed(2)}</b></td>
            </tr>
            <tr>
                <td>Discount</td>
                <td>:</td>
                <td>${discount > 0 ? settings.symbol + parseFloat(discount).toFixed(2) : ''}</td>
            </tr>
            
            ${tax_row}
        
            <tr>
                <td><h3>Total</h3></td>
                <td><h3>:</h3></td>
                <td>
                    <h3>${settings.symbol}${parseFloat(orderTotal).toFixed(2)}</h3>
                </td>
            </tr>
            ${payment == 0 ? '' : payment}
            </tbody>
            </table>
            <br>
            <hr>
            <br>
            <p style="text-align: center;">
             ${settings.footer}
             </p>
            </div>`;


            if (status == 3) {
                if (cart.length > 0) {

                    printJS({ printable: receipt, type: 'raw-html' });

                    $(".loading").hide();
                    return;

                }
                else {

                    $(".loading").hide();
                    return;
                }
            }


            let data = {
                order: orderNumber,
                ref_number: refNumber,
                discount: discount,
                customer: customer,
                status: status,
                subtotal: parseFloat(subTotal).toFixed(2),
                tax: totalVat,
                order_type: 1,
                items: cart,
                date: currentTime,
                payment_type: type,
                payment_info: $("#paymentInfo").val(),
                total: orderTotal,
                paid: paid,
                change: change,
                _id: orderNumber,
                till: platform.till,
                mac: platform.mac,
                user: user.fullname,
                user_id: user && (user._id || user.id) ? (user._id || user.id) : null
            }


            $.ajax({
                url: api + 'transactions/transaction',
                type: method,
                data: JSON.stringify(data),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function (data) {

                    cart = [];
                    $('#viewTransaction').html('');
                    $('#viewTransaction').html(receipt);
                    $('#orderModal').modal('show');
                    console.log('🔄 Refreshing products and raw materials after transaction...');
                    refreshProductsWithCategories();
                    loadRawMaterials(); // Refresh raw materials after transaction
                    loadCustomers();
                    $(".loading").hide();
                    $("#dueModal").modal('hide');
                    $("#paymentModel").modal('hide');
                    $(this).getHoldOrders();
                    $(this).getCustomerOrders();
                    $('#cartTable').renderTable(cart);

                }, error: function (xhr) {
                    $(".loading").hide();
                    $("#dueModal").modal('toggle');
                    
                    // Handle raw material validation errors
                    if (xhr.status === 400 && xhr.responseJSON && xhr.responseJSON.error === "Insufficient raw materials to fulfill this order") {
                        const details = xhr.responseJSON.details || [];
                        let errorMessage = "Cannot process this order due to insufficient raw materials:\n\n";
                        
                        details.forEach(material => {
                            errorMessage += `• ${material.product_name}: ${material.raw_material_name}\n`;
                            errorMessage += `  Required: ${material.required}, Available: ${material.available}\n`;
                            errorMessage += `  Shortfall: ${material.shortfall}\n\n`;
                        });
                        
                        errorMessage += "Please restock the raw materials or reduce the order quantity.";
                        
                        Swal.fire({
                            title: 'Insufficient Raw Materials!',
                            text: errorMessage,
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                    } else {
                        // Generic error handling
                        const errorMsg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Please refresh this page and try again';
                        Swal.fire("Something went wrong!", errorMsg, 'error');
                    }
                }
            });

            $("#refNumber").val('');
            $("#change").text('');
            $("#payment").val('');

        }


        // Load hold orders after server is ready
        waitForServer().then(serverReady => {
            if (serverReady) {
                apiGet('on-hold', function (data) {
                    holdOrderList = data;
                    holdOrderlocation.empty();
                    clearInterval(dotInterval);
                    $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
                });
            }
        });


        $.fn.getHoldOrders = function () {
            apiGet('on-hold', function (data) {
                holdOrderList = data;
                clearInterval(dotInterval);
                holdOrderlocation.empty();
                $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
            });
        };


        $.fn.randerHoldOrders = function (data, renderLocation, orderType) {
            $.each(data, function (index, order) {
                $(this).calculatePrice(order);
                renderLocation.append(
                    $('<div>', { class: orderType == 1 ? 'col-md-3 order' : 'col-md-3 customer-order' }).append(
                        $('<a>').append(
                            $('<div>', { class: 'card-box order-box' }).append(
                                $('<p>').append(
                                    $('<b>', { text: 'Ref :' }),
                                    $('<span>', { text: order.ref_number, class: 'ref_number' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Price :' }),
                                    $('<span>', { text: order.total, class: "label label-info", style: 'font-size:14px;' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Items :' }),
                                    $('<span>', { text: order.items.length }),
                                    $('<br>'),
                                    $('<b>', { text: 'Customer :' }),
                                    $('<span>', { text: order.customer != 0 ? order.customer.name : 'Walk in customer', class: 'customer_name' })
                                ),
                                $('<button>', { class: 'btn btn-danger del', onclick: '$(this).deleteOrder(' + index + ',' + orderType + ')' }).append(
                                    $('<i>', { class: 'fa fa-trash' })
                                ),

                                $('<button>', { class: 'btn btn-default', onclick: '$(this).orderDetails(' + index + ',' + orderType + ')' }).append(
                                    $('<span>', { class: 'fa fa-shopping-basket' })
                                )
                            )
                        )
                    )
                )
            })
        }


        $.fn.calculatePrice = function (data) {
            totalPrice = 0;
            $.each(data.products, function (index, product) {
                totalPrice += product.price * product.quantity;
            })

            let vat = (totalPrice * data.vat) / 100;
            totalPrice = ((totalPrice + vat) - data.discount).toFixed(0);

            return totalPrice;
        };


        $.fn.orderDetails = function (index, orderType) {

            $('#refNumber').val('');

            if (orderType == 1) {

                $('#refNumber').val(holdOrderList[index].ref_number);

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function () {
                    return $(this).text() == "Walk in customer";
                }).prop("selected", true);

                holdOrder = holdOrderList[index]._id;
                cart = [];
                $.each(holdOrderList[index].items, function (index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            } else if (orderType == 2) {

                $('#refNumber').val('');

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function () {
                    return $(this).text() == customerOrderList[index].customer.name;
                }).prop("selected", true);


                holdOrder = customerOrderList[index]._id;
                cart = [];
                $.each(customerOrderList[index].items, function (index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            }
            $('#cartTable').renderTable(cart);
            $("#holdOrdersModal").modal('hide');
            $("#customerModal").modal('hide');
        }


        $.fn.deleteOrder = function (index, type) {

            switch (type) {
                case 1: deleteId = holdOrderList[index]._id;
                    break;
                case 2: deleteId = customerOrderList[index]._id;
            }

            let data = {
                orderId: deleteId,
            }

            Swal.fire({
                title: "Delete order?",
                text: "This will delete the order. Are you sure you want to delete!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'delete',
                        type: 'POST',
                        data: JSON.stringify(data),
                        contentType: 'application/json; charset=utf-8',
                        cache: false,
                        success: function (data) {

                            $(this).getHoldOrders();
                            $(this).getCustomerOrders();

                            Swal.fire(
                                'Deleted!',
                                'You have deleted the order!',
                                'success'
                            )

                        }, error: function (data) {
                            $(".loading").hide();

                        }
                    });
                }
            });
        }



        $.fn.getCustomerOrders = function () {
            $.get(api + 'customer-orders', function (data) {
                clearInterval(dotInterval);
                customerOrderList = data;
                customerOrderLocation.empty();
                $(this).randerHoldOrders(customerOrderList, customerOrderLocation, 2);
            });
        }



        $('#saveCustomer').on('submit', function (e) {

            e.preventDefault();

            let custData = {
                _id: Math.floor(Date.now() / 1000),
                name: $('#userName').val(),
                phone: $('#phoneNumber').val(),
                email: $('#emailAddress').val(),
                address: $('#userAddress').val()
            }

            $.ajax({
                url: api + 'customers/customer',
                type: 'POST',
                data: JSON.stringify(custData),
                contentType: 'application/json; charset=utf-8',
                cache: false,
                processData: false,
                success: function (data) {
                    $("#newCustomer").modal('hide');
                    Swal.fire("Customer added!", "Customer added successfully!", "success");
                    $("#customer option:selected").removeAttr('selected');
                    $('#customer').append(
                        $('<option>', { text: custData.name, value: `{"id": ${custData._id}, "name": ${custData.name}}`, selected: 'selected' })
                    );

                    $('#customer').val(`{"id": ${custData._id}, "name": ${custData.name}}`).trigger('chosen:updated');

                }, error: function (data) {
                    $("#newCustomer").modal('hide');
                    Swal.fire('Error', 'Something went wrong please try again', 'error')
                }
            })
        })


        $("#confirmPayment").hide();

        $("#cardInfo").hide();

        $("#payment").on('input', function () {
            $(this).calculateChange();
        });


        $("#confirmPayment").on('click', function () {
            if ($('#payment').val() == "") {
                Swal.fire(
                    'Nope!',
                    'Please enter the amount that was paid!',
                    'warning'
                );
            }
            else {
                $(this).submitDueOrder(1);
            }
        });


        $('#transactions').click(function () {
            // Load all transaction page data
            window.loadTransactions();
            window.loadUserList();
            window.loadTransactionStats();
            window.initTransactionFilters();

            $('#pos_view').hide();
            $('#pointofsale').show();
            $('#transactions_view').show();
            $(this).hide();

        });


        $('#pointofsale').click(function () {
            $('#pos_view').show();
            $('#transactions').show();
            $('#transactions_view').hide();
            $(this).hide();
        });


        $("#viewRefOrders").click(function () {
            setTimeout(function () {
                $("#holdOrderInput").focus();
            }, 500);
        });


        $("#viewCustomerOrders").click(function () {
            setTimeout(function () {
                $("#holdCustomerOrderInput").focus();
            }, 500);
        });


        $('#newProductModal').click(function () {
            $('#saveProduct').get(0).reset();
            $('#current_img').text('');
            
            // Reset raw materials and refresh data
            resetRawMaterialsForm();
        });


        $('#saveProduct').submit(function (e) {
            e.preventDefault();

            $(this).attr('action', api + 'inventory/product');
            $(this).attr('method', 'POST');
            
            // Debug: Log form data before submission
            console.log('Form submission - Category selected:', $('#category').val());

            $(this).ajaxSubmit({
                // Don't set contentType for file uploads - let jQuery handle it automatically
                success: function (response) {

                    $('#saveProduct').get(0).reset();
                    $('#current_img').text('');

                    refreshProductsWithCategories();
                    Swal.fire({
                        title: 'Product Saved',
                        text: "Select an option below to continue.",
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Add another',
                        cancelButtonText: 'Close'
                    }).then((result) => {

                        if (!result.value) {
                            $("#newProduct").modal('hide');
                        }
                    });
                }, error: function (xhr, status, error) {
                    console.error('Product save failed:', xhr.responseText);
                    Swal.fire({
                        title: 'Error',
                        text: 'Failed to save product: ' + (xhr.responseJSON?.error || error),
                        icon: 'error'
                    });
                }
            });

        });



        $('#saveCategory').submit(function (e) {
            e.preventDefault();

            if ($('#category_id').val() == "") {
                method = 'POST';
            }
            else {
                method = 'PUT';
            }
            console.log("method", method);
            console.log("api", api);

            $.ajax({
                type: method,
                url: api + 'categories/category',
                data: $(this).serialize(),
                success: function (data, textStatus, jqXHR) {
                    $('#saveCategory').get(0).reset();
                    loadCategories(() => {
                        loadProducts();
                    });
                    Swal.fire({
                        title: 'Category Saved',
                        text: "Select an option below to continue.",
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Add another',
                        cancelButtonText: 'Close'
                    }).then((result) => {

                        if (!result.value) {
                            $("#newCategory").modal('hide');
                        }
                    });
                }, error: function (data) {
                    console.log(data);
                }

            });


        });


        $.fn.editProduct = function (index) {

            $('#Products').modal('hide');

            // Set selected category (with small delay to ensure dropdown is ready)
            setTimeout(() => {
                if (allProducts[index].category_id) {
                    $("#category").val(allProducts[index].category_id);
                } else {
                    $("#category").val("0"); // Default "Select" option
                }
            }, 100);

            $('#productName').val(allProducts[index].name);
            $('#product_price').val(allProducts[index].price);
            $('#quantity').val(allProducts[index].quantity);

            $('#product_id').val(allProducts[index]._id);
            $('#img').val(allProducts[index].image);

            if (allProducts[index].image != "") {

                $('#imagename').hide();
                $('#current_img').html(`<img src="${img_path + "product_image/" + allProducts[index].image}" alt="">`);
                $('#rmv_img').show();
            }

            if (allProducts[index].stock == 0) {
                $('#stock').prop("checked", true);
            }

            // Load raw materials for this product
            if (allProducts[index].rawMaterials && allProducts[index].rawMaterials.length > 0) {
                loadProductRawMaterials(allProducts[index].rawMaterials);
            } else {
                resetRawMaterialsForm();
            }

            $('#newProduct').modal('show');
        }


        $("#userModal").on("hide.bs.modal", function () {
            $('.perms').hide();
        });


        $.fn.editUser = function (index) {

            user_index = index;

            $('#Users').modal('hide');

            $('.perms').show();

            $("#user_id").val(allUsers[index]._id);
            $('#fullname').val(allUsers[index].fullname);
            $('#username').val(allUsers[index].username);
            $('#password').val(atob(allUsers[index].password));

            if (allUsers[index].perm_products == 1) {
                $('#perm_products').prop("checked", true);
            }
            else {
                $('#perm_products').prop("checked", false);
            }

            if (allUsers[index].perm_categories == 1) {
                $('#perm_categories').prop("checked", true);
            }
            else {
                $('#perm_categories').prop("checked", false);
            }

            if (allUsers[index].perm_raw_materials == 1) {
                $('#perm_raw_materials').prop("checked", true);
            }
            else {
                $('#perm_raw_materials').prop("checked", false);
            }

            if (allUsers[index].perm_transactions == 1) {
                $('#perm_transactions').prop("checked", true);
            }
            else {
                $('#perm_transactions').prop("checked", false);
            }

            if (allUsers[index].perm_users == 1) {
                $('#perm_users').prop("checked", true);
            }
            else {
                $('#perm_users').prop("checked", false);
            }

            if (allUsers[index].perm_settings == 1) {
                $('#perm_settings').prop("checked", true);
            }
            else {
                $('#perm_settings').prop("checked", false);
            }

            $('#userModal').modal('show');
        }


        $.fn.editCategory = function (index) {
            $('#Categories').modal('hide');
            
            $('#categoryName').val(allCategories[index].name);
            $('#categoryDescription').val(allCategories[index].description || '');
            $('#category_id').val(allCategories[index]._id);
            
            // Set the active checkbox
            if (allCategories[index].is_active === true) {
                $('#category_is_active').prop('checked', true);
            } else {
                $('#category_is_active').prop('checked', false);
            }
            
            $('#newCategory').modal('show');
        }

        // Clear category form when creating new category
        $('#newCategoryModal').click(function() {
            $('#saveCategory').get(0).reset();
            $('#category_is_active').prop('checked', true); // Default to active for new categories
        });


        $.fn.deleteProduct = function (id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this product.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'inventory/product/' + id,
                        type: 'DELETE',
                        success: function (result) {
                            refreshProductsWithCategories();
                            Swal.fire(
                                'Done!',
                                'Product deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $.fn.deleteUser = function (id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this user.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'users/user/' + id,
                        type: 'DELETE',
                        success: function (result) {
                            loadUserList();
                            Swal.fire(
                                'Done!',
                                'User deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $.fn.deleteCategory = function (id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this category.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {

                if (result.value) {

                    $.ajax({
                        url: api + 'categories/category/' + id,
                        type: 'DELETE',
                        success: function (result) {
                            loadCategories();
                            Swal.fire(
                                'Done!',
                                'Category deleted',
                                'success'
                            );

                        }
                    });
                }
            });
        }


        $('#productModal').click(function () {
            loadProductList();
        });


        $('#usersModal').click(function () {
            loadUserList();
        });


        $('#categoryModal').click(function () {
            loadCategoryList();
        });


        function loadUserList() {

            let counter = 0;
            let user_list = '';
            $('#user_list').empty();
            $('#userList').DataTable().destroy();

            console.log('Making API call to:', api + 'users/all');
            $.get(api + 'users/all', function (users) {



                allUsers = [...users];

                users.forEach((user, index) => {

                    state = [];
                    let class_name = '';

                    if (user.is_active) {
                        let class_name = '';
                        if (user.last_login) {
                            // User has logged in before
                            class_name = 'btn-default';
                        } else {
                            // User hasn't logged in yet
                            class_name = 'btn-light';
                        }
                    }

                    counter++;
                    user_list += `<tr>
            <td>${user.fullname}</td>
            <td>${user.username}</td>
            <td class="${class_name}">${state.length > 0 ? state[0] : ''} <br><span style="font-size: 11px;"> ${state.length > 0 ? moment(state[1]).format('hh:mm A DD MMM YYYY') : ''}</span></td>
            <td>${user._id == 1 ? '<span class="btn-group"><button class="btn btn-dark"><i class="fa fa-edit"></i></button><button class="btn btn-dark"><i class="fa fa-trash"></i></button></span>' : '<span class="btn-group"><button onClick="$(this).editUser(' + index + ')" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' + user._id + ')" class="btn btn-danger"><i class="fa fa-trash"></i></button></span>'}</td></tr>`;

                    if (counter == users.length) {

                        $('#user_list').html(user_list);

                        $('#userList').DataTable({
                            "order": [[1, "desc"]]
                            , "autoWidth": false
                            , "info": true
                            , "JQueryUI": true
                            , "ordering": true
                            , "paging": false
                        });
                    }

                });

            });
        }


        function loadProductList() {
            let products = [...allProducts];
            let product_list = '';
            let counter = 0;
            $('#product_list').empty();
            $('#productList').DataTable().destroy();

            products.forEach((product, index) => {

                counter++;

                // Category info - use included category data or fallback to lookup
                let categoryName = '';
                if (product.category && product.category.name) {
                    // Use included category data from API
                    categoryName = product.category.name;
                } else if (product.category_id) {
                    // Fallback: lookup category by ID
                    let category = allCategories.filter(function (category) {
                        return category._id == product.category_id;
                    });
                    categoryName = category.length > 0 ? category[0].name : '';
                }
                

                // Get raw materials info
                let rawMaterialsInfo = '';
                if (product.rawMaterials && product.rawMaterials.length > 0) {
                    rawMaterialsInfo = product.rawMaterials.map(rm => {
                        const material = allRawMaterials.find(m => m._id == (rm._id || rm.id));
                        const quantity = rm.ProductRawMaterial?.quantity_required || rm.quantity_required || rm.quantity || '?';
                        return material ? `${material.name} (${quantity})` : `Material ${rm._id || rm.id} (${quantity})`;
                    }).join(', ');
                } else {
                    rawMaterialsInfo = 'None';
                }

                product_list += `<tr>
            <td><img id="`+ product._id + `"></td>
            <td><img style="max-height: 50px; max-width: 50px; border: 1px solid #ddd;" src="${!product.image || product.image == "" ? "./assets/images/default.jpg" : img_path + "product_image/" + product.image}" id="product_img"></td>
            <td>${product.name}</td>
            <td>${settings && settings.symbol ? settings.symbol : '$'}${product.price}</td>
            <td>${product.quantity || 'N/A'}</td>
            <td>${categoryName}</td>
            <td style="max-width: 200px; word-wrap: break-word;">${rawMaterialsInfo}</td>
            <td class="nobr"><span class="btn-group"><button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td></tr>`;

                if (counter == allProducts.length) {

                    $('#product_list').html(product_list);

                    products.forEach(pro => {
                        $("#" + pro._id + "").JsBarcode(pro._id, {
                            width: 2,
                            height: 25,
                            fontSize: 14
                        });
                    });

                    $('#productList').DataTable({
                        "order": [[1, "desc"]]
                        , "autoWidth": false
                        , "info": true
                        , "JQueryUI": true
                        , "ordering": true
                        , "paging": false
                    });
                }

            });
        }


        function loadCategoryList() {

            let category_list = '';
            let counter = 0;
            $('#category_list').empty();
            $('#categoryList').DataTable().destroy();

            allCategories.forEach((category, index) => {

                counter++;

                category_list += `<tr>
     
            <td>${category.name}</td>
            <td><span class="btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });

            if (counter == allCategories.length) {

                $('#category_list').html(category_list);
                $('#categoryList').DataTable({
                    "autoWidth": false
                    , "info": true
                    , "JQueryUI": true
                    , "ordering": true
                    , "paging": false

                });
            }
        }


        $.fn.serializeObject = function () {
            var o = {};
            var a = this.serializeArray();
            $.each(a, function () {
                if (o[this.name]) {
                    if (!o[this.name].push) {
                        o[this.name] = [o[this.name]];
                    }
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        };



        $('#log-out').click(function () {

            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to log out.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Logout'
            }).then((result) => {

                if (result.value) {
                    if (user && (user._id || user.id)) {
                        $.get(api + 'users/logout/' + (user._id || user.id), function (data) {
                            storage.delete('auth');
                            storage.delete('user');
                            ipcRenderer.send('app-reload', '');
                        });
                    } else {
                        // If user._id is undefined, just clear storage and reload
                        storage.delete('auth');
                        storage.delete('user');
                        ipcRenderer.send('app-reload', '');
                    }
                }
            });
        });



        $('#settings_form').on('submit', function (e) {
            e.preventDefault();
            let formData = $(this).serializeObject();
            let mac_address;

            api = 'http://' + host + ':' + port + '/api/';

            macaddress.one(function (err, mac) {
                mac_address = mac;
            });

            formData['app'] = $('#app').find('option:selected').text();
            formData['mac'] = mac_address;
            formData['till'] = 1;

            $('#settings_form').append('<input type="hidden" name="app" value="' + formData.app + '" />');

            if (formData.percentage != "" && !$.isNumeric(formData.percentage)) {
                Swal.fire(
                    'Oops!',
                    'Please make sure the tax value is a number',
                    'warning'
                );
            }
            else {
                storage.set('settings', formData);

                $(this).attr('action', api + 'settings/post');
                $(this).attr('method', 'POST');


                $(this).ajaxSubmit({
                    contentType: 'application/json',
                    success: function (response) {

                        ipcRenderer.send('app-reload', '');

                    }, error: function (data) {
                        console.log(data);
                    }

                });

            }

        });



        $('#net_settings_form').on('submit', function (e) {
            e.preventDefault();
            let formData = $(this).serializeObject();

            if (formData.till == 0 || formData.till == 1) {
                Swal.fire(
                    'Oops!',
                    'Please enter a number greater than 1.',
                    'warning'
                );
            }
            else {
                if (isNumeric(formData.till)) {
                    formData['app'] = $('#app').find('option:selected').text();
                    storage.set('settings', formData);
                    ipcRenderer.send('app-reload', '');
                }
                else {
                    Swal.fire(
                        'Oops!',
                        'Till number must be a number!',
                        'warning'
                    );
                }

            }

        });



        $('#saveUser').on('submit', function (e) {
            e.preventDefault();
            let formData = $(this).serializeObject();

            console.log(formData);

            if (ownUserEdit) {
                if (formData.password != atob(user.password)) {
                    if (formData.password != formData.pass) {
                        Swal.fire(
                            'Oops!',
                            'Passwords do not match!',
                            'warning'
                        );
                    }
                }
            }
            else {
                if (formData.password != atob(allUsers[user_index].password)) {
                    if (formData.password != formData.pass) {
                        Swal.fire(
                            'Oops!',
                            'Passwords do not match!',
                            'warning'
                        );
                    }
                }
            }



            if (formData.password == atob(user.password) || formData.password == atob(allUsers[user_index].password) || formData.password == formData.pass) {
                $.ajax({
                    url: api + 'users/post',
                    type: 'POST',
                    data: JSON.stringify(formData),
                    contentType: 'application/json; charset=utf-8',
                    cache: false,
                    processData: false,
                    success: function (data) {

                        if (ownUserEdit) {
                            ipcRenderer.send('app-reload', '');
                        }

                        else {
                            $('#userModal').modal('hide');

                            loadUserList();

                            $('#Users').modal('show');
                            Swal.fire(
                                'Ok!',
                                'User details saved!',
                                'success'
                            );
                        }


                    }, error: function (data) {
                        console.log(data);
                    }

                });

            }

        });



        $('#app').change(function () {
            if ($(this).find('option:selected').text() == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);
                macaddress.one(function (err, mac) {
                    $("#mac").val(mac);
                });
            }
            else {
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);
            }

        });



        $('#cashier').click(function () {

            ownUserEdit = true;

            $('#userModal').modal('show');

            $("#user_id").val(user._id);
            $("#fullname").val(user.fullname);
            $("#username").val(user.username);
            $("#password").val(atob(user.password));

        });



        $('#add-user').click(function () {

            if (platform.app != 'Network Point of Sale Terminal') {
                $('.perms').show();
            }

            $("#saveUser").get(0).reset();
            $('#userModal').modal('show');

        });



        $('#settings').click(function () {

            if (platform.app == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);

                $("#ip").val(platform.ip);
                $("#till").val(platform.till);

                macaddress.one(function (err, mac) {
                    $("#mac").val(mac);
                });

                $("#app option").filter(function () {
                    return $(this).text() == platform.app;
                }).prop("selected", true);
            }
            else {
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);

                $("#settings_id").val("1");
                $("#store").val(settings.store);
                $("#address_one").val(settings.address_one);
                $("#address_two").val(settings.address_two);
                $("#contact").val(settings.contact);
                $("#tax").val(settings.tax);
                $("#symbol").val(settings.symbol);
                $("#percentage").val(settings.percentage);
                $("#footer").val(settings.footer);
                $("#logo_img").val(settings.img);
                if (settings.charge_tax == 'on') {
                    $('#charge_tax').prop("checked", true);
                }
                if (settings.img && settings.img != "") {
                    $('#logoname').hide();
                    $('#current_logo').html(`<img src="${img_path + "settings/" + settings.img}" alt="">`);
                    $('#rmv_logo').show();
                }

                $("#app option").filter(function () {
                    return $(this).text() == settings.app;
                }).prop("selected", true);
            }




        });


    });


    $('#rmv_logo').click(function () {
        $('#remove_logo').val("1");
        $('#current_logo').hide(500);
        $(this).hide(500);
        $('#logoname').show(500);
    });


    $('#rmv_img').click(function () {
        $('#remove_img').val("1");
        $('#current_img').hide(500);
        $(this).hide(500);
        $('#imagename').show(500);
    });


    $('#print_list').click(function () {

        $("#loading").show();

        $('#productList').DataTable().destroy();

        const filename = 'productList.pdf';

        html2canvas($('#all_products').get(0)).then(canvas => {
            let height = canvas.height * (25.4 / 96);
            let width = canvas.width * (25.4 / 96);
            let pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);

            $("#loading").hide();
            pdf.save(filename);
        });



        $('#productList').DataTable({
            "order": [[1, "desc"]]
            , "autoWidth": false
            , "info": true
            , "JQueryUI": true
            , "ordering": true
            , "paging": false
        });

        $(".loading").hide();

    });

}


$.fn.print = function () {

    printJS({ printable: receipt, type: 'raw-html' });

}


function loadTransactions() {

    let tills = [];
    let users = [];
    let sales = 0;
    let transact = 0;
    let unique = 0;

    sold_items = [];
    sold = [];

    let counter = 0;
    let transaction_list = '';
    let query = `by-date?start=${start_date}&end=${end_date}&user=${by_user}&status=${by_status}&till=${by_till}`;


    $.get(api + query, function (transactions) {

        if (transactions.length > 0) {


            $('#transaction_list').empty();
            $('#transactionList').DataTable().destroy();

            allTransactions = [...transactions];

            transactions.forEach((trans, index) => {

                sales += parseFloat(trans.total);
                transact++;



                trans.items.forEach(item => {
                    sold_items.push(item);
                });


                if (!tills.includes(trans.till)) {
                    tills.push(trans.till);
                }

                if (!users.includes(trans.user_id)) {
                    users.push(trans.user_id);
                }

                counter++;
                transaction_list += `<tr>
                                <td>${trans.order}</td>
                                <td class="nobr">${moment(trans.date).format('YYYY MMM DD hh:mm:ss')}</td>
                                <td>${settings.symbol + trans.total}</td>
                                <td>${trans.paid == "" ? "" : settings.symbol + trans.paid}</td>
                                <td>${trans.change ? settings.symbol + Math.abs(trans.change).toFixed(2) : '00'}</td>
                                <td>${trans.paid == "" ? "" : trans.payment_type == 0 ? "Cash" : 'Card'}</td>
                                <td>${trans.till}</td>
                                <td>${trans.user ?? 'Unknown User'}</td>
                                <td>${trans.paid == "" ? '<button class="btn btn-dark"><i class="fa fa-search-plus"></i></button>' : '<button onClick="$(this).viewTransaction(' + index + ')" class="btn btn-info"><i class="fa fa-search-plus"></i></button></td>'}</tr>
                    `;

                if (counter == transactions.length) {

                    $('#total_sales #counter').text(settings.symbol + parseFloat(sales).toFixed(2));
                    $('#total_transactions #counter').text(transact);

                    const result = {};

                    for (const { product_name, price, quantity, id } of sold_items) {
                        if (!result[product_name]) result[product_name] = [];
                        result[product_name].push({ id, price, quantity });
                    }

                    for (item in result) {

                        let price = 0;
                        let quantity = 0;
                        let id = 0;

                        result[item].forEach(i => {
                            id = i.id;
                            price = i.price;
                            quantity += i.quantity;
                        });

                        sold.push({
                            id: id,
                            product: item,
                            qty: quantity,
                            price: price
                        });
                    }

                    loadSoldProducts();


                    if (by_user == 0 && by_till == 0) {

                        userFilter(users);
                        tillFilter(tills);
                    }


                    $('#transaction_list').html(transaction_list);
                    $('#transactionList').DataTable({
                        "order": [[1, "desc"]]
                        , "autoWidth": false
                        , "info": true
                        , "JQueryUI": true
                        , "ordering": true
                        , "paging": true,
                        "dom": 'Bfrtip',
                        "buttons": ['csv', 'excel', 'pdf',]

                    });
                }
            });
        }
        else {
            Swal.fire(
                'No data!',
                'No transactions available within the selected criteria',
                'warning'
            );
        }

    });
}


function discend(a, b) {
    if (a.qty > b.qty) {
        return -1;
    }
    if (a.qty < b.qty) {
        return 1;
    }
    return 0;
}


function loadSoldProducts() {

    sold.sort(discend);

    let counter = 0;
    let sold_list = '';
    let items = 0;
    let products = 0;
    $('#product_sales').empty();

    sold.forEach((item, index) => {

        items += item.qty;
        products++;

        let product = allProducts.filter(function (selected) {
            return selected._id == item.id;
        });

        counter++;

        sold_list += `<tr>
            <td>${item.product}</td>
            <td>${item.qty}</td>
            <td>${product.length > 0 ? product[0].quantity || 'N/A' : 'N/A'}</td>
            <td>${settings && settings.symbol ? settings.symbol : '$'}${(item.qty * parseFloat(item.price)).toFixed(2)}</td>
            </tr>`;

        if (counter == sold.length) {
            $('#total_items #counter').text(items);
            $('#total_products #counter').text(products);
            $('#product_sales').html(sold_list);
        }
    });
}


function userFilter(users) {

    $('#users').empty();
    $('#users').append(`<option value="0">All</option>`);

    // Check if allUsers is loaded
    if (!allUsers || allUsers.length === 0) {
        console.warn('allUsers not loaded yet, skipping user filter');
        return;
    }

    users.forEach(user => {
        let u = allUsers.filter(function (usr) {
            return usr._id == user;
        });

        // Add error checking to prevent undefined access
        if (u.length > 0 && u[0] && u[0].fullname) {
            $('#users').append(`<option value="${user}">${u[0].fullname}</option>`);
        } else {
            console.warn('User not found or missing fullname for ID:', user);
            $('#users').append(`<option value="${user}">Unknown User (${user})</option>`);
        }
    });

}


function tillFilter(tills) {

    $('#tills').empty();
    $('#tills').append(`<option value="0">All</option>`);
    tills.forEach(till => {
        $('#tills').append(`<option value="${till}">${till}</option>`);
    });

}


$.fn.viewTransaction = function (index) {

    transaction_index = index;

    let discount = allTransactions[index].discount;
    let customer = allTransactions[index].customer == 0 ? 'Walk in Customer' : allTransactions[index].customer.username;
    let refNumber = allTransactions[index].ref_number != "" ? allTransactions[index].ref_number : allTransactions[index].order;
    let orderNumber = allTransactions[index].order;
    let type = "";
    let tax_row = "";
    let items = "";
    let products = allTransactions[index].items;

    products.forEach(item => {
        items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + parseFloat(item.price).toFixed(2) + "</td></tr>";

    });


    switch (allTransactions[index].payment_type) {

        case 2: type = "Card";
            break;

        default: type = "Cash";

    }


    if (allTransactions[index].paid != "") {
        payment = `<tr>
                    <td>Paid</td>
                    <td>:</td>
                    <td>${settings.symbol + allTransactions[index].paid}</td>
                </tr>
                <tr>
                    <td>Change</td>
                    <td>:</td>
                    <td>${settings.symbol + Math.abs(allTransactions[index].change).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Method</td>
                    <td>:</td>
                    <td>${type}</td>
                </tr>`
    }



    if (settings.charge_tax) {
        tax_row = `<tr>
                <td>Vat(${settings.percentage})% </td>
                <td>:</td>
                <td>${settings.symbol}${parseFloat(allTransactions[index].tax).toFixed(2)}</td>
            </tr>`;
    }



    receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${!settings.img || settings.img == "" ? "" : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + "settings/" + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
    </p>
    <hr>
    <left>
        <p>
        Invoice : ${orderNumber} <br>
        Ref No : ${refNumber} <br>
        Customer : ${allTransactions[index].customer == 0 ? 'Walk in Customer' : allTransactions[index].customer.name} <br>
        Cashier : ${allTransactions[index].user ?? 'Unknown User'} <br>
        Date : ${moment(allTransactions[index].date).format('DD MMM YYYY HH:mm:ss')}<br>
        </p>

    </left>
    <hr>
    <table width="100%">
        <thead style="text-align: left;">
        <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
        </tr>
        </thead>
        <tbody>
        ${items}                
 
        <tr>                        
            <td><b>Subtotal</b></td>
            <td>:</td>
            <td><b>${settings.symbol}${allTransactions[index].subtotal}</b></td>
        </tr>
        <tr>
            <td>Discount</td>
            <td>:</td>
            <td>${discount > 0 ? settings.symbol + parseFloat(allTransactions[index].discount).toFixed(2) : ''}</td>
        </tr>
        
        ${tax_row}
    
        <tr>
            <td><h3>Total</h3></td>
            <td><h3>:</h3></td>
            <td>
                <h3>${settings.symbol}${allTransactions[index].total}</h3>
            </td>
        </tr>
        ${payment == 0 ? '' : payment}
        </tbody>
        </table>
        <br>
        <hr>
        <br>
        <p style="text-align: center;">
         ${settings.footer}
         </p>
        </div>`;

    $('#viewTransaction').html('');
    $('#viewTransaction').html(receipt);

    $('#orderModal').modal('show');

}


$('#status').change(function () {
    by_status = $(this).find('option:selected').val();
    loadTransactions();
});



$('#tills').change(function () {
    by_till = $(this).find('option:selected').val();
    loadTransactions();
});


$('#users').change(function () {
    by_user = $(this).find('option:selected').val();
    loadTransactions();
});


$('#reportrange').on('apply.daterangepicker', function (ev, picker) {

    start = picker.startDate.format('DD MMM YYYY hh:mm A');
    end = picker.endDate.format('DD MMM YYYY hh:mm A');

    start_date = picker.startDate.toDate().toJSON();
    end_date = picker.endDate.toDate().toJSON();


    loadTransactions();
});


function authenticate() {
    $('#loading').append(
        `<div id="load">
            <form id="account">
                <div class="form-group">
                    <input type="text" placeholder="Username" name="username" class="form-control">
                </div>
                <div class="form-group">
                    <input type="password" placeholder="Password" name="password" class="form-control">
                </div>
                <div class="form-group">
                    <input type="submit" class="btn btn-block btn-default" value="Login">
                </div>
            </form>
            <div class="text-center mt-3">
                <button id="resetAdmin" class="btn btn-sm btn-warning">Reset Admin User</button>
            </div>
        </div>`
    );
    
    // Add event listener for reset admin button
    $('#resetAdmin').click(function() {
        Swal.fire({
            title: 'Reset Admin User?',
            text: 'This will reset the admin user to username: admin, password: admin',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Reset Admin'
        }).then((result) => {
            if (result.value) {
                $.ajax({
                    url: api + 'users/reset-admin',
                    type: 'POST',
                    success: function(data) {
                        Swal.fire(
                            'Success!',
                            'Admin user has been reset. You can now login with admin/admin',
                            'success'
                        );
                    },
                    error: function(xhr, status, error) {
                        Swal.fire(
                            'Error!',
                            'Failed to reset admin user: ' + error,
                            'error'
                        );
                    }
                });
            }
        });
    });
}


$('body').on("submit", "#account", function (e) {
    e.preventDefault();
    let formData = $(this).serializeObject();

    if (formData.username == "" || formData.password == "") {
        Swal.fire(
            'Incomplete form!',
            auth_empty,
            'warning'
        );
    }
    else {
        console.log('Attempting login with:', formData.username);
        
        $.ajax({
            url: api + 'users/login',
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json; charset=utf-8',
            cache: false,
            processData: false,
            success: function (data) {
                console.log('Login response:', data);
                
                if (data && data.user._id) {
                    console.log('Login successful, storing user data');
                    storage.set('auth', { auth: true });
                    storage.set('user', data.user); // Store only the user object, not the entire response
                    ipcRenderer.send('app-reload', '');
                }
                else {
                    console.log('Login failed - no user data returned');
                    Swal.fire(
                        'Oops!',
                        auth_error,
                        'warning'
                    );
                }
            }, 
            error: function (xhr, status, error) {
                console.error('Login error:', {xhr, status, error});
                Swal.fire(
                    'Login Error',
                    'Failed to connect to server. Please check if the server is running.',
                    'error'
                );
            }
        });
    }
});


$('#quit').click(function () {
    Swal.fire({
        title: 'Are you sure?',
        text: "You are about to close the application.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Close Application'
    }).then((result) => {

        if (result.value) {
            ipcRenderer.send('app-quit', '');
        }
    });
});

// Raw Materials functionality
let allRawMaterials = [];

// Load raw materials
function loadRawMaterials() {
    console.log('🔄 Loading raw materials from API...');
    apiGet('raw-materials/raw-materials', function (data) {
        console.log('✅ Raw materials loaded:', data.length, 'materials');
        allRawMaterials = [...data];
        loadRawMaterialList();
    });
}

// Load raw materials list in modal
function loadRawMaterialList() {
    let materials = [...allRawMaterials];
    let material_list = '';
    let counter = 0;
    $('#raw_material_list').empty();
    $('#rawMaterialList').DataTable().destroy();

    materials.forEach((material, index) => {
        counter++;
        
        material_list += `<tr>
            <td>${material._id}</td>
            <td>${material.name}</td>
            <td>${material.description || ''}</td>
            <td>${material.unit || ''}</td>
            <td>${settings && settings.symbol ? settings.symbol : '$'}${material.cost_per_unit || '0.00'}</td>
            <td>${material.quantity_in_stock || '0'}</td>
            <td>${material.supplier || ''}</td>
            <td class="nobr"><span class="btn-group"><button onClick="$(this).editRawMaterial(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteRawMaterial(${material._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td>
        </tr>`;

        if (counter == allRawMaterials.length) {
            $('#raw_material_list').html(material_list);
            $('#rawMaterialList').DataTable({
                "pageLength": 10,
                "order": [[ 0, "desc" ]]
            });
        }
    });
}

// Edit raw material
$.fn.editRawMaterial = function (index) {
    $('#RawMaterials').modal('hide');

    $('#rawMaterialName').val(allRawMaterials[index].name);
    $('#rawMaterialSku').val(allRawMaterials[index].sku || '');
    $('#rawMaterialDescription').val(allRawMaterials[index].description || '');
    $('#rawMaterialUnit').val(allRawMaterials[index].unit || '');
    $('#raw_material_price').val(allRawMaterials[index].cost_per_unit);
    $('#raw_material_quantity').val(allRawMaterials[index].quantity_in_stock);
    $('#raw_material_min_quantity').val(allRawMaterials[index].min_quantity);
    $('#rawMaterialSupplier').val(allRawMaterials[index].supplier || '');
    $('#raw_material_id').val(allRawMaterials[index]._id);
    // Note: Raw material model doesn't have image field
    $('#raw_material_img').val('');

    // Check if material is inactive (stock disabled)
    if (allRawMaterials[index].is_active === false) {
        $('#raw_material_stock').prop('checked', true);
    } else {
        $('#raw_material_stock').prop('checked', false);
    }

    // Note: RawMaterial model doesn't have image field, removing image display
    // if (allRawMaterials[index].img != "") {
    //     $('#current_raw_material_img').html(`<img style="max-height: 50px; max-width: 50px; border: 1px solid #ddd;" src="${img_path + allRawMaterials[index].img}">`);
    // }

    $('#newRawMaterial').modal('show');
}

// Delete raw material
$.fn.deleteRawMaterial = function (id) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You are about to delete this raw material.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.value) {
            $.ajax({
                url: api + 'raw-materials/raw-material/' + id,
                type: 'DELETE',
                success: function (data) {
                    loadRawMaterials();
                    Swal.fire(
                        'Deleted!',
                        'Raw material has been deleted.',
                        'success'
                    );
                }
            });
        }
    });
}

// Raw material form submission
$('#saveRawMaterial').submit(function (e) {
    e.preventDefault();

    $(this).attr('action', api + 'raw-materials/raw-material');
    $(this).attr('method', 'POST');

    $(this).ajaxSubmit({
        contentType: 'application/json',
        success: function (response) {
            $('#saveRawMaterial').get(0).reset();
            $('#current_raw_material_img').text('');

            loadRawMaterials();
            Swal.fire({
                title: 'Raw Material Saved',
                text: "Select an option below to continue.",
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Add another',
                cancelButtonText: 'Close'
            }).then((result) => {
                if (!result.value) {
                    $("#newRawMaterial").modal('hide');
                }
            });
        }, error: function (data) {
            console.log(data);
        }
    });
});

// Raw material modal click handlers
$('#rawMaterialsModal').click(function () {
    loadRawMaterials(); // Reload raw materials data first
    loadRawMaterialList();
});

$('#newRawMaterialModal').click(function () {
    $('#saveRawMaterial').get(0).reset();
    $('#current_raw_material_img').text('');
    $('#raw_material_id').val('');
    $('#raw_material_img').val('');
    $('#remove_raw_material_img').val('');
});

// Raw material image handling
$('#rmv_raw_material_img').click(function () {
    $('#remove_raw_material_img').val(1);
    $('#current_raw_material_img').text('');
});

// Load raw materials when page loads
$(document).ready(function() {
    // Load raw materials after categories are loaded
    setTimeout(function() {
        loadRawMaterials();
    }, 1000);
});

// Raw Materials in Products functionality
function resetRawMaterialsForm() {
    $('#raw_materials_container').html(`
        <div class="raw-material-item" style="margin-bottom: 10px;">
            <div class="row">
                <div class="col-md-6">
                    <select class="form-control raw-material-select" name="raw_materials[]">
                        <option value="">Select Raw Material</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <input type="number" class="form-control raw-material-quantity" name="raw_material_quantities[]" placeholder="Quantity" min="0" step="0.01">
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm remove-raw-material" style="display: none;">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `);
    // Refresh raw materials data before populating dropdown
    loadRawMaterials();
    setTimeout(() => {
        populateRawMaterialsDropdown();
    }, 100);
}

function populateRawMaterialsDropdown() {
    $('.raw-material-select').each(function() {
        if ($(this).find('option').length <= 1) { // Only has the default option
            allRawMaterials.forEach(material => {
                $(this).append(`<option value="${material._id}">${material.name} (${material.unit || 'unit'}) - Stock: ${material.quantity_in_stock || 0}</option>`);
            });
        }
    });
}

function addRawMaterialRow() {
    const newRow = `
        <div class="raw-material-item" style="margin-bottom: 10px;">
            <div class="row">
                <div class="col-md-6">
                    <select class="form-control raw-material-select" name="raw_materials[]">
                        <option value="">Select Raw Material</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <input type="number" class="form-control raw-material-quantity" name="raw_material_quantities[]" placeholder="Quantity" min="0" step="0.01">
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm remove-raw-material">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    $('#raw_materials_container').append(newRow);
    // Refresh raw materials data before populating dropdown
    loadRawMaterials();
    setTimeout(() => {
        populateRawMaterialsDropdown();
        updateRemoveButtons();
    }, 100);
}

function updateRemoveButtons() {
    const items = $('.raw-material-item');
    items.each(function(index) {
        const removeBtn = $(this).find('.remove-raw-material');
        if (items.length > 1) {
            removeBtn.show();
        } else {
            removeBtn.hide();
        }
    });
}

// Event handlers for raw materials in products
$(document).on('click', '#add-raw-material', function() {
    addRawMaterialRow();
});

$(document).on('click', '.remove-raw-material', function() {
    $(this).closest('.raw-material-item').remove();
    updateRemoveButtons();
});

// Load raw materials into product form when editing
function loadProductRawMaterials(rawMaterials) {
    resetRawMaterialsForm();
    
    if (rawMaterials && rawMaterials.length > 0) {
        // First, create the required number of rows
        rawMaterials.forEach((rm, index) => {
            if (index > 0) {
                // Add new rows for additional materials (first row already exists from resetRawMaterialsForm)
                addRawMaterialRow();
            }
        });
        
        // Then populate dropdowns and set values
        setTimeout(() => {
            populateRawMaterialsDropdown();
            
            // Set values after dropdowns are populated
            rawMaterials.forEach((rm, index) => {
                const row = $('.raw-material-item').eq(index);
                if (row.length > 0) {
                    row.find('.raw-material-select').val(rm._id || rm.id);
                    row.find('.raw-material-quantity').val(rm.ProductRawMaterial?.quantity_required || rm.quantity_required || '');
                }
            });
            
            updateRemoveButtons();
        }, 200);
    }
}

// Load and display transactions
window.loadTransactions = function() {
    console.log('Loading transactions...');
    
    // Get filter values
    const selectedUser = $('#users').val();
    const selectedStatus = $('#status').val();
    let startDate = null;
    let endDate = null;
    
    // Get date range if daterangepicker is available
    if (typeof $.fn.daterangepicker === 'function' && $('#reportrange').data('daterangepicker')) {
        const dateRange = $('#reportrange').data('daterangepicker');
        startDate = dateRange.startDate.format('YYYY-MM-DD');
        endDate = dateRange.endDate.format('YYYY-MM-DD');
    }
    
    // Build query parameters
    let queryParams = [];
    if (selectedUser) queryParams.push(`user=${selectedUser}`);
    if (selectedStatus) queryParams.push(`status=${selectedStatus}`);
    if (startDate && endDate) {
        queryParams.push(`start=${startDate}`);
        queryParams.push(`end=${endDate}`);
    }
    
    const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
    console.log('Filter query:', queryString);
    console.log('Filter values:', { selectedUser, selectedStatus, startDate, endDate });
    
    $.ajax({
        url: api + 'transactions/transactions' + queryString,
        type: 'GET',
        success: function(transactions) {
            console.log('Transactions loaded:', transactions.length);
            
            const tbody = $('#transaction_list');
            tbody.empty();
            
            if (transactions && transactions.length > 0) {
                transactions.forEach(function(transaction) {
                    // Convert payment method to display format
                    const paymentDisplay = transaction.payment_method === 'cash' ? 'Cash' : 
                                         transaction.payment_method === 'card' ? 'Card' : 
                                         (transaction.payment_method || 'Cash');
                    
                    // For completed transactions, assume paid in full
                    const totalAmount = parseFloat(transaction.total);
                    const paidAmount = transaction.status === 'completed' ? totalAmount : 0;
                    const changeAmount = transaction.status === 'completed' ? 0 : 0;
                    
                    const row = `
                        <tr>
                            <td>${transaction.transaction_number || 'N/A'}</td>
                            <td class="nobr">${new Date(transaction.created_at).toLocaleDateString()}</td>
                            <td>${settings.symbol}${totalAmount.toFixed(2)}</td>
                            <td>${transaction.status === 'completed' ? settings.symbol + paidAmount.toFixed(2) : ''}</td>
                            <td>${settings.symbol}${changeAmount.toFixed(2)}</td>
                            <td>${paymentDisplay}</td>
                            <td>1</td>
                            <td>${transaction.user ? transaction.user.full_name || transaction.user.username : 'Unknown User'}</td>
                            <td>
                                <button class="btn btn-sm btn-info" onclick="viewTransaction(${transaction.id})">
                                    <i class="fa fa-search-plus"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
                
                // Update transaction counter
                $('#total_transactions div').text(transactions.length);
            } else {
                tbody.append('<tr><td colspan="9" class="text-center">No transactions found</td></tr>');
                $('#total_transactions div').text('0');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading transactions:', error);
            const tbody = $('#transaction_list');
            tbody.empty();
            tbody.append('<tr><td colspan="9" class="text-center text-danger">Error loading transactions</td></tr>');
        }
    });
}

// View transaction details
window.viewTransaction = function(transactionId) {
    console.log('Viewing transaction:', transactionId);
    
    $.ajax({
        url: api + 'transactions/transaction/' + transactionId,
        type: 'GET',
        success: function(transaction) {
            console.log('Transaction details:', transaction);
            
            let itemsHtml = '';
            if (transaction.items && transaction.items.length > 0) {
                transaction.items.forEach(function(item) {
                    itemsHtml += `
                        <tr>
                            <td>${item.product ? item.product.name : 'Unknown Product'}</td>
                            <td>${item.quantity}</td>
                            <td>${settings.symbol}${parseFloat(item.unit_price).toFixed(2)}</td>
                            <td>${settings.symbol}${parseFloat(item.total_price).toFixed(2)}</td>
                        </tr>
                    `;
                });
            }
            
            const transactionHtml = `
                <div class="transaction-details">
                    <h4>Transaction #${transaction.transaction_number}</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Date:</strong> ${new Date(transaction.created_at).toLocaleString()}</p>
                            <p><strong>Cashier:</strong> ${transaction.user ? transaction.user.full_name || transaction.user.username : 'N/A'}</p>
                            <p><strong>Customer:</strong> ${transaction.customer ? transaction.customer.name : 'Walk-in'}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Payment Method:</strong> ${transaction.payment_method || 'cash'}</p>
                            <p><strong>Status:</strong> ${transaction.status}</p>
                            ${transaction.notes ? `<p><strong>Notes:</strong> ${transaction.notes}</p>` : ''}
                        </div>
                    </div>
                    
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div class="row">
                        <div class="col-md-6 col-md-offset-6">
                            <table class="table">
                                <tr>
                                    <td><strong>Subtotal:</strong></td>
                                    <td>${settings.symbol}${parseFloat(transaction.subtotal).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Tax:</strong></td>
                                    <td><strong>${settings.symbol}${parseFloat(transaction.tax).toFixed(2)}</strong></td>
                                </tr>
                                <tr>
                                    <td><strong>Total:</strong></td>
                                    <td><strong>${settings.symbol}${parseFloat(transaction.total).toFixed(2)}</strong></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            $('#viewTransaction').html(transactionHtml);
            $('#orderModal').modal('show');
        },
        error: function(xhr, status, error) {
            console.error('Error loading transaction details:', error);
            alert('Error loading transaction details');
        }
    });
}

// Load user list for transactions filter
window.loadUserList = function() {
    console.log('Loading user list for transaction filters...');
    
    $.ajax({
        url: api + 'users/',
        type: 'GET',
        success: function(users) {
            console.log('Users loaded:', users.length);
            
            const userSelect = $('#users');
            userSelect.empty();
            userSelect.append('<option value="">All Cashiers</option>');
            
            if (users && users.length > 0) {
                users.forEach(function(user) {
                    userSelect.append(`<option value="${user.id}">${user.full_name || user.username}</option>`);
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading users:', error);
        }
    });
}

// Load transaction statistics and product sales
window.loadTransactionStats = function() {
    console.log('Loading transaction statistics...');
    
    // Get filter values (same as loadTransactions)
    const selectedUser = $('#users').val();
    const selectedStatus = $('#status').val();
    let startDate = null;
    let endDate = null;
    
    // Get date range if daterangepicker is available
    if (typeof $.fn.daterangepicker === 'function' && $('#reportrange').data('daterangepicker')) {
        const dateRange = $('#reportrange').data('daterangepicker');
        startDate = dateRange.startDate.format('YYYY-MM-DD');
        endDate = dateRange.endDate.format('YYYY-MM-DD');
    }
    
    // Build query parameters for stats
    let queryParams = [];
    if (startDate && endDate) {
        queryParams.push(`start_date=${startDate}`);
        queryParams.push(`end_date=${endDate}`);
    }
    // Note: Stats endpoint currently only supports date filtering
    
    const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
    console.log('Stats filter query:', queryString);
    
    $.ajax({
        url: api + 'transactions/stats' + queryString,
        type: 'GET',
        success: function(stats) {
            console.log('Transaction stats loaded:', stats);
            
            // Update totals
            $('#total_sales div').text(settings.symbol + parseFloat(stats.total_revenue || 0).toFixed(2));
            $('#total_transactions div').text(stats.total_transactions || 0);
            
            // Calculate total items sold
            let totalItems = 0;
            if (stats.top_products) {
                stats.top_products.forEach(function(product) {
                    totalItems += parseInt(product.total_quantity || 0);
                });
            }
            $('#total_items div').text(totalItems);
            $('#total_products div').text(stats.top_products ? stats.top_products.length : 0);
            
            // Populate products table
            const tbody = $('#product_sales');
            tbody.empty();
            
            if (stats.top_products && stats.top_products.length > 0) {
                stats.top_products.forEach(function(product) {
                    const row = `
                        <tr>
                            <td>${product.product ? product.product.name : 'Unknown Product'}</td>
                            <td>${product.total_quantity || 0}</td>
                            <td>-</td>
                            <td>${settings.symbol}${parseFloat(product.total_revenue || 0).toFixed(2)}</td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            } else {
                tbody.append('<tr><td colspan="4" class="text-center">No product sales data</td></tr>');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading transaction stats:', error);
            // Set default values on error
            $('#total_sales div').text(settings.symbol + '0.00');
            $('#total_transactions div').text('0');
            $('#total_items div').text('0');
            $('#total_products div').text('0');
            $('#product_sales').html('<tr><td colspan="4" class="text-center text-danger">Error loading statistics</td></tr>');
        }
    });
}

// Initialize transaction filters
window.initTransactionFilters = function() {
    console.log('Initializing transaction filters...');
    
    // Initialize date range picker if it exists
    if (typeof $.fn.daterangepicker === 'function') {
        $('#reportrange').daterangepicker({
            startDate: moment().subtract(29, 'days'),
            endDate: moment(),
            ranges: {
               'Today': [moment(), moment()],
               'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
               'Last 7 Days': [moment().subtract(6, 'days'), moment()],
               'Last 30 Days': [moment().subtract(29, 'days'), moment()],
               'This Month': [moment().startOf('month'), moment().endOf('month')],
               'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            },
            locale: {
                format: 'MM/DD/YYYY'
            }
        }, function(start, end, label) {
            console.log('Date range selected:', label, start.format('YYYY-MM-DD'), 'to', end.format('YYYY-MM-DD'));
            // Update the display text
            $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
            // Reload data when date range changes
            window.loadTransactions();
            window.loadTransactionStats();
        });
        
        // Set initial display text
        $('#reportrange span').html(moment().subtract(29, 'days').format('MMMM D, YYYY') + ' - ' + moment().format('MMMM D, YYYY'));
    } else {
        console.warn('daterangepicker not available');
    }
    
    // Add change handlers for other filters
    $('#users, #status').on('change', function() {
        console.log('Filter changed:', $(this).attr('id'), $(this).val());
        // Reload data when filters change
        window.loadTransactions();
        window.loadTransactionStats();
    });
}

// User Management Functions

// Load all users
window.loadAllUsers = function() {
    console.log('Loading all users...');
    
    $.ajax({
        url: api + 'users/',
        type: 'GET',
        success: function(users) {
            console.log('Users loaded:', users.length);
            
            const tbody = $('#user_list');
            tbody.empty();
            
            if (users && users.length > 0) {
                users.forEach(function(user) {
                    const statusBadge = user.is_active ? 
                        '<span class="badge badge-success">Active</span>' : 
                        '<span class="badge badge-danger">Inactive</span>';
                    
                    const row = `
                        <tr>
                            <td>${user.full_name || 'N/A'}</td>
                            <td>${user.username}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <button class="btn btn-sm btn-info" onclick="editUser(${user.id})">
                                    <i class="fa fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                                    <i class="fa fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            } else {
                tbody.append('<tr><td colspan="4" class="text-center">No users found</td></tr>');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading users:', error);
            const tbody = $('#user_list');
            tbody.empty();
            tbody.append('<tr><td colspan="4" class="text-center text-danger">Error loading users</td></tr>');
        }
    });
}

// Create new user
window.createUser = function(userData) {
    console.log('Creating new user:', userData);
    
    $.ajax({
        url: api + 'users/',
        type: 'POST',
        data: JSON.stringify(userData),
        contentType: 'application/json',
        success: function(response) {
            console.log('User created successfully:', response);
            alert('User created successfully!');
            $('#newUserForm')[0].reset();
            $('#newUser').modal('hide');
            loadAllUsers(); // Refresh the user list
        },
        error: function(xhr, status, error) {
            console.error('Error creating user:', error);
            let errorMessage = 'Failed to create user';
            if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMessage = xhr.responseJSON.error;
            }
            alert('Error: ' + errorMessage);
        }
    });
}

// Edit user - fetch user data and populate edit form
window.editUser = function(userId) {
    console.log('Edit user:', userId);
    
    // Fetch user data by ID
    $.ajax({
        url: api + 'users/' + userId,
        type: 'GET',
        success: function(user) {
            console.log('User data loaded for editing:', user);
            
            // Note: Field population moved to modal shown event
            
            // Show permissions section
            $('.perms').show();
            
            // Close any open modals and open the edit modal
            $('#userManagement').modal('hide');
            $('#Users').modal('hide');
            
            // Open the modal and populate fields after it's shown
            $('#userModal').modal('show');
            
            // Use setTimeout to ensure modal is fully rendered before populating fields
            setTimeout(function() {
                console.log('Populating user edit fields after modal is shown...');
                
                // Populate fields after modal is shown
                $('#user_id').val(user.id);
                $('#edit_fullname').val(user.full_name || user.fullname || '');
                $('#edit_username').val(user.username || '');
                $('#edit_password').val('');
                $('#user_email').val(user.email || '');
                $('#user_role').val(user.role || '');
                
                // Set permissions based on role
                if (user.role === 'admin') {
                    $('#perm_products').prop('checked', true);
                    $('#perm_categories').prop('checked', true);
                    $('#perm_raw_materials').prop('checked', true);
                    $('#perm_transactions').prop('checked', true);
                    $('#perm_users').prop('checked', true);
                    $('#perm_settings').prop('checked', true);
                } else {
                    // Default permissions for non-admin users
                    $('#perm_products').prop('checked', true);
                    $('#perm_categories').prop('checked', true);
                    $('#perm_raw_materials').prop('checked', false);
                    $('#perm_transactions').prop('checked', true);
                    $('#perm_users').prop('checked', false);
                    $('#perm_settings').prop('checked', false);
                }
                
                console.log('User edit fields populated successfully');
            }, 500); // Wait 500ms for modal to be fully rendered
        },
        error: function(xhr, status, error) {
            console.error('Error loading user for editing:', error);
            alert('Error loading user data for editing');
        }
    });
}

// Delete user (placeholder for future implementation)
window.deleteUser = function(userId) {
    console.log('Delete user:', userId);
    if (confirm('Are you sure you want to delete this user?')) {
        alert('Delete user functionality will be implemented in the next update');
    }
}

// Load current user account info
window.loadAccountInfo = function() {
    console.log('Loading account info...');
    
    // Get current user from storage or global variable
    const currentUser = user || storage.get('user');
    
    if (currentUser) {
        $('#currentUsername').text(currentUser.username || 'N/A');
        $('#currentFullName').text(currentUser.full_name || currentUser.fullname || 'N/A');
        $('#currentEmail').text(currentUser.email || 'N/A');
        $('#currentRole').text(currentUser.role || 'N/A');
        $('#currentLastLogin').text(currentUser.last_login ? new Date(currentUser.last_login).toLocaleString() : 'Never');
    } else {
        $('#currentUsername').text('Not logged in');
        $('#currentFullName').text('Not logged in');
        $('#currentEmail').text('Not logged in');
        $('#currentRole').text('Not logged in');
        $('#currentLastLogin').text('Not logged in');
    }
}

// Change password function
window.changePassword = function(passwordData) {
    console.log('Changing password...');
    
    // Get current user ID
    const currentUser = user || storage.get('user');
    if (!currentUser || !currentUser._id) {
        alert('Error: User not logged in');
        return;
    }
    
    // Add user_id to password data
    const dataWithUserId = {
        ...passwordData,
        user_id: currentUser._id
    };
    
    $.ajax({
        url: api + 'users/change-password',
        type: 'POST',
        data: JSON.stringify(dataWithUserId),
        contentType: 'application/json',
        success: function(response) {
            console.log('Password changed successfully:', response);
            alert('Password changed successfully!');
            $('#changePasswordForm')[0].reset();
        },
        error: function(xhr, status, error) {
            console.error('Error changing password:', error);
            let errorMessage = 'Failed to change password';
            if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMessage = xhr.responseJSON.error;
            }
            alert('Error: ' + errorMessage);
        }
    });
}

// Handle new user form submission
$(document).ready(function() {
    $('#newUserForm').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const userData = {
            full_name: formData.get('full_name'),
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role'),
            is_active: formData.get('is_active') === 'on'
        };
        
        // Validate password confirmation
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        // Validate required fields
        if (!userData.full_name || !userData.username || !userData.password || !userData.role) {
            alert('Please fill in all required fields!');
            return;
        }
        
        createUser(userData);
    });
    
    // Handle change password form submission
    $('#changePasswordForm').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const passwordData = {
            current_password: formData.get('current_password'),
            new_password: formData.get('new_password'),
            confirm_password: formData.get('confirm_new_password')
        };
        
        // Validate password confirmation
        if (passwordData.new_password !== passwordData.confirm_password) {
            alert('New passwords do not match!');
            return;
        }
        
        // Validate required fields
        if (!passwordData.current_password || !passwordData.new_password) {
            alert('Please fill in all required fields!');
            return;
        }
        
        changePassword(passwordData);
    });
    
    // Load users when Users modal is opened
    $('#usersModal').on('click', function() {
        loadAllUsers();
    });
    
    // Load account info when User Management modal is opened
    $('#add-user').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        loadAccountInfo();
    });
    
    // Handle user edit form submission
    $('#saveUser').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const userData = {
            id: formData.get('id'),
            fullname: formData.get('fullname'),
            username: formData.get('username'),
            password: formData.get('password'),
            email: formData.get('email'),
            role: formData.get('role'),
            perm_products: formData.get('perm_products') === 'on' ? 1 : 0,
            perm_categories: formData.get('perm_categories') === 'on' ? 1 : 0,
            perm_raw_materials: formData.get('perm_raw_materials') === 'on' ? 1 : 0,
            perm_transactions: formData.get('perm_transactions') === 'on' ? 1 : 0,
            perm_users: formData.get('perm_users') === 'on' ? 1 : 0,
            perm_settings: formData.get('perm_settings') === 'on' ? 1 : 0
        };
        
        // Validate password confirmation if password is provided
        const password = formData.get('password');
        const confirmPassword = formData.get('pass');
        
        if (password && password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        // Don't send empty password
        if (!password) {
            delete userData.password;
        }
        
        // Validate required fields
        if (!userData.fullname || !userData.username || !userData.role) {
            alert('Please fill in all required fields!');
            return;
        }
        
        // Update user
        $.ajax({
            url: api + 'users/',
            type: 'POST',
            data: JSON.stringify(userData),
            contentType: 'application/json',
            success: function(response) {
                console.log('User updated successfully:', response);
                alert('User updated successfully!');
                $('#saveUser')[0].reset();
                $('#userModal').modal('hide');
                loadAllUsers(); // Refresh the user list
            },
            error: function(xhr, status, error) {
                console.error('Error updating user:', error);
                let errorMessage = 'Failed to update user';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                }
                alert('Error: ' + errorMessage);
            }
        });
    });
});

