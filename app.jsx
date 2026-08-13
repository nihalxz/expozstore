const { useState, useEffect } = React;

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAmbA3lod35ahzKlFTXv6V9Hpe-COXCwao",
  authDomain: "xze-store.firebaseapp.com",
  projectId: "xze-store",
  storageBucket: "xze-store.firebasestorage.app",
  messagingSenderId: "783383415530",
  appId: "1:783383415530:web:3ef1d962ce0e9f276fe593",
  measurementId: "G-0TRZVM00DZ"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Safe Icon Component to prevent React DOM conflicts with Lucide
const Icon = ({ name, size, className, style, fill, stroke, onClick }) => {
    let attrs = `data-lucide="${name}"`;
    if (size) attrs += ` width="${size}" height="${size}"`;
    if (fill) attrs += ` fill="${fill}"`;
    if (stroke) attrs += ` stroke="${stroke}"`;
    
    const iconHtml = `<i ${attrs}></i>`;
    return (
        <span 
            className={className} 
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'inherit', ...style }} 
            dangerouslySetInnerHTML={{ __html: iconHtml }} 
            onClick={onClick}
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
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Form states
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    
    const [newProduct, setNewProduct] = useState({
        title: "", price: "", mrp: "", image: "", images: [], description: "", category: "Fashion"
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const [orderFormData, setOrderFormData] = useState({
        name: '', phone: '', email: '', address1: '', address2: '', landmark: '', pincode: '', city: '', state: ''
    });
    
    const [productReviews, setProductReviews] = useState(null);
    const [newReview, setNewReview] = useState({ rating: 0, comment: "", photos: [], userName: "" });
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
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
    const [selectedCategory, setSelectedCategory] = useState("All");

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

    useEffect(() => {
        if (!selectedProduct) return;
        const fetchReviews = async () => {
            try {
                const snapshot = await db.collection('product_reviews')
                    .where('productId', '==', selectedProduct.id)
                    .orderBy('timestamp', 'desc')
                    .get();
                const reviews = [];
                snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
                setProductReviews(reviews);
            } catch (err) {
                console.error("Error fetching reviews:", err);
                if (err.message && err.message.includes('index')) {
                    const fallback = await db.collection('product_reviews')
                        .where('productId', '==', selectedProduct.id)
                        .get();
                    const reviews = [];
                    fallback.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
                    setProductReviews(reviews);
                } else {
                    setProductReviews([]);
                }
            }
        };
        fetchReviews();
    }, [selectedProduct]);

    const handleReviewPhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewReview(prev => ({...prev, photos: [...prev.photos, reader.result]}));
            };
            reader.readAsDataURL(file);
        });
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        
        let finalUserName = "Customer";
        if (newReview.userName.trim()) {
            finalUserName = newReview.userName.trim();
        } else if (currentUser) {
            finalUserName = currentUser.email.split('@')[0];
        } else {
            showToast("Please enter your name");
            return;
        }

        if (newReview.rating === 0) {
            showToast("Please select a star rating");
            return;
        }

        if (!newReview.comment.trim()) {
            showToast("Please write a comment");
            return;
        }
        
        setIsSubmittingReview(true);
        try {
            const reviewData = {
                productId: selectedProduct.id,
                userName: finalUserName,
                email: currentUser ? currentUser.email : "guest@xzestore.local",
                rating: newReview.rating,
                comment: newReview.comment,
                photos: newReview.photos,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('product_reviews').add(reviewData);
            
            setProductReviews([{
                id: docRef.id,
                ...reviewData,
                timestamp: { toDate: () => new Date() }
            }, ...(productReviews || [])]);
            
            showToast("Review submitted successfully!");
            setNewReview({ rating: 0, comment: "", photos: [], userName: "" });
            setCurrentView('product');
            
        } catch (error) {
            console.error("Error submitting review:", error);
            showToast("Failed to submit review");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // ---- Helpers ----
    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    // ---- Auth Logic ----
    const handleLogin = async (e) => {
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
        } else {
            if (!authEmail.toLowerCase().endsWith('@gmail.com')) {
                showToast("Please login using a Google (@gmail.com) email address.");
                return;
            }
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
        if (!newProduct.image || newProduct.image === "") {
            showToast("Please wait for image to upload or select an image!");
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
                    images: newProduct.images || [],
                    description: newProduct.description,
                    category: newProduct.category || "Fashion"
                });
                showToast("Product updated successfully!");
            } else {
                // Add new product to Firestore
                await db.collection('products').add({
                    title: newProduct.title,
                    price: newProduct.price,
                    mrp: newProduct.mrp,
                    image: newProduct.image,
                    images: newProduct.images || [],
                    description: newProduct.description,
                    category: newProduct.category || "Fashion",
                    rating: 4.5,
                    reviews: "0",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast("Product published to database!");
            }

            setNewProduct({ title: "", price: "", mrp: "", image: "", images: [], description: "", category: "Fashion" });
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
            images: prod.images || (prod.image ? [prod.image] : []),
            description: prod.description || "",
            category: prod.category || "Fashion"
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
            const updateData = { status: newStatus };
            if (newStatus === 'Delivered') {
                updateData.deliveredAt = new Date().toISOString();
            }
            await db.collection('orders').doc(orderId).update(updateData);
            showToast("Order status updated!");
        } catch (error) {
            console.error("Error updating order status:", error);
            showToast("Failed to update status.");
        }
    };

    const handleCancelOrder = async (order) => {
        const reason = window.prompt("Are you sure you want to request cancellation for this order? If yes, please enter the reason:");
        if (reason === null) return false; // User clicked cancel on the prompt

        try {
            await db.collection('orders').doc(order.id).update({ 
                status: 'Cancellation Requested',
                cancellationReason: reason || "No reason provided"
            });
            showToast("Cancellation requested successfully");

            // Open WhatsApp Message for cancellation
            const cancelMessage = `*Cancellation Requested!*\n\n*Order ID:* ${order.orderId}\n*Customer:* ${order.name}\n*Reason:* ${reason || "No reason provided"}\n\n_The customer has requested to cancel their order._`;
            const encodedMessage = encodeURIComponent(cancelMessage);
            
            // Send Push Notification to Mobile via ntfy
            const ntfyMessage = `Cancellation Requested!\nOrder: ${order.orderId}\nFrom: ${order.name}\nReason: ${reason || "None"}`;
            fetch("https://ntfy.sh/xzestore_orders_live", {
                method: "POST",
                body: ntfyMessage
            }).catch(e => console.error(e));

            window.location.href = `https://wa.me/918606588738?text=${encodedMessage}`;
            return true;
        } catch (error) {
            console.error("Error cancelling order:", error);
            showToast("Failed to request cancellation.");
            return false;
        }
    };

    const handleReturnOrder = async (order) => {
        const reason = window.prompt("Are you sure you want to request a return for this order? If yes, please enter the reason (e.g. damaged, wrong item):");
        if (reason === null) return false; // User clicked cancel on the prompt

        try {
            await db.collection('orders').doc(order.id).update({ 
                status: 'Return Requested',
                returnReason: reason || "No reason provided"
            });
            showToast("Return requested successfully");

            // Open WhatsApp Message for return
            const returnMessage = `*Return Requested!*\n\n*Order ID:* ${order.orderId}\n*Customer:* ${order.name}\n*Reason:* ${reason || "No reason provided"}\n\n_The customer has requested to return their order._`;
            const encodedMessage = encodeURIComponent(returnMessage);
            
            // Send Push Notification to Mobile via ntfy
            const ntfyMessage = `Return Requested!\nOrder: ${order.orderId}\nFrom: ${order.name}\nReason: ${reason || "None"}`;
            fetch("https://ntfy.sh/xzestore_orders_live", {
                method: "POST",
                body: ntfyMessage
            }).catch(e => console.error(e));

            window.location.href = `https://wa.me/918606588738?text=${encodedMessage}`;
            return true;
        } catch (error) {
            console.error("Error returning order:", error);
            showToast("Failed to request return.");
            return false;
        }
    };

    const handleAdminDeleteOrder = async (orderId) => {
        if (!window.confirm("Are you sure you want to permanently delete this order? It will be removed from the customer's history as well.")) {
            return;
        }
        try {
            await db.collection('orders').doc(orderId).delete();
            showToast("Order permanently deleted!");
        } catch (error) {
            console.error("Error deleting order:", error);
            showToast("Failed to delete order.");
        }
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploadingImage(true);
        let processedCount = 0;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    try {
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
                        
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        setNewProduct(prev => {
                            const newImages = [...(prev.images || []), compressedBase64];
                            return {
                                ...prev,
                                images: newImages,
                                image: newImages[0] // Set first image as main thumbnail
                            };
                        });
                    } catch (err) {
                        console.error("Canvas error", err);
                        showToast("Error processing one of the images.");
                    } finally {
                        processedCount++;
                        if (processedCount === files.length) setIsUploadingImage(false);
                    }
                };
                img.onerror = () => {
                    showToast("Failed to load an image. Format might not be supported.");
                    processedCount++;
                    if (processedCount === files.length) setIsUploadingImage(false);
                };
                img.src = event.target.result;
            };
            reader.onerror = () => {
                showToast("Failed to read a file.");
                processedCount++;
                if (processedCount === files.length) setIsUploadingImage(false);
            };
            reader.readAsDataURL(file);
        });
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

            // 1. Save order to Firestore (Fire and forget to avoid UI lag)
            firebase.firestore().collection('orders').doc(generatedId).set(orderData).catch(e => console.error(e));
            
            // 2. Send data to Google Sheets via Apps Script Web App (Fire and forget)
            fetch("https://script.google.com/macros/s/AKfycbwpPGzU_hDD3vN_lkrbc8_m6SAJ5_HCxGowzHczg_ZDjIJWPMw8T7gKPr1VTOtGTxAU/exec", {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData)
            }).catch(e => console.error(e));

            // 3. Send Push Notification to Mobile via ntfy (Fire and forget)
            const ntfyMessage = `New Order: ${generatedId}\nFrom: ${addressToUse.name} (${addressToUse.phone})\nAmount: ₹${orderTotal}\nProduct: ${itemsToCheckout.map(i => i.title).join(', ')}`;
            fetch("https://ntfy.sh/xzestore_orders_live", {
                method: "POST",
                body: ntfyMessage
            }).catch(e => console.error(e));
            
            // 3. Artificial 1 second delay for better user experience
            setTimeout(() => {
                // Show success view and play sound
                setCurrentView("success");
                if (checkoutMode === 'cart') setCart([]);
                window.scrollTo(0,0);
                setIsSubmitting(false);

                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                    audio.play().catch(e => console.log("Audio error: ", e));
                } catch(e) {}

                // Redirect to WhatsApp after showing the success screen for 2 seconds
                setTimeout(() => {
                    const encodedMessage = encodeURIComponent(textMessage);
                    window.location.href = `https://wa.me/918606588738?text=${encodedMessage}`;
                }, 2000);

            }, 1000);
            
        } catch (error) {
            console.error("Error placing order:", error);
            showToast("Failed to place order. Please try again.");
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
                                    <div style={{minWidth: 0, flex: 1}}>
                                        <div style={{fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px'}}>{currentUser.email}</div>
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
                                <li onClick={() => { setIsMenuOpen(false); alert('Help center coming soon!'); }}><Icon name="help-circle" size="20" /> Help</li>
                                <li onClick={() => { setIsMenuOpen(false); alert('xzestore version 1.0.0'); }}><Icon name="info" size="20" /> About</li>
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
                        <div className="logo" onClick={() => setCurrentView('store')} style={{ display: 'flex', alignItems: 'center' }}>
                            <img src="logo.jpg" alt="xzestore logo" style={{height: '60px', mixBlendMode: 'multiply', objectFit: 'contain', margin: '-5px 0 0 -5px'}} />
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
                <p className="auth-subtitle">Enter your Google email to login</p>
            </div>
            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                        type="email" 
                        className="form-input" 
                        required 
                        placeholder="name@gmail.com"
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
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-input" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                                    <option value="Electronics">Electronics</option>
                                    <option value="Fashion">Fashion</option>
                                    <option value="Home & Kitchen">Home & Kitchen</option>
                                    <option value="Others">Others</option>
                                </select>
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
                                <label className="form-label">Product Images (Select multiple from Gallery)</label>
                                <input type="file" id="image-upload-input" accept="image/*" multiple className="form-input" style={{padding: '0.5rem'}} required={(!newProduct.images || newProduct.images.length === 0) && !newProduct.image} onChange={handleImageUpload} />
                                {newProduct.images && newProduct.images.length > 0 ? (
                                    <div className="admin-image-previews">
                                        {newProduct.images.map((imgSrc, idx) => (
                                            <div key={idx} className="admin-image-preview-card">
                                                <img src={imgSrc} alt="Preview" />
                                                <button type="button" className="admin-image-remove" onClick={() => {
                                                    setNewProduct(prev => {
                                                        const filtered = prev.images.filter((_, i) => i !== idx);
                                                        return { ...prev, images: filtered, image: filtered.length > 0 ? filtered[0] : "" };
                                                    });
                                                }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : newProduct.image && (
                                    <div className="admin-image-previews">
                                        <div className="admin-image-preview-card">
                                            <img src={newProduct.image} alt="Preview" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Product Description</label>
                                <textarea className="form-input" rows="4" required
                                    value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}></textarea>
                            </div>
                            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                                <button type="submit" className="btn-auth" style={{marginTop: 0, flex: 1}} disabled={isSavingProduct || isUploadingImage}>
                                    {isSavingProduct ? "Saving..." : isUploadingImage ? "Uploading Image..." : (editingProductId ? "Update Product" : "Publish to Database")}
                                </button>
                                {editingProductId && (
                                    <button type="button" className="btn-auth" style={{marginTop: 0, flex: 1, background: 'var(--border-color)', color: 'var(--text-primary)'}} onClick={() => {
                                        setNewProduct({ title: "", price: "", mrp: "", image: "", images: [], description: "", category: "Fashion" });
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
                                                    <option value="Cancellation Requested">Cancellation Requested</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                    <option value="Return Requested">Return Requested</option>
                                                    <option value="Return Accepted">Return Accepted</option>
                                                    <option value="Return Rejected">Return Rejected</option>
                                                    <option value="Returned">Returned</option>
                                                </select>
                                            </div>
                                            <div style={{display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem'}}>
                                                <button 
                                                    style={{flex: 1, padding: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'}}
                                                    onClick={() => setSelectedReceiptOrder(order)}
                                                >
                                                    View Receipt
                                                </button>
                                                <button 
                                                    style={{flex: 1, padding: '0.5rem', background: '#fef2f2', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'}}
                                                    onClick={() => handleAdminDeleteOrder(order.id)}
                                                >
                                                    Delete Order
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStore = () => {
        const displayedProducts = (products || []).filter(p => selectedCategory === 'All' || p.category === selectedCategory);
        
        return (
        <div className="animate-fade-in store-layout">
            <div className="main-content">
                <div className="promotional-banner">
                    <span className="promo-tag">Mega Sale</span>
                    <h2 className="promo-title">Up to 60% Off</h2>
                    <p className="promo-desc">On Selected Premium Products. Limited time offer!</p>
                    <button className="promo-btn">Shop Now</button>
                </div>
                
                <div className="home-categories">
                    {['All', 'Electronics', 'Fashion', 'Home & Kitchen', 'Others'].map((cat, idx) => (
                        <div key={cat} className="home-category-item" onClick={() => setSelectedCategory(cat)}>
                            <div className="home-category-icon" style={{ borderColor: selectedCategory === cat ? 'var(--accent-color)' : 'var(--border-color)' }}>
                                <Icon name={cat === 'All' ? 'grid' : cat === 'Electronics' ? 'smartphone' : cat === 'Fashion' ? 'shirt' : cat === 'Home & Kitchen' ? 'home' : 'package'} size="24" />
                            </div>
                            <span className="home-category-name" style={{ color: selectedCategory === cat ? 'var(--accent-color)' : 'var(--text-primary)' }}>{cat}</span>
                        </div>
                    ))}
                </div>

                <div className="section-header">
                    <h2 className="section-title">Trending Products</h2>
                    <a href="#" className="view-all">View All</a>
                </div>
                
                {products === null ? (
                    <div style={{textAlign: 'center', padding: '4rem 0', color: 'var(--accent-color)'}}>
                        <Icon name="loader" size="48" style={{animation: 'spin 2s linear infinite', marginBottom: '1rem'}} />
                        <p>Loading products from cloud...</p>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : displayedProducts.length === 0 ? (
                    <div style={{textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)'}}>
                        <Icon name="package-open" size="48" style={{opacity: 0.5, marginBottom: '1rem'}} />
                        <p>No products available right now.</p>
                        {currentUser && currentUser.role === 'admin' && (
                            <p style={{marginTop: '1rem', color: 'var(--accent-color)', cursor: 'pointer'}} onClick={() => setCurrentView('admin')}>Go to Dashboard to add products</p>
                        )}
                    </div>
                ) : (
                    <div className="product-grid">
                        {displayedProducts.map(prod => {
                            const priceVal = parseInt((prod.price || "0").replace(/[^0-9]/g, ''));
                            const mrpVal = parseInt((prod.mrp || "0").replace(/[^0-9]/g, ''));
                            const hasDiscount = mrpVal > priceVal;
                            const discountPercent = hasDiscount ? Math.round(((mrpVal - priceVal) / mrpVal) * 100) : 0;
                            
                            return (
                            <div className="product-card" key={prod.id} onClick={() => {
                                setSelectedProduct(prod);
                                setCurrentView('product');
                                window.scrollTo(0,0);
                            }}>
                                {hasDiscount && <span className="badge-sale">-{discountPercent}%</span>}
                                <div className="card-img-container">
                                    <img src={prod.image} alt={prod.title} className="card-img" />
                                </div>
                                <div className="card-body">
                                    <h3 className="card-title">{prod.title}</h3>
                                    <div className="card-rating">
                                        <div style={{display: 'flex', color: 'var(--star-color)'}}>
                                            <Icon name="star" size="14" fill="currentColor" />
                                            <Icon name="star" size="14" fill="currentColor" />
                                            <Icon name="star" size="14" fill="currentColor" />
                                            <Icon name="star" size="14" fill="currentColor" />
                                            <Icon name="star-half" size="14" fill="currentColor" />
                                        </div>
                                        <span className="rating-count">({prod.reviews})</span>
                                    </div>
                                    <div className="price-container">
                                        <span className="card-price">{prod.price}</span>
                                        {hasDiscount && <span className="mrp-price">{prod.mrp}</span>}
                                        {hasDiscount && <span className="discount-text">{discountPercent}% off</span>}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
        );
    };

    const renderProductDetail = () => {
        if (!selectedProduct) return null;
        
        const baseCount = 128;
        const baseRating = 4.5;
        const realTotalRating = productReviews ? productReviews.reduce((sum, r) => sum + r.rating, 0) : 0;
        const realCount = productReviews ? productReviews.length : 0;
        
        const reviewCount = baseCount + realCount;
        const avgRating = (((baseRating * baseCount) + realTotalRating) / reviewCount).toFixed(1);
        
        const ratingDistribution = { 5: 85, 4: 28, 3: 10, 2: 3, 1: 2 };
        if (productReviews) {
            productReviews.forEach(r => {
                const ratingStr = String(r.rating);
                if (ratingDistribution[ratingStr] !== undefined) {
                    ratingDistribution[ratingStr]++;
                }
            });
        }
        const totalReviewsText = 42 + realCount;
        
        const renderStars = (rating) => {
            const stars = [];
            for (let i = 1; i <= 5; i++) {
                if (i <= rating) {
                    stars.push(<Icon key={i} name="star" size="16" fill="currentColor" />);
                } else if (i - 0.5 <= rating) {
                    stars.push(<Icon key={i} name="star-half" size="16" fill="currentColor" />);
                } else {
                    stars.push(<Icon key={i} name="star" size="16" fill="none" stroke="currentColor" />);
                }
            }
            return stars;
        };

        return (
            <div className="animate-fade-in">
                <div className="breadcrumb">
                    <span className="breadcrumb-link" onClick={() => setCurrentView('store')}>Home</span>
                    <Icon name="chevron-right" size="14" />
                    <span style={{color: 'var(--text-primary)'}}>Products</span>
                </div>
                
                <div className="product-container">
                    <div>
                        {(!selectedProduct.images || selectedProduct.images.length <= 1) ? (
                            <div className="main-image-container">
                                <img src={selectedProduct.image} alt="Product" className="main-image" />
                            </div>
                        ) : (
                            <div className="image-carousel-container">
                                <div 
                                    className="image-carousel"
                                    onScroll={(e) => {
                                        const index = Math.round(e.target.scrollLeft / e.target.offsetWidth);
                                        setCurrentImageIndex(index);
                                    }}
                                >
                                    {selectedProduct.images.map((img, idx) => (
                                        <div className="carousel-slide" key={idx}>
                                            <img src={img} alt={`Product ${idx+1}`} />
                                        </div>
                                    ))}
                                </div>
                                <div className="carousel-indicators">
                                    {selectedProduct.images.map((_, idx) => (
                                        <div key={idx} className={`carousel-dot ${idx === currentImageIndex ? 'active' : ''}`} />
                                    ))}
                                </div>
                            </div>
                        )}
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
                        <div className="card-rating" style={{fontSize: '0.85rem', padding: '0.2rem 0'}}>
                            <div style={{display: 'flex', color: 'var(--star-color)', alignItems: 'center', gap: '4px'}}>
                                {avgRating > 0 && <span style={{fontWeight: 'bold', fontSize: '1rem', color: '#111827'}}>{avgRating}</span>}
                                <div style={{display: 'flex'}}>
                                    {renderStars(avgRating)}
                                </div>
                            </div>
                            <span className="rating-count" style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>({reviewCount} Ratings)</span>
                        </div>
                        <div className="divider"></div>
                        <div style={{display: 'flex', alignItems: 'baseline', gap: '1rem', margin: '0.5rem 0'}}>
                            <span className="price-large">{selectedProduct.price}</span>
                            {selectedProduct.mrp && <span className="mrp-price" style={{fontSize: '1.1rem'}}>{selectedProduct.mrp}</span>}
                        </div>
                        <div style={{color: 'var(--success-color)', fontSize: '0.9rem', fontWeight: '500'}}>Inclusive of all taxes</div>
                        
                        <div style={{
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: '#f4f6f8', 
                            padding: '1rem', 
                            borderRadius: 'var(--radius-md)',
                            marginTop: '1.25rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1}}>
                                <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                                    <Icon name="tag" size="20" color="#10b981" />
                                </div>
                                <span style={{fontSize: '0.75rem', fontWeight: '600', color: '#4b5563', textAlign: 'center'}}>Lowest Price</span>
                            </div>
                            <div style={{width: '1px', height: '30px', background: '#d1d5db'}}></div>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1}}>
                                <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                                    <Icon name="banknote" size="20" color="#10b981" />
                                </div>
                                <span style={{fontSize: '0.75rem', fontWeight: '600', color: '#4b5563', textAlign: 'center'}}>Cash on Delivery</span>
                            </div>
                            <div style={{width: '1px', height: '30px', background: '#d1d5db'}}></div>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1}}>
                                <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                                    <Icon name="rotate-ccw" size="20" color="#10b981" />
                                </div>
                                <span style={{fontSize: '0.75rem', fontWeight: '600', color: '#4b5563', textAlign: 'center'}}>7-day Returns</span>
                            </div>
                        </div>

                        <div className="divider"></div>
                        <div style={{marginTop: '1rem'}}>
                            <div style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem'}}>Product Description</div>
                            <p style={{fontSize: '0.95rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap'}}>
                                {selectedProduct.description}
                            </p>
                        </div>
                        
                        <div className="divider"></div>
                        <div className="reviews-container">
                            <h2 style={{fontSize: '1.2rem', marginBottom: '1.5rem'}}>Product Ratings & Reviews</h2>
                            
                            <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap'}}>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px'}}>
                                    <div style={{fontSize: '3rem', fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem', lineHeight: '1'}}>
                                        {avgRating} <Icon name="star" size="32" fill="#059669" color="#059669" style={{marginTop: '-2px'}} />
                                    </div>
                                    <div style={{fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'center'}}>
                                        {reviewCount} Ratings,<br/>{totalReviewsText} Reviews
                                    </div>
                                </div>
                                <div style={{flex: 1, minWidth: '200px', padding: '0 1rem'}}>
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const count = ratingDistribution[star];
                                        const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                                        const labels = {5: "Excellent", 4: "Very Good", 3: "Good", 2: "Average", 1: "Poor"};
                                        const colors = {5: "#059669", 4: "#10b981", 3: "#facc15", 2: "#f97316", 1: "#ef4444"};
                                        return (
                                            <div key={star} style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.6rem'}}>
                                                <span style={{width: '65px', fontSize: '0.85rem', color: '#4b5563', textAlign: 'right', fontWeight: '500'}}>{labels[star]}</span>
                                                <div style={{flex: 1, background: '#e5e7eb', height: '6px', borderRadius: '4px', overflow: 'hidden'}}>
                                                    <div style={{width: `${percentage}%`, background: colors[star], height: '100%', borderRadius: '4px'}}></div>
                                                </div>
                                                <span style={{width: '35px', fontSize: '0.85rem', color: '#6b7280', textAlign: 'left'}}>{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="divider" style={{marginBottom: '1.5rem'}}></div>
                            
                            {/* Review Form */}
                            {/* Review Form extracted to separate view */}
                            
                            {/* Review List */}
                            {productReviews === null ? (
                                <p>Loading reviews...</p>
                            ) : productReviews.length === 0 ? (
                                <p style={{color: 'var(--text-secondary)'}}>No reviews yet. Be the first to review this product!</p>
                            ) : (
                                <div>
                                    {productReviews.map(review => {
                                        const rName = review.userName || "Customer";
                                        return (
                                        <div key={review.id} className="review-card">
                                            <div className="review-header" style={{justifyContent: 'flex-start', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem'}}>
                                                <div className="review-avatar" style={{background: 'var(--accent-light)', color: 'var(--accent-color)'}}>
                                                    {rName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="review-user" style={{color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0'}}>{rName}</div>
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem'}}>
                                                <span style={{background: '#059669', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px'}}>
                                                    {review.rating}.0 <Icon name="star" size="10" fill="currentColor" />
                                                </span>
                                                <span className="review-date" style={{fontSize: '0.8rem', color: '#9ca3af'}}>
                                                    • Posted on {review.timestamp && review.timestamp.toDate ? review.timestamp.toDate().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'Just now'}
                                                </span>
                                            </div>
                                            <div className="review-comment" style={{color: '#374151', marginBottom: '0.75rem', fontSize: '0.95rem'}}>{review.comment}</div>
                                            {review.photos && review.photos.length > 0 && (
                                                <div className="review-photos" style={{marginBottom: '0.75rem'}}>
                                                    {review.photos.map((photo, idx) => (
                                                        <img key={idx} src={photo} className="review-photo" alt="Customer uploaded" onClick={() => { /* Could implement fullscreen view */ }} />
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.9rem', cursor: 'pointer', marginTop: '0.5rem'}}>
                                                <Icon name="thumbs-up" size="16" /> Helpful ({review.helpfulCount || Math.floor(Math.random() * 50) + 1})
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                            
                            {/* Add Review Button */}
                            <div style={{marginTop: '1.5rem', textAlign: 'center'}}>
                                <button className="btn-auth" style={{width: 'auto', padding: '0.75rem 2rem', background: 'white', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', fontWeight: '600'}} onClick={() => currentUser ? setCurrentView('add_review') : setCurrentView('login')}>
                                    Write a Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddReview = () => {
        if (!selectedProduct) {
            setCurrentView('home');
            return null;
        }
        return (
            <div className="page-container" style={{paddingBottom: '80px', paddingTop: 'env(safe-area-inset-top)'}}>
                <header className="header" style={{position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-color)'}}>
                    <div className="nav-actions">
                        <Icon name="arrow-left" size="24" className="icon-btn" onClick={() => setCurrentView('product')} />
                    </div>
                    <div className="logo">Write a Review</div>
                    <div className="nav-actions" style={{width: '24px'}}></div>
                </header>
                
                <div style={{padding: '1rem'}}>
                    <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)'}}>
                        <img src={selectedProduct.images && selectedProduct.images[0]} alt={selectedProduct.name} style={{width: '60px', height: '60px', objectFit: 'contain', borderRadius: '4px'}} />
                        <div style={{fontWeight: '600', fontSize: '0.95rem'}}>{selectedProduct.name}</div>
                    </div>
                    
                    <form className="review-form" onSubmit={handleSubmitReview} style={{background: 'white', border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)'}}>
                        <div style={{marginBottom: '1.5rem'}}>
                            <label style={{display: 'block', fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem'}}>Overall Rating</label>
                            <div className="star-selector" style={{margin: '0', display: 'flex', gap: '0.5rem'}}>
                                {[1,2,3,4,5].map(star => (
                                    <svg 
                                        key={star} 
                                        width="36" 
                                        height="36" 
                                        viewBox="0 0 24 24" 
                                        fill={star <= (hoverRating || newReview.rating) ? 'var(--star-color)' : 'none'} 
                                        stroke={star <= (hoverRating || newReview.rating) ? 'var(--star-color)' : '#9ca3af'} 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        style={{cursor: 'pointer', transition: 'all 0.15s ease-in-out'}}
                                        onClick={() => setNewReview({...newReview, rating: star})}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                    >
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                ))}
                            </div>
                        </div>

                        <div style={{marginBottom: '1.5rem'}}>
                            <label style={{display: 'block', fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem'}}>Your Name</label>
                            <input type="text" className="form-input" placeholder="Enter your name" value={newReview.userName} onChange={e => setNewReview({...newReview, userName: e.target.value})} required style={{padding: '0.8rem'}} />
                        </div>
                        
                        <div style={{marginBottom: '1.5rem'}}>
                            <label style={{display: 'block', fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem'}}>Detailed Review</label>
                            <textarea className="form-input" rows="4" placeholder="What did you like or dislike? What should other shoppers know?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} required style={{padding: '0.8rem'}}></textarea>
                        </div>
                        
                        <div style={{marginBottom: '2rem'}}>
                            <label style={{display: 'block', fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem'}}>Add Photos</label>
                            <label className="photo-upload-btn" style={{margin: '0', display: 'inline-flex', padding: '0.6rem 1rem'}}>
                                <Icon name="camera" size="18" /> Upload Images
                                <input type="file" multiple accept="image/*" style={{display: 'none'}} onChange={handleReviewPhotoUpload} />
                            </label>
                            
                            {newReview.photos.length > 0 && (
                                <div className="review-photos" style={{marginTop: '1rem'}}>
                                    {newReview.photos.map((photo, idx) => (
                                        <div key={idx} style={{position: 'relative', display: 'inline-block', marginRight: '0.5rem'}}>
                                            <img src={photo} className="review-photo" style={{width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px'}} alt="Upload preview" />
                                            <button type="button" onClick={() => setNewReview(prev => ({...prev, photos: prev.photos.filter((_, i) => i !== idx)}))} style={{position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '22px', height: '22px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <button type="submit" className="btn-auth" style={{width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '8px'}} disabled={isSubmittingReview}>
                            {isSubmittingReview ? "Submitting..." : "Submit Review"}
                        </button>
                    </form>
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
                                            <input 
                                                type="tel" 
                                                name="phone" 
                                                value={orderFormData.phone} 
                                                onChange={handleOrderInputChange} 
                                                onInput={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                                                className="form-input" 
                                                required={isAddingNewAddress} 
                                                pattern="[6-9][0-9]{9}" 
                                                maxLength="10" 
                                                title="Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9" 
                                            />
                                        </div>
                                        {!currentUser && (
                                            <div className="form-group full-width">
                                                <label className="form-label">Email Address (To track orders)</label>
                                                <input 
                                                    type="email" 
                                                    name="email" 
                                                    value={orderFormData.email} 
                                                    onChange={handleOrderInputChange} 
                                                    className="form-input" 
                                                    required={isAddingNewAddress} 
                                                    pattern="[a-zA-Z0-9._%+\-]+@gmail\.com$" 
                                                    title="Please enter a valid Google Mail address (e.g., name@gmail.com)" 
                                                />
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
                                            <input 
                                                type="text" 
                                                name="pincode" 
                                                value={orderFormData.pincode} 
                                                onChange={handleOrderInputChange} 
                                                onInput={(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
                                                className="form-input" 
                                                required={isAddingNewAddress} 
                                                pattern="[1-9][0-9]{5}" 
                                                maxLength="6" 
                                                title="Please enter a valid 6-digit PIN code" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <div style={{display: window.innerWidth < 900 ? 'flex' : 'none', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem', borderRadius: 'var(--radius-sm)'}}>
                            <Icon name="shield-check" size="24" />
                            <div>
                                <div style={{fontWeight: '600', fontSize: '0.9rem'}}>Cash on Delivery Available</div>
                                <div style={{fontSize: '0.75rem', marginTop: '0.1rem', opacity: 0.9}}>Pay securely when you receive your order</div>
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
                        
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem', borderRadius: 'var(--radius-sm)'}}>
                            <Icon name="shield-check" size="24" />
                            <div>
                                <div style={{fontWeight: '600', fontSize: '0.9rem'}}>Cash on Delivery Available</div>
                                <div style={{fontSize: '0.75rem', marginTop: '0.1rem', opacity: 0.9}}>Pay securely when you receive your order</div>
                            </div>
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
                {currentView === 'add_review' && renderAddReview()}
                {currentView === 'cart' && renderCart()}
                {currentView === 'checkout' && renderCheckout()}
                {currentView === 'success' && renderSuccess()}
                {currentView === 'myorders' && <MyOrdersView currentUser={currentUser} setCurrentView={setCurrentView} handleCancelOrder={handleCancelOrder} handleReturnOrder={handleReturnOrder} setSelectedReceiptOrder={setSelectedReceiptOrder} />}
            </main>

            {/* Mobile Bottom Navigation - Hide on product detail to prevent overlap with sticky action buttons */}
            {currentView !== 'product' && (
                <div className="mobile-bottom-nav">
                    <button className={`mobile-nav-item ${currentView === 'store' ? 'active' : ''}`} onClick={() => setCurrentView('store')}>
                    <Icon name="home" size="24" />
                    Home
                </button>
                <button className="mobile-nav-item" onClick={() => { setCurrentView('store'); window.scrollTo(0, 400); }}>
                    <Icon name="grid" size="24" />
                    Categories
                </button>
                <button className={`mobile-nav-item ${currentView === 'cart' ? 'active' : ''}`} onClick={() => setCurrentView('cart')} style={{position: 'relative'}}>
                    <Icon name="shopping-cart" size="24" />
                    Cart
                    {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
                </button>
                {currentUser && currentUser.isAdmin ? (
                    <button className={`mobile-nav-item ${currentView === 'admin' ? 'active' : ''}`} onClick={() => setCurrentView('admin')}>
                        <Icon name="settings" size="24" />
                        Admin
                    </button>
                ) : currentUser ? (
                    <button className={`mobile-nav-item ${currentView === 'myorders' ? 'active' : ''}`} onClick={() => setCurrentView('myorders')}>
                        <Icon name="package" size="24" />
                        My Orders
                    </button>
                ) : (
                    <button className={`mobile-nav-item ${currentView === 'login' ? 'active' : ''}`} onClick={() => setCurrentView('login')}>
                        <Icon name="user" size="24" />
                        Login
                    </button>
                )}
                </div>
            )}

            <footer>
                <div className="footer-bottom">
                    &copy; 2026 xzestore. All Rights Reserved.
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

const MyOrdersView = ({ currentUser, setCurrentView, handleCancelOrder, handleReturnOrder, setSelectedReceiptOrder }) => {
    const [orders, setOrders] = React.useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = React.useState(null);

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

    if (selectedOrderDetails) {
        return (
            <div className="animate-fade-in store-layout" style={{ display: 'block' }}>
                <div className="breadcrumb" style={{marginBottom: '1.5rem'}}>
                    <span className="breadcrumb-link" onClick={() => setSelectedOrderDetails(null)}>My Orders</span>
                    <Icon name="chevron-right" size="14" />
                    <span style={{color: 'var(--text-primary)'}}>Order Details</span>
                </div>
                
                <div style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem'}}>
                        <div>
                            <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Order ID</div>
                            <div style={{fontWeight: '600'}}>{selectedOrderDetails.orderId}</div>
                        </div>
                        <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Total Amount</div>
                            <div style={{fontWeight: '700', color: 'var(--accent-color)'}}>₹{selectedOrderDetails.total}</div>
                        </div>
                    </div>
                    
                    <div style={{marginBottom: '1rem'}}>
                        <div style={{fontWeight: '600', marginBottom: '0.5rem'}}>Items:</div>
                        <div style={{fontSize: '0.95rem', color: 'var(--text-secondary)'}}>{selectedOrderDetails.products}</div>
                    </div>
                    
                    <div style={{marginBottom: '1rem'}}>
                        <div style={{fontWeight: '600', marginBottom: '0.5rem'}}>Delivery Details:</div>
                        <div style={{fontSize: '0.95rem', color: 'var(--text-secondary)'}}>
                            {selectedOrderDetails.customerName}<br/>
                            {selectedOrderDetails.address}<br/>
                            {selectedOrderDetails.pincode}<br/>
                            Phone: {selectedOrderDetails.phone}
                        </div>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem'}}>
                        <div style={{
                            display: 'inline-block', 
                            padding: '0.25rem 0.75rem', 
                            background: selectedOrderDetails.status === 'Cancelled' ? '#fecdd3' : (selectedOrderDetails.status === 'Delivered' ? '#dcfce7' : '#fef9c3'), 
                            color: selectedOrderDetails.status === 'Cancelled' ? '#9f1239' : (selectedOrderDetails.status === 'Delivered' ? '#166534' : '#854d0e'), 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.8rem', 
                            fontWeight: 'bold'
                        }}>
                            {selectedOrderDetails.status || 'Pending'}
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button 
                                style={{background: 'none', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'}}
                                onClick={() => setSelectedReceiptOrder(selectedOrderDetails)}
                            >
                                Receipt
                            </button>
                            {(!selectedOrderDetails.status || selectedOrderDetails.status === 'Pending' || selectedOrderDetails.status === 'Processing') && (
                                <button 
                                    style={{background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer'}}
                                    onClick={async () => {
                                        const success = await handleCancelOrder(selectedOrderDetails);
                                        if (success) {
                                            setSelectedOrderDetails({...selectedOrderDetails, status: 'Cancellation Requested'});
                                        }
                                    }}
                                >
                                    Request Cancellation
                                </button>
                            )}
                            {selectedOrderDetails.status === 'Delivered' && 
                             (!selectedOrderDetails.deliveredAt || ((new Date().getTime() - new Date(selectedOrderDetails.deliveredAt).getTime()) / (1000 * 3600 * 24) <= 7)) && (
                                <button 
                                    style={{background: 'none', border: '1px solid #eab308', color: '#eab308', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', marginLeft: '0.5rem'}}
                                    onClick={async () => {
                                        const success = await handleReturnOrder(selectedOrderDetails);
                                        if (success) {
                                            setSelectedOrderDetails({...selectedOrderDetails, status: 'Return Requested'});
                                        }
                                    }}
                                >
                                    Request Return
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                        <div key={order.id} onClick={() => setSelectedOrderDetails(order)} style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer'}}>
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
                                <div style={{fontSize: '0.95rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{order.products}</div>
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
                                <div style={{color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                                    View Details <Icon name="chevron-right" size="16" />
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
                        <img src="logo.jpg" alt="xzestore logo" style={{height: '100px', mixBlendMode: 'multiply', objectFit: 'contain'}} />
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
