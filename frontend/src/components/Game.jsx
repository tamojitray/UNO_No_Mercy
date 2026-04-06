import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import Card from './Card';

export default function Game({ roomCode, username, sessionToken, setView, initialHandData, initialGameUpdate }) {
  const [hand, setHand] = useState(initialHandData ? initialHandData.hand : []);
  const [discardTop, setDiscardTop] = useState(initialHandData && initialHandData.discard_top ? initialHandData.discard_top : null);
  const [stats, setStats] = useState({
    current_player: initialGameUpdate?.current_player || '',
    cards_left: initialGameUpdate?.cards_left || 0,
    stacked_cards: initialGameUpdate?.stacked_cards || 0,
    playing_color: initialGameUpdate?.playing_color || '',
    player_hands: initialGameUpdate?.player_hands || {},
    draw_deck_size: initialGameUpdate?.draw_deck_size || 0,
    discard_pile_size: initialGameUpdate?.discard_pile_size || 0,
    uno_flags: initialGameUpdate?.uno_flags || {},
    players: initialGameUpdate?.players || []
  });
  
  // Modals
  const [choosingColor, setChoosingColor] = useState(false);
  const [choosingPlayer, setChoosingPlayer] = useState(null); // array of players if active, else null
  const [pendingPlayInfo, setPendingPlayInfo] = useState(null); // { index, card }
  const [gameOver, setGameOver] = useState(null); // { winner }
  const [showCatchHint, setShowCatchHint] = useState(true);
  const [drawnRouletteCards, setDrawnRouletteCards] = useState([]);
  const rouletteTimeoutRef = useRef(null);
  const stackDrawTimeoutsRef = useRef([]);

  useEffect(() => {
    if (initialHandData) {
      setHand(initialHandData.hand);
      if (initialHandData.discard_top) setDiscardTop(initialHandData.discard_top);
    }
  }, [initialHandData]);

  useEffect(() => {
    if (initialGameUpdate) {
      setStats(prev => ({
        ...prev,
        current_player: initialGameUpdate.current_player || prev.current_player,
        cards_left: initialGameUpdate.cards_left || prev.cards_left,
        stacked_cards: initialGameUpdate.stacked_cards || prev.stacked_cards,
        playing_color: initialGameUpdate.playing_color || prev.playing_color,
        player_hands: initialGameUpdate.player_hands || prev.player_hands,
        draw_deck_size: initialGameUpdate.draw_deck_size || prev.draw_deck_size,
        discard_pile_size: initialGameUpdate.discard_pile_size || prev.discard_pile_size,
        uno_flags: initialGameUpdate.uno_flags || prev.uno_flags,
        players: initialGameUpdate.players || prev.players
      }));
      if (initialGameUpdate.discard_top) setDiscardTop(initialGameUpdate.discard_top);
    }
  }, [initialGameUpdate]);

  useEffect(() => {
    const onYourHand = (data) => {
      setHand(data.hand);
      if (data.discard_top) setDiscardTop(data.discard_top);
    };

    const onGameUpdate = (data) => {
      setStats({
        current_player: data.current_player,
        cards_left: data.cards_left,
        stacked_cards: data.stacked_cards,
        playing_color: data.playing_color,
        player_hands: data.player_hands || {},
        draw_deck_size: data.draw_deck_size,
        discard_pile_size: data.discard_pile_size,
        uno_flags: data.uno_flags || {},
        players: data.players || []
      });
      if (data.discard_top) setDiscardTop(data.discard_top);
    };

    const onCardDrawn = (data) => {
      if (data.player === username) {
        setHand(prev => [...prev, data.new_card]);
      }
    };

    const onPlayError = (data) => {
      alert(data.message);
      setChoosingColor(false);
      setPendingPlayInfo(null);
    };
    
    const onPlayerDisqualified = (data) => {
      alert(`${data.player} is eliminated from the game.`);
    };
    
    const onUnoCalled = (data) => {};
    
    const onUnoCaught = (data) => {
      alert(`${data.caller} caught ${data.target_player}! ${data.target_player} auto-drawing 2 cards.`);
    };

    const onSelectPlayerForSwap = (data) => {
      setChoosingPlayer(data.players);
    };
    
    const onPendingPlayerSelection = (data) => {
      if (data.needs_selection && data.current_player === username) {
        setChoosingPlayer(data.available_players);
      }
    };

    const onRoulette = () => setChoosingColor(true);
    
    const onPendingRoulette = (data) => {
      if (data.needs_selection && data.current_player === username) {
        setChoosingColor(true);
      }
    };

    const onGameOver = (data) => {
      setGameOver({ winner: data.winner });
      if (data.discard_top) setDiscardTop(data.discard_top);
      // Clean up any pending "Draw All" loops
      stackDrawTimeoutsRef.current.forEach(t => clearTimeout(t));
      stackDrawTimeoutsRef.current = [];
    };

    const onGameStarted = () => {
      setGameOver(null);
      // Clean up any pending "Draw All" loops
      stackDrawTimeoutsRef.current.forEach(t => clearTimeout(t));
      stackDrawTimeoutsRef.current = [];
      setHand([]);
      setDiscardTop(null);
      setChoosingColor(false);
      setChoosingPlayer(null);
      setPendingPlayInfo(null);
      setDrawnRouletteCards([]);
      setStats({
        current_player: '',
        cards_left: 0,
        stacked_cards: 0,
        playing_color: '',
        player_hands: {},
        draw_deck_size: 0,
        discard_pile_size: 0,
        uno_flags: {},
        players: []
      });
    };

    const onRouletteDraw = (data) => {
        if (data.player === username) return; // Local drawing player doesn't need to spectate themselves
        
        const newCard = { ...data.card_drawn, id: Date.now() + Math.random(), player: data.player };
        setDrawnRouletteCards(prev => [...prev, newCard]);

        if (rouletteTimeoutRef.current) {
            clearTimeout(rouletteTimeoutRef.current);
        }

        rouletteTimeoutRef.current = setTimeout(() => {
             setDrawnRouletteCards([]);
        }, 5000);
    };

    socket.on("your_hand", onYourHand);
    socket.on("game_update", onGameUpdate);
    socket.on("card_drawn", onCardDrawn);
    socket.on("play_error", onPlayError);
    socket.on("player_disqualified", onPlayerDisqualified);
    socket.on("uno_called", onUnoCalled);
    socket.on("uno_caught", onUnoCaught);
    socket.on("select_player_for_swap", onSelectPlayerForSwap);
    socket.on("pending_player_selection", onPendingPlayerSelection);
    socket.on("roulette", onRoulette);
    socket.on("pending_roulette", onPendingRoulette);
    socket.on("game_over", onGameOver);
    socket.on("game_started", onGameStarted);
    socket.on("roulette_draw", onRouletteDraw);

    // Request active states after listeners are confidently attached
    socket.emit("check_game_states", { room: roomCode });

    return () => {
      socket.off("your_hand", onYourHand);
      socket.off("game_update", onGameUpdate);
      socket.off("card_drawn", onCardDrawn);
      socket.off("play_error", onPlayError);
      socket.off("player_disqualified", onPlayerDisqualified);
      socket.off("uno_called", onUnoCalled);
      socket.off("uno_caught", onUnoCaught);
      socket.off("select_player_for_swap", onSelectPlayerForSwap);
      socket.off("pending_player_selection", onPendingPlayerSelection);
      socket.off("roulette", onRoulette);
      socket.off("pending_roulette", onPendingRoulette);
      socket.off("game_over", onGameOver);
      socket.off("game_started", onGameStarted);
      socket.off("roulette_draw", onRouletteDraw);
    };
  }, [username, roomCode]);

  const handlePlayCard = (index, card) => {
    if (stats.current_player !== username) {
        alert("It's not your turn!");
        return;
    }
    
    if (card.color === 'Wild' && card.type !== 'Color Roulette') {
      setPendingPlayInfo({ index, card });
      setChoosingColor(true);
    } else {
      socket.emit('play_card', { room: roomCode, index });
    }
  };

  const submitColor = (color) => {
    setChoosingColor(false);
    if (pendingPlayInfo) {
      socket.emit('play_card', { room: roomCode, index: pendingPlayInfo.index, color });
      setPendingPlayInfo(null);
    } else {
      socket.emit("color_selected", { room: roomCode, color });
    }
  };

  const submitPlayerSwap = (targetPlayer) => {
    setChoosingPlayer(null);
    socket.emit("player_selected_for_swap", { room: roomCode, selected_player: targetPlayer });
  };

  const handleDrawCard = () => {
    socket.emit("draw_card", { room: roomCode });
  };

  const handleCallUno = () => {
    socket.emit("call_uno", { room: roomCode });
  };
  
  const handleCatchUno = (target) => {
    socket.emit("catch_uno", { room: roomCode, target_player: target });
  };

  const leaveGame = () => {
      if (window.confirm("Leave game?")) {
        socket.emit("leave_room", { room: roomCode, username, session: sessionToken });
        localStorage.clear();
        setView('home');
      }
  };

  const returnToLobby = () => {
      setView('room');
  };

  const isMyTurn = !gameOver && stats.current_player === username && !choosingColor && !choosingPlayer;

  const rawPlayers = stats.players && stats.players.length > 0 ? stats.players : Object.keys(stats.player_hands || {});
  const myIndex = rawPlayers.indexOf(username);
  let orderedOpponents = [];
  if (myIndex !== -1) {
    orderedOpponents = [...rawPlayers.slice(myIndex + 1), ...rawPlayers.slice(0, myIndex)];
  } else {
    orderedOpponents = rawPlayers;
  }

  return (
    <div className="w-full max-w-6xl mx-auto h-[90vh] flex flex-col justify-between animate-slide-up relative">
      
      {showCatchHint && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-600/90 backdrop-blur-md text-white text-xs md:text-sm px-6 py-3 rounded-full flex items-center justify-between gap-4 shadow-2xl shadow-blue-500/50 animate-bounce border border-blue-400">
            <span>💡 <strong>Tip:</strong> Click an opponent's name box directly to CATCH them if they forget to say UNO!</span>
            <button onClick={() => setShowCatchHint(false)} className="text-white hover:text-blue-200 transition font-black ml-2 rounded-full px-2.5 py-0.5 bg-blue-800 scale-110 active:scale-95">×</button>
         </div>
      )}

      {/* Top Bar - Opponents */}
      <div className="flex flex-wrap justify-center gap-4 mb-4 z-10">
         {orderedOpponents.map((player, idx) => {
           const cnt = stats.player_hands[player];
           const isTurn = stats.current_player === player;
           return (
             <button 
                key={player} 
                onClick={() => handleCatchUno(player)}
                className={`relative glass-panel px-4 py-2 mt-2 flex flex-col items-center outline-none focus:outline-none transition cursor-pointer hover:scale-105 ${cnt === 1 && !stats.uno_flags[player] ? 'hover:bg-red-900/40 hover:ring-2 hover:ring-unoRed animate-pulse shadow-unoRed/40' : 'hover:bg-white/10'} ${isTurn && !(cnt === 1 && !stats.uno_flags[player]) ? 'ring-2 ring-primary bg-primary/20 shadow-xl shadow-primary/20' : ''}`}
             >
                 {orderedOpponents.length > 1 && idx === 0 && (
                     <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 rounded-md text-[10px] font-bold text-white tracking-widest shadow-md">NEXT</div>
                 )}
                 {orderedOpponents.length > 1 && idx === orderedOpponents.length - 1 && (
                     <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-700 border border-slate-500 rounded-md text-[10px] font-bold text-slate-300 tracking-widest shadow-md">PREV</div>
                 )}
                 <span className="font-bold whitespace-nowrap">{player} {stats.uno_flags[player] && <span className="text-unoRed animate-pulse ml-1">UNO!</span>}</span>
                 <span className="text-sm text-slate-300">{cnt} cards</span>
                 
                 {cnt === 1 && !stats.uno_flags[player] && (
                     <span className="flex items-center gap-1 mt-1 text-[10px] font-black uppercase text-unoRed opacity-80">
                         <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                         Click to Catch!
                     </span>
                 )}
             </button>
           );
         })}
      </div>

      {drawnRouletteCards.length > 0 && (
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center bg-transparent pointer-events-none w-full max-w-5xl">
              <div className="text-center mb-1 font-black text-white tracking-widest text-[10px] md:text-xs animate-pulse whitespace-nowrap bg-red-600/90 px-4 py-1.5 rounded-full shadow-2xl shadow-red-500/40 uppercase mb-4 z-10 border border-red-400">
                  {drawnRouletteCards[0].player} MINE-SWEEPING FOR COLOR...
              </div>
              <div className="card-container bg-black/60 backdrop-blur-md rounded-3xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,1)] pt-4 pb-8 flex items-center justify-center -space-x-10 px-12 transform scale-75 md:scale-90 lg:scale-100 transition-all duration-300">
                 {drawnRouletteCards.map((card, idx) => (
                    <Card key={card.id} card={card} index={idx} stacked={true} isPlayable={false} noOverlay={true} />
                 ))}
              </div>
          </div>
      )}

      {/* Center - Play Area */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 z-10">
         
         <div className="flex flex-col items-center space-y-2 relative">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Deck ({stats.draw_deck_size})</span>
            <div 
                className={`relative w-24 md:w-32 lg:w-40 rounded-xl cursor-pointer shadow-xl shadow-black/60 transition ${isMyTurn ? 'hover:scale-105 hover:ring-4 hover:ring-primary hover:shadow-primary/50' : 'opacity-70'}`}
                style={{ aspectRatio: '2/3' }}
                onClick={isMyTurn ? handleDrawCard : undefined}
            >
               <img src="/images/back.png" className="absolute inset-0 w-full h-full object-cover rounded-xl border border-white/10" alt="Draw Pile" />
            </div>

            {isMyTurn && stats.stacked_cards > 0 && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        // Prevent multiple clicks spawning multiple loops
                        if (stackDrawTimeoutsRef.current.length > 0) return;

                        const numToDraw = stats.stacked_cards;
                        Array.from({ length: numToDraw }).forEach((_, i) => {
                            const t = setTimeout(() => {
                                socket.emit('draw_card', { room: roomCode });
                                stackDrawTimeoutsRef.current = stackDrawTimeoutsRef.current.filter(x => x !== t);
                            }, i * 150);
                            stackDrawTimeoutsRef.current.push(t);
                        });
                    }}
                    className="absolute -bottom-10 bg-gradient-to-r from-red-600 to-red-800 text-white font-black text-[10px] sm:text-xs px-3 py-1 rounded-lg shadow-xl shadow-red-900/50 border border-red-400 hover:scale-105 active:scale-95 transition animate-pulse whitespace-nowrap z-30"
                >
                    DRAW ALL (+{stats.stacked_cards})
                </button>
            )}
         </div>

         <div className="flex flex-col items-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Discard Pile ({stats.discard_pile_size})</span>
            {discardTop && (
               <Card card={discardTop} stacked={false} isPlayable={false} noOverlay={true} />
            )}
         </div>

         {/* Game Stats Info block */}
         <div className="glass-panel p-4 flex flex-col space-y-2 ml-4">
             <div className="text-sm">
                <span className="text-slate-400">Current Turn:</span> <br/>
                <span className={`text-xl font-bold ${isMyTurn ? 'text-primary' : 'text-white'}`}>{stats.current_player}</span>
             </div>
             {stats.playing_color && (
                <div className="text-sm mt-2">
                    <span className="text-slate-400">Color:</span> <br/>
                    <span className="font-bold flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getHexForColor(stats.playing_color) }}></span>
                        {stats.playing_color}
                    </span>
                 </div>
             )}
             {stats.stacked_cards > 0 && (
                <div className="text-sm text-unoRed font-bold mt-2 animate-bounce">
                    Stack: +{stats.stacked_cards}
                </div>
             )}
             {isMyTurn && (
                <div className="mt-4 pointer-events-none bg-gradient-to-r from-primary to-purple-600 text-white font-black px-4 py-2 rounded-xl animate-pulse shadow-xl shadow-primary/40 border border-white/20 tracking-widest text-sm text-center">
                   ★ YOUR TURN ★
                </div>
             )}
         </div>
      </div>

      {/* Bottom - Player Hand */}
      <div className="w-full mt-4 flex flex-col items-center z-20 relative">
         <div className="flex justify-between items-end w-full max-w-3xl mb-2 px-4 gap-2">
             <button onClick={leaveGame} className="text-slate-400 hover:text-slate-200 transition bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">Leave</button>
             
             <div className="text-center font-bold text-slate-300 bg-black/40 px-6 py-1.5 rounded-full border border-white/5 whitespace-nowrap hidden sm:block">
                 <span className="text-primary mr-1 text-sm uppercase tracking-widest">You:</span> 
                 <span className="text-lg">{username}</span> 
                 {stats.uno_flags[username] && <span className="text-unoRed animate-pulse font-black ml-2 text-lg">UNO!</span>}
                 <span className="opacity-60 ml-2 text-sm italic">({hand.length} cards)</span>
             </div>

             <div className="text-center font-bold text-slate-300 bg-black/40 px-4 py-1.5 rounded-full border border-white/5 whitespace-nowrap sm:hidden">
                 <span className="text-primary mr-1 text-xs uppercase tracking-widest">You</span> 
                 {stats.uno_flags[username] && <span className="text-unoRed animate-pulse font-black ml-1 text-xs">UNO!</span>}
                 <span className="opacity-60 ml-1 text-xs italic">({hand.length})</span>
             </div>

             <button 
                onClick={handleCallUno}
                className="px-6 py-2 rounded-xl font-black italic tracking-wider shadow-lg transition bg-unoRed text-white hover:bg-red-600 shadow-unoRed/30 cursor-pointer"
             >
                UNO!
             </button>
         </div>

         <div className="card-container bg-surface/40 pb-12 pt-8 px-12 rounded-t-3xl backdrop-blur-md border-t border-white/10 w-full min-h-[220px] relative">
             {hand.map((card, idx) => (
                 <Card 
                    key={idx} 
                    card={card} 
                    index={idx} 
                    stacked={true} 
                    isPlayable={isMyTurn}
                    onPlay={handlePlayCard}
                 />
             ))}
         </div>
      </div>

      {choosingColor && (
         <div 
             id="color-picker-backdrop"
             className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
             onClick={(e) => {
                 if (e.target.id === "color-picker-backdrop" && pendingPlayInfo) {
                     setChoosingColor(false);
                     setPendingPlayInfo(null);
                 }
             }}
         >
            <div className="glass-panel p-8 text-center max-w-sm w-full animate-pop">
                <h3 className="text-2xl font-bold mb-6">Choose Color</h3>
                <div className="grid grid-cols-2 gap-4">
                    {['Red', 'Blue', 'Green', 'Yellow'].map(color => (
                        <button 
                            key={color} 
                            onClick={() => submitColor(color)}
                            className="h-24 rounded-2xl transform transition hover:scale-105 active:scale-95 shadow-xl border-4 border-transparent hover:border-white/50"
                            style={{ backgroundColor: getHexForColor(color) }}
                        ></button>
                    ))}
                </div>
                {pendingPlayInfo && (
                    <p className="mt-6 text-slate-400 text-sm italic">Click anywhere outside to cancel.</p>
                )}
            </div>
         </div>
      )}

      {choosingPlayer && choosingPlayer.length > 0 && (
         <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="glass-panel p-8 text-center max-w-md w-full animate-pop">
                <h3 className="text-2xl font-bold mb-6">Trade Hands With:</h3>
                <div className="flex flex-col gap-3">
                    {choosingPlayer.map(player => (
                        <button 
                            key={player} 
                            onClick={() => submitPlayerSwap(player)}
                            className="bg-surface hover:bg-primary py-3 rounded-xl font-bold transition text-lg"
                        >
                            {player}
                        </button>
                    ))}
                </div>
            </div>
         </div>
      )}

      {gameOver && (
         <div className="fixed inset-0 z-[200] pointer-events-none flex flex-col items-start justify-start p-8 md:p-12 bg-black/20">
            <div className="glass-panel p-6 text-center w-full max-w-lg mx-auto animate-pop pointer-events-auto border-t-4 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.2)] mt-8">
                <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-2 uppercase tracking-tight drop-shadow-lg">Game Over</h2>
                <div className="text-center font-bold mb-8 mt-4">
                    {gameOver.winner === username ? (
                        <span className="text-green-400 text-3xl block animate-bounce drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]">🏆 You Won! 🏆</span>
                    ) : (
                        <span className="text-slate-100 text-2xl block">{gameOver.winner} Won!</span>
                    )}
                </div>
                <button 
                    onClick={returnToLobby}
                    className="btn-primary w-full py-4 text-lg font-bold shadow-xl shadow-primary/30 active:scale-95 transition"
                >
                    Return to Lobby →
                </button>
            </div>
         </div>
      )}

    </div>
  );
}

function getHexForColor(c) {
    const m = {
        'Red': '#ef4444',
        'Blue': '#3b82f6',
        'Green': '#22c55e',
        'Yellow': '#eab308',
        'Wild': '#888'
    };
    return m[c] || '#888';
}
