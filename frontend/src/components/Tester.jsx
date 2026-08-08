import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import Card from './Card';

const Tester = () => {
    const [rooms, setRooms] = useState({});
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [availableCards, setAvailableCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchRooms();
        fetchCards();
        const interval = setInterval(fetchRooms, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/debug`);
            setRooms(res.data.rooms || {});
        } catch (err) {
            console.error("Failed to fetch rooms", err);
        }
    };

    const fetchCards = async () => {
        try {
            const res = await axios.get(`${API_BASE}/admin/cards`);
            setAvailableCards(res.data);
        } catch (err) {
            console.error("Failed to fetch cards", err);
        }
    };

    const executeCommand = async (command, params) => {
        if (!selectedRoom) return;
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/admin/execute`, {
                room_code: selectedRoom,
                command,
                params
            });
            fetchRooms(); // Refresh
        } catch (err) {
            alert("Error: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const roomData = rooms[selectedRoom];
    const game = roomData?.game;

    const filteredCards = availableCards.filter(c => 
        c.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.color.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-7xl mx-auto h-screen flex flex-col p-4 gap-4 overflow-hidden text-slate-100">
            <header className="flex justify-between items-center glass-panel p-4 px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-unoRed to-unoBlue uppercase tracking-tighter">
                        Manual Game Tester
                    </h1>
                    <div className="h-6 w-px bg-white/20"></div>
                    <select 
                        className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={selectedRoom || ''}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                    >
                        <option value="">Select Room</option>
                        {Object.keys(rooms).map(code => (
                            <option key={code} value={code}>{code} ({rooms[code].players.length} players)</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchRooms} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition">Refresh State</button>
                    <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition">Back to Lobby</button>
                </div>
            </header>

            {!selectedRoom ? (
                <div className="flex-1 glass-panel flex flex-center items-center justify-center italic text-slate-400">
                    Please select a room to start testing.
                </div>
            ) : !game ? (
                <div className="flex-1 glass-panel flex flex-col items-center justify-center gap-4">
                    <p className="text-xl font-bold">Game not started in room {selectedRoom}</p>
                    <div className="text-slate-400">Players in lobby: {roomData.players.join(', ')}</div>
                </div>
            ) : (
                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Left Panel: Game Stats & Controls */}
                    <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                        <section className="glass-panel p-4 space-y-4">
                            <h2 className="text-lg font-bold border-b border-white/10 pb-2 flex items-center justify-between">
                                Game Parameters
                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-widest">Global</span>
                            </h2>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Stacked Cards</label>
                                    <input 
                                        type="number" 
                                        value={game.stacked_cards} 
                                        onChange={(e) => executeCommand('set_param', { key: 'stacked_cards', value: parseInt(e.target.value) })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Playing Color</label>
                                    <select 
                                        value={game.playing_color}
                                        onChange={(e) => executeCommand('set_param', { key: 'playing_color', value: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                    >
                                        {['Red', 'Blue', 'Green', 'Yellow', 'Wild'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <button 
                                    onClick={() => executeCommand('set_param', { key: 'draw_pending', value: !game.draw_pending })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${game.draw_pending ? 'bg-unoRed/30 border-unoRed text-unoRed' : 'bg-slate-800 border-white/10 text-slate-400'}`}
                                >
                                    Draw Pending: {game.draw_pending ? 'ON' : 'OFF'}
                                </button>
                                <button 
                                    onClick={() => executeCommand('set_param', { key: 'no_mercy_doubled', value: !game.no_mercy_doubled })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${game.no_mercy_doubled ? 'bg-red-600/30 border-red-500 text-red-400' : 'bg-slate-800 border-white/10 text-slate-400'}`}
                                >
                                    No Mercy Doubled: {game.no_mercy_doubled ? 'ON 😈' : 'OFF'}
                                </button>
                                <button 
                                    onClick={() => executeCommand('set_param', { key: 'roulette', value: !game.roulette })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${game.roulette ? 'bg-purple-500/30 border-purple-500 text-purple-400' : 'bg-slate-800 border-white/10 text-slate-400'}`}
                                >
                                    Roulette: {game.roulette ? 'ON' : 'OFF'}
                                </button>
                                <button 
                                    onClick={() => executeCommand('set_param', { key: 'awaiting_final_attack_color', value: !game.awaiting_final_attack_color })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${game.awaiting_final_attack_color ? 'bg-orange-500/30 border-orange-500 text-orange-400' : 'bg-slate-800 border-white/10 text-slate-400'}`}
                                >
                                    Final Attack Color: {game.awaiting_final_attack_color ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Min Stack Value Req</label>
                                <input 
                                    type="number" 
                                    value={game.min_stack_draw_value || 0} 
                                    onChange={(e) => executeCommand('set_param', { key: 'min_stack_draw_value', value: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Top Discard Card</label>
                                <div className="flex gap-2 items-center bg-slate-900 p-2 rounded-xl border border-white/5">
                                    <div className="w-12 h-18 shrink-0">
                                        <Card card={game.discard_pile[game.discard_pile.length - 1]} isPlayable={false} noOverlay />
                                    </div>
                                    <div className="text-sm font-bold">
                                        {game.discard_pile[game.discard_pile.length - 1].color} {game.discard_pile[game.discard_pile.length - 1].type}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="glass-panel p-4 space-y-4">
                            <h2 className="text-lg font-bold border-b border-white/10 pb-2 flex items-center justify-between">
                                Players Hand Control
                                <span className="text-[10px] bg-unoBlue/20 text-unoBlue px-2 py-0.5 rounded uppercase tracking-widest">Active</span>
                            </h2>
                            
                            <div className="space-y-3">
                                {game.players.map((player) => (
                                    <div key={player} className={`p-3 rounded-xl border transition ${game.current_player === player ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10' : 'bg-slate-900/50 border-white/5'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                {game.current_player === player && <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>}
                                                <span className="font-bold">{player}</span>
                                                <span className="text-xs text-slate-400">({game.hands[player].length} cards)</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => executeCommand('set_turn', { player })}
                                                    className="p-1 px-2 text-[10px] bg-primary hover:bg-blue-600 rounded font-bold uppercase tracking-tighter transition"
                                                >
                                                    Set Turn
                                                </button>
                                                <button 
                                                    onClick={() => executeCommand('set_hand', { player, hand: [] })}
                                                    className="p-1 px-2 text-[10px] bg-unoRed hover:bg-red-600 rounded font-bold uppercase tracking-tighter transition"
                                                >
                                                    Clear
                                                </button>
                                                <button 
                                                    onClick={() => executeCommand('add_card', { player, card: availableCards[Math.floor(Math.random() * availableCards.length)] })}
                                                    className="p-1 px-2 text-[10px] bg-green-600 hover:bg-green-500 rounded font-bold uppercase tracking-tighter transition"
                                                >
                                                    +1
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        for(let i=0; i<7; i++) {
                                                            await axios.post(`${API_BASE}/admin/execute`, {
                                                                room_code: selectedRoom,
                                                                command: 'add_card',
                                                                params: { player, card: availableCards[Math.floor(Math.random() * availableCards.length)] }
                                                            });
                                                        }
                                                        fetchRooms();
                                                    }}
                                                    className="p-1 px-2 text-[10px] bg-green-700 hover:bg-green-600 rounded font-bold uppercase tracking-tighter transition"
                                                >
                                                    +7
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-black/20 rounded-lg custom-scrollbar">
                                            {game.hands[player].map((card, idx) => (
                                                <div key={idx} className="group relative w-10 h-14 cursor-pointer" onClick={() => executeCommand('remove_card', { player, index: idx })}>
                                                    <Card card={card} isPlayable={false} noOverlay />
                                                    <div className="absolute inset-0 bg-red-500/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-sm transition-opacity">
                                                        <span className="text-white font-black text-xs">×</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {game.hands[player].length === 0 && <div className="text-[10px] text-slate-500 italic p-2">Empty hand</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right Panel: Card Adder / Picker */}
                    <div className="flex-1 glass-panel p-4 flex flex-col gap-4 min-w-0">
                        <div className="flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-bold">Add Cards to Game</h2>
                            <div className="relative w-64">
                                <input 
                                    type="text" 
                                    placeholder="Search cards (e.g. 'Red', 'Skip')..."
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <span className="absolute right-3 top-2 text-slate-500">🔍</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto p-2 custom-scrollbar pr-4">
                            {filteredCards.map((card, idx) => (
                                <div key={idx} className="flex flex-col gap-2 group">
                                    <div className="w-full aspect-[2/3] transform transition group-hover:scale-105 group-hover:-translate-y-1">
                                        <Card card={card} isPlayable={false} noOverlay />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{card.color} {card.type}</div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => executeCommand('add_card', { player: game.current_player, card })}
                                                    className="flex-1 py-1 bg-primary hover:bg-blue-600 rounded text-[9px] font-black uppercase transition"
                                                >
                                                    To Current
                                                </button>
                                                <button 
                                                    onClick={() => executeCommand('set_discard', { card })}
                                                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[9px] font-black uppercase transition"
                                                >
                                                    Top
                                                </button>
                                            </div>
                                            <div className="flex gap-1">
                                                {game.players.map(p => (
                                                    p !== game.current_player && (
                                                        <button 
                                                            key={p}
                                                            onClick={() => executeCommand('add_card', { player: p, card })}
                                                            className="flex-1 py-0.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded text-[8px] font-bold uppercase truncate transition"
                                                            title={`Add to ${p}`}
                                                        >
                                                            {p[0]}
                                                        </button>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                @keyframes pop {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}} />
        </div>
    );
};

export default Tester;
