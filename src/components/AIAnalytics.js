'use client';

import React, { useState, useEffect } from 'react';

const PURCHASE_TYPES = ['purchase'];
const MESSAGE_TYPES = ['onsite_conversion.messaging_conversation_started_7d'];

export default function AIAnalytics({ campaigns }) {
    const [report, setReport] = useState(null);

    useEffect(() => {
        if (!campaigns || campaigns.length === 0) {
            setReport(null);
            return;
        }
        analyzeData(campaigns);
    }, [campaigns]);

    const getActionSum = (item, types) => {
        if (!item.actions) return 0;
        return item.actions
            .filter(a => types.includes(a.action_type))
            .reduce((sum, a) => sum + parseInt(a.value || 0), 0);
    };

    const getActionValueSum = (item, types) => {
        if (!item.action_values) return 0;
        return item.action_values
            .filter(a => types.includes(a.action_type))
            .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);
    };

    const analyzeData = (data) => {
        // 1. Account-Wide Stats
        const totalSpend = data.reduce((s, c) => s + (c.spend || 0), 0);
        const totalRevenue = data.reduce((s, c) => s + getActionValueSum(c, PURCHASE_TYPES), 0);
        const totalPurchases = data.reduce((s, c) => s + getActionSum(c, PURCHASE_TYPES), 0);
        const totalMessages = data.reduce((s, c) => s + getActionSum(c, MESSAGE_TYPES), 0);
        const accountROAS = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;

        // 2. Identify "Bleeding" or "High Potential" Campaign
        const activeCampaigns = data.filter(c => c.status === 'ACTIVE');
        if (activeCampaigns.length === 0) {
            setReport({ type: 'account_only', totalSpend, totalRevenue, accountROAS, totalPurchases, totalMessages });
            return;
        }

        const scoredCampaigns = activeCampaigns.map(c => {
            const spend = c.spend || 0;
            const revenue = getActionValueSum(c, PURCHASE_TYPES);
            const roas = spend > 0 ? (revenue / spend) : 0;
            const ctr = c.ctr || 0;

            // Urgency score: Higher spend + Lower ROAS = More urgent
            let score = spend;
            if (roas < 1.0) score *= 3;
            else if (roas < 2.0) score *= 1.5;
            if (ctr < 0.5) score *= 1.5;

            return { ...c, roas, revenue, urgencyScore: score };
        });

        const target = scoredCampaigns.sort((a, b) => b.urgencyScore - a.urgencyScore)[0];

        // 3. Deep Dive Analysis for Target Campaign
        const spend = target.spend || 0;
        const revenue = target.revenue;
        const roas = target.roas;
        const ctr = target.ctr || 0;
        const messages = getActionSum(target, MESSAGE_TYPES);
        const purchases = getActionSum(target, PURCHASE_TYPES);
        const impressions = target.impressions || 0;
        const clicks = target.clicks || 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const costPerMsg = messages > 0 ? (spend / messages) : 0;

        const badPoints = [];
        const goodPoints = [];
        let summary = '';
        let advice = '';

        if (ctr < 0.8) badPoints.push(`คนเห็นแล้วผ่านเลย (CTR ต่ำ ${ctr.toFixed(2)}%): คอนเทนต์ยังไม่หยุดนิ้วคนดู ควรเปลี่ยนรูปหรือพาดหัวใหม่`);
        if (costPerMsg > 150) badPoints.push(`ทักแชทแพงมาก (฿${costPerMsg.toFixed(0)}): ต้นทุนต่อแชทสูงเกินไป ทำให้กำไรบาง`);
        if (messages > 5 && purchases === 0) badPoints.push(`ทักเยอะแต่ไม่ซื้อ: มีคนทัก ${messages} คน แต่ยังปิดยอดไม่ได้ เช็กแอดมินหรือราคาด่วน`);
        if (roas < 1.5 && spend > 500) badPoints.push(`ยอดขายไม่เข้าเป้า (ROAS ${roas.toFixed(2)}x): แคมเปญนี้กินงบแต่ทำกำไรไม่ได้`);

        if (cpm < 150) goodPoints.push(`คนเห็นทั่วถึง (CPM ฿${cpm.toFixed(0)}): Facebook ส่งแอดให้คนเห็นได้เยอะในราคาประหยัด`);
        if (ctr > 1.5) goodPoints.push(`คอนเทนต์น่าสนใจ (CTR ${ctr.toFixed(2)}%): คนหยุดดูและกดแอดเยอะมาก แสดงว่าภาพดีแล้ว`);
        if (roas > 3) goodPoints.push(`ทำกำไรได้ดีมาก (ROAS ${roas.toFixed(2)}x): แคมเปญนี้เป็นนางฟ้า ควรพิจารณาเพิ่มงบ`);

        if (badPoints.length >= 2) summary = 'แคมเปญนี้มีจุดรั่วไหลที่ต้องรีบอุดด่วน';
        else if (goodPoints.length >= 2) summary = 'ผลลัพธ์ค่อนข้างน่าพอใจ มีโอกาสขยายผลต่อได้';
        else summary = 'ประสิทธิภาพอยู่ในระดับปานกลาง ต้องปรับปรุงบางจุดเพื่อให้คุ้มค่ากว่านี้';

        if (roas < 1.2 && spend > 1000) advice = 'ปิดเพื่อหยุดเลือด: ยอดขายน้อยกว่าค่าแอดเกินไป แนะนำให้ปิดและทดลองกลุ่มเป้าหมายใหม่';
        else if (ctr < 0.8) advice = 'เปลี่ยน Creative ด่วน: ภาพหรือวิดีโอนี้คนไม่สนใจแล้ว ลองทำแบบใหม่ที่ต่างจากเดิม';
        else if (roas > 2.5) advice = 'อัดงบเพิ่ม (Ready to Scale): กำไรดีแล้ว ค่อยๆ เพิ่มงบ 20% ทุกๆ 2-3 วันเพื่อรักษาระดับกำไร';
        else advice = 'ปรับแต่งกลุ่มเป้าหมาย (Optimize): ลองไล่ดูว่าเพศหรืออายุไหนทำผลงานได้ดี แล้วบีบบบให้เจาะจงมากขึ้น';

        setReport({
            type: 'deep_dive',
            campaignName: target.name,
            summary,
            badPoints,
            goodPoints,
            advice,
            spend,
            revenue,
            roas,
            accountSummary: {
                totalSpend,
                totalRevenue,
                accountROAS
            }
        });
    };

    if (!report) return null;

    return (
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-white/10 rounded-[2.5rem] p-8 animate-fade-in mb-8 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 relative">
                            <i className="fas fa-brain text-white text-3xl"></i>
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#0F172A] animate-pulse"></div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">AI Marketing Intelligence</h2>
                            <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">
                                <i className="fas fa-bolt text-amber-400 mr-2"></i> Real-time Facebook Data Analysis
                            </p>
                        </div>
                    </div>

                    {/* Account Overview Tag */}
                    <div className="hidden lg:flex gap-4">
                        <div className="text-right border-r border-white/10 pr-4">
                            <p className="text-[10px] font-black text-white/30 uppercase">ACC. ROAS</p>
                            <p className={`text-lg font-black ${(report.accountSummary?.accountROAS || report.accountROAS || 0) >= 2 ? 'text-emerald-400' : 'text-white'}`}>
                                {(report.accountSummary?.accountROAS ?? report.accountROAS ?? 0).toFixed(2)}x
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-white/30 uppercase">TOTAL REVENUE</p>
                            <p className="text-lg font-black text-[#C9A34E]">
                                ฿{(report.accountSummary ? report.accountSummary.totalRevenue : report.totalRevenue).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {/* 1. Overview */}
                    <div className="bg-white/5 border border-white/5 rounded-[2rem] p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <h3 className="text-blue-400 font-black text-xs uppercase tracking-widest">แคมเปญที่ต้องโฟกัส: {report.campaignName || 'รวมท้งบัญชี'}</h3>
                        </div>
                        <p className="text-2xl lg:text-3xl font-black text-white leading-tight">"{report.summary}"</p>

                        <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                                <span className="text-white/30 block text-[9px] font-black uppercase tracking-wider mb-1">งบที่ใช้ไป</span>
                                <span className="text-xl font-black text-white">฿{report.spend?.toLocaleString() || report.totalSpend?.toLocaleString()}</span>
                            </div>
                            <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                                <span className="text-white/30 block text-[9px] font-black uppercase tracking-wider mb-1">ยอดขาย</span>
                                <span className="text-xl font-black text-emerald-400">฿{report.revenue?.toLocaleString() || report.totalRevenue?.toLocaleString()}</span>
                            </div>
                            <div className="bg-black/20 p-5 rounded-2xl border border-white/5 hidden lg:block">
                                <span className="text-white/30 block text-[9px] font-black uppercase tracking-wider mb-1">ROAS</span>
                                <span className={`text-xl font-black ${(report.roas || report.accountROAS || 0) >= 2 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(report.roas || report.accountROAS || 0).toFixed(2)}x
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 2. Urgent / Bad Points */}
                        {report.badPoints?.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-rose-400 font-black text-xs uppercase tracking-widest pl-2 flex items-center gap-2">
                                    <i className="fas fa-fire-alt"></i> จุดที่ต้องแก้ไข
                                </h3>
                                <div className="space-y-3">
                                    {report.badPoints.map((point, i) => {
                                        const [title, desc] = point.split(':');
                                        return (
                                            <div key={i} className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl p-5 transition-all group">
                                                <div className="flex gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-110 transition-transform">
                                                        <i className="fas fa-times-circle text-xs"></i>
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-black text-sm mb-1">{title}</p>
                                                        <p className="text-xs text-white/40 font-medium leading-relaxed">{desc}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 3. Strength / Good Points */}
                        {report.goodPoints?.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-emerald-400 font-black text-xs uppercase tracking-widest pl-2 flex items-center gap-2">
                                    <i className="fas fa-medal"></i> จุดแข็งที่ทำได้ดี
                                </h3>
                                <div className="space-y-3">
                                    {report.goodPoints.map((point, i) => {
                                        const [title, desc] = point.split(':');
                                        return (
                                            <div key={i} className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl p-5 transition-all group">
                                                <div className="flex gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
                                                        <i className="fas fa-check-circle text-xs"></i>
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-black text-sm mb-1">{title}</p>
                                                        <p className="text-xs text-white/40 font-medium leading-relaxed">{desc}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Recommendation */}
                    {report.advice && (
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-[#1E293B] border border-white/10 rounded-3xl p-8 overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                                    <div className="flex items-start gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white text-xl shadow-xl shadow-indigo-500/40 shrink-0">
                                            <i className="fas fa-lightbulb"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-indigo-400 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                                Next Best Action
                                            </h3>
                                            <p className="text-white font-bold text-xl lg:text-2xl leading-tight">{report.advice}</p>
                                            <p className="text-white/30 text-xs font-bold mt-2 italic">ควรปรับเปลี่ยนตามคำแนะนำเพื่อให้ได้ยอดที่สูงขึ้นครับ!</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                                        className="bg-white text-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-400 hover:text-white transition-all whitespace-nowrap"
                                    >
                                        ดูรายละเอียดเพิ่มเติม
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
