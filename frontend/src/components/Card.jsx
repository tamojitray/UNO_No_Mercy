import React from 'react';

// Maps card values to image paths
function getImagePath(color, typeOrValue) {
  if (color === 'Wild') {
      return `/images/wild_${typeOrValue.toLowerCase().replaceAll(' ', '_')}.png`;
  }
  const val = typeOrValue.toString().toLowerCase().replaceAll(' ', '_');
  return `/images/${color.toLowerCase()}_${val}.png`;
}

export default function Card({ card, index, onPlay, isPlayable, stacked, noOverlay }) {
  const imageUrl = getImagePath(card.color, card.type || card.value);
  const zIndex = index ? index : 0;

  return (
    <div 
      className={`relative group ${stacked ? 'stacked-card' : ''} ${isPlayable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      style={{ zIndex }}
      onClick={() => isPlayable && onPlay(index, card)}
    >
      <img 
        src={imageUrl} 
        alt={`${card.color} ${card.type || card.value}`} 
        className={`w-24 sm:w-28 md:w-32 lg:w-40 rounded-xl transition-all duration-300 ${isPlayable ? 'hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:z-50' : ''}`}
      />
    </div>
  );
}
