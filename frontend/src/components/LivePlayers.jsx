import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';

import { API_BASE } from '../config';

export default function LivePlayers() {
  const [totalPlayers, setTotalPlayers] = useState(0);

  useEffect(() => {
    const handleUpdate = (data) => {
      if (data && typeof data.total_players !== 'undefined') {
        setTotalPlayers(data.total_players);
      }
    };
    
    socket.on('total_players_update', handleUpdate);
    
    // Initial fetch on mount
    axios.get(`${API_BASE}/total_players`)
      .then(res => {
        if (res.data && typeof res.data.total_players !== 'undefined') {
          setTotalPlayers(res.data.total_players);
        }
      })
      .catch(err => console.error("Failed to fetch total players:", err));

    return () => {
      socket.off('total_players_update', handleUpdate);
    };
  }, []);

  return (
    <div className="fixed top-4 md:top-6 left-4 md:left-6 bg-slate-900/80 backdrop-blur-md border border-white/10 text-white p-2 md:p-3 rounded-xl shadow-2xl z-[150] flex items-center gap-3">
      <div className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black leading-none mb-1">Live Players</span>
        <span className="text-lg md:text-xl font-display font-black text-white leading-none">{totalPlayers ?? 0}</span>
      </div>
    </div>
  );
}
