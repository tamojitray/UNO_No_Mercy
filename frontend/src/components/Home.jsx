import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE } from '../config';

export default function Home({ setView, setRoomCode, setUsername, setSessionToken, invitedRoomCode, setInvitedRoomCode }) {
  const [name, setName] = useState(() => localStorage.getItem('username') || '');
  const [room, setRoom] = useState(invitedRoomCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invitedRoomCode) {
      setRoom(invitedRoomCode.toUpperCase());
    }
  }, [invitedRoomCode]);

  const isValidName = (str) => {
    if (!str || /^\d+$/.test(str.trim())) return false;
    return true;
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (val.trim()) {
      localStorage.setItem('username', val.trim());
    }
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) return setError("Please enter your name!");
    if (!isValidName(name)) return setError("Name cannot be purely numeric!");
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/create_room/`, { username: name.trim() });
      setRoomCode(res.data.room_code);
      setSessionToken(res.data.session_token);
      setUsername(name.trim());
      
      localStorage.setItem('session_token', res.data.session_token);
      localStorage.setItem('room_code', res.data.room_code);
      localStorage.setItem('username', name.trim());

      setView('room');
    } catch (err) {
      setError("Failed to create room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (targetRoomCode) => {
    const targetRoom = (targetRoomCode || room).toUpperCase().trim();
    if (!name.trim() || !targetRoom) return setError("Name and Room Code are required!");
    if (!isValidName(name)) return setError("Name cannot be purely numeric!");
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/join_room/`, {
        room_code: targetRoom,
        username: name.trim()
      });
      
      if (res.data.status === 'joined') {
        setRoomCode(targetRoom);
        setSessionToken(res.data.session_token);
        setUsername(name.trim());

        localStorage.setItem('session_token', res.data.session_token);
        localStorage.setItem('room_code', targetRoom);
        localStorage.setItem('username', name.trim());

        setView('room');
      } else {
        const errorMessages = {
          'room_not_found': 'Room not found. Check your room link or code.',
          'game_started': 'Game has already started in this room.',
          'room_full': 'Room is full! Maximum 6 players allowed.',
          'duplicate': 'A player with this name is already in the room.'
        };
        setError(errorMessages[res.data.status] || ("Could not join: " + res.data.status));
      }
    } catch (err) {
      setError("Failed to join room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 md:p-12 w-full max-w-md animate-slide-up flex flex-col items-center">
      <h1 className="text-4xl md:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-unoRed via-unoYellow to-unoBlue mb-6 tracking-tight">
        NO MERCY
      </h1>
      
      {invitedRoomCode && (
        <div className="w-full bg-slate-900/90 text-slate-200 p-4 rounded-xl mb-6 text-center border border-yellow-500/40 shadow-lg flex flex-col items-center">
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-widest mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Room Invitation
          </div>
          <p className="text-sm text-slate-300">You were invited to join room:</p>
          <div className="text-2xl font-black font-mono text-yellow-400 tracking-wider my-1 bg-slate-950 px-4 py-1 rounded-lg border border-yellow-500/20">
            {invitedRoomCode}
          </div>
        </div>
      )}

      {error && <div className="w-full bg-unoRed/20 text-red-300 p-3 rounded-lg mb-4 text-center border border-red-500/30 text-sm font-medium">{error}</div>}

      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1 flex justify-between items-center">
            <span>Your Name</span>
            {localStorage.getItem('username') && (
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Cached from browser</span>
            )}
          </label>
          <input 
            type="text" 
            value={name}
            onChange={handleNameChange}
            className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            placeholder="Enter your nickname..."
          />
        </div>

        {invitedRoomCode ? (
          <div className="pt-2 space-y-3">
            <button 
              onClick={() => handleJoinRoom(invitedRoomCode)}
              disabled={loading}
              className="w-full btn-primary font-bold text-sm md:text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            >
              Join Room {invitedRoomCode}
            </button>
            <button 
              onClick={() => {
                setInvitedRoomCode('');
                setRoom('');
                if (window.location.pathname !== '/') {
                  window.history.pushState({}, '', '/');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition border border-slate-700"
            >
              Or create standard lobby
            </button>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            <button 
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full btn-primary font-bold text-sm md:text-lg"
            >
              Create New Game
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-600"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">Or join existing</span>
              <div className="flex-grow border-t border-slate-600"></div>
            </div>
            
            <div className="flex space-x-2">
              <input 
                type="text" 
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary transition placeholder:text-slate-500 uppercase tracking-widest text-center font-mono font-bold"
                placeholder="ROOM CODE"
                maxLength={6}
              />
              <button 
                onClick={() => handleJoinRoom()}
                disabled={loading}
                className="w-1/3 px-4 py-3 rounded-xl bg-surfaceLight hover:bg-slate-600 text-white font-bold transition-all border border-slate-500"
              >
                Join
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

