'use client';

const menuGroups = [
    {
        label: null,
        items: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' }
        ]
    },
    {
        label: 'OPERATIONS',
        items: [
            { id: 'customers', icon: 'fa-users', label: 'Customers' },
            { id: 'store', icon: 'fa-store', label: 'Store' },
            { id: 'orders', icon: 'fa-receipt', label: 'Orders' },
            { id: 'verification', icon: 'fa-robot', label: 'Verification' }
        ]
    },
    {
        label: 'GROWTH',
        items: [
            { id: 'analytics', icon: 'fa-chart-line', label: 'Analytics' },
            { id: 'facebook-ads', icon: 'fa-bullhorn', label: 'Facebook Ads' },
            { id: 'facebook-chat', icon: 'fa-comments', label: 'Inbox' },
            { id: 'campaign-tracking', icon: 'fa-crosshairs', label: 'Campaign Tracking' }
        ]
    },
    {
        label: 'SYSTEM',
        items: [
            { id: 'settings', icon: 'fa-cog', label: 'Settings' }
        ]
    }
];

export default function Sidebar({ activeView, onViewChange, cartCount, currentUser, onLogout }) {
    const userName = currentUser?.profile?.first_name || 'User';
    const userRole = currentUser?.profile?.role || 'Guest';

    return (
        <aside className="w-64 bg-[#0A1A2F] border-r border-white/5 flex flex-col h-screen shrink-0 sticky top-0 z-[100]">
            {/* Logo Section - Champagne Gold Accent */}
            <div className="p-8 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#C9A34E] flex items-center justify-center text-[#0A1A2F] font-black text-2xl shadow-lg shadow-[#C9A34E]/20 rotate-[-4deg] group-hover:rotate-0 transition-transform duration-500">
                        V
                    </div>
                    <div>
                        <h1 className="font-black text-[#F8F8F6] text-xl tracking-tight leading-none mb-1">V SCHOOL</h1>
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] leading-none">Customer 360</p>
                    </div>
                </div>
            </div>

            {/* Navigation - High Contrast Ivory on Navy */}
            <nav className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                    {menuGroups.map((group, groupIndex) => (
                        <div key={groupIndex}>
                            {group.label && (
                                <h3 className="px-5 mb-2 text-[10px] font-black text-white/20 uppercase tracking-widest">
                                    {group.label}
                                </h3>
                            )}
                            <ul className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = activeView === item.id;
                                    // Permission-based visibility
                                    const canAccess = item.id === 'analytics'
                                        ? (currentUser?.permissions?.can_access_analytics || currentUser?.permissions?.can_manage_analytics || currentUser?.permissions?.is_admin)
                                        : true;

                                    if (!canAccess) return null;

                                    return (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => onViewChange(item.id)}
                                                className={`w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative group ${isActive
                                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 translate-x-1'
                                                    : 'text-white/60 hover:text-[#F8F8F6] hover:bg-white/5'
                                                    }`}
                                            >
                                                {/* Active Indicator Light */}
                                                {isActive && (
                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></span>
                                                )}

                                                <i className={`fas ${item.icon} w-6 text-center text-lg ${isActive ? 'text-white' : 'group-hover:text-red-500 transition-colors'}`}></i>
                                                <span className="tracking-tight">{item.label}</span>

                                                {/* Cart badge - Japan Red Accent */}
                                                {item.id === 'store' && cartCount > 0 && (
                                                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white text-red-500' : 'bg-red-500 text-white'
                                                        }`}>
                                                        {cartCount}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </nav>

            {/* User Profile - Premium Warm Gray & Navy */}
            <div className="p-6 border-t border-white/5 bg-black/20">
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A34E] to-amber-600 flex items-center justify-center border-2 border-white/10 shadow-xl overflow-hidden">
                        <span className="text-white font-black text-lg">{userName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#F8F8F6] truncate uppercase tracking-tight">{userName}</p>
                        <p className="text-[10px] text-white/30 font-bold truncate uppercase">{userRole}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Logout"
                    >
                        <i className="fas fa-sign-out-alt text-sm"></i>
                    </button>
                </div>
            </div>
        </aside>
    );
}

