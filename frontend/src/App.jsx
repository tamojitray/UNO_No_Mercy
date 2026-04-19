import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import Room from './components/Room';
import Game from './components/Game';
import Chat from './components/Chat';
import BugReport from './components/BugReport';
import RulesModal from './components/RulesModal';
import LivePlayers from './components/LivePlayers';
import { socket } from './socket';
import axios from 'axios';

const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : window.location.protocol + "//" + window.location.hostname + ":8000";

function App() {
  const [view, setView] = useState('home'); // 'home' | 'room' | 'game'
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [showRules, setShowRules] = useState(false);

  const [initialHandData, setInitialHandData] = useState(null);
  const [initialGameUpdate, setInitialGameUpdate] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    const room = localStorage.getItem('room_code');
    const user = localStorage.getItem('username');
    
    if (token && room && user) {
      axios.post(`${API_BASE}/get_username/`, { session_token: token })
        .then(res => {
          if (res.data.status === 'success' && res.data.username === user) {
            setSessionToken(token);
            setRoomCode(room);
            setUsername(user);
            setView('room');
          } else {
            localStorage.clear();
          }
        }).catch(err => console.error(err));
    }
  }, []);

  // When game_started event occurs, we switch from 'room' to 'game'.
  // Also we want to ensure socket connects properly.
  useEffect(() => {
    function onConnect() {
      console.log('Socket connected:', socket.id);
    }
    
    function onDisconnect() {
      console.log('Socket disconnected');
    }

    function onGameStarted(data) {
      console.log("Game started!", data);
      setView('game');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game_started', onGameStarted);
    socket.on('your_hand', (data) => setInitialHandData(data));
    socket.on('game_update', (data) => {
        setInitialGameUpdate(data);
        setView('game');
    });

    // the game_over event will be handled inside Game.jsx to allow players to view the board.

    socket.on('room_deleted', (data) => {
        alert(data.message);
        localStorage.clear();
        setView('home');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game_started', onGameStarted);
      socket.off('your_hand');
      socket.off('game_update');
      socket.off('room_deleted');
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      {view === 'home' && (
        <Home 
          setView={setView} 
          setRoomCode={setRoomCode} 
          setUsername={setUsername}
          setSessionToken={setSessionToken}
        />
      )}
      
      {view === 'room' && (
        <Room 
          roomCode={roomCode} 
          username={username}
          sessionToken={sessionToken}
          setView={setView}
        />
      )}

      {view === 'game' && (
        <Game 
          roomCode={roomCode} 
          username={username}
          sessionToken={sessionToken}
          setView={setView}
          initialHandData={initialHandData}
          initialGameUpdate={initialGameUpdate}
        />
      )}

      {/* Global Chat Component */}
      {(view === 'room' || view === 'game') && (
        <Chat roomCode={roomCode} username={username} />
      )}

      {/* Global Live Players Counter */}
      {view !== 'game' && <LivePlayers />}

      {/* Global Rules Button */}
      <button 
          onClick={() => setShowRules(true)}
          className="fixed top-4 md:top-6 right-4 md:right-6 bg-slate-900/80 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white p-2 md:p-3 rounded-xl shadow-2xl hover:scale-110 active:scale-95 transition z-[150] shadow-black flex items-center justify-center min-w-[32px] md:min-w-[45px]"
          title="Game Rules"
      >
          <span className="text-xs md:text-xl font-black text-slate-300 hover:text-white transition tracking-widest whitespace-nowrap">RULES</span>
      </button>

      {/* Bug Report Component */}
      <BugReport />

      {/* Rules Modal Overlay */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

export default App;
