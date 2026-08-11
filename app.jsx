const { useState, useEffect } = React;

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAAoxHNxSxHzt09fauzRLnZFxkhzXFAbgM",
  authDomain: "expozstore111.firebaseapp.com",
  projectId: "expozstore111",
  storageBucket: "expozstore111.firebasestorage.app",
  messagingSenderId: "349337666272",
  appId: "1:349337666272:web:831ce8b876fc06523f0685",
  measurementId: "G-3KXM6DYK26"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Safe Icon Component to prevent React DOM conflicts with Lucide
const Icon = ({ name, size, className, style }) => {
    const iconHtml = `<i data-lucide="${name}" ${size ? `size="${size}"` : ''}></i>`;
    return (
        <span 
            className={className} 
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }} 
            dangerouslySetInnerHTML={{ __html: iconHtml }} 
        />
    );
};

const App = () => {
    // ---- State Management ----
    const [cart, setCart] = useState([]);
    const [toastMsg, setToastMsg] = useState("");
    const [currentView, setCurrentView] = useState("store"); 
    const [checkoutMode, setCheckoutMode] = useState("single");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // Auth State
    const [currentUser, setCurrentUser] = useState(null); 
    
    // Database State (Products)
    const [products, setProducts] = useState(null); // null means loading
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Form states
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    
    const [newProduct, setNewProduct] = useState({
        title: "", price: "", mrp: "", image: "", description: ""
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);

    const [orderFormData, setOrderFormData] = useState({
        name: '', phone: '', email: '', address1: '', address2: '', landmark: '', pincode: '', city: '', state: ''
    });
    const [orderId, setOrderId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Address Book State
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
    const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);

    // Admin Orders State
    const [adminViewTab, setAdminViewTab] = useState("products"); // 'products' or 'orders'
    const [allOrders, setAllOrders] = useState(null);
    const [adminSearchTerm, setAdminSearchTerm] = useState("");
    const [selectedReceiptOrder, setSelectedReceiptOrder] = useState(null);

    const ADMIN_EMAIL = "expoztech@gmail.com";

    // ---- Lifecycle / Initialization ----
    useEffect(() => {
        // Load User & Cart from local storage
        try {
            const savedUser = localStorage.getItem("expoz_user");
            if (savedUser) setCurrentUser(JSON.parse(savedUser));

            const savedCart = localStorage.getItem("expoz_cart");
            if (savedCart) setCart(JSON.parse(savedCart));
        } catch (e) {
            console.error("Local storage error:", e);
        }

        // Load Products from Firebase Firestore Real-time
        const unsubscribe = db.collection('products')
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const fetchedProducts = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setProducts(fetchedProducts);
                },
                (error) => {
                    console.error("Firebase fetch error:", error);
                    showToast("Error connecting to database.");
                    setProducts([]);
                }
            );

        return () => unsubscribe();
    }, []);

    // Load user addresses when currentUser changes
    useEffect(() => {
        if (currentUser && currentUser.email) {
            try {
                const addrs = localStorage.getItem(`expoz_addresses_${currentUser.email}`);
                if (addrs) {
                    const parsedAddrs = JSON.parse(addrs);
                    setSavedAddresses(parsedAddrs);
                    if (parsedAddrs.length > 0) {
                        setSelectedAddressIndex(0);
                        setIsAddingNewAddress(false);
                    } else {
                        setIsAddingNewAddress(true);
                    }
                } else {
                    setSavedAddresses([]);
                    setIsAddingNewAddress(true);
                }
            } catch(e) {
                console.error("Error loading addresses", e);
            }
        } else {
            setSavedAddresses([]);
            setIsAddingNewAddress(true);
        }
    }, [currentUser]);

    // Save cart to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem("expoz_cart", JSON.stringify(cart));
    }, [cart]);

    // Re-run icons script when the view changes
    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [currentView, cart.length, toastMsg, products, currentUser, isMenuOpen]);

    // Load Admin Orders when tab changes
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin' && adminViewTab === 'orders') {
            const unsubscribe = db.collection('orders')
                .orderBy('timestamp', 'desc')
                .onSnapshot(
                    (snapshot) => {
                        const fetchedOrders = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        setAllOrders(fetchedOrders);
                    },
                    (error) => {
                        console.error("Firebase order fetch error:", error);
                        // Fallback if index fails
                        if (error.message && error.message.includes('index')) {
                            db.collection('orders').get().then(snap => {
                                setAllOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                            });
                        } else {
                            setAllOrders([]);
                        }
                    }
                );
            return () => unsubscribe();
        }
    }, [currentUser, adminViewTab]);

    // ---- Helpers ----
    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    // ---- Auth Logic ----
    const handleLogin = (e) => {
        e.preventDefault();
        if (!authEmail) {
            showToast("Please enter your email");
            return;
        }

        let userObj = { email: authEmail, role: 'customer' };
        if (authEmail.toLowerCase() === ADMIN_EMAIL) {
            if (!authPassword || authPassword !== "860658") {
                showToast("Incorrect Admin Password!");
                return;
            }
            userObj.role = 'admin';
        }

        setCurrentUser(userObj);
        localStorage.setItem("expoz_user", JSON.stringify(userObj));
        showToast("Logged in successfully!");
        
        if (userObj.role === 'admin') setCurrentView('admin');
        else setCurrentView('store');
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem("expoz_user");
        setCurrentView('store');
        showToast("Logged out successfully");
    };

    // ---- Admin Logic (Firebase) ----
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.title || !newProduct.price) {
            showToast("Title and Price are required!");
            return;
        }
        if (!newProduct.image) {
            showToast("Please upload an image!");
            return;
        }

        setIsSavingProduct(true);
        try {
            if (editingProductId) {
                // Update existing product in Firestore
                await db.collection('products').doc(editingProductId).update({
                    title: newProduct.title,
                    price: newProduct.price,
                    mrp: newProduct.mrp,
                    image: newProduct.image,
                    description: newProduct.description
                });
                showToast("Product updated successfully!");
            } else {
                // Add new product to Firestore
                await db.collection('products').add({
                    title: newProduct.title,
                    price: newProduct.price,
                    mrp: newProduct.mrp,
                    image: newProduct.image,
                    description: newProduct.description,
                    rating: 4.5,
                    reviews: "0",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast("Product published to database!");
            }

            setNewProduct({ title: "", price: "", mrp: "", image: "", description: "" });
            setEditingProductId(null);
            
            const fileInput = document.getElementById('image-upload-input');
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error("Error saving product:", error);
            showToast("Failed to save product.");
        } finally {
            setIsSavingProduct(false);
        }
    };

    const handleEditProduct = (prod) => {
        setNewProduct({
            title: prod.title,
            price: prod.price,
            mrp: prod.mrp || "",
            image: prod.image,
            description: prod.description
        });
        setEditingProductId(prod.id);
        window.scrollTo(0, 0);
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm("Are you sure you want to delete this product?")) return;
        try {
            await db.collection('products').doc(id).delete();
            showToast("Product deleted from database!");
        } catch (error) {
            console.error("Error deleting product:", error);
            showToast("Failed to delete product.");
        }
    };

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        try {
            await db.collection('orders').doc(orderId).update({ status: newStatus });
            showToast("Order status updated!");
        } catch (error) {
            console.error("Error updating order status:", error);
            showToast("Failed to update status.");
        }
    };

    const handleCancelOrder = async (order) => {
        const reason = window.prompt("Are you sure you want to cancel this order? If yes, please enter the reason for cancellation:");
        if (reason === null) return; // User clicked cancel on the prompt

        try {
            await db.collection('orders').doc(order.id).update({ 
                status: 'Cancelled',
                cancellationReason: reason || "No reason provided"
            });
            showToast("Order cancelled successfully");

            // Open WhatsApp Message for cancellation
            const cancelMessage = `*Order Cancelled!*\n\n*Order ID:* ${order.orderId}\n*Customer:* ${order.name}\n*Reason:* ${reason || "No reason provided"}\n\n_The customer has cancelled their order._`;
            const encodedMessage = encodeURIComponent(cancelMessage);
            window.location.href = `https://wa.me/918606588738?text=${encodedMessage}`;
            
        } catch (error) {
            console.error("Error cancelling order:", error);
            showToast("Failed to cancel order.");
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Resize image to max 800px to save storage space
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800;
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG (0.7 quality) to keep Base64 string small for Firestore document
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setNewProduct(prev => ({...prev, image: compressedBase64}));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ---- Store & Cart Logic ----
    const handleAddToCart = (e) => {
        if(e) e.stopPropagation();
        if (!selectedProduct) return;
        
        setCart(prev => {
            const exists = prev.find(item => item.id === selectedProduct.id);
            if (exists) {
                return prev.map(item => item.id === selectedProduct.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...selectedProduct, qty: 1 }];
        });
        showToast("Product added to cart");
    };

    const handleRemoveFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
        showToast("Product removed from cart");
    };

    const handleBuyNow = (product) => {
        setSelectedProduct(product);
        setCheckoutMode('single');
        setCurrentView("checkout");
        window.scrollTo(0, 0);
    };

    const handleCartCheckout = () => {
        setCheckoutMode('cart');
        setCurrentView("checkout");
        window.scrollTo(0, 0);
    };

    // ---- Order Logic ----
    const handleOrderInputChange = (e) => {
        const { name, value } = e.target;
        setOrderFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handlePlaceOrder = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        showToast("Processing your order...");

        const generatedId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        setOrderId(generatedId);

        const itemsToCheckout = checkoutMode === 'single' ? [ { ...selectedProduct, qty: 1 } ] : cart;
        const orderTotal = itemsToCheckout.reduce((total, item) => {
            const priceVal = parseInt(item.price.replace(/[^\d]/g, ''), 10) || 0;
            return total + (priceVal * item.qty);
        }, 0);

        const addressToUse = (!isAddingNewAddress && savedAddresses.length > 0 && selectedAddressIndex >= 0) 
            ? savedAddresses[selectedAddressIndex] 
            : orderFormData;

        const checkoutEmail = currentUser ? currentUser.email : addressToUse.email;
        
        const textMessage = `*New Order Placed!*\n\n*Order ID:* ${generatedId}\n*Customer:* ${addressToUse.name}\n*Phone:* ${addressToUse.phone}\n*Email:* ${checkoutEmail}\n*Address:* ${addressToUse.address1}, ${addressToUse.city}, PIN: ${addressToUse.pincode}\n\n*Products:*\n${itemsToCheckout.map(i => `- ${i.title} (x${i.qty})`).join('\n')}\n\n*Total Amount:* ₹${orderTotal}\n\n_Payment Method: Cash on Delivery_`;

        const orderData = {
            orderId: generatedId,
            name: addressToUse.name,
            phone: addressToUse.phone,
            email: checkoutEmail,
            address: `${addressToUse.address1}, ${addressToUse.city}, PIN: ${addressToUse.pincode}`,
            products: itemsToCheckout.map(i => `${i.title} (x${i.qty})`).join(', '),
            total: orderTotal,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "Pending"
        };

        try {
            // 0. Auto Login if Guest
            if (!currentUser) {
                const userObj = { email: checkoutEmail, role: 'customer' };
                setCurrentUser(userObj);
                localStorage.setItem("expoz_user", JSON.stringify(userObj));
            }

            // 0.5 Save New Address if applicable
            if (isAddingNewAddress) {
                const newAddr = {
                    name: addressToUse.name,
                    phone: addressToUse.phone,
                    email: checkoutEmail,
                    address1: addressToUse.address1,
                    city: addressToUse.city,
                    pincode: addressToUse.pincode
                };
                const updatedAddresses = [...savedAddresses, newAddr];
                setSavedAddresses(updatedAddresses);
                localStorage.setItem(`expoz_addresses_${checkoutEmail}`, JSON.stringify(updatedAddresses));
            }

            // 1. Save order to Firestore
            await firebase.firestore().collection('orders').doc(generatedId).set(orderData);
            // 1. Send data to Google Sheets via Apps Script Web App
            await fetch("https://script.google.com/macros/s/AKfycbwpPGzU_hDD3vN_lkrbc8_m6SAJ5_HCxGowzHczg_ZDjIJWPMw8T7gKPr1VTOtGTxAU/exec", {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData)
            });
            
            // 2. Open WhatsApp Message
            const encodedMessage = encodeURIComponent(textMessage);
            
            setCurrentView("success");
            if (checkoutMode === 'cart') setCart([]);
            window.scrollTo(0,0);
            
            // Use location.href instead of window.open to prevent popup blockers after async operations
            window.location.href = `https://wa.me/918606588738?text=${encodedMessage}`;
        } catch (error) {
            console.error(error);
            showToast("Network error. Could not place order.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ================= VIEWS =================

    const renderHeader = () => (
        <header>
            {isMenuOpen && (
                <div className="side-menu-overlay" onClick={() => setIsMenuOpen(false)}>
                    <div className={`side-menu ${isMenuOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                        <div className="side-menu-header">
                            <h3>Menu</h3>
                            <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
                                <Icon name="x" size="24" />
                            </button>
                        </div>
                        <div className="side-menu-content">
                            {currentUser && (
                                <div className="user-info-box">
                                    <div style={{background: 'var(--accent-color)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem'}}>
                                        {currentUser.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all'}}>{currentUser.email}</div>
                                        <div style={{fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: '600'}}>{currentUser.role === 'admin' ? 'Administrator' : 'Customer'}</div>
                                    </div>
                                </div>
                            )}
                            <ul className="menu-links">
                                <li onClick={() => { setIsMenuOpen(false); setCurrentView('store'); }}><Icon name="home" size="20" /> Home</li>
                                <li onClick={() => { setIsMenuOpen(false); setCurrentView('cart'); }}><Icon name="shopping-cart" size="20" /> Cart ({cart.length})</li>
                                {currentUser && currentUser.role === 'admin' && (
                                    <li onClick={() => { setIsMenuOpen(false); setCurrentView('admin'); }}><Icon name="layout-dashboard" size="20" /> Admin Dashboard</li>
                                )}
                                {currentUser && (
                                    <li onClick={() => { setIsMenuOpen(false); setCurrentView('myorders'); }}><Icon name="package" size="20" /> My Orders</li>
                                )}
                                <li><Icon name="settings" size="20" /> Settings</li>
                                {currentUser ? (
                                    <li onClick={() => { setIsMenuOpen(false); handleLogout(); }} style={{color: 'var(--danger-color)'}}><Icon name="log-out" size="20" /> Logout</li>
                                ) : (
                                    <li onClick={() => { setIsMenuOpen(false); setCurrentView('login'); }}><Icon name="log-in" size="20" /> Sign In</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            <div className="header-top">
                <div className="nav-container">
                    <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                        <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
                            <Icon name="menu" size="28" />
                        </button>
                        <div className="logo" onClick={() => setCurrentView('store')}>
                            <Icon name="shopping-bag" size="32" />
                            <div>
                                <span className="logo-text">EXPOZ</span>
                                <span className="logo-sub">STORE</span>
                            </div>
                        </div>
                    </div>

                    <div className="search-container" style={{display: currentView === 'login' ? 'none' : 'flex'}}>
                        <Icon name="search" size="18" className="search-icon" />
                        <input type="text" className="search-input" placeholder="Search for products..." />
                        <button className="search-btn">Search</button>
                    </div>
                    
                    <div className="header-actions">
                        {currentUser ? (
                            <React.Fragment key="logged-in-nav">
                                {currentUser.role === 'admin' && (
                                    <button className="action-link" onClick={() => setCurrentView('admin')}>
                                        <Icon name="layout-dashboard" size="22" />
                                        <span>Dashboard</span>
                                    </button>
                                )}
                                <button className="action-link" onClick={handleLogout}>
                                    <Icon name="log-out" size="22" />
                                    <span>Logout</span>
                                </button>
                            </React.Fragment>
                        ) : (
                            <button key="logged-out-nav" className="action-link" onClick={() => setCurrentView('login')}>
                                <Icon name="user" size="22" />
                                <span>Sign In</span>
                            </button>
                        )}
                        
                        <button className="cart-btn" aria-label="Cart" onClick={() => setCurrentView('cart')}>
                            <Icon name="shopping-cart" size="22" />
                            <span>Cart</span>
                            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
                        </button>
                    </div>
                </div>
            </div>
            
            {(currentView === 'store' || currentView === 'product') && (
                <div className="category-nav">
                    <ul className="cat-list">
                        <li><a className="cat-link active" onClick={() => setCurrentView('store')}>All Products</a></li>
                        <li><a className="cat-link">Electronics</a></li>
                        <li><a className="cat-link">Mobile Accessories</a></li>
                        <li><a className="cat-link">Offers Zone</a></li>
                    </ul>
                </div>
            )}
        </header>
    );

    const renderLogin = () => (
        <div className="animate-fade-in auth-container">
            <div className="auth-header">
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-subtitle">Enter your email to view your orders</p>
            </div>
            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                        type="email" 
                        className="form-input" 
                        required 
                        placeholder="name@example.com"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                    />
                </div>
                {authEmail.toLowerCase() === ADMIN_EMAIL && (
                    <div className="form-group">
                        <label className="form-label">Admin Password</label>
                        <input 
                            type="password" 
                            className="form-input" 
                            required 
                            placeholder="••••••••"
                            value={authPassword}
                            onChange={e => setAuthPassword(e.target.value)}
                        />
                    </div>
                )}
                <button type="submit" className="btn-auth">Login to Track Orders</button>
            </form>
        </div>
    );

    const renderAdminDashboard = () => (
        <div className="animate-fade-in admin-layout">
            <div style={{gridColumn: '1 / -1', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem'}}>
                <button className="btn-auth" style={{marginTop: 0, padding: '0.5rem 1rem', width: 'fit-content', background: 'var(--border-color)', color: 'var(--text-primary)'}} onClick={() => setCurrentView('store')}>
                    <Icon name="arrow-left" size="18" /> Back to Store
                </button>
                <div style={{display: 'flex', gap: '0.5rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', padding: '0.25rem'}}>
                    <button 
                        style={{padding: '0.5rem 1rem', border: 'none', background: adminViewTab === 'products' ? 'var(--accent-color)' : 'transparent', color: adminViewTab === 'products' ? 'white' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer'}} 
                        onClick={() => setAdminViewTab('products')}>
                        Products
                    </button>
                    <button 
                        style={{padding: '0.5rem 1rem', border: 'none', background: adminViewTab === 'orders' ? 'var(--accent-color)' : 'transparent', color: adminViewTab === 'orders' ? 'white' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer'}} 
                        onClick={() => setAdminViewTab('orders')}>
                        Orders
                    </button>
                </div>
            </div>

            {adminViewTab === 'products' ? (
                <>
                    <div className="admin-panel">
                        <div className="admin-header">
                            <h2 className="admin-title">
                                <Icon name={editingProductId ? "edit" : "plus-circle"} /> {editingProductId ? "Edit Product" : "Add New Product"}
                            </h2>
                        </div>
                        <form onSubmit={handleSaveProduct}>
                            <div className="form-group">
                                <label className="form-label">Product Title</label>
                                <input type="text" className="form-input" required 
                                    value={newProduct.title} onChange={e => setNewProduct({...newProduct, title: e.target.value})} />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Selling Price (₹)</label>
                                    <input type="text" className="form-input" required placeholder="e.g. ₹500"
                                        value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">MRP (₹)</label>
                                    <input type="text" className="form-input" placeholder="e.g. ₹999"
                                        value={newProduct.mrp} onChange={e => setNewProduct({...newProduct, mrp: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Product Image (Select from Gallery)</label>
                                <input type="file" id="image-upload-input" accept="image/*" className="form-input" style={{padding: '0.5rem'}} required={!newProduct.image} onChange={handleImageUpload} />
                                {newProduct.image && (
                                    <div style={{marginTop: '1rem', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', width: 'fit-content'}}>
                                        <img src={newProduct.image} alt="Preview" style={{width: '100px', height: '100px', objectFit: 'contain', background: 'white'}} />
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Product Description</label>
                                <textarea className="form-input" rows="4" required
                                    value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}></textarea>
                            </div>
                            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                                <button type="submit" className="btn-auth" style={{marginTop: 0, flex: 1}} disabled={isSavingProduct}>
                                    {isSavingProduct ? "Saving..." : (editingProductId ? "Update Product" : "Publish to Database")}
                                </button>
                                {editingProductId && (
                                    <button type="button" className="btn-auth" style={{marginTop: 0, flex: 1, background: 'var(--border-color)', color: 'var(--text-primary)'}} onClick={() => {
                                        setNewProduct({ title: "", price: "", mrp: "", image: "", description: "" });
                                        setEditingProductId(null);
                                        const fileInput = document.getElementById('image-upload-input');
                                        if (fileInput) fileInput.value = '';
                                    }}>Cancel Edit</button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="admin-list">
                        <div className="admin-header">
                            <h2 className="admin-title">
                                <Icon name="database" /> Cloud Database
                            </h2>
                            <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>{products ? products.length : 0} Items</span>
                        </div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                            {products === null ? (
                                <p style={{color: 'var(--accent-color)'}}>Loading from Firebase...</p>
                            ) : products.length === 0 ? (
                                <p style={{color: 'var(--text-secondary)'}}>Database is empty.</p>
                            ) : (
                                products.map(prod => (
                                    <div className="admin-product-item" key={prod.id}>
                                        <img src={prod.image} className="admin-product-img" alt={prod.title} />
                                        <div className="admin-product-info">
                                            <div style={{fontWeight: '500', fontSize: '0.9rem', marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{prod.title}</div>
                                            <div style={{color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: '600'}}>{prod.price}</div>
                                        </div>
                                        <div className="admin-product-actions">
                                            <button className="btn-icon" onClick={() => handleEditProduct(prod)} title="Edit Product">
                                                <Icon name="edit" size="18" />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDeleteProduct(prod.id)} title="Delete Product">
                                                <Icon name="trash-2" size="18" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{gridColumn: '1 / -1', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1.5rem'}}>
                    <div className="admin-header" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem'}}>
                        <h2 className="admin-title">
                            <Icon name="package" /> Order Management
                        </h2>
                        <div className="search-container" style={{display: 'flex', width: '100%', maxWidth: '400px', margin: 0}}>
                            <Icon name="search" size="18" className="search-icon" />
                            <input type="text" className="search-input" placeholder="Search by Order ID..." value={adminSearchTerm} onChange={e => setAdminSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    
                    <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        {allOrders === null ? (
                            <p>Loading orders...</p>
                        ) : allOrders.length === 0 ? (
                            <p>No orders found.</p>
                        ) : (
                            allOrders
                                .filter(o => o.orderId && o.orderId.toLowerCase().includes(adminSearchTerm.toLowerCase()))
                                .map(order => (
                                    <div key={order.id} style={{border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between'}}>
                                        <div style={{flex: '1 1 300px'}}>
                                            <div style={{fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem'}}>{order.orderId}</div>
                                            <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'Just now'}</div>
                                            <div style={{marginTop: '1rem'}}>
                                                <b>Customer:</b> {order.name}<br/>
                                                <b>Phone:</b> {order.phone}<br/>
                                                <b>Email:</b> {order.email}<br/>
                                                <b>Address:</b> {order.address}
                                            </div>
                                            <div style={{marginTop: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)'}}>
                                                <b>Items:</b> {order.products}
                                            </div>
                                        </div>
                                        <div style={{flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end'}}>
                                            <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-color)'}}>₹{order.total}</div>
                                            
                                            <div style={{width: '100%'}}>
                                                <label style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem'}}>Update Status:</label>
                                                <select 
                                                    style={{width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'white'}}
                                                    value={order.status || 'Pending'}
                                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Processing">Processing</option>
                                                    <option value="Shipped">Shipped</option>
                                                    <option value="Delivered">Delivered</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                            <button 
                                                style={{width: '100%', padding: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem'}}
                                                onClick={() => setSelectedReceiptOrder(order)}
                                            >
                                                View Receipt
                                            </button>
                                        </div>
                                    </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStore = () => (
        <div className="animate-fade-in store-layout">
            <aside className="sidebar">
                <div className="filter-group">
                    <h3 className="filter-title">Categories</h3>
                    <label className="filter-option"><input type="checkbox" defaultChecked /> All Categories</label>
                </div>
            </aside>
            <div className="main-content">
                <div className="promotional-banner">
                    <span className="promo-tag">Mega Sale</span>
                    <h2 className="promo-title">Welcome to Expoz Store</h2>
                    <p className="promo-desc">Discover our latest collection of premium products.</p>
                </div>
                <div className="section-header">
                    <h2 className="section-title">Available Products</h2>
                </div>
                
                {products === null ? (
                    <div style={{textAlign: 'center', padding: '4rem 0', color: 'var(--accent-color)'}}>
                        <Icon name="loader" size="48" style={{animation: 'spin 2s linear infinite', marginBottom: '1rem'}} />
                        <p>Loading products from cloud...</p>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : products.length === 0 ? (
                    <div style={{textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)'}}>
                        <Icon name="package-open" size="48" style={{opacity: 0.5, marginBottom: '1rem'}} />
                        <p>No products available right now.</p>
                        {currentUser && currentUser.role === 'admin' && (
                            <p style={{marginTop: '1rem', color: 'var(--accent-color)', cursor: 'pointer'}} onClick={() => setCurrentView('admin')}>Go to Dashboard to add products</p>
                        )}
                    </div>
                ) : (
                    <div className="product-grid">
                        {products.map(prod => (
                            <div className="product-card" key={prod.id} onClick={() => { setSelectedProduct(prod); setCurrentView('product'); window.scrollTo(0,0); }}>
                                <span className="badge-sale">SALE</span>
                                <div className="card-img-container">
                                    <img src={prod.image} alt={prod.title} className="card-img" />
                                </div>
                                <div className="card-body">
                                    <h3 className="card-title">{prod.title}</h3>
                                    <div className="card-rating">
                                        <span style={{background: 'var(--star-color)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'}}>
                                            {prod.rating} ★
                                        </span>
                                        <span className="rating-count">({prod.reviews})</span>
                                    </div>
                                    <div className="price-container">
                                        <span className="card-price">{prod.price}</span>
                                        {prod.mrp && <span className="mrp-price">{prod.mrp}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderProductDetail = () => {
        if (!selectedProduct) return null;
        return (
            <div className="animate-fade-in">
                <div className="breadcrumb">
                    <span className="breadcrumb-link" onClick={() => setCurrentView('store')}>Home</span>
                    <Icon name="chevron-right" size="14" />
                    <span style={{color: 'var(--text-primary)'}}>Products</span>
                </div>
                
                <div className="product-container">
                    <div>
                        <div className="main-image-container">
                            <img src={selectedProduct.image} alt="Product" className="main-image" />
                        </div>
                        <div className="action-buttons">
                            <button className="btn btn-cart" onClick={handleAddToCart}>
                                <Icon name="shopping-cart" size="18" /> Add to Cart
                            </button>
                            <button className="btn btn-buy" onClick={() => handleBuyNow(selectedProduct)}>
                                <Icon name="zap" size="18" /> Buy Now
                            </button>
                        </div>
                    </div>
                    <div className="product-details">
                        <h1 className="product-title-large">{selectedProduct.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <span style={{color: 'var(--star-color)'}}>★ ★ ★ ★ ☆</span>
                            <span style={{color: 'var(--accent-color)', fontSize: '0.9rem'}}>{selectedProduct.reviews} ratings</span>
                        </div>
                        <div className="divider"></div>
                        <div style={{display: 'flex', alignItems: 'baseline', gap: '1rem', margin: '0.5rem 0'}}>
                            <span className="price-large">{selectedProduct.price}</span>
                        </div>
                        {selectedProduct.mrp && (
                            <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
                                M.R.P.: <span style={{textDecoration: 'line-through'}}>{selectedProduct.mrp}</span>
                            </div>
                        )}
                        <div style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>Inclusive of all taxes</div>
                        <div className="divider"></div>
                        <div style={{marginTop: '1rem'}}>
                            <div style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem'}}>Product Description</div>
                            <p style={{fontSize: '0.95rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap'}}>
                                {selectedProduct.description}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCart = () => {
        const cartTotal = cart.reduce((total, item) => {
            const priceVal = parseInt(item.price.replace(/[^\d]/g, ''), 10) || 0;
            return total + (priceVal * item.qty);
        }, 0);

        return (
            <div className="animate-fade-in store-layout" style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Icon name="shopping-cart" size="28" style={{color: 'var(--accent-color)'}} />
                    <h2 style={{ fontSize: '1.5rem' }}>Your Shopping Cart</h2>
                </div>
                {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <Icon name="shopping-bag" size="48" style={{ opacity: 0.5, marginBottom: '1rem' }} />
                        <p style={{fontSize: '1.1rem', fontWeight: '500'}}>Your cart is empty.</p>
                        <button className="btn-continue" style={{ marginTop: '1.5rem' }} onClick={() => setCurrentView('store')}>
                            Continue Shopping
                        </button>
                    </div>
                ) : (
                    <div className="checkout-layout">
                        <div className="checkout-left">
                            {cart.map(item => (
                                <div key={item.id} className="admin-product-item" style={{ background: 'var(--card-bg)', padding: '1.5rem' }}>
                                    <img src={item.image} className="admin-product-img" alt={item.title} style={{ width: '80px', height: '80px' }} />
                                    <div className="admin-product-info">
                                        <div style={{ fontWeight: '500', fontSize: '1rem', marginBottom: '0.25rem' }}>{item.title}</div>
                                        <div style={{ color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: '600' }}>{item.price}</div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                            Quantity: {item.qty}
                                        </div>
                                    </div>
                                    <div className="admin-product-actions">
                                        <button className="btn-icon" onClick={() => handleRemoveFromCart(item.id)} title="Remove from Cart">
                                            <Icon name="trash-2" size="20" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="checkout-summary">
                                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Cart Summary</h3>
                                <div className="summary-item total">
                                    <span>Total:</span>
                                    <span>₹{cartTotal}</span>
                                </div>
                                <button className="btn btn-place-order" onClick={handleCartCheckout}>
                                    Proceed to Checkout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCheckout = () => {
        const itemsToCheckout = checkoutMode === 'single' ? (selectedProduct ? [{ ...selectedProduct, qty: 1 }] : []) : cart;
        if (itemsToCheckout.length === 0) return null;

        const orderTotal = itemsToCheckout.reduce((total, item) => {
            const priceVal = parseInt(item.price.replace(/[^\d]/g, ''), 10) || 0;
            return total + (priceVal * item.qty);
        }, 0);

        return (
            <div className="animate-fade-in checkout-layout">
                <div className="checkout-left">
                    <h2 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Secure Checkout</h2>
                    <form onSubmit={handlePlaceOrder}>
                        {!isAddingNewAddress ? (
                            <div className="checkout-section">
                                <div className="checkout-title" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <span><Icon name="map-pin" size="20" style={{color: 'var(--accent-color)'}} /> Saved Addresses</span>
                                    <button type="button" onClick={() => setIsAddingNewAddress(true)} style={{background: 'none', border: 'none', color: 'var(--accent-color)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'}}>+ Add New Address</button>
                                </div>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                                    {savedAddresses.map((addr, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => setSelectedAddressIndex(idx)}
                                            style={{
                                                border: selectedAddressIndex === idx ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1rem',
                                                cursor: 'pointer',
                                                background: selectedAddressIndex === idx ? 'rgba(0, 0, 0, 0.02)' : 'var(--card-bg)'
                                            }}
                                        >
                                            <div style={{fontWeight: '600', marginBottom: '0.25rem'}}>{addr.name}</div>
                                            <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>{addr.phone} {addr.email && `| ${addr.email}`}</div>
                                            <div style={{fontSize: '0.9rem'}}>{addr.address1}</div>
                                            <div style={{fontSize: '0.9rem'}}>{addr.city}, PIN: {addr.pincode}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="checkout-section">
                                    <div className="checkout-title" style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span><Icon name="user" size="20" style={{color: 'var(--accent-color)'}} /> 1. Contact Information</span>
                                        {savedAddresses.length > 0 && (
                                            <button type="button" onClick={() => setIsAddingNewAddress(false)} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer'}}>Cancel</button>
                                        )}
                                    </div>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label className="form-label">Full Name</label>
                                            <input type="text" name="name" value={orderFormData.name} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Mobile Number</label>
                                            <input type="tel" name="phone" value={orderFormData.phone} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                        </div>
                                        {!currentUser && (
                                            <div className="form-group full-width">
                                                <label className="form-label">Email Address (To track orders)</label>
                                                <input type="email" name="email" value={orderFormData.email} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="checkout-section">
                                    <div className="checkout-title"><Icon name="map-pin" size="20" style={{color: 'var(--accent-color)'}} /> 2. Shipping Address</div>
                                    <div className="form-grid">
                                        <div className="form-group full-width">
                                            <label className="form-label">Address Line 1</label>
                                            <input type="text" name="address1" value={orderFormData.address1} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Town/City</label>
                                            <input type="text" name="city" value={orderFormData.city} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">PIN Code</label>
                                            <input type="text" name="pincode" value={orderFormData.pincode} onChange={handleOrderInputChange} className="form-input" required={isAddingNewAddress} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <button type="submit" className="btn btn-place-order" style={{display: window.innerWidth < 900 ? 'block' : 'none'}} disabled={isSubmitting}>
                            {isSubmitting ? "Processing..." : "Place Order"}
                        </button>
                    </form>
                </div>
                <div>
                    <div className="checkout-summary">
                        <h3 style={{marginBottom: '1.5rem', fontSize: '1.2rem'}}>Order Summary</h3>
                        
                        {itemsToCheckout.map(item => (
                            <div className="summary-product" key={item.id} style={{marginBottom: '1rem', paddingBottom: '1rem'}}>
                                <img src={item.image} className="summary-img" alt="Product" />
                                <div>
                                    <div style={{fontSize: '0.85rem', fontWeight: '500', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{item.title}</div>
                                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>Qty: {item.qty}</div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="summary-item total">
                            <span>Order Total:</span>
                            <span>₹{orderTotal}</span>
                        </div>
                        <button className="btn btn-place-order" onClick={(e) => document.querySelector('form').requestSubmit()} disabled={isSubmitting}>
                            {isSubmitting ? "Processing..." : "Place Your Order"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSuccess = () => (
        <div className="animate-fade-in success-container">
            <div className="success-icon-container">
                <Icon name="check" size="40" />
            </div>
            <h1 className="success-title">Order Placed Successfully!</h1>
            <p className="success-message">
                Thank you for your purchase. Your order details have been received.
            </p>
            <div className="order-id">
                Order ID: <span style={{color: 'var(--accent-color)'}}>{orderId}</span>
            </div>
            <div>
                <button className="btn-continue" onClick={() => { setCurrentView('store'); window.scrollTo(0,0); }}>
                    Continue Shopping
                </button>
            </div>
        </div>
    );

    return (
        <div>
            {renderHeader()}
            
            <main>
                {currentView === 'store' && renderStore()}
                {currentView === 'login' && renderLogin()}
                {currentView === 'admin' && renderAdminDashboard()}
                {currentView === 'product' && renderProductDetail()}
                {currentView === 'cart' && renderCart()}
                {currentView === 'checkout' && renderCheckout()}
                {currentView === 'success' && renderSuccess()}
                {currentView === 'myorders' && <MyOrdersView currentUser={currentUser} setCurrentView={setCurrentView} handleCancelOrder={handleCancelOrder} setSelectedReceiptOrder={setSelectedReceiptOrder} />}
            </main>

            <footer>
                <div className="footer-bottom">
                    &copy; 2026 Expoz Store. All Rights Reserved.
                </div>
            </footer>

            <div className={`toast ${toastMsg ? 'show' : ''}`}>
                <Icon name="info" size="20" style={{ color: 'var(--accent-color)' }} />
                <span style={{marginLeft: '0.5rem'}}>{toastMsg}</span>
            </div>

            {selectedReceiptOrder && (
                <ReceiptModal 
                    order={selectedReceiptOrder} 
                    onClose={() => setSelectedReceiptOrder(null)} 
                />
            )}
        </div>
    );
};

const MyOrdersView = ({ currentUser, setCurrentView, handleCancelOrder, setSelectedReceiptOrder }) => {
    const [orders, setOrders] = React.useState(null);

    React.useEffect(() => {
        if (!currentUser) return;
        
        const fetchOrders = async () => {
            try {
                const snapshot = await firebase.firestore().collection('orders')
                    .where('email', '==', currentUser.email)
                    .orderBy('timestamp', 'desc')
                    .get();
                
                const fetchedOrders = [];
                snapshot.forEach(doc => {
                    fetchedOrders.push({ id: doc.id, ...doc.data() });
                });
                setOrders(fetchedOrders);
            } catch (err) {
                console.error("Error fetching orders:", err);
                // Firebase might require an index for orderBy. If it fails, fallback to unordered.
                if (err.message && err.message.includes('index')) {
                    const fallbackSnapshot = await firebase.firestore().collection('orders')
                        .where('email', '==', currentUser.email)
                        .get();
                    const fetchedOrders = [];
                    fallbackSnapshot.forEach(doc => {
                        fetchedOrders.push({ id: doc.id, ...doc.data() });
                    });
                    setOrders(fetchedOrders);
                } else {
                    setOrders([]);
                }
            }
        };
        fetchOrders();
    }, [currentUser]);

    return (
        <div className="animate-fade-in store-layout" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Icon name="package" size="28" style={{color: 'var(--accent-color)'}} />
                <h2 style={{ fontSize: '1.5rem' }}>My Orders</h2>
            </div>
            
            {orders === null ? (
                <div style={{textAlign: 'center', padding: '4rem 0'}}>Loading orders...</div>
            ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: 'var(--radius-md)' }}>
                    <p style={{fontSize: '1.1rem'}}>You have not placed any orders yet.</p>
                    <button className="btn-continue" style={{ marginTop: '1.5rem' }} onClick={() => setCurrentView('store')}>
                        Start Shopping
                    </button>
                </div>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {orders.map(order => (
                        <div key={order.id} style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem'}}>
                                <div>
                                    <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Order ID</div>
                                    <div style={{fontWeight: '600'}}>{order.orderId}</div>
                                </div>
                                <div style={{textAlign: 'right'}}>
                                    <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Total Amount</div>
                                    <div style={{fontWeight: '700', color: 'var(--accent-color)'}}>₹{order.total}</div>
                                </div>
                            </div>
                            <div style={{marginBottom: '1rem'}}>
                                <div style={{fontWeight: '600', marginBottom: '0.5rem'}}>Items:</div>
                                <div style={{fontSize: '0.95rem', color: 'var(--text-secondary)'}}>{order.products}</div>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <div style={{
                                    display: 'inline-block', 
                                    padding: '0.25rem 0.75rem', 
                                    background: order.status === 'Cancelled' ? '#fecdd3' : (order.status === 'Delivered' ? '#dcfce7' : '#fef9c3'), 
                                    color: order.status === 'Cancelled' ? '#9f1239' : (order.status === 'Delivered' ? '#166534' : '#854d0e'), 
                                    borderRadius: 'var(--radius-sm)', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 'bold'
                                }}>
                                    {order.status || 'Pending'}
                                </div>
                                <div style={{display: 'flex', gap: '0.5rem'}}>
                                    <button 
                                        style={{background: 'none', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'}}
                                        onClick={() => setSelectedReceiptOrder(order)}
                                    >
                                        Receipt
                                    </button>
                                    {(!order.status || order.status === 'Pending' || order.status === 'Processing') && (
                                        <button 
                                            style={{background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'}}
                                            onClick={() => handleCancelOrder(order)}
                                        >
                                            Cancel Order
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ReceiptModal = ({ order, onClose }) => {
    const [isDownloading, setIsDownloading] = React.useState(false);

    const handleDownload = async () => {
        const element = document.getElementById('receipt-card');
        if (!element) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Receipt_${order.orderId}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error generating receipt photo:", error);
            alert("Failed to download receipt.");
        }
        setIsDownloading(false);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '1rem', overflowY: 'auto'
        }}>
            <div style={{
                background: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px',
                position: 'relative', display: 'flex', flexDirection: 'column'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: 'var(--border-color)', border: 'none',
                    borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 10
                }}>
                    ✕
                </button>

                <div id="receipt-card" style={{
                    padding: '2rem', background: 'white', borderBottom: '1px dashed #ccc'
                }}>
                    <div style={{textAlign: 'center', marginBottom: '1.5rem'}}>
                        <h2 style={{margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'black'}}>EXPOZ STORE</h2>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>Premium Stylus Pen</div>
                    </div>

                    <div style={{borderBottom: '2px solid black', paddingBottom: '0.5rem', marginBottom: '1rem'}}>
                        <div style={{fontSize: '0.8rem', color: '#666', fontWeight: 600}}>ORDER RECEIPT</div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>Date: {new Date(order.timestamp?.toDate ? order.timestamp.toDate() : Date.now()).toLocaleDateString()}</div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>Order ID: <b>{order.orderId}</b></div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>Status: <b>{order.status || 'Pending'}</b></div>
                    </div>

                    <div style={{marginBottom: '1rem'}}>
                        <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#333'}}>BILLED TO:</div>
                        <div style={{fontSize: '0.9rem', fontWeight: 600, color: 'black'}}>{order.name}</div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>{order.address}</div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>{order.pincode}</div>
                        <div style={{fontSize: '0.8rem', color: '#666'}}>Mob: {order.mobile}</div>
                    </div>

                    <div style={{background: '#f9fafb', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem'}}>
                        <div style={{fontSize: '0.8rem', fontWeight: 600, color: '#333', marginBottom: '0.5rem'}}>ITEMS:</div>
                        <div style={{fontSize: '0.9rem', color: 'black', whiteSpace: 'pre-wrap'}}>{order.products}</div>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid black', paddingTop: '1rem'}}>
                        <div style={{fontSize: '1rem', fontWeight: 700, color: 'black'}}>TOTAL</div>
                        <div style={{fontSize: '1.2rem', fontWeight: 800, color: 'black'}}>₹{order.total}</div>
                    </div>
                    
                    <div style={{textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#666'}}>
                        Thank you for shopping with us!
                    </div>
                </div>

                <div style={{padding: '1rem', textAlign: 'center'}}>
                    <button 
                        onClick={handleDownload}
                        disabled={isDownloading}
                        style={{
                            background: 'var(--accent-color)', color: 'white', border: 'none',
                            padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold',
                            cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        <Icon name="download" size="18" />
                        {isDownloading ? 'Generating...' : 'Download Photo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
