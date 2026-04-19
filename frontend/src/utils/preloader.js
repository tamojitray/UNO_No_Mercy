const COLORS = ['red', 'green', 'blue', 'yellow'];
const TYPES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'skip_all', 'reverse', 'draw_two', 'draw_four', 'discard_all_of_color'];
const WILDS = ['reverse_draw_four', 'draw_six', 'draw_ten', 'color_roulette'];

export const getAllCardImageUrls = () => {
    const urls = [];
    
    // Add back card
    urls.push('/images/back.png');
    
    // Colored cards
    COLORS.forEach(color => {
        TYPES.forEach(type => {
            urls.push(`/images/${color}_${type}.png`);
        });
    });
    
    // Wild cards
    WILDS.forEach(type => {
        urls.push(`/images/wild_${type}.png`);
    });
    
    return urls;
};

export const preloadImages = (urls) => {
    console.log(`Preloading ${urls.length} images...`);
    urls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
};
