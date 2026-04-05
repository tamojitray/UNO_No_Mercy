import React from 'react';

export default function RulesModal({ onClose }) {
  const rulings = [
    {
       title: "Winning the Game",
       description: "The primary goal is to be the first player to successfully discard all your cards. Alternatively, simply be the very last player surviving the brutal 25-card Mercy Rule elimination!",
       images: []
    },
    {
       title: "Matching Cards",
       description: "Play a card from your hand that strictly matches the top card of the discard pile by either Color, Number, or Symbol. If you don't have a match, you must click the deck to DRAW a card, or play a Wild!",
       images: ["/images/blue_5.png", "/images/red_5.png"]
    },
    {
       title: "Calling & Catching UNO",
       description: "You MUST press the 'Call UNO' button before playing your second-to-last card. If you forget, and an opponent clicks your name box at the top to Catch you before you fix it, you are penalized with 2 cards!",
       images: ["/images/back.png"]
    },
    {
       title: "The Mercy Rule",
       description: "Show No Mercy! If at any point a player acquires 25 or more cards in their hand from drawing penalties, they are instantly eliminated from the game.",
       images: []
    },
    {
      title: "Draw Cards",
      description: "Forces the next player to draw cards and lose their turn. These cards CAN be stacked! For example, playing a +4 on a +2 makes the next player draw 6.",
      images: ["/images/red_draw_two.png", "/images/blue_draw_four.png"]
    },
    {
       title: "Skip Everyone",
       description: "Skips every single opponent's turn. It instantly becomes your turn again!",
       images: ["/images/green_skip_all.png"]
    },
    {
       title: "Discard All",
       description: "Allows you to instantly discard all cards in your hand that match this card's color. Play it, and all of your matching cards vanish!",
       images: ["/images/yellow_discard_all_of_color.png"]
    },
    {
       title: "Wild Color Roulette",
       description: "Choose a wild color. The next player must continuously draw cards from the deck until they finally find a card of that color! They lose their turn.",
       images: ["/images/wild_color_roulette.png"]
    },
    {
       title: "Wild Reverse Draw 4",
       description: "Reverses the direction of play AND forces the new next player to draw 4 cards and lose their turn. You choose the next color.",
       images: ["/images/wild_reverse_draw_four.png"]
    },
    {
       title: "Wild Draw 6 & 10",
       description: "Heavy artillery. Choose a color, and obliterate the next player by forcing them to draw 6 or 10 cards. They lose their turn.",
       images: ["/images/wild_draw_six.png", "/images/wild_draw_ten.png"]
    },
    {
       title: "The '7' Rule (Swap Hands)",
       description: "When you play any 7 card, you MUST select any other player and instantly swap entire hands with them.",
       images: ["/images/red_7.png"]
    },
    {
       title: "The '0' Rule (Pass Hands)",
       description: "When anyone plays a 0 card, every single player passes their entire hand to the next player in the current direction of play.",
       images: ["/images/blue_0.png"]
    }
  ];

  return (
    <div 
       className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
       onClick={(e) => { 
           if (e.target === e.currentTarget) onClose();
       }}
    >
        <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[0_0_60px_-15px_rgba(0,0,0,1)] shadow-primary/30 animate-scale-up">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
               <h2 className="text-3xl font-black text-white tracking-tight">UNO <span className="text-unoRed uppercase tracking-widest text-2xl bg-unoRed/10 px-3 py-1 rounded-lg ml-2">No Mercy</span></h2>
               <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500/80 rounded-full w-10 h-10 flex items-center justify-center transition font-black text-xl z-50 hover:shadow-xl hover:shadow-red-500/50">×</button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-white/20">
               {rulings.map((r, i) => (
                  <div key={i} className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-slate-800/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800 transition">
                     {r.images.length > 0 && (
                        <div className="flex justify-center items-center shrink-0 min-w-[120px]">
                           {r.images.map((img, j) => (
                              <img 
                                 key={j} 
                                 src={img} 
                                 alt={r.title} 
                                 className={`w-20 sm:w-24 rounded-lg shadow-xl shadow-black border border-white/10 cursor-pointer hover:scale-125 hover:rotate-0 hover:z-50 transition-all duration-300 ${j > 0 ? '-ml-10 z-10 transform rotate-12' : 'z-0 -rotate-6'}`} 
                              />
                           ))}
                        </div>
                     )}
                     <div className={`flex-1 text-center md:text-left ${r.images.length === 0 ? 'md:text-center w-full' : ''}`}>
                        <h3 className="text-xl font-bold text-primary mb-2 uppercase tracking-wide">{r.title}</h3>
                        <p className="text-slate-300 leading-relaxed text-sm md:text-base">{r.description}</p>
                     </div>
                  </div>
               ))}
               <div className="text-center pt-4 opacity-50 text-xs uppercase tracking-widest">
                  Click anywhere outside this box to close
               </div>
            </div>
        </div>
    </div>
  );
}
