'use client';

import React, { useState } from 'react';
import IntelligencePanel from './IntelligencePanel';
import InventoryPanel from './InventoryPanel';
import Timeline from './Timeline';
import SlipVerificationModal from './SlipVerificationModal';

export default function CustomerCard({ customer, customers, onSelectCustomer, currentUser, onUpdateInventory, onGoToChat }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    if (!customer) return null;

    const profile = customer.profile || {};
    const intel = customer.intelligence || {};
    const inventory = customer.inventory || {};
    const wallet = customer.wallet || { balance: 0, points: 0, currency: 'THB' };
    const contact = customer.contact_info || profile.contact_info || {};
    const timeline = customer.timeline || [];

    const tierConfig = {
        L1: { label: 'General Member (L1)', color: 'bg-slate-400', nextTier: 'L2', threshold: 15000, hourThreshold: 0, icon: 'fa-certificate', textColor: 'text-slate-100' },
        L2: { label: 'Silver (L2)', color: 'bg-zinc-300', nextTier: 'L3', threshold: 50000, hourThreshold: 0, icon: 'fa-medal', textColor: 'text-zinc-800' },
        L3: { label: 'Gold (L3)', color: 'bg-amber-400', nextTier: 'L4', threshold: 125000, hourThreshold: 30, icon: 'fa-crown', textColor: 'text-amber-950' },
        L4: { label: 'Platinum (L4)', color: 'bg-cyan-400', nextTier: 'L5', threshold: 250000, hourThreshold: 100, icon: 'fa-gem', textColor: 'text-cyan-950' },
        L5: { label: 'Elite (L5)', color: 'bg-rose-500', nextTier: null, threshold: Infinity, hourThreshold: Infinity, icon: 'fa-fire', textColor: 'text-white' }
    };

    const totalSpend = intel.metrics?.total_spend || 0;
    const learningHours = intel.metrics?.total_learning_hours || 0;
    const internship = intel.metrics?.internship_completed || false;

    // Detect Current Tier based on spending AND hours
    let currentTierKey = 'L1';
    if (totalSpend >= 250000 && learningHours >= 100 && internship) currentTierKey = 'L5';
    else if (totalSpend >= 125000 && learningHours >= 30) currentTierKey = 'L4';
    else if (totalSpend >= 50000) currentTierKey = 'L3';
    else if (totalSpend >= 15000) currentTierKey = 'L2';

    const currentTier = tierConfig[currentTierKey];
    const nextTierKey = currentTier.nextTier;
    const nextTier = nextTierKey ? tierConfig[nextTierKey] : null;

    // Progress calculation (Dominant by Spending, but checking both)
    const spendProgress = nextTier ? Math.min(100, (totalSpend / nextTier.threshold) * 100) : 100;
    const hourProgress = nextTier && nextTier.hourThreshold > 0 ? Math.min(100, (learningHours / nextTier.hourThreshold) * 100) : 100;

    const [editAgent, setEditAgent] = useState(profile.agent || '');
    const [editStatus, setEditStatus] = useState(customer.status || 'New Lead');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const updatedCustomer = {
                ...customer,
                profile: { ...profile, agent: editAgent },
                status: editStatus,
                timeline: [
                    {
                        date: new Date().toISOString(),
                        type: 'STATUS_CHANGE',
                        icon: 'fas fa-user-edit',
                        title: 'Profile Updated',
                        details: `Assigned Agent: ${editAgent}, Status: ${editStatus}`
                    },
                    ...timeline
                ]
            };
            await onUpdateInventory(updatedCustomer);

            const res = await fetch(`/api/customers/${customer.customer_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCustomer)
            });

            if (res.ok) {
                alert('Profile updated successfully!');
            }
        } catch (err) {
            console.error('Failed to save profile:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInventoryUpdate = async (newInventory) => {
        const updatedCustomer = {
            ...customer,
            inventory: newInventory
        };

        // Update local state immediately
        onUpdateInventory(updatedCustomer);

        // Persist to API
        try {
            await fetch(`/api/customers/${customer.customer_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCustomer)
            });
        } catch (err) {
            console.error('Failed to save inventory:', err);
            alert('Failed to save inventory changes.');
        }
    };

    return (
        <div className="animate-fade-in pb-12 overflow-hidden">
            {/* Top Toolbar - Compact */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 bg-[#162A47]/80 p-4 lg:p-5 rounded-[1.5rem] shadow-lg relative overflow-hidden ring-1 ring-white/10 backdrop-blur-md">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-xl font-black text-white tracking-tight">Customer Engagement</h2>
                    <p className="text-slate-400 text-[10px] font-bold">360° Insight & Experience Management</p>
                </div>

                {/* Search Bar - Compact */}
                <div className="flex-1 max-w-xs mx-auto hidden lg:block">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="fas fa-search text-slate-400 text-xs group-focus-within:text-[#0A1A2F] transition-colors"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Search Inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 pl-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active</span>
                    </div>
                    <select
                        value={customer.customer_id}
                        onChange={(e) => {
                            const selected = customers.find(c => c.customer_id === e.target.value);
                            if (selected) onSelectCustomer(selected);
                        }}
                        className="pl-3 pr-8 py-1.5 bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-700 appearance-none cursor-pointer outline-none"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23fb923c\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M8 9l4-4 4 4m0 6l-4 4-4-4\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                    >
                        {customers.map((c) => (
                            <option key={c.customer_id} value={c.customer_id}>
                                {c.profile?.member_id ? `[${c.profile.member_id}]` : `[${c.customer_id}]`} {c.profile?.first_name ? `${c.profile.first_name} ${c.profile.last_name || ''}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-3 space-y-5">
                    <div className="bg-[#162A47]/80 rounded-[1.5rem] shadow-lg border border-white/10 overflow-hidden relative group backdrop-blur-md">
                        <div className="p-[15px] pb-20 bg-gradient-to-br from-[#162A47]/80 to-[#1F3A5F]/80 relative">
                            <div className="flex flex-col items-center text-center">
                                <div className="relative mb-4">
                                    <div className="w-[140px] h-[140px] rounded-full bg-[#162A47] p-0.5 ring-2 ring-[#C9A34E]/20 shadow-xl overflow-hidden">
                                        <img
                                            src={profile.profile_picture || profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name || 'C'}&background=0A1A2F&color=C9A34E`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover rounded-full"
                                            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=' + (profile.first_name || 'C') + '&background=0A1A2F&color=C9A34E'; }}
                                        />
                                    </div>
                                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-2 border-[#162A47] rounded-full flex items-center justify-center shadow-md">
                                        <i className="fas fa-check text-white text-[9px]"></i>
                                    </div>
                                </div>

                                <h3 className="text-lg font-black text-[#F8F8F6] mb-0.5 tracking-tight leading-tight">{profile.first_name} {profile.last_name}</h3>
                                <p className="text-white/40 font-bold text-[8px] tracking-[0.2em] uppercase mb-4">
                                    {profile.nick_name ? `"${profile.nick_name}"` : 'Premium Member'}
                                </p>

                                {/* Membership Badge */}
                                <div className={`flex items-center gap-2 px-4 py-1.5 ${currentTier.color} rounded-full mb-6 shadow-lg shadow-black/20 border border-white/20 transition-all hover:scale-105 cursor-default`}>
                                    <i className={`fas ${currentTier.icon} ${currentTier.textColor} text-xs`}></i>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${currentTier.textColor}`}>
                                        {currentTier.label}
                                    </span>
                                </div>

                                {/* AI Intelligence Badges - Phase 5 🧠 */}
                                {intel.score !== undefined && (
                                    <div className="flex flex-col items-center gap-2 mb-6 animate-bounce-slow">
                                        <div className="flex items-center gap-3">
                                            {/* Lead Score Circle */}
                                            <div className="relative w-12 h-12 flex items-center justify-center">
                                                <svg className="w-full h-full -rotate-90">
                                                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                                                    <circle
                                                        cx="24" cy="24" r="20" fill="transparent"
                                                        stroke={intel.score > 70 ? '#4ade80' : intel.score > 40 ? '#fbbf24' : '#f87171'}
                                                        strokeWidth="4"
                                                        strokeDasharray={125.6}
                                                        strokeDashoffset={125.6 * (1 - intel.score / 100)}
                                                        strokeLinecap="round"
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                </svg>
                                                <span className="absolute text-[10px] font-black text-white">{intel.score}%</span>
                                            </div>

                                            {/* Intent Badge */}
                                            <div className="flex flex-col items-start">
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">AI Intent</span>
                                                <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30 text-[9px] font-black uppercase tracking-tighter shadow-glow-blue flex items-center gap-1">
                                                    <i className={`fas ${intel.intent === 'Purchase' ? 'fa-shopping-cart' :
                                                        intel.intent === 'Question' ? 'fa-question-circle' :
                                                            intel.intent === 'Complaint' ? 'fa-exclamation-triangle' : 'fa-comment'
                                                        } text-[8px]`}></i>
                                                    {intel.intent || 'Analyzing...'}
                                                </div>
                                            </div>
                                        </div>
                                        {intel.main_interest && (
                                            <p className="text-[9px] font-bold text-[#C9A34E] italic">
                                                Interest: {intel.main_interest}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Membership Progress */}
                                {nextTier && (
                                    <div className="w-full max-w-[240px] mb-6 p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Tier: {nextTier.label.split(' ')[0]}</span>
                                            <div className="flex gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${spendProgress >= 100 ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-slate-600'}`}></div>
                                                {nextTier.hourThreshold > 0 && (
                                                    <div className={`w-1.5 h-1.5 rounded-full ${hourProgress >= 100 ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]' : 'bg-slate-600'}`}></div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Spending Progress Bar */}
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-1 px-1">
                                                    <span>SPEND</span>
                                                    <span>{totalSpend.toLocaleString()} / {nextTier.threshold.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-400 to-amber-200 rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${spendProgress}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Hours Progress Bar (if applicable) */}
                                            {nextTier.hourThreshold > 0 && (
                                                <div>
                                                    <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-1 px-1">
                                                        <span>HOURS</span>
                                                        <span>{learningHours} / {nextTier.hourThreshold} HRS</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-400 to-blue-200 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(96,165,250,0.3)]"
                                                            style={{ width: `${hourProgress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Wallet Section - 2-Row Grid with Actions */}
                                <div className="w-full max-w-[240px] bg-[#162A47] rounded-2xl p-5 mb-6 border border-white/10 relative overflow-hidden">
                                    <div className="space-y-4 relative z-10">
                                        {/* Row 1: Wallet */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">W. Wallet</span>
                                                <div className="text-xl font-black text-white flex items-baseline gap-1">
                                                    <span className="text-xs text-slate-500 font-bold">฿</span>
                                                    {wallet.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsTopUpModalOpen(true)}
                                                className="px-4 py-1.5 bg-[#D9381E] hover:bg-[#b92b14] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-red-900/20 border border-white/10 transition-all active:scale-95"
                                            >
                                                Top Up
                                            </button>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px w-full bg-white/5"></div>

                                        {/* Row 2: VP Points */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">P. VP</span>
                                                <div className="text-xl font-black text-[#C9A34E] flex items-baseline gap-1">
                                                    <span className="text-xs text-[#C9A34E]/60 font-bold">VP</span>
                                                    {wallet.points?.toLocaleString()}
                                                </div>
                                            </div>
                                            <button className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/10 transition-all active:scale-95">
                                                Transfer
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 max-w-full px-2">
                                    {intel.tags?.map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-[#C9A34E]/10 text-[#C9A34E] text-[10px] font-bold uppercase tracking-wider rounded-lg border border-[#C9A34E]/20 whitespace-nowrap shadow-sm">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full mb-4 p-3 bg-[#162A47] rounded-xl border border-white/10 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {nextTier ? `Next: ${nextTier.label.split(' ')[0]}` : 'Tier: Elite (Max)'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-0.5 px-0.5 uppercase tracking-tighter">
                                    <span>Spend</span>
                                    <span>{totalSpend.toLocaleString()} / {nextTier?.threshold?.toLocaleString() || 'MAX'}</span>
                                </div>
                                <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-400 to-amber-200 rounded-full transition-all duration-1000" style={{ width: `${spendProgress}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sales Agent & Status Editor */}
                    <div className="bg-[#162A47]/80 rounded-[1.5rem] shadow-lg border border-white/10 overflow-hidden relative group backdrop-blur-md">
                        <div className="px-5 pt-4 pb-4 border-t border-white/5 bg-white/5">
                            <p className="text-[9px] font-black text-[#C9A34E] uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fas fa-user-tie"></i> Sales Assignment
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[8px] font-bold text-white/30 uppercase block mb-1">Assigned Agent</label>
                                    <input
                                        type="text"
                                        value={editAgent}
                                        onChange={(e) => setEditAgent(e.target.value)}
                                        placeholder="Sales Representative Name"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C9A34E]/50 transition-all font-inter"
                                    />
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold text-white/30 uppercase block mb-1">Follow-up Status</label>
                                    <select
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C9A34E]/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="New Lead">New Lead</option>
                                        <option value="Interested">Interested</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="No Answer">No Answer</option>
                                        <option value="Lost">Lost</option>
                                        <option value="Won / Enrolled">Won / Enrolled</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    className="w-full bg-[#C9A34E] text-[#0A1A2F] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <i className="fas fa-spinner animate-spin text-[10px]"></i> : <i className="fas fa-save text-[10px]"></i>}
                                    {isSaving ? 'SAVING...' : 'UPDATE SALES INFO'}
                                </button>

                                <button
                                    onClick={() => onGoToChat && onGoToChat(customer)}
                                    className="w-full bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/30 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#1877F2]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="fab fa-facebook-messenger"></i>
                                    OPEN FACEBOOK CHAT
                                </button>
                            </div>
                        </div>

                        <div className="px-[15px] pt-4 pb-6">
                            <div className="w-full bg-black/20 rounded-xl p-4 space-y-2.5">
                                {[
                                    { icon: 'fa-envelope', label: 'E-mail', val: contact.email || profile.email || '-', color: 'text-blue-400' },
                                    { icon: 'fa-phone', label: 'Phone', val: contact.phone_primary || profile.phone_primary || '-', color: 'text-green-400' },
                                    { icon: 'fa-line', label: 'Line ID', val: contact.line_id || '-', color: 'text-emerald-400' },
                                    { icon: 'fa-user-tie', label: 'Current Agent', val: profile.agent || 'Unassigned', color: 'text-[#C9A34E]' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 border border-white/5">
                                            <i className={`fas ${item.icon} text-[10px]`}></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mb-0">{item.label}</p>
                                            <p className="text-[11px] font-bold text-[#F8F8F6] truncate">{item.val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-9 space-y-6">
                    <IntelligencePanel intel={intel} profile={profile} />
                    <InventoryPanel
                        inventory={inventory}
                        searchTerm={searchTerm}
                        currentUser={currentUser}
                        onUpdateInventory={(newInventory, redeemedItem) => {
                            let updatedCustomer = { ...customer, inventory: newInventory };
                            if (redeemedItem) {
                                const logEntry = {
                                    id: `RED-${Date.now()}`,
                                    date: new Date().toISOString(),
                                    type: 'REDEEM',
                                    summary: `Redeemed ${redeemedItem.type}: ${redeemedItem.name}`,
                                    details: {
                                        item_id: redeemedItem.coupon_id || redeemedItem.course_id || redeemedItem.bundle_id,
                                        name: redeemedItem.name,
                                        timestamp: new Date().toLocaleTimeString()
                                    }
                                };
                                updatedCustomer.timeline = [logEntry, ...(customer.timeline || [])];
                            }
                            onUpdateInventory(updatedCustomer);
                        }}
                    />
                    <Timeline timeline={timeline} />
                </div>
            </div>

            <SlipVerificationModal
                isOpen={isTopUpModalOpen}
                onClose={() => setIsTopUpModalOpen(false)}
                onVerifySuccess={(data) => {
                    const topUpAmount = data.amount;
                    let updatedCustomer = { ...customer };

                    // Update Wallet
                    updatedCustomer.wallet = {
                        ...wallet,
                        balance: (wallet.balance || 0) + topUpAmount
                    };

                    // Add Timeline Entry
                    const logEntry = {
                        id: `TOP-${Date.now()}`,
                        date: new Date().toISOString(),
                        type: 'TOPUP',
                        summary: `Wallet Top-up: ฿${topUpAmount.toLocaleString()}`,
                        details: {
                            amount: topUpAmount,
                            bank: data.bank,
                            transaction_id: data.transaction_id,
                            timestamp: new Date().toLocaleTimeString()
                        }
                    };
                    updatedCustomer.timeline = [logEntry, ...(customer.timeline || [])];

                    onUpdateInventory(updatedCustomer);
                }}
            />
        </div>
    );
}
