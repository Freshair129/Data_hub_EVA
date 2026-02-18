'use client';

export default function Settings() {
    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h2 className="text-3xl font-black text-[#F8F8F6] tracking-tight mb-2">System Settings</h2>
                <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">CONFIGURATION & PARAMETERS</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Settings */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
                            <i className="fas fa-user-cog"></i>
                        </div>
                        <h3 className="font-black text-white text-lg tracking-tight">Admin Profile</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Display Name</label>
                            <input
                                type="text"
                                defaultValue="Admin User"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-[#C9A34E] transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Control Access Level</label>
                            <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-[#C9A34E] appearance-none transition-colors">
                                <option>System Controller</option>
                                <option>Sales Manager</option>
                                <option>Inventory Specialist</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Store Settings */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center border border-orange-500/30">
                            <i className="fas fa-store-alt"></i>
                        </div>
                        <h3 className="font-black text-white text-lg tracking-tight">Store Preferences</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div>
                                <p className="text-sm font-bold text-white">Maintenance Mode</p>
                                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-0.5">Pause all public transactions</p>
                            </div>
                            <div className="w-12 h-6 bg-white/10 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-4 h-4 bg-white/40 rounded-full"></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div>
                                <p className="text-sm font-bold text-white">Auto-Inventory Sync</p>
                                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mt-0.5">Real-time credit updates</p>
                            </div>
                            <div className="w-12 h-6 bg-green-500/40 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Branding Accent */}
                <div className="md:col-span-2 bg-gradient-to-r from-[#0A1A2F] to-[#1A2F4F] border border-[#C9A34E]/30 rounded-[2.5rem] p-8 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-[#C9A34E] text-xl tracking-tight mb-2 uppercase italic">Visual Identity Engine</h3>
                        <p className="text-white/40 text-sm font-medium">Currently using <span className="text-[#C9A34E] font-bold">Deep Navy & Champagne Gold</span> premium theme.</p>
                    </div>
                    <button className="bg-[#C9A34E] text-[#0A1A2F] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl">
                        Customize Branding
                    </button>
                </div>
            </div>
        </div>
    );
}
