import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";

export default function Home({ setView, setRoomCode, setUsername, setSessionToken }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidName = (str) => {
    if (/^\d+$/.test(str.trim())) return false;
    return true;
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) return setError("Please enter your name!");
    if (!isValidName(name)) return setError("Name cannot be purely numeric!");
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/create_room/`, { username: name });
      setRoomCode(res.data.room_code);
      setSessionToken(res.data.session_token);
      setUsername(name);
      
      localStorage.setItem('session_token', res.data.session_token);
      localStorage.setItem('room_code', res.data.room_code);
      localStorage.setItem('username', name);

      setView('room');
    } catch (err) {
      setError("Failed to create room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim() || !room.trim()) return setError("Name and Room Code are required!");
    if (!isValidName(name)) return setError("Name cannot be purely numeric!");
    
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/join_room/`, {
        room_code: room.toUpperCase(),
        username: name
      });
      
      
      if (res.data.status === 'joined') {
        setRoomCode(room.toUpperCase());
        setSessionToken(res.data.session_token);
        setUsername(name);

        localStorage.setItem('session_token', res.data.session_token);
        localStorage.setItem('room_code', room.toUpperCase());
        localStorage.setItem('username', name);

        setView('room');
      } else {
        setError("Could not join: " + res.data.status);
      }
    } catch (err) {
      setError("Failed to join room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 md:p-12 w-full max-w-md animate-slide-up flex flex-col items-center">
      <h1 className="text-4xl md:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-unoRed via-unoYellow to-unoBlue mb-8 tracking-tight">
        NO MERCY
      </h1>
      
      {error && <div className="w-full bg-unoRed/20 text-red-300 p-3 rounded-lg mb-4 text-center border border-red-500/30">{error}</div>}

      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            placeholder="Enter your nickname..."
          />
        </div>
        
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
              onClick={handleJoinRoom}
              disabled={loading}
              className="w-1/3 px-4 py-3 rounded-xl bg-surfaceLight hover:bg-slate-600 text-white font-bold transition-all border border-slate-500"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
