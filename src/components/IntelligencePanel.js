'use client';

import React, { useState, useEffect } from 'react';

export default function IntelligencePanel({ intel, profile, products = [] }) {
    if (!intel) return null;

    const [campaigns, setCampaigns] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);

    useEffect(() => {
        const fetchCampaigns = async () => {
            setLoadingCampaigns(true);
            try {
                const res = await fetch('/api/marketing/campaigns');
                const result = await res.json();
                if (result.success) {
                    setCampaigns(result.data.slice(0, 5)); // Show top 5
                }
            } catch (err) {
                console.error('Failed to fetch campaigns:', err);
            } finally {
                setLoadingCampaigns(false);
            }
        };
        fetchCampaigns();
    }, []);

    const marketing = profile?.marketing_attribution || {};
    const social = profile?.social_profiles?.facebook || {};

    const riskLevel = intel.metrics?.churn_risk_level || 'Low';
    const riskPercent = riskLevel === 'Low' ? 15 : riskLevel === 'Medium' ? 50 : 85;
    const riskColor = riskLevel === 'Low' ? 'text-green-500' : riskLevel === 'Medium' ? 'text-amber-500' : 'text-red-500';
    const riskBg = riskLevel === 'Low' ? 'bg-green-100' : riskLevel === 'Medium' ? 'bg-amber-100' : 'bg-red-100';

    return (
        <div className="grid grid-cols-1 gap-6">
            {/* Consolidated AI Insights & Pain Points Card - Compact */}
            <div className="bg-[#162A47]/80 backdrop-blur-md rounded-[1.5rem] p-5 shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shadow-sm">
                            <i className="fas fa-brain text-orange-500 text-sm"></i>
                        </div>
                        <h3 className="font-extrabold text-white text-lg tracking-tight">AI Engagement Insights</h3>
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-[#0A1A2F]/50 px-2.5 py-1 rounded-full border border-white/5">
                        V-Insight
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5">
                    {/* Customer Goal - Compact */}
                    <div className="md:col-span-8 p-4 bg-[#162A47] rounded-xl border border-white/10 shadow-inner group/goal hover:bg-[#1F3A5F] transition-colors">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-2">Core Learning Objective</p>
                        <p className="text-white font-bold text-base leading-snug italic">
                            &quot;{intel.customer_goal_th || intel.customer_goal || '-'}&quot;
                        </p>
                    </div>

                    {/* Churn Risk - Compact */}
                    <div className="md:col-span-4 p-4 bg-[#162A47] rounded-xl border border-white/10 shadow-inner flex flex-col justify-center items-center text-center group/risk hover:bg-[#1F3A5F] transition-colors">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-2">Churn Probability</p>
                        <div className={`text-3xl font-black mb-1 ${riskColor} drop-shadow-sm`}>{riskPercent}%</div>
                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${riskBg} ${riskColor} border border-current/10`}>
                            {riskLevel}
                        </div>
                    </div>
                </div>

                {/* Pain Points - Compact */}
                {(intel.pain_points_th?.length > 0 || intel.pain_points?.length > 0) && (
                    <div className="mb-5 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-2 mb-3">
                            <i className="fas fa-exclamation-triangle text-red-400 text-[10px]"></i>
                            <h4 className="text-[8px] font-black text-red-500 uppercase tracking-widest">Active Pain Points</h4>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(intel.pain_points_th || intel.pain_points).map((pain, i) => (
                                <div key={i} className="px-2.5 py-1.5 bg-[#0A1A2F]/40 text-slate-300 text-[10px] font-bold rounded-lg border border-red-500/10 flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-red-500"></div>
                                    {pain}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Marketing & Social Attribution Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
                    <div className="p-6 bg-indigo-50/10 rounded-2xl border border-white/10 flex flex-col justify-between backdrop-blur-md">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <i className="fas fa-ad text-indigo-400 text-xs"></i>
                                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Marketing Attribution</h4>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Source</p>
                                    <p className="text-sm font-black text-white">
                                        {marketing.source || 'Direct / Unknown'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Campaign</p>
                                        <p className="text-[10px] font-bold text-slate-300 truncate">{marketing.campaign || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Conversion</p>
                                        <p className={`text-[10px] font-bold ${marketing.is_converted ? 'text-green-400' : 'text-amber-400'}`}>
                                            {marketing.is_converted ? 'PROFITABLE' : 'PENDING'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-blue-50/10 rounded-2xl border border-white/10 flex flex-col justify-between backdrop-blur-md">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <i className="fab fa-facebook text-blue-400 text-xs"></i>
                                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Social Engagement</h4>
                            </div>
                            <div className="flex items-end justify-between">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Handle</p>
                                    <h4 className="text-sm font-black text-blue-400 truncate max-w-[120px]">@{social.handle || 'not_linked'}</h4>
                                </div>
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-900/40 border-2 border-white/20 flex items-center justify-center">
                                        <i className="fas fa-thumbs-up text-[8px] text-blue-400"></i>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-blue-900/40 border-2 border-white/20 flex items-center justify-center">
                                        <i className="fas fa-comment text-[8px] text-blue-400"></i>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-blue-900/40 border-2 border-white/20 flex items-center justify-center">
                                        <i className="fas fa-share text-[8px] text-blue-400"></i>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[9px] font-medium text-slate-400 mt-4 italic">
                                {social.last_engagement ? `Last active: ${new Date(social.last_engagement).toLocaleDateString()}` : "No recent activity recorded"}
                            </p>
                        </div>
                    </div>
                </div>


                {/* Commercial Intent - New Section */}
                {profile?.intelligence?.attribution?.smart_detected_ad && (
                    <div className="mb-8 p-6 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 transform group-hover:scale-110 transition-transform">
                            <i className="fas fa-shopping-cart text-7xl text-amber-500"></i>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <i className="fas fa-search-dollar text-amber-500 text-xs"></i>
                                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Commercial Intent Analysis</h4>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Detected Interest</p>
                                    <h5 className="text-white font-black text-lg mb-1">{profile.intelligence.attribution.smart_detected_ad.name}</h5>
                                    <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                        Matching this customer against your current store catalog based on ad conversion data.
                                    </p>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Suggested Products</p>
                                    {products.filter(p =>
                                        profile.intelligence.attribution.smart_detected_ad.name.toLowerCase().includes(p.name.replace('หลักสูตร ', '').substring(0, 10).toLowerCase()) ||
                                        (profile.intelligence.attribution.smart_detected_ad.name.includes('Chinese') && p.name.includes('จีน'))
                                    ).slice(0, 2).map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 text-[10px]">
                                                    <i className="fas fa-star"></i>
                                                </div>
                                                <span className="text-[10px] font-black text-white">{p.name}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-amber-400">฿{p.price?.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {products.filter(p =>
                                        profile.intelligence.attribution.smart_detected_ad.name.toLowerCase().includes(p.name.replace('หลักสูตร ', '').substring(0, 10).toLowerCase()) ||
                                        (profile.intelligence.attribution.smart_detected_ad.name.includes('Chinese') && p.name.includes('จีน'))
                                    ).length === 0 && (
                                            <p className="text-[10px] text-white/20 italic">Searching catalog for best match...</p>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Strategic Recommendation - Compact */}
                <div className="p-8 bg-[#0A1A2F] rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">
                        <i className="fas fa-lightbulb text-[120px] text-white"></i>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="bg-[#C9A34E] text-[#0A1A2F] px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] shadow-md">
                                Recommended Action
                            </span>
                        </div>
                        <h4 className="text-white font-black text-xl mb-2 leading-tight tracking-tight">
                            {intel.next_best_action?.action_th || intel.next_best_action?.action || '-'}
                        </h4>
                        <p className="text-slate-400 text-xs font-bold leading-relaxed max-w-xl">
                            {intel.next_best_action?.reason_th || intel.next_best_action?.reason || ''}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
