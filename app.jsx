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

    // ---- Helpers ----
    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    // ---- Auth Logic ----
    const handleLogin = (e) => {
        e.preventDefault();
        if (!authEmail || !authPassword) {
            showToast("Please enter email and password");
            return;
        }

        let userObj = { email: authEmail, role: 'customer' };
        if (authEmail.toLowerCase() === ADMIN_EMAIL) {
            if (authPassword !== "860658") {
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
        if (!currentUser) {
            showToast("Please login to place an order");
            setCurrentView("login");
            window.scrollTo(0,0);
            return;
        }
        setSelectedProduct(product);
        setCheckoutMode('single');
        setCurrentView("checkout");
        window.scrollTo(0, 0);
    };

    const handleCartCheckout = () => {
        if (!currentUser) {
            showToast("Please login to checkout");
            setCurrentView("login");
            window.scrollTo(0,0);
            return;
        }
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

        const textMessage = `*New Order Placed!*\n\n*Order ID:* ${generatedId}\n*Customer:* ${orderFormData.name}\n*Phone:* ${orderFormData.phone}\n*Email:* ${currentUser.email}\n*Address:* ${orderFormData.address1}, ${orderFormData.city}, PIN: ${orderFormData.pincode}\n\n*Products:*\n${itemsToCheckout.map(i => `- ${i.title} (x${i.qty})`).join('\n')}\n\n*Total Amount:* ₹${orderTotal}\n\n_Payment Method: Cash on Delivery_`;

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const encodedMessage = encodeURIComponent(textMessage);
            window.open(`https://wa.me/918606588738?text=${encodedMessage}`, '_blank');
            
            setCurrentView("success");
            if (checkoutMode === 'cart') setCart([]);
            window.scrollTo(0,0);
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
                <h2 className="auth-title">Welcome to Expoz Store</h2>
                <p className="auth-subtitle">Sign in or Create an account to continue</p>
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
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <input 
                        type="password" 
                        className="form-input" 
                        required 
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn-auth">Sign In / Register</button>
            </form>
            <div style={{marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center'}}>
                Note: Admin login is <b>expoztech@gmail.com</b>
            </div>
        </div>
    );

    const renderAdminDashboard = () => (
        <div className="animate-fade-in admin-layout">
            <div className="admin-panel">
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '1.5rem'}}>
                    <button className="btn-auth" style={{marginTop: 0, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', background: 'var(--border-color)', color: 'var(--text-primary)'}} onClick={() => setCurrentView('store')}>
                        <Icon name="arrow-left" size="18" /> Back to Store
                    </button>
                </div>
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
                        <div className="checkout-section">
                            <div className="checkout-title"><Icon name="user" size="20" style={{color: 'var(--accent-color)'}} /> 1. Contact Information</div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input type="text" name="name" value={orderFormData.name} onChange={handleOrderInputChange} className="form-input" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mobile Number</label>
                                    <input type="tel" name="phone" value={orderFormData.phone} onChange={handleOrderInputChange} className="form-input" required />
                                </div>
                            </div>
                        </div>
                        <div className="checkout-section">
                            <div className="checkout-title"><Icon name="map-pin" size="20" style={{color: 'var(--accent-color)'}} /> 2. Shipping Address</div>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">Address Line 1</label>
                                    <input type="text" name="address1" value={orderFormData.address1} onChange={handleOrderInputChange} className="form-input" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Town/City</label>
                                    <input type="text" name="city" value={orderFormData.city} onChange={handleOrderInputChange} className="form-input" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">PIN Code</label>
                                    <input type="text" name="pincode" value={orderFormData.pincode} onChange={handleOrderInputChange} className="form-input" required />
                                </div>
                            </div>
                        </div>
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
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
