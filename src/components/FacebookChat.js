
'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function FacebookChat({ onViewCustomer, initialCustomerId }) {
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [pageId, setPageId] = useState(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isTokenExpired, setIsTokenExpired] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isSyncing, setIsSyncing] = useState(false);
    const [catalog, setCatalog] = useState({ packages: [], products: [] });
    const [employees, setEmployees] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [discoveredProducts, setDiscoveredProducts] = useState([]);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const initialSelectionRef = useRef(false);

    // Initial load: catalog & employees
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const res = await fetch('/api/catalog');
                const data = await res.json();
                setCatalog(data);
            } catch (err) {
                console.error('Failed to load catalog:', err);
            }
        };
        loadCatalog();

        const loadEmployees = async () => {
            try {
                const res = await fetch('/api/employees');
                const data = await res.json();
                setEmployees(data || []);
            } catch (err) { console.error('Failed to load employees:', err); }
        };
        loadEmployees();
    }, []);

    // Polling setup: Fetch conversations every 15s
    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 15000);
        return () => clearInterval(interval);
    }, []);

    // Polling active chat: Fetch messages every 5s if active
    useEffect(() => {
        let interval;
        if (selectedConv) {
            fetchMessages(selectedConv.id);
            interval = setInterval(() => fetchMessages(selectedConv.id), 5000);
        }
        return () => clearInterval(interval);
    }, [selectedConv]);

    // Auto-select conversation based on initialCustomerId
    useEffect(() => {
        if (initialCustomerId && conversations.length > 0 && !initialSelectionRef.current) {
            console.log(`[Chat] Attempting auto-selection for ID: ${initialCustomerId}`);
            const target = conversations.find(c => {
                const fbId = c.customer?.contact_info?.facebook_id || c.customer?.facebook_id;
                return c.id === initialCustomerId || fbId === initialCustomerId;
            });

            if (target) {
                console.log(`[Chat] Target found: ${target.id}`);
                setSelectedConv(target);
                initialSelectionRef.current = true;
            }
        }
    }, [initialCustomerId, conversations]);

    // Auto-Sync Background: Trigger full Facebook lead import every 5 minutes
    useEffect(() => {
        if (isTokenExpired) return;

        const autoSync = async () => {
            console.log('[Chat] Background Auto-Sync Triggered');
            try {
                await fetch('/api/customers');
                await fetchConversations();
            } catch (err) {
                console.error('Auto-sync error:', err);
            }
        };

        const interval = setInterval(autoSync, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isTokenExpired]);

    // Scroll Logic
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom || messages.length <= 20) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const fetchConversations = async () => {
        try {
            const res = await fetch('/api/marketing/chat/conversations');
            const data = await res.json();
            if (data.success) {
                setConversations(Array.isArray(data.data) ? data.data : []);
                setPageId(data.pageId);
                setLoading(false);
                setIsTokenExpired(false);
                setLastUpdated(new Date());
            } else if (data.errorType === 'TOKEN_EXPIRED') {
                setIsTokenExpired(true);
            }
        } catch (err) {
            console.error('Fetch conversations error:', err);
        }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            await fetch('/api/customers');
            await fetchConversations();
            alert('Synchronized successfully!');
        } catch (err) {
            console.error('Sync error:', err);
            alert('Sync failed. Check connection.');
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchMessages = async (convId) => {
        try {
            const res = await fetch(`/api/marketing/chat/messages?conversation_id=${convId}`);
            const data = await res.json();
            if (data.success) {
                setMessages(Array.isArray(data.data) ? data.data : []);
            }
        } catch (err) {
            console.error('Fetch messages error:', err);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedConv) return;

        const text = inputText;
        setInputText('');
        setSending(true);

        try {
            const participants = selectedConv.participants?.data || [];
            const recipient = participants.find(p => p.id !== pageId);
            if (!recipient) throw new Error('Cannot identify recipient');

            const res = await fetch('/api/marketing/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId: recipient.id, message: text })
            });
            const data = await res.json();
            if (data.success) {
                fetchMessages(selectedConv.id);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                alert('Failed to send: ' + (data.error || 'Unknown error'));
                setInputText(text);
            }
        } catch (err) {
            console.error(err);
            alert('Error sending message');
            setInputText(text);
        } finally {
            setSending(false);
        }
    };

    const handleAssignAgent = async (agentName) => {
        if (!selectedConv) return;
        try {
            const res = await fetch('/api/marketing/chat/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: selectedConv.id, agentName })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedConv(prev => ({ ...prev, agent: agentName }));
                setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, agent: agentName } : c));
            } else {
                alert('Assignment failed: ' + data.error);
            }
        } catch (err) { console.error(err); alert('Error assigning agent'); }
    };

    const handleDiscoverProducts = async () => {
        if (!selectedConv) return;
        setIsAnalyzing(true);
        setDiscoveredProducts([]);
        try {
            const res = await fetch(`/api/ai/discover-products?customerId=${selectedConv.id}`);
            const data = await res.json();
            if (data.success) {
                setDiscoveredProducts(data.data || []);
            } else {
                alert('Discovery failed: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Discovery error. Check connection.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAddToStore = async (product) => {
        if (!window.confirm(`Add "${product.product_name}" to store for ${product.price} THB?`)) return;

        try {
            const res = await fetch('/api/ai/discover-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_name: product.product_name,
                    price: product.price,
                    category: product.category
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Product added to store!');
                setDiscoveredProducts(prev => prev.map(p => p.product_name === product.product_name ? { ...p, exists: true } : p));
                // Reload catalog
                const catRes = await fetch('/api/catalog');
                const catData = await catRes.json();
                setCatalog(catData);
            } else {
                alert('Failed to add product: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error adding to store');
        }
    };

    const getCustomerTags = (conv) => {
        if (!conv) return [];
        const customer = conv.customer || conversations.find(c => c.id === conv.id)?.customer;
        const tags = customer?.intelligence?.tags || [];
        const labels = conv.labels?.data?.map(l => l.name) || [];
        return [...new Set([...tags, ...labels])];
    };

    const getParticipantName = (conv) => {
        const parts = conv.participants?.data || [];
        const other = parts.find(p => p.id !== pageId);
        return other?.name || 'User';
    };

    if (loading && conversations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-white/50">
                <div className="text-center">
                    <i className="fas fa-circle-notch animate-spin text-3xl mb-4 text-blue-500"></i>
                    <p className="text-xs font-bold uppercase tracking-widest">Loading Chats...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-[#0A1A2F] text-white rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
            {/* Left Sidebar: Conversations */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-[#0A1A2F]">
                <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-black text-xl tracking-tight text-white">Inbox</h2>
                            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mt-1">{conversations.length} Active Chats</p>
                        </div>
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className={`p-2 rounded-xl transition-all ${isSyncing ? 'bg-blue-500/20 text-blue-400 rotate-180' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                            title="Force Sync from Facebook"
                        >
                            <i className={`fas fa-sync-alt text-xs ${isSyncing ? 'animate-spin' : ''}`}></i>
                        </button>
                    </div>

                    {isTokenExpired && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 animate-pulse">
                            <i className="fas fa-key text-rose-500 text-xs"></i>
                            <div>
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Token Expired</p>
                                <p className="text-[8px] text-rose-500/70 font-bold leading-tight">Sync restricted to local cache.</p>
                            </div>
                        </div>
                    )}

                    {!isTokenExpired && (
                        <div className="flex items-center gap-2 text-[8px] font-bold text-white/20 uppercase tracking-widest">
                            <i className="fas fa-clock"></i>
                            Last Updated: {lastUpdated.toLocaleTimeString()}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-white/30 text-xs font-bold uppercase tracking-widest">
                            No conversations found
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => setSelectedConv(conv)}
                                className={`w-full p-5 text-left border-b border-white/5 hover:bg-white/5 transition-all group relative ${selectedConv?.id === conv.id ? 'bg-blue-600/10' : ''}`}
                            >
                                {selectedConv?.id === conv.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                )}
                                <div className="flex justify-between items-start mb-1.5">
                                    <h3 className={`font-black text-sm truncate pr-2 ${selectedConv?.id === conv.id ? 'text-blue-400' : 'text-white'}`}>
                                        {getParticipantName(conv)}
                                    </h3>
                                    <span className="text-[9px] text-white/30 whitespace-nowrap font-bold">
                                        {new Date(conv.updated_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <p className="text-xs text-white/50 truncate font-medium pr-6 leading-relaxed">
                                    {conv.snippet}
                                </p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-[9px] text-white/30 truncate font-bold">
                                        <i className="fas fa-headset mr-1 text-blue-500/50"></i> {conv.agent || 'Unassigned'}
                                    </p>
                                    {conv.unread_count > 0 && (
                                        <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-md">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {getCustomerTags(conv).map((tag, idx) => {
                                        const isPaid = tag.toLowerCase().includes('paid') || tag.includes('ชำระ') || tag.includes('โอน');
                                        return (
                                            <span key={idx} className={`text-[7px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider border ${isPaid
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/5 text-white/30 border-white/10'}`}>
                                                {tag}
                                            </span>
                                        );
                                    })}
                                </div>
                                {!conv.has_history && (
                                    <span className="absolute right-4 bottom-4 text-[8px] text-white/20 font-black uppercase tracking-tighter">
                                        Lead / Legacy
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Side: Chat Window */}
            {selectedConv ? (
                <div className="flex-1 flex flex-col bg-[#0f2440]/50 backdrop-blur-sm">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0A1A2F]/80 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-sm">
                                {getParticipantName(selectedConv).charAt(0)}
                            </div>
                            <div>
                                <h2 className="font-black text-lg text-white leading-none">{getParticipantName(selectedConv)}</h2>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.15em] flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                        Messenger Active
                                    </p>
                                    <span className="text-[9px] text-white/20 font-bold border-l border-white/10 pl-3">
                                        {selectedConv.id}
                                    </span>
                                    <span className="text-[9px] text-blue-300/80 font-black uppercase tracking-wider border-l border-white/10 pl-3 flex items-center gap-1.5">
                                        <i className="fas fa-user-shield"></i>
                                        Agent: {selectedConv.agent || 'Unassigned'}
                                    </span>
                                    {(!selectedConv.agent || selectedConv.agent === 'Unassigned') && (
                                        <button
                                            onClick={() => handleAssignAgent('Me')}
                                            className="ml-4 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/40 transition-all flex items-center gap-1.5"
                                        >
                                            <i className="fas fa-hand-paper"></i> Claim Chat
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-white/20 px-12 text-center">
                                <div>
                                    <i className="fas fa-history text-4xl mb-4 opacity-20"></i>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] mb-2">
                                        {selectedConv?.has_history ? 'Loading History...' : 'No Local History'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, i) => {
                                const isMe = msg.from?.id === pageId;
                                return (
                                    <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-xl backdrop-blur-sm ${isMe
                                            ? 'bg-blue-600/90 text-white rounded-tr-sm border border-blue-500/50'
                                            : 'bg-[#1e3a5f]/80 text-[#e2e8f0] rounded-tl-sm border border-white/10'
                                            }`}>
                                            {msg.message}
                                            {msg.attachments?.data?.map(att => (
                                                <div key={att.id} className="mt-2 rounded-lg overflow-hidden border border-white/10">
                                                    {(att.mime_type?.startsWith('image/') || att.image_data) ? (
                                                        <img src={att.local_path || att.image_data?.url || att.url} className="w-full h-48 object-cover" />
                                                    ) : (
                                                        <a href={att.file_url || att.url} target="_blank" className="p-2 bg-white/5 block text-[10px] text-blue-400">Download Attachment</a>
                                                    )}
                                                </div>
                                            ))}
                                            <p className={`text-[8px] mt-1.5 font-bold uppercase tracking-wider ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                                {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} className="p-6 bg-[#0A1A2F] border-t border-white/5 flex gap-4">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                        />
                        <button type="submit" disabled={sending || !inputText.trim()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50">
                            {sending ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-paper-plane"></i>}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-white/30 bg-[#0f2440]/50">
                    <i className="fas fa-comments text-4xl mb-6"></i>
                    <h3 className="text-2xl font-black mb-2 text-white/80">Welcome to Inbox</h3>
                    <p className="text-xs">Select a conversation to start chatting</p>
                </div>
            )}

            {/* Right Sidebar: Customer Context */}
            {selectedConv && (
                <div className="w-80 border-l border-white/5 bg-[#0A1A2F] flex flex-col p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    <div className="border-b border-white/5 pb-6">
                        <button onClick={() => onViewCustomer && onViewCustomer(selectedConv.customer)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all">
                            <i className="fas fa-id-card"></i> View Full Profile
                        </button>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i className="fas fa-tags text-blue-500"></i> Labels & Segmentation
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {getCustomerTags(selectedConv).map((tag, idx) => {
                                const isPaid = tag.toLowerCase().includes('paid') || tag.includes('ชำระ') || tag.includes('โอน');
                                return (
                                    <div key={idx} className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest flex items-center gap-1.5 ${isPaid
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'bg-white/5 text-white/40 border-white/10'}`}>
                                        {isPaid && <i className="fas fa-check-circle"></i>}
                                        {tag}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                                <i className="fas fa-search-dollar text-purple-500"></i> Smart Explore
                            </h3>
                            <button
                                onClick={handleDiscoverProducts}
                                disabled={isAnalyzing}
                                className="text-[9px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-all flex items-center gap-1.5"
                            >
                                {isAnalyzing ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-magic"></i>}
                                {isAnalyzing ? 'Detecting...' : 'Detect Products'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {discoveredProducts.length === 0 && !isAnalyzing && (
                                <p className="text-[9px] text-white/20 italic text-center py-4 border border-dashed border-white/5 rounded-xl">
                                    Click detect to scan chat for products.
                                </p>
                            )}

                            {discoveredProducts.map((p, i) => (
                                <div key={i} className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/20 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-white leading-tight">{p.product_name}</p>
                                            <p className="text-[9px] text-purple-400 font-bold mt-0.5">{Number(p.price).toLocaleString()} THB</p>
                                        </div>
                                        {p.exists ? (
                                            <span className="text-[7px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">In Store</span>
                                        ) : (
                                            <button
                                                onClick={() => handleAddToStore(p)}
                                                className="text-[7px] font-black text-purple-400 uppercase border border-purple-500/30 px-1.5 py-0.5 rounded hover:bg-purple-500/20 active:scale-95 transition-all"
                                            >
                                                + Add to Store
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[8px] text-white/40 italic leading-relaxed border-t border-white/5 pt-1">
                                        "{p.justification}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i className="fas fa-box-open text-[#C9A34E]"></i> Active Inventory
                        </h3>
                        <div className="space-y-3">
                            {selectedConv.customer?.inventory?.learning_courses?.map((item, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-[10px] font-black text-white leading-tight mb-0.5">{item.name}</p>
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded border uppercase bg-blue-500/20 text-blue-400 border-blue-500/30">
                                        {item.status || 'Active'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
