import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

const Chat = ({ roomCode, username }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!isMinimized) {
            scrollToBottom();
            setUnreadCount(0);
        }
    }, [messages, isMinimized]);

    useEffect(() => {
        function onReceiveMessage(data) {
            setMessages(prev => [...prev, data]);
            if (isMinimized) {
                setUnreadCount(prev => prev + 1);
            }
        }

        socket.on('receive_message', onReceiveMessage);

        return () => {
            socket.off('receive_message', onReceiveMessage);
        };
    }, [isMinimized]);

    const sendMessage = (e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed) {
            socket.emit('send_message', {
                room: roomCode,
                message: trimmed
            });
            setInput('');
        }
    };

    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
        if (isMinimized) {
            setUnreadCount(0);
        }
    };

    return (
        <div className={`fixed bottom-6 right-6 w-80 bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[200] transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 translate-y-2' : 'h-96'}`}>
            <div 
                className="bg-gradient-to-r from-green-600 to-green-500 p-3 flex items-center justify-between border-b border-white/10 cursor-pointer select-none"
                onClick={toggleMinimize}
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-sm tracking-wide">ROOM CHAT</h3>
                    {isMinimized && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce shadow-lg shadow-red-500/50">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></div>
                    <button className="text-white/80 hover:text-white transition">
                        {isMinimized ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
            
            {!isMinimized && (
                <>
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-900/50">
                        {messages.length === 0 && (
                            <div className="text-slate-500 text-xs text-center mt-10 italic">
                                No messages yet. Say hi!
                            </div>
                        )}
                        {messages.map((msg, idx) => {
                            const isMe = msg.username === username;
                            return (
                                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {!isMe && <span className="text-[10px] font-bold text-green-400 uppercase">{msg.username}</span>}
                                        <span className="text-[9px] text-slate-500 font-medium">{msg.timestamp}</span>
                                    </div>
                                    <div className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${
                                        isMe 
                                        ? 'bg-green-600 text-white rounded-tr-none' 
                                        : 'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-none'
                                    }`}>
                                        {msg.message}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-3 bg-black/40 border-t border-white/10 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type message..."
                            className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500/50 transition"
                        />
                        <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-xl transition active:scale-95 shadow-lg shadow-green-900/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </>
            )}

            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
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
            `}</style>
        </div>
    );
};

export default Chat;
