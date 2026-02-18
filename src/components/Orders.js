'use client';

export default function Orders({ customers }) {
    // Extract orders from customer timelines
    const allOrders = customers.flatMap(c =>
        (c.timeline || [])
            .filter(t => t.type === 'ORDER')
            .map(o => ({
                ...o,
                customerName: c.profile?.nick_name || c.profile?.first_name || 'Unknown',
                customerId: c.customer_id
            }))
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h2 className="text-3xl font-black text-[#F8F8F6] tracking-tight mb-2">Order Management</h2>
                <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">TRANSACTION HISTORY & LOGISTICS</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Date</th>
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Customer</th>
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Order Summary</th>
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Amount</th>
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest">Method</th>
                            <th className="px-8 py-6 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {allOrders.map((order, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                <td className="px-8 py-6">
                                    <p className="text-sm font-medium text-white/80 font-mono tracking-tighter">
                                        {order.date?.split('T')[0]}
                                    </p>
                                    <p className="text-[10px] text-white/20 font-mono uppercase mt-0.5">
                                        {order.date?.split('T')[1]?.substring(0, 5)}
                                    </p>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#C9A34E]/20 text-[#C9A34E] flex items-center justify-center text-[10px] font-black border border-[#C9A34E]/30">
                                            {order.customerName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white group-hover:text-[#C9A34E] transition-colors">{order.customerName}</p>
                                            <p className="text-[10px] text-white/30 font-bold tracking-widest">{order.customerId}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-sm font-bold text-white/90">{order.summary}</p>
                                    <p className="text-[10px] text-white/40 mt-1">Ref ID: {order.id}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-sm font-black text-[#C9A34E]">
                                        ฿{(order.details?.amount || 0).toLocaleString()}
                                    </p>
                                </td>
                                <td className="px-8 py-6">
                                    <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black text-white/40 uppercase tracking-widest">
                                        {order.details?.payment_method || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${order.inventory_status === 'Pending Verification'
                                        ? 'bg-orange-500/10 border border-orange-500/20 text-orange-500 shadow-orange-500/5'
                                        : 'bg-green-500/10 border border-green-500/20 text-green-500 shadow-green-500/5'
                                        }`}>
                                        {order.inventory_status || 'Completed'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
