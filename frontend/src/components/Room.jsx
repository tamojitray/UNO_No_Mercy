import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';

const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";

export default function Room({ roomCode, username, sessionToken, setView }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Join the socket room
    socket.emit("join_room", { room: roomCode, username: username, session: sessionToken });
    socket.emit("check_game_states", { room: roomCode });
    // check_roulette_state was missing in app.py handlers but was in front end
    
    function onUpdatePlayers(data) {
        if (!data.game_started) {
            setPlayers(data.players);
        }
    }

    socket.on("update_players", onUpdatePlayers);

    return () => {
      socket.off("update_players", onUpdatePlayers);
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
        <div className="bg-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700">
          <span className="text-slate-400 text-[10px] md:text-sm uppercase tracking-wider block text-center">Room Code</span>
          <span className="text-primary font-mono text-xl md:text-2xl font-black">{roomCode}</span>
        </div>
      </div>

      <div className="bg-slate-800/80 rounded-xl p-6 mb-8 border border-white/5">
        <h3 className="text-lg text-slate-300 font-semibold mb-4">Players Connected ({players.length}/6)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {players.map((p, idx) => (
            <div key={idx} className="flex items-center space-x-3 bg-surface p-3 rounded-lg border border-slate-700">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {p.charAt(0).toUpperCase()}
              </div>
              <span className={`font-medium ${p === username ? 'text-primary' : 'text-slate-200'}`}>
                {p} {p === username && '(You)'}
              </span>
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
