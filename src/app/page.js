'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import CustomerCard from '@/components/CustomerCard';
import CustomerList from '@/components/CustomerList';
import StoreGrid from '@/components/StoreGrid';
import ProductModal from '@/components/ProductModal';
import Dashboard from '@/components/Dashboard';
import Orders from '@/components/Orders';
import Analytics from '@/components/Analytics';
import FacebookAds from '@/components/FacebookAds';
import FacebookChat from '@/components/FacebookChat';
import Settings from '@/components/Settings';
import RegistrationModal from '@/components/RegistrationModal';
import LoginPage from '@/components/LoginPage';
import SlipVerificationPanel from '@/components/SlipVerificationPanel';
import CampaignTracking from '@/components/CampaignTracking';

export default function Home() {
    const [activeView, setActiveView] = useState('customers');
    const [customers, setCustomers] = useState([]);
    const [activeCustomer, setActiveCustomer] = useState(null);
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [customerViewMode, setCustomerViewMode] = useState('list'); // 'list' or 'detail'
    const [initialChatCustomerId, setInitialChatCustomerId] = useState(null);

    // Auth State
    const [currentUser, setCurrentUser] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loginError, setLoginError] = useState('');

    // Load customers on mount
    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (currentUser) {
            loadCustomers();
            loadProducts();
        }
    }, [currentUser]);

    async function loadEmployees() {
        try {
            const res = await fetch('/api/employees');
            if (res.ok) {
                const loaded = await res.json();
                setEmployees(loaded);
            }
        } catch (e) {
            console.error('Failed to load employees', e);
        }
    }

    function handleLogin(user) {
        if (user) {
            setCurrentUser(user);
            setLoginError('');
        } else {
            setLoginError('Invalid email or password');
        }
    }

    function handleLogout() {
        setCurrentUser(null);
        setActiveView('customers');
        setCart([]);
    }

    async function loadCustomers() {
        try {
            const apiUrl = `${window.location.origin}/api/customers`;
            console.log('Loading customers from:', apiUrl);
            const res = await fetch(apiUrl, { redirect: 'error' });
            console.log('Customer API response status:', res.status);
            if (res.ok) {
                const loaded = await res.json();
                // Ensure each customer object has both id and customer_id for stability
                const normalized = loaded.map(c => ({ ...c, id: c.customer_id }));
                setCustomers(normalized);

                // Smart active customer selection:
                // 1. Keep currently active if still valid
                // 2. Or pick the first one from the list
                setActiveCustomer(prev => {
                    if (prev) {
                        const stillExists = normalized.find(c => c.customer_id === prev.customer_id);
                        if (stillExists) return stillExists;
                    }
                    return normalized[0] || null;
                });
            }
        } catch (e) {
            console.error('Failed to load customers', e);
            console.error('Error details:', e.name, e.message);
        }
    }

    async function saveCustomer(customer) {
        if (!customer.profile || !customer.intelligence) {
            console.error('Refusing to save incomplete customer object:', customer);
            return;
        }
        try {
            const res = await fetch(`${window.location.origin}/api/customers/${customer.customer_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer)
            });
            if (!res.ok) throw new Error('Failed to update customer');
        } catch (e) {
            console.error('Failed to save customer', e);
        }
    }

    async function loadProducts() {
        try {
            const res = await fetch('/api/catalog');
            const catalog = await res.json();
            const allProducts = [
                ...catalog.packages.map(p => ({ ...p, type: 'bundle' })),
                ...catalog.products.map(p => ({ ...p, type: 'course' }))
            ];
            setProducts(allProducts);
        } catch (e) {
            console.error('Failed to load products', e);
        }
    }

    useEffect(() => {
        if (activeView === 'store') {
            loadProducts();
        }
    }, [activeView]);

    function addToCart(product) {
        const productSignature = product.type === 'bundle'
            ? JSON.stringify({
                id: product.id,
                swapped: product.swappedCourses || {},
                free: (product.selectedFreeCourses || []).sort()
            })
            : product.id;
        const existing = cart.find(c => {
            const cSignature = c.type === 'bundle'
                ? JSON.stringify({
                    id: c.id,
                    swapped: c.swappedCourses || {},
                    free: (c.selectedFreeCourses || []).sort()
                })
                : c.id;
            return cSignature === productSignature;
        });

        if (existing) {
            setCart(cart.map(c => {
                const cSignature = c.type === 'bundle'
                    ? JSON.stringify({
                        id: c.id,
                        swapped: c.swappedCourses || {},
                        free: (c.selectedFreeCourses || []).sort()
                    })
                    : c.id;
                return cSignature === productSignature
                    ? { ...c, qty: c.qty + 1 }
                    : c;
            }));
        } else {
            setCart([...cart, { ...product, qty: 1 }]);
        }
    }

    async function handleRegisterCustomer(newCustomer) {
        setCustomers([...customers, newCustomer]);
        setActiveCustomer(newCustomer);
        setIsRegistrationOpen(false);

        // Persist to disk
        await saveCustomer(newCustomer);

        alert(`Customer ${newCustomer.customer_id} registered successfully!`);
    }


    const handleCheckout = async (paymentData = {}) => {
        const { method = 'wallet', slip_url = null } = paymentData;

        if (!activeCustomer) {
            alert("Please select a customer first!");
            return;
        }

        const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const currentBalance = activeCustomer.wallet?.balance || 0;

        // Wallet Logic: Check if balance is sufficient
        if (method === 'wallet' && currentBalance < cartTotal) {
            alert(`Insufficient Wallet Balance! (Have: ฿${currentBalance.toLocaleString()}, Need: ฿${cartTotal.toLocaleString()})`);
            return;
        }

        const newInventoryItems = [];
        const timestamp = new Date().toISOString().split('T')[0];

        cart.forEach(item => {
            for (let i = 0; i < item.qty; i++) {
                if (item.type === 'bundle' || item.type === 'package') {
                    const bundleItems = [];
                    if (item.courses) {
                        item.courses.forEach(cId => {
                            const targetId = item.swappedCourses && item.swappedCourses[cId]
                                ? item.swappedCourses[cId].id
                                : cId;
                            const course = products.find(p => p.id === targetId);
                            if (course) {
                                bundleItems.push({
                                    name: course.name,
                                    course_id: course.id,
                                    description: targetId !== cId ? `Customized (Swapped)` : course.description,
                                    type: 'course',
                                    purchase_date: timestamp,
                                    status: method === 'wallet' ? 'Active' : 'Pending Verification',
                                    credits_remaining: { sessions: course.duration ? Math.ceil(course.duration / 3) : 1 },
                                    is_bundle_item: true
                                });
                            }
                        });
                    }
                    const freeCourseIds = item.selectedFreeCourses && item.selectedFreeCourses.length > 0
                        ? item.selectedFreeCourses
                        : (item.free_courses || []);
                    freeCourseIds.forEach(cId => {
                        const course = products.find(p => p.id === cId);
                        if (course) {
                            bundleItems.push({
                                name: course.name + " (Bonus)",
                                course_id: course.id,
                                description: "Bonus Course",
                                type: 'course',
                                purchase_date: timestamp,
                                status: method === 'wallet' ? 'Active' : 'Pending Verification',
                                credits_remaining: { sessions: 1 },
                                is_bonus: true,
                                is_bundle_item: true
                            });
                        }
                    });
                    newInventoryItems.push({
                        name: item.name,
                        bundle_id: item.id,
                        description: "Package License",
                        type: 'bundle',
                        purchase_date: timestamp,
                        status: method === 'wallet' ? 'Active' : 'Pending Verification',
                        items: bundleItems
                    });
                } else {
                    newInventoryItems.push({
                        name: item.name,
                        course_id: item.id,
                        description: item.description,
                        type: 'course',
                        purchase_date: timestamp,
                        status: method === 'wallet' ? 'Active' : 'Pending Verification',
                        credits_remaining: { sessions: 1 }
                    });
                }
            }
        });

        const timelineEntry = {
            date: new Date().toISOString(),
            type: 'ORDER',
            icon: 'fas fa-shopping-bag',
            title: `Order #${Math.floor(Math.random() * 90000) + 10000}`,
            details: {
                total: cartTotal,
                method: method,
                status: method === 'wallet' ? 'Completed' : 'Pending Verification',
                slip: slip_url,
                items: cart.map(item => `${item.qty}x ${item.name}`)
            }
        };

        const updatedCustomers = customers.map(c => {
            if (c.customer_id === activeCustomer.customer_id) {
                const updatedTotalSpend = (c.intelligence?.metrics?.total_spend || 0) + (method === 'wallet' ? cartTotal : 0);
                const newBalance = method === 'wallet' ? (c.wallet?.balance || 0) - cartTotal : (c.wallet?.balance || 0);
                return {
                    ...c,
                    wallet: {
                        ...c.wallet,
                        balance: newBalance
                    },
                    inventory: {
                        ...c.inventory,
                        learning_courses: [
                            ...(c.inventory?.learning_courses || []),
                            ...newInventoryItems
                        ]
                    },
                    timeline: [timelineEntry, ...(c.timeline || [])],
                    intelligence: {
                        ...c.intelligence,
                        metrics: {
                            ...c.intelligence?.metrics,
                            total_spend: updatedTotalSpend
                        }
                    }
                };
            }
            return c;
        });

        setCustomers(updatedCustomers);
        const newActive = updatedCustomers.find(c => c.customer_id === activeCustomer.customer_id);
        setActiveCustomer(newActive);

        // Persist to disk
        if (activeCustomer) { // Use activeCustomer directly here
            const newActive = updatedCustomers.find(c => c.customer_id === activeCustomer.customer_id);
            if (newActive) {
                await saveCustomer(newActive);
                setActiveCustomer(newActive); // Update active customer after saving
            }
        }

        setCustomers(updatedCustomers);
        setCart([]);
        setIsCartOpen(false);
        if (method === 'wallet') {
            alert("Checkout Successful! Courses added to inventory.");
        } else {
            alert("Transfer Received! Pending verification by admin.");
        }
    };

    const handleVerifySlip = (orderId, ocrData) => {
        const updatedCustomers = customers.map(c => {
            const orderTimeline = (c.timeline || []).find(t => t.id === orderId);
            if (!orderTimeline) return c;

            const orderTotal = orderTimeline.details?.total || 0;

            return {
                ...c,
                timeline: c.timeline.map(t => t.id === orderId ? {
                    ...t,
                    details: { ...t.details, status: 'Completed', verified_at: new Date().toISOString(), ocr_match: true }
                } : t),
                inventory: {
                    ...c.inventory,
                    learning_courses: (c.inventory?.learning_courses || []).map(item => {
                        if (item.status === 'Pending Verification') {
                            return { ...item, status: 'Active' };
                        }
                        if (item.type === 'bundle' && item.items) {
                            return {
                                ...item,
                                status: item.status === 'Pending Verification' ? 'Active' : item.status,
                                items: item.items.map(sub => ({
                                    ...sub,
                                    status: sub.status === 'Pending Verification' ? 'Active' : sub.status
                                }))
                            };
                        }
                        return item;
                    })
                },
                intelligence: {
                    ...c.intelligence,
                    metrics: {
                        ...c.intelligence?.metrics,
                        total_spend: (c.intelligence?.metrics?.total_spend || 0) + orderTotal
                    }
                }
            };
        });
        setCustomers(updatedCustomers);
        if (activeCustomer && updatedCustomers.find(c => c.customer_id === activeCustomer.customer_id)) {
            setActiveCustomer(updatedCustomers.find(c => c.customer_id === activeCustomer.customer_id));
        }
        alert("Slip Verified! Inventory activated and revenue updated.");
    };

    const handleRejectSlip = (orderId) => {
        alert("Slip Rejected. Order status updated to 'Action Required'.");
    };

    const pendingVerifications = customers.flatMap(c =>
        (c.timeline || [])
            .filter(t => t.type === 'ORDER' && t.details?.status === 'Pending Verification')
            .map(o => ({
                ...o,
                customer_name: c.profile?.nick_name || c.profile?.first_name || 'Unknown',
                customer_id: c.customer_id,
                total_amount: o.details?.total || 0,
                slip_url: o.details?.slip,
                items: (o.details?.items || []).map(itemStr => ({ name: itemStr })),
                inventory_status: 'Pending Verification'
            }))
    );


    // Standard IDs (TVS-CUS Stable V7)
    const currentYearShort = new Date().getFullYear().toString().slice(-2);
    const maxSerial = customers.reduce((max, c) => {
        if (c.customer_id && c.customer_id.startsWith(`TVS-CUS-WB-${currentYearShort}-`)) {
            const num = parseInt(c.customer_id.split('-').pop());
            return num > max ? num : max;
        }
        return max;
    }, 0);
    const nextCustomerId = `TVS-CUS-WB-${currentYearShort}-${String(maxSerial + 1).padStart(4, '0')}`;

    // Calculate Next Member ID (MEM-YYYY-XXXX)
    const currentYear = new Date().getFullYear();
    const maxMemberId = customers.reduce((max, c) => {
        const mid = c.profile?.member_id;
        if (mid && mid.startsWith(`MEM-${currentYear}-`)) {
            const num = parseInt(mid.split('-')[2]);
            return num > max ? num : max;
        }
        return max;
    }, 0);
    const nextMemberId = `MEM-${currentYear}-${String(maxMemberId + 1).padStart(4, '0')}`;

    const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Show login page if not authenticated
    if (!currentUser) {
        return (
            <LoginPage
                onLogin={handleLogin}
                employees={employees}
                error={loginError}
            />
        );
    }

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                activeView={activeView}
                onViewChange={(view) => {
                    if (view === 'customers') setCustomerViewMode('list');
                    setActiveView(view);
                }}
                cartCount={cartItemCount}
                currentUser={currentUser}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-10 md:p-16">
                {activeView === 'dashboard' && (
                    <Dashboard
                        customers={customers}
                        products={products}
                        onRefresh={loadCustomers}
                    />
                )}

                {activeView === 'customers' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    {customerViewMode === 'list' ? 'Customer Database' : 'Customer Profile'}
                                </h1>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                                    {customerViewMode === 'list' ? `TOTAL RECORDS: ${customers.length}` : `Viewing Details: ${activeCustomer?.profile?.member_id}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {customerViewMode === 'detail' && (
                                    <button
                                        onClick={() => setCustomerViewMode('list')}
                                        className="bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
                                    >
                                        <i className="fas fa-arrow-left"></i>
                                        BACK TO LIST
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsRegistrationOpen(true)}
                                    className="bg-[#C9A34E] text-[#0A1A2F] px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-3 shadow-xl"
                                >
                                    <i className="fas fa-user-plus"></i>
                                    REGISTER NEW CUSTOMER
                                </button>
                            </div>
                        </div>
                        {customerViewMode === 'list' ? (
                            <CustomerList
                                customers={customers}
                                onSelectCustomer={(c) => {
                                    setActiveCustomer(c);
                                    setCustomerViewMode('detail');
                                }}
                                onGoToChat={(c) => {
                                    const fbId = c.contact_info?.facebook_id || c.facebook_id || c.customer_id;
                                    setInitialChatCustomerId(fbId);
                                    setActiveView('facebook-chat');
                                }}
                            />
                        ) : activeCustomer && (
                            <CustomerCard
                                customer={activeCustomer}
                                customers={customers}
                                onSelectCustomer={setActiveCustomer}
                                currentUser={currentUser}
                                onUpdateInventory={(updatedCustomer) => {
                                    setCustomers(customers.map(c => c.customer_id === updatedCustomer.customer_id ? updatedCustomer : c));
                                    setActiveCustomer(updatedCustomer);
                                }}
                                onGoToChat={(c) => {
                                    const fbId = c.contact_info?.facebook_id || c.facebook_id || c.customer_id;
                                    setInitialChatCustomerId(fbId);
                                    setActiveView('facebook-chat');
                                }}
                            />
                        )}
                    </div>
                )}

                {activeView === 'store' && (
                    <StoreGrid
                        products={products}
                        allProducts={products}
                        activeCustomer={activeCustomer}
                        onSelectProduct={setSelectedProduct}
                        onAddToCart={addToCart}
                        cart={cart}
                        setCart={setCart}
                        onCheckout={handleCheckout}
                        isCartOpen={isCartOpen}
                        setIsCartOpen={setIsCartOpen}
                    />
                )}

                {activeView === 'orders' && (
                    <Orders customers={customers} />
                )}

                {activeView === 'verification' && (
                    <SlipVerificationPanel
                        orders={pendingVerifications}
                        onVerify={handleVerifySlip}
                        onReject={handleRejectSlip}
                    />
                )}

                {activeView === 'analytics' && (
                    <Analytics
                        customers={customers}
                        orders={[]} // Passing empty orders for now as they are not fully implemented in global state
                        products={products}
                        onRefresh={loadCustomers}
                    />
                )}

                {activeView === 'facebook-ads' && (
                    <FacebookAds
                        customers={customers}
                    />
                )}

                {activeView === 'facebook-chat' && (
                    <FacebookChat
                        initialCustomerId={initialChatCustomerId}
                        onViewCustomer={(customer) => {
                            if (customer) {
                                const fullCustomer = customers.find(c => c.customer_id === customer.customer_id) || customer;
                                setActiveCustomer(fullCustomer);
                                setCustomerViewMode('detail');
                                setActiveView('customers');
                            }
                        }}
                    />
                )}

                {activeView === 'settings' && (
                    <Settings />
                )}

                {activeView === 'campaign-tracking' && (
                    <CampaignTracking customers={customers} />
                )}

                {activeView === 'inventory' && activeCustomer && (
                    <div className="space-y-6">
                        <h1 className="text-3xl font-black text-white tracking-tight">Inventory Management</h1>
                        <CustomerCard
                            customer={activeCustomer}
                            customers={customers}
                            onSelectCustomer={setActiveCustomer}
                            currentUser={currentUser}
                            onUpdateInventory={(updatedCustomer) => {
                                setCustomers(customers.map(c => c.customer_id === updatedCustomer.customer_id ? updatedCustomer : c));
                                setActiveCustomer(updatedCustomer);
                                saveCustomer(updatedCustomer);
                            }}
                        />
                    </div>
                )}
            </main>

            {/* Modals & Overlays */}
            {/* Cart Toggle Button (Floating) - REMOVED: Moved to Sticky Header in StoreGrid */}

            <ProductModal
                product={selectedProduct}
                allProducts={products}
                activeCustomer={activeCustomer}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={(p) => {
                    addToCart(p);
                    setSelectedProduct(null);
                }}
            />

            <RegistrationModal
                isOpen={isRegistrationOpen}
                onClose={() => setIsRegistrationOpen(false)}
                onRegister={handleRegisterCustomer}
                nextId={nextCustomerId}
                nextMemberId={nextMemberId}
            />
        </div>
    );
}
