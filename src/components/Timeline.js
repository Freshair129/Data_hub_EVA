'use client';

export default function Timeline({ timeline }) {
    if (!timeline || timeline.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-history text-slate-200 text-3xl"></i>
                </div>
                <h4 className="text-slate-900 font-bold mb-2">No activity recorded yet</h4>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">Customer interactions and purchase history will appear here once available.</p>
            </div>
        );
    }

    // Sort timeline by date descending
    const sortedTimeline = [...timeline].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="bg-[#162A47]/80 backdrop-blur-md rounded-[1.5rem] p-5 shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <i className="fas fa-stream text-indigo-500 text-sm"></i>
                    </div>
                    <h3 className="font-extrabold text-white text-lg tracking-tight">Activity Log</h3>
                </div>
                <div className="flex items-center gap-2 bg-[#0A1A2F]/50 px-2.5 py-1 rounded-full border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        {timeline.length} Events
                    </span>
                </div>
            </div>

            <div className="relative">
                {/* Visual Line */}
                <div className="absolute left-5 top-0 bottom-0 w-1 bg-white/5 rounded-full"></div>

                <div className="space-y-6 relative z-10">
                    {sortedTimeline.map((item, idx) => {
                        const date = new Date(item.date);
                        const formattedDate = date.toLocaleDateString('th-TH', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit'
                        });

                        // Premium Icon Strategy
                        const iconMap = {
                            'ORDER': { icon: 'fa-shopping-cart', color: 'bg-orange-500 shadow-orange-100', text: 'text-orange-600', label: 'Purchase' },
                            'REDEEM': { icon: 'fa-ticket-alt', color: 'bg-rose-500 shadow-rose-100', text: 'text-rose-600', label: 'Redemption' },
                            'CHAT': { icon: 'fa-comment-alt', color: 'bg-indigo-500 shadow-indigo-100', text: 'text-indigo-600', label: 'Inquiry' },
                            'CALL': { icon: 'fa-phone-alt', color: 'bg-green-500 shadow-green-100', text: 'text-green-600', label: 'Contact' },
                            'TOPUP': { icon: 'fa-wallet', color: 'bg-emerald-500 shadow-emerald-100', text: 'text-emerald-600', label: 'Top-up' },
                            'EMAIL': { icon: 'fa-envelope-open-text', color: 'bg-blue-500 shadow-blue-100', text: 'text-blue-600', label: 'Direct Mail' }
                        };

                        const typeInfo = iconMap[item.type] || { icon: 'fa-dot-circle', color: 'bg-slate-400 shadow-slate-100', text: 'text-slate-600', label: item.type };

                        return (
                            <div key={idx} className="relative pl-12 group">
                                {/* Timeline Marker */}
                                <div className={`absolute left-1.5 w-8 h-8 ${typeInfo.color} rounded-xl shadow-lg border-2 border-[#162A47] flex items-center justify-center z-10 group-hover:scale-110 transition-transform duration-500`}>
                                    <i className={`fas ${typeInfo.icon} text-white text-[10px]`}></i>
                                </div>

                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{formattedDate}</span>
                                        <div className="h-px flex-1 bg-slate-50"></div>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${typeInfo.text} bg-slate-50 border border-slate-100/50`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>
                                    <h4 className="font-extrabold text-white text-base leading-tight mb-2 group-hover:text-indigo-400 transition-colors">
                                        {item.summary}
                                    </h4>

                                    {item.details && (
                                        <div className="p-3 bg-[#0A1A2F]/30 rounded-xl border border-white/5 group-hover:border-indigo-500/30 transition-all duration-500">
                                            {item.details.content && <p className="text-slate-400 text-xs leading-relaxed mb-2">{item.details.content}</p>}
                                            <div className="flex flex-wrap items-center gap-4">
                                                {item.details.amount && (
                                                    <div className="flex items-center gap-2">
                                                        <i className="fas fa-tag text-[10px] text-slate-400"></i>
                                                        <span className="text-sm font-black text-slate-900 italic">฿{item.details.amount.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {item.details.agent && (
                                                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                                        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center">
                                                            <i className="fas fa-user text-[8px] text-slate-400"></i>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500">{item.details.agent}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
