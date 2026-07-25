import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';
import { useToast } from '../context/ToastContext';

import { API_BASE } from '../config';

export default function Room({ roomCode, username, sessionToken, setView }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(null); // 'Mercy' | 'No Mercy' | null
  const [coins, setCoins] = useState({}); // { playerName: 'Mercy' | 'No Mercy' }
  const { showToast } = useToast();

  useEffect(() => {
    // Join the socket room
    socket.emit("join_room", { room: roomCode, username: username, session: sessionToken });
    socket.emit("check_game_states", { room: roomCode });

    function onUpdatePlayers(data) {
      if (!data.game_started) {
        setPlayers(data.players);
      }
    }

    function onPlayerKicked(data) {
      if (data.username === username) {
        showToast("You have been kicked from the room.", 'error');
        localStorage.clear();
        setView('home');
      }
    }

    function onCoinUpdate(data) {
      const updatedCoins = data.coins || {};
      setCoins(updatedCoins);
      setSelectedCoin(updatedCoins[username] || null);
    }

    socket.on("update_players", onUpdatePlayers);
    socket.on("player_kicked", onPlayerKicked);
    socket.on("coin_update", onCoinUpdate);

    return () => {
      socket.off("update_players", onUpdatePlayers);
      socket.off("player_kicked", onPlayerKicked);
      socket.off("coin_update", onCoinUpdate);
    };
  }, [roomCode, username, sessionToken]);

  const handleChooseCoin = (coin) => {
    setSelectedCoin(coin);
    socket.emit("choose_coin", { room: roomCode, coin });
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/start_game/`, { room_code: roomCode, username });
      if (res.data.status === 'coins_not_chosen') {
        const missing = res.data.missing || [];
        showToast(`Waiting for coins: ${missing.join(', ')}`, 'error');
      } else if (res.data.status !== "started") {
        showToast(res.data.status, 'error');
      }
    } catch(err) {
      console.error(err);
      showToast("Error starting game.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKick = (targetUsername) => {
    if (window.confirm(`Kick ${targetUsername}?`)) {
      socket.emit("kick_player", { room: roomCode, target_username: targetUsername });
    }
  };

  const handleTransferLeadership = (targetUsername) => {
    if (window.confirm(`Transfer leadership to ${targetUsername}?`)) {
      socket.emit("transfer_leadership", { room: roomCode, target_username: targetUsername });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    showToast("Room code copied!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast("Room link copied to clipboard!", "success");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const leaveRoom = () => {
    if (window.confirm("Leave the room?")) {
      socket.emit("leave_room", { room: roomCode, username, session: sessionToken });
      localStorage.removeItem('session_token');
      localStorage.removeItem('room_code');
      setView('home');
    }
  };

  const allCoinsChosen = players.length >= 2 && players.every(p => coins[p] === 'Mercy' || coins[p] === 'No Mercy');
  const canStart = players[0] === username && players.length >= 2 && allCoinsChosen;

  return (
    <div className="glass-panel p-8 w-full max-w-2xl animate-slide-up">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-wide">
            Waiting Room
          </h2>
          <button
            onClick={leaveRoom}
            className="mt-2 text-xs md:text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            ← Leave Room
          </button>
        </div>
        <div className="flex gap-2">
          <div
            onClick={copyRoomCode}
            className="bg-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700 cursor-pointer hover:border-primary/50 hover:bg-slate-800 transition-all relative group flex flex-col items-center justify-center min-w-[90px]"
            title="Click to copy room code"
          >
            <span className="text-slate-400 text-[10px] md:text-xs uppercase tracking-wider block text-center select-none">
              {copied ? <span className="text-green-400 font-bold animate-pulse">Copied!</span> : 'Code'}
            </span>
            <span className="text-primary font-mono text-lg md:text-xl font-black flex items-center gap-1">
              {roomCode}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-colors ${copied ? 'text-green-400' : 'text-slate-500 group-hover:text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </span>
          </div>

          <button
            onClick={copyRoomLink}
            className="bg-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700 cursor-pointer hover:border-emerald-500/50 hover:bg-slate-800 transition-all relative group flex flex-col items-center justify-center min-w-[90px]"
            title="Click to copy room share link"
          >
            <span className="text-slate-400 text-[10px] md:text-xs uppercase tracking-wider block text-center select-none">
              {copiedLink ? <span className="text-green-400 font-bold animate-pulse">Copied!</span> : 'Share Link'}
            </span>
            <span className="text-emerald-400 font-mono text-xs md:text-sm font-bold flex items-center gap-1 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Link
            </span>
          </button>
        </div>
      </div>

      {/* Player List */}
      <div className="bg-slate-800/80 rounded-xl p-6 mb-6 border border-white/5">
        <h3 className="text-lg text-slate-300 font-semibold mb-4">Players Connected ({players.length}/6)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {players.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between bg-surface p-3 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg relative">
                  {p.charAt(0).toUpperCase()}
                  {idx === 0 && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 rounded-full p-1 shadow-lg shadow-amber-900/50 border border-amber-300/50" title="Room Leader">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 16l3-8 4 4 4-4 3 8H5z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <span className={`font-medium block ${p === username ? 'text-primary' : 'text-slate-200'}`}>
                    {p} {p === username && '(You)'}
                  </span>
                  {/* Coin status badge */}
                  {coins[p] ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${coins[p] === 'Mercy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {coins[p] === 'Mercy' ? '😊 Mercy' : '😈 No Mercy'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">choosing coin...</span>
                  )}
                </div>
              </div>

              {players[0] === username && p !== username && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleTransferLeadership(p)}
                    className="text-amber-500 hover:text-amber-400 p-2 rounded-xl hover:bg-amber-500/10 transition-all active:scale-90"
                    title="Promote to Leader"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16l3-8 4 4 4-4 3 8H5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleKick(p)}
                    className="text-red-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-500/10 transition-all active:scale-90"
                    title="Kick Player"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {players.length < 2 && (
          <p className="text-slate-400 text-sm mt-4 italic text-center">Waiting for more players to join...</p>
        )}
      </div>

      {/* Coin Selection */}
      <div className="bg-slate-800/80 rounded-xl p-5 mb-6 border border-white/5">
        <h3 className="text-base md:text-lg text-slate-300 font-semibold mb-1 text-center">Choose Your Coin</h3>
        <p className="text-xs text-slate-500 text-center mb-4 italic">You must choose a coin before the game can start</p>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {/* Mercy Coin */}
          <button
            onClick={() => handleChooseCoin('Mercy')}
            className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all active:scale-95 ${
              selectedCoin === 'Mercy'
                ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/20'
                : 'border-slate-600 bg-slate-900/60 hover:border-emerald-500/60 hover:bg-emerald-500/10'
            }`}
          >
            <img src="/images/coin_happy.png" alt="Mercy Coin" className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg" />
            <div className="text-center">
              <div className={`font-black text-sm md:text-base ${selectedCoin === 'Mercy' ? 'text-emerald-400' : 'text-slate-200'}`}>Mercy</div>
              <div className="text-[10px] md:text-xs text-slate-400 leading-tight mt-0.5">Discard hand & draw 7 fresh cards</div>
            </div>
            {selectedCoin === 'Mercy' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* No Mercy Coin */}
          <button
            onClick={() => handleChooseCoin('No Mercy')}
            className={`flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl border-2 transition-all active:scale-95 ${
              selectedCoin === 'No Mercy'
                ? 'border-red-400 bg-red-500/20 shadow-lg shadow-red-500/20'
                : 'border-slate-600 bg-slate-900/60 hover:border-red-500/60 hover:bg-red-500/10'
            }`}
          >
            <img src="/images/coin_sad.png" alt="No Mercy Coin" className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg" />
            <div className="text-center">
              <div className={`font-black text-sm md:text-base ${selectedCoin === 'No Mercy' ? 'text-red-400' : 'text-slate-200'}`}>No Mercy</div>
              <div className="text-[10px] md:text-xs text-slate-400 leading-tight mt-0.5">Double the draw penalty</div>
            </div>
            {selectedCoin === 'No Mercy' && (
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* All-chosen status */}
        {players.length >= 2 && (
          <div className={`mt-3 text-center text-xs font-semibold ${allCoinsChosen ? 'text-emerald-400' : 'text-amber-400'}`}>
            {allCoinsChosen
              ? '✅ All players have chosen their coin!'
              : `⏳ Waiting for ${players.filter(p => !coins[p]).length} player(s) to choose...`
            }
          </div>
        )}
      </div>

      {/* Start / Waiting */}
      <div className="flex justify-center">
        {players[0] === username ? (
          <button
            onClick={handleStartGame}
            disabled={loading || !canStart}
            className="btn-primary w-full md:w-auto px-12 text-base md:text-lg shadow-primary/40 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting...' : !allCoinsChosen ? 'Waiting for Coins...' : 'Start Game'}
          </button>
        ) : (
          <div className="text-slate-400 animate-pulse text-lg py-3">
            Waiting for {players[0] || 'host'} to start the game...
          </div>
        )}
      </div>
    </div>
  );
}
