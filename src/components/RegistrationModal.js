'use client';

import { useState, useEffect } from 'react';

export default function RegistrationModal({ isOpen, onClose, onRegister, nextId, nextMemberId }) {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        nick_name: '',
        email: '',
        phone: '',
        birthday: '',
        occupation: '',
        line_id: '',
        facebook: '',
        lead_channel: 'Facebook Ad',
        membership_tier: 'GENERAL',
        agent_name: 'Admin',
        attribution_campaign_id: '',
        attribution_adset_id: ''
    });
    const [availableCampaigns, setAvailableCampaigns] = useState([]);
    const [availableAdsets, setAvailableAdsets] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetch('/api/marketing/campaigns')
                .then(res => res.json())
                .then(data => {
                    if (data.success) setAvailableCampaigns(data.data || []);
                })
                .catch(err => console.error('Error fetching campaigns:', err));

            fetch('/api/marketing/adsets')
                .then(res => res.json())
                .then(data => {
                    if (data.success) setAvailableAdsets(data.data || []);
                })
                .catch(err => console.error('Error fetching adsets:', err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onRegister({
            customer_id: nextId,
            profile: {
                member_id: nextMemberId,
                first_name: formData.first_name,
                last_name: formData.last_name,
                nick_name: formData.nick_name,
                birthday: formData.birthday,
                job_title: formData.occupation,
                status: 'Active',
                membership_tier: formData.membership_tier,
                lifecycle_stage: 'New Lead',
                agent: formData.agent_name
            },
            contact_info: {
                email: formData.email,
                phone_primary: formData.phone,
                line_id: formData.line_id,
                facebook: formData.facebook
            },
            intelligence: {
                metrics: { total_spend: 0, total_learning_hours: 0, total_point: 0 },
                tags: ['New Customer', 'Registration Pending', formData.lead_channel],
                attribution: {
                    campaign_id: formData.attribution_campaign_id,
                    adset_id: formData.attribution_adset_id,
                    source: formData.lead_channel
                }
            },
            inventory: { coupons: [], learning_courses: [] },
            wallet: { balance: 0, points: 0, currency: 'THB' },
            timeline: [{
                id: `REG-${Date.now()}`,
                date: new Date().toISOString(),
                type: 'SYSTEM',
                summary: 'Customer Registered',
                details: {
                    content: 'New customer account created via registration portal.',
                    member_id: nextMemberId,
                    lead_source: formData.lead_channel,
                    campaign_id: formData.attribution_campaign_id
                }
            }]
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-[#0A1A2F] p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A34E]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[#C9A34E] text-[10px] font-black uppercase tracking-[0.2em] mb-2">SYSTEM PORTAL</p>
                            <h2 className="text-3xl font-black tracking-tight">Register New Customer</h2>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {/* System IDs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Member ID</label>
                            <div className="w-full bg-[#0A1A2F] border border-[#0A1A2F] rounded-2xl px-5 py-3 text-[#C9A34E] font-mono font-bold text-sm shadow-inner">
                                {nextMemberId}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Customer ID</label>
                            <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3 text-slate-400 font-mono font-bold text-sm">
                                {nextId}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">First Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.first_name}
                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.last_name}
                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nickname</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.nick_name}
                                onChange={e => setFormData({ ...formData, nick_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Birthday</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.birthday}
                                onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Occupation</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.occupation}
                                onChange={e => setFormData({ ...formData, occupation: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                            <input
                                required
                                type="email"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Phone</label>
                            <input
                                required
                                type="tel"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Line ID</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.line_id}
                                onChange={e => setFormData({ ...formData, line_id: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Facebook</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.facebook}
                                onChange={e => setFormData({ ...formData, facebook: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lead Channel</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors appearance-none"
                                value={formData.lead_channel}
                                onChange={e => setFormData({ ...formData, lead_channel: e.target.value })}
                            >
                                <option value="Facebook Ad">Facebook Ad</option>
                                <option value="Tiktok Ad">Tiktok Ad</option>
                                <option value="Direct">Direct / Walk-in</option>
                                <option value="Referral">Referral</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Responsible Agent</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors"
                                value={formData.agent_name}
                                onChange={e => setFormData({ ...formData, agent_name: e.target.value })}
                                placeholder="E.g. Admin, Sales-A"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Campaign (Marketing)</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors appearance-none"
                                value={formData.attribution_campaign_id}
                                onChange={e => setFormData({ ...formData, attribution_campaign_id: e.target.value })}
                            >
                                <option value="">-- No Campaign --</option>
                                {availableCampaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ad Set (Marketing)</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-800 font-bold outline-none focus:border-[#C9A34E] transition-colors appearance-none"
                                value={formData.attribution_adset_id}
                                onChange={e => setFormData({ ...formData, attribution_adset_id: e.target.value })}
                            >
                                <option value="">-- No Ad Set --</option>
                                {availableAdsets.filter(a => !formData.attribution_campaign_id || a.campaign_id === formData.attribution_campaign_id).map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="w-full bg-[#0A1A2F] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-transform active:scale-95">
                            COMPLETE REGISTRATION
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
