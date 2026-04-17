import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';

const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";

export default function Room({ roomCode, username, sessionToken, setView }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
            alert("You have been kicked from the room.");
            localStorage.clear();
            setView('home');
        }
    }

    socket.on("update_players", onUpdatePlayers);
    socket.on("player_kicked", onPlayerKicked);

    return () => {
      socket.off("update_players", onUpdatePlayers);
      socket.off("player_kicked", onPlayerKicked);
    };
  }, [roomCode, username, sessionToken]);

  const handleStartGame = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/start_game`, { room_code: roomCode, username });
      if (res.data.status !== "started") {
          alert(res.data.status);
      }
    } catch(err) {
      console.error(err);
      alert("Error starting game.");
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
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = () => {
    if (window.confirm("Leave the room?")) {
      socket.emit("leave_room", { room: roomCode, username, session: sessionToken });
      localStorage.clear();
      setView('home');
    }
  };

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
        <div 
          onClick={copyRoomCode}
          className="bg-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700 cursor-pointer hover:border-primary/50 hover:bg-slate-800 transition-all relative group flex flex-col items-center justify-center min-w-[100px]"
          title="Click to copy room code"
        >
          <span className="text-slate-400 text-[10px] md:text-sm uppercase tracking-wider block text-center select-none">
            {copied ? <span className="text-green-400 font-bold animate-pulse">Copied!</span> : 'Room Code'}
          </span>
          <span className="text-primary font-mono text-xl md:text-2xl font-black flex items-center gap-2">
            {roomCode}
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-colors ${copied ? 'text-green-400' : 'text-slate-500 group-hover:text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </span>
        </div>
      </div>

      <div className="bg-slate-800/80 rounded-xl p-6 mb-8 border border-white/5">
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
                <span className={`font-medium ${p === username ? 'text-primary' : 'text-slate-200'}`}>
                  {p} {p === username && '(You)'}
                </span>
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

      <div className="flex justify-center">
        {players[0] === username ? (
          <button 
            onClick={handleStartGame}
            disabled={loading || players.length < 2}
            className="btn-primary w-full md:w-auto px-12 text-base md:text-lg shadow-primary/40 shadow-xl"
          >
            {loading ? 'Starting...' : 'Start Game'}
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
