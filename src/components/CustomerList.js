'use client';

import React, { useState } from 'react';

export default function CustomerList({ customers, onSelectCustomer }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCustomers = customers.filter(c => {
        const fullContent = `${c.profile?.first_name} ${c.profile?.last_name} ${c.profile?.nick_name} ${c.profile?.member_id} ${c.customer_id}`.toLowerCase();
        return fullContent.includes(searchTerm.toLowerCase());
    });

    const tierConfig = {
        L1: { label: 'General', color: 'bg-slate-400/10 text-slate-400 border-slate-400/20', icon: 'fa-certificate' },
        L2: { label: 'Silver', color: 'bg-zinc-300/10 text-zinc-300 border-zinc-300/20', icon: 'fa-medal' },
        L3: { label: 'Gold', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20', icon: 'fa-crown' },
        L4: { label: 'Platinum', color: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20', icon: 'fa-gem' },
        L5: { label: 'Elite', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: 'fa-fire' }
    };

    const getTier = (c) => {
        const totalSpend = c.intelligence?.metrics?.total_spend || 0;
        const learningHours = c.intelligence?.metrics?.total_learning_hours || 0;
        const internship = c.intelligence?.metrics?.internship_completed || false;

        if (totalSpend >= 250000 && learningHours >= 100 && internship) return tierConfig.L5;
        if (totalSpend >= 125000 && learningHours >= 30) return tierConfig.L4;
        if (totalSpend >= 50000) return tierConfig.L3;
        if (totalSpend >= 15000) return tierConfig.L2;
        return tierConfig.L1;
    };

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-[#F8F8F6] tracking-tight mb-2">Customer Directory</h2>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">GLOBAL STUDENT 360 OVERVIEW</p>
                </div>

                {/* Search Bar */}
                <div className="w-full md:w-96 relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <i className="fas fa-search text-[#C9A34E] text-sm group-focus-within:scale-110 transition-transform"></i>
                    </div>
                    <input
                        type="text"
                        placeholder="Search name, nickname or Member ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#C9A34E]/50 focus:border-[#C9A34E] transition-all shadow-2xl"
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Student Profile</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Membership</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Financials</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Engagement</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Agent / Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Lifecycle</th>
                                <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredCustomers.map((c) => {
                                const tier = getTier(c);
                                return (
                                    <tr key={c.customer_id} className="hover:bg-white/5 transition-all group cursor-pointer" onClick={() => onSelectCustomer(c)}>
                                        {/* ... existing columns ... */}

                                        {/* Agent & Status */}
                                        <td className="px-8 py-6">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-user-tie text-[10px] text-[#C9A34E]"></i>
                                                    <span className="text-sm font-black text-white">{c.profile?.agent || 'Unassigned'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 pl-4">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'Won / Enrolled' ? 'bg-green-500' : 'bg-[#C9A34E] animte-pulse'}`}></div>
                                                    <span className="text-[10px] font-bold text-white/50">{c.status || 'New Lead'}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Lifecycle */}
                                        <td className="px-8 py-6">
                                            <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-black text-white/40 uppercase tracking-widest group-hover:bg-[#C9A34E]/10 group-hover:text-[#C9A34E] group-hover:border-[#C9A34E]/20 transition-all">
                                                {c.profile?.lifecycle_stage || 'Unknown'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-8 py-6 text-right">
                                            <button className="w-10 h-10 rounded-xl bg-white/5 text-white/40 flex items-center justify-center hover:bg-[#C9A34E] hover:text-[#0A1A2F] hover:scale-105 active:scale-95 transition-all shadow-xl">
                                                <i className="fas fa-chevron-right text-xs"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
