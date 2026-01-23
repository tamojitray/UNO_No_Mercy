document.addEventListener("DOMContentLoaded", function () {
    var socket = io();
    var roomCode = window.roomCode;
    var playerList = document.getElementById("player-list");
    var leaveButton = document.getElementById("leave-room-btn");
    var startGameButton = document.getElementById("start-game-btn");
    var drawButton = document.getElementById("draw-card-btn");
    var newGameButton = document.getElementById("new-game-btn");
    var callUnoButton = document.getElementById("call-uno-btn");


    let currentHand = [];

    // Retrieve username from localStorage
    var sessionToken = localStorage.getItem("session_token");

    if (!sessionToken) {
        alert("Session expired or missing. Please rejoin the room.");
        window.location.href = "/";
        return;
    }

    callUnoButton.addEventListener("click", function () {
        socket.emit("call_uno", { room: roomCode });
    });

    drawButton.addEventListener("click", function() {
        socket.emit("draw_card", { room: roomCode });
    });

    // Add click handler for new game button
    newGameButton.addEventListener("click", function() {
        localStorage.removeItem("session_token");
        localStorage.removeItem("username");
        window.location.href = "/";
    });

    function updatePlayerList(players, gameStarted, playerHands = {}, unoFlags = {}) {
        playerList.innerHTML = "";
        players.forEach((player, index) => {
            let li = document.createElement("li");
            let cardCount = gameStarted && playerHands[player] !== undefined ? playerHands[player] : "N/A";
            let unoStatus = unoFlags[player] ? " (UNO)" : "";
            li.textContent = `${player}${unoStatus} (${cardCount} cards)`;
    
            if (gameStarted && player !== localStorage.getItem("username")) {
                let caughtButton = document.createElement("button");
                caughtButton.textContent = "Caught";
                caughtButton.style.marginLeft = "10px";
                caughtButton.addEventListener("click", () => {
                    socket.emit("catch_uno", { room: roomCode, target_player: player });
                });
                li.appendChild(caughtButton);
            }
    
            playerList.appendChild(li);
    
            if (!gameStarted && index === 0 && player === localStorage.getItem("username")) {
                startGameButton.classList.remove("hidden");
            }
        });
        // Removed the conditional display of callUnoButton; it will always be visible in HTML
    }

    function getCardColor(color) {
        const colors = {
            'Red': '#ff0000',
            'Blue': '#0000ff',
            'Green': '#00ff00',
            'Yellow': '#ffff00',
            'Wild': '#808080'
        };
        return colors[color] || '#ffffff';
    }

    function getCardImage(color, value) {
        const baseUrl = '/static/images/'; // Assuming you'll store card images in this directory
        // Handle wild cards

        if (color === 'Wild') {
            return `${baseUrl}wild_${value.toLowerCase().replaceAll(' ', '_')}.png`;
        }
        
        // Handle number cards and action cards
        const cardValue = value.toString().toLowerCase().replaceAll(' ', '_');
        return `${baseUrl}${color.toLowerCase()}_${cardValue}.png`;
    }
    
    function updateHandDisplay() {
        const container = document.getElementById('hand-container');
        container.innerHTML = '';
        currentHand.forEach((card, index) => {
            const cardBtn = document.createElement('button');
            cardBtn.className = 'card';

            // Create card container div
            const cardContainer = document.createElement('div');
            cardContainer.style.textAlign = 'center';

            // Add card image
            const cardImage = document.createElement('img');
            cardImage.src = getCardImage(card.color, card.type || card.value);
            cardImage.alt = `${card.color} ${card.type || card.value}`;
            cardImage.className = 'card-image';
            cardImage.style.width = '150px';
            
            // Add card caption
            const caption = document.createElement('div');
            caption.textContent = `${card.color} ${card.type || card.value}`;
            caption.style.marginTop = '5px';

            cardContainer.appendChild(cardImage);
            cardContainer.appendChild(caption);
            
            cardBtn.appendChild(cardContainer);
            cardBtn.dataset.index = index;
        
            cardBtn.addEventListener('click', () => handlePlayCard(index, card));
            container.appendChild(cardBtn);
        });
    }

    async function handlePlayCard(index, card) {
        if (card.color === 'Wild' && card.type !== 'Color Roulette') {
            const color = await promptColor();
            if (!color) return;
            socket.emit('play_card', {
                room: roomCode,
                index: index,
                color: color
            });
        } else {
            socket.emit('play_card', {
                room: roomCode,
                index: index
            });
        }
    }

    // Add this new function near your other utility functions
    function updateDiscardTopDisplay(discardTop) {
        const discardTopDiv = document.getElementById('discard-top');
        discardTopDiv.innerHTML = ''; // Clear existing content
        
        // Create container div
        const cardContainer = document.createElement('div');
        cardContainer.style.textAlign = 'center';
        
        const cardImage = document.createElement('img');
        cardImage.src = getCardImage(discardTop.color, discardTop.type || discardTop.value);
        cardImage.alt = `${discardTop.color} ${discardTop.type || discardTop.value}`;
        cardImage.style.width = '150px'; // Match the size of hand cards
        cardImage.style.height = 'auto';
        
        // Add card caption
        const caption = document.createElement('div');
        caption.textContent = `${discardTop.color} ${discardTop.type || discardTop.value}`;
        caption.style.marginTop = '5px';

        cardContainer.appendChild(cardImage);
        cardContainer.appendChild(caption);
        discardTopDiv.appendChild(cardContainer);
    }

    function promptColor() {
        return new Promise(resolve => {
            const overlay = showOverlayPrompt(`
                <div style="width:100%;text-align:center;">
                    <p style="font-size:2rem;margin-bottom:2rem;">Choose a color:</p>
                    <div style="display:flex;justify-content:center;gap:40px;">
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button style="background: red; width:100px; height:100px; border-radius:50%; border:none; font-size:1.5rem; color:white;" data-color="Red"></button>
                            <span style="margin-top:10px; font-size:1.3rem; text-align:center;">Red</span>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button style="background: blue; width:100px; height:100px; border-radius:50%; border:none; font-size:1.5rem; color:white;" data-color="Blue"></button>
                            <span style="margin-top:10px; font-size:1.3rem; text-align:center;">Blue</span>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button style="background: green; width:100px; height:100px; border-radius:50%; border:none; font-size:1.5rem; color:white;" data-color="Green"></button>
                            <span style="margin-top:10px; font-size:1.3rem; text-align:center;">Green</span>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:center;">
                            <button style="background: yellow; width:100px; height:100px; border-radius:50%; border:none; font-size:1.5rem; color:black;" data-color="Yellow"></button>
                            <span style="margin-top:10px; font-size:1.3rem; text-align:center;">Yellow</span>
                        </div>
                    </div>
                </div>
            `);
    
            overlay.querySelectorAll('button[data-color]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    removeOverlayPrompt();
                    resolve(e.target.dataset.color);
                });
            });
        });
    }
    
    function showOverlayPrompt(innerHtml) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'custom-overlay-prompt';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        // Prevent interaction with rest of the page
        document.body.style.pointerEvents = 'none';

        // Prompt content
        const promptBox = document.createElement('div');
        promptBox.style.background = 'white';
        promptBox.style.padding = '40px';
        promptBox.style.borderRadius = '20px';
        promptBox.style.boxShadow = '0 0 30px #0008';
        promptBox.style.minWidth = '350px';
        promptBox.style.minHeight = '200px';
        promptBox.style.display = 'flex';
        promptBox.style.flexDirection = 'column';
        promptBox.style.alignItems = 'center';
        promptBox.style.justifyContent = 'center';
        promptBox.innerHTML = innerHtml;

        overlay.appendChild(promptBox);
        document.body.appendChild(overlay);

        // Only allow interaction with the prompt
        promptBox.style.pointerEvents = 'auto';

        return overlay;
    }

    function removeOverlayPrompt() {
        const overlay = document.getElementById('custom-overlay-prompt');
        if (overlay) overlay.remove();
        document.body.style.pointerEvents = 'auto';
    }

    function promptPlayerSelection(players) {
        return new Promise(resolve => {
            const overlay = showOverlayPrompt(`
                <div style="width:100%;text-align:center;">
                    <p style="font-size:2rem;margin-bottom:2rem;">Choose a player to swap hands with:</p>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px;">
                        ${players.map(player => `<button style="font-size:1.5rem;padding:20px 40px;min-width:180px;" data-player="${player}">${player}</button>`).join('')}
                    </div>
                </div>
            `);

            overlay.querySelectorAll('button[data-player]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    removeOverlayPrompt();
                    resolve(e.target.dataset.player);
                });
            });
        });
    }

    // Fetch username from session token
    fetch('/get_username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            let username = data.username;
            localStorage.setItem("username", username);

            // Emit event to join room
            socket.emit("join_room", { room: roomCode, username: username, session: sessionToken });

            // Add this line to check both states after joining
            socket.emit("check_game_states", { room: roomCode });

            // Add this new line to check roulette state after joining
            socket.emit("check_roulette_state", { room: roomCode });

            socket.on("update_players", function (data) {
                if (!data.game_started) {
                    updatePlayerList(data.players, data.game_started);
                }
            });
            
            socket.on("game_started", function (data) {
                console.log("=== GAME STARTED ===");
                console.log("Initial Discard:", data.discard_top);
                console.log("Cards Remaining:", data.cards_left);
                console.log("====================");      
                
                alert("Game has started! No new players can join.");
                updatePlayerList(data.shuffled_players, true);
                startGameButton.classList.add("hidden");
            });

            socket.on("your_hand", function (data) {
                console.log("=== YOUR HAND ===");
                console.log("Cards:", data.hand);
                console.log("Discard Pile Top:", data.discard_top);
                console.log("Cards Left in Deck:", data.cards_left);
                console.log("==================");

                currentHand = data.hand;
                updateHandDisplay();
                
                updateDiscardTopDisplay(data.discard_top); // Update this line
            });

            // Add new handler for checking game states
            socket.on("pending_player_selection", async function(data) {
                if (data.needs_selection && data.current_player === username) {
                    console.log("=== RESUMING PLAYER SELECTION ===");
                    try {
                        const selectedPlayer = await promptPlayerSelection(data.available_players);
                        if (selectedPlayer) {
                            socket.emit("player_selected_for_swap", { 
                                room: roomCode,
                                selected_player: selectedPlayer
                            });
                        }
                    } catch (error) {
                        console.error("Player selection failed:", error);
                    }
                }
            });

            // Add new handler for pending roulette check
            socket.on("pending_roulette", async function(data) {
                if (data.needs_selection && data.current_player === username) {
                    console.log("=== RESUMING ROULETTE SELECTION ===");
                    try {
                        const color = await promptColor();
                        if (color) {
                            socket.emit("color_selected", { 
                                room: roomCode,
                                color: color
                            });
                        }
                    } catch (error) {
                        console.error("Color selection failed:", error);
                    }
                }
            });

            socket.on("select_player_for_swap", async function(data) {
                console.log("=== SELECT PLAYER FOR SWAP ===");
                console.log("Available Players:", data.players);
                console.log("==============================");
                
                try {
                    const selectedPlayer = await promptPlayerSelection(data.players);
                    socket.emit("player_selected_for_swap", { 
                        room: roomCode,
                        selected_player: selectedPlayer
                    });
                } catch (error) {
                    console.error("Player selection failed:", error);
                }
            });

            // Add new event listener for game state updates
            socket.on("game_update", function(data) {
                document.getElementById('current-turn').textContent = `Current turn: ${data.current_player}`;
                updateDiscardTopDisplay(data.discard_top); // Replace the old discard-top update

                const discardTopDiv = document.getElementById('discard-top');
                if (data.discard_top.color === 'Wild') {
                    discardTopDiv.style.backgroundColor = "#808080";
                } else {
                    discardTopDiv.style.backgroundColor = getCardColor(data.playing_color);
                }

                document.getElementById('draw-deck-size').textContent = `Draw Deck Size: ${data.draw_deck_size}`;
                document.getElementById('discard-pile-size').textContent = `Discard Pile Size: ${data.discard_pile_size}`;  

                document.getElementById('stack-counter').textContent = `Stack: ${data.stacked_cards}`;  // Update stack counter
                document.getElementById('playing-color').textContent = `Playing Color: ${data.playing_color || 'None'}`;  // Update playing color               
                // Update player list with hand sizes
                updatePlayerList(
                    data.player_hands ? Object.keys(data.player_hands) : [],
                    true,
                    data.player_hands,
                    data.uno_flags
                );

                const currentUser = localStorage.getItem("username");
                if (data.current_player === currentUser) {
                    drawButton.classList.remove("hidden");
                } else {
                    drawButton.classList.add("hidden");
                }
            });

            socket.on("play_error", function(data) {
                alert(data.message);
            });

            socket.on("uno_called", function (data) {
                // alert(`${data.player} called UNO!`);
            });

            socket.on("uno_caught", function (data) {
                alert(`${data.caller} caught ${data.target_player}! ${data.target_player} auto-drawing 2 cards.`);
            });

            socket.on("player_disqualified", function(data) {
                alert(data.player + " is eliminated");
            });

            socket.on("roulette", async function() {
                console.log("=== SPIN ROULETTE ===");
                try {
                    const color = await promptColor();
                    socket.emit("color_selected", { 
                        room: roomCode,
                        color: color
                    });
                } catch (error) {
                    console.error("Color selection failed:", error);
                }
            });

            socket.on("card_drawn", function (data) {
                console.log("=== CARD DRAWN ===");
                console.log("Player:", data.player);
                console.log("New Card:", data.new_card);
                console.log("Remaining Cards:", data.cards_left);
                console.log("==================");

                // Add new cards to current hand
                currentHand.push(data.new_card);
                updateHandDisplay();
                
            });

            socket.on("room_full", function (data) {
                console.log("Room full event received:", data);
                alert(data.message);
                window.location.href = "/";
            });

            socket.on("room_deleted", function (data) {
                console.log("Room deleted event received:", data);
                alert(data.message);
                window.location.href = "/";
            });
            
            socket.on("roulette_draw", function (data) {
                console.log("Roulette Card Drawn");
                console.log(data.card_drawn);

            });

            socket.on("game_over", function (data) {
                updateDiscardTopDisplay(data.discard_top); // Update this line
                // Hide game controls
                drawButton.classList.add("hidden");
                leaveButton.style.display = 'none';
                // Show new game button
                newGameButton.classList.remove("hidden");
                alert(data.winner + " has won the game!");
            });

            leaveButton.addEventListener("click", function () {
                const confirmation = confirm("Are you sure you want to leave the room?");
                if (confirmation) {
                    socket.emit("leave_room", { room: roomCode, username: username, session: sessionToken });
                    localStorage.removeItem("session_token");
                    localStorage.removeItem("username");
                    window.location.href = "/";
                }
            });

            startGameButton.addEventListener("click", function () {
                fetch('/start_game', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room_code: roomCode, username: username })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === "started") {
                        alert("Game started!");
                        socket.emit("game_started", { room: roomCode });
                    } else if (data.status === "not_enough_players") {
                        alert("At least 2 players are required to start the game.");
                    } else {
                        alert("You are not authorized to start the game.");
                    }
                });
            });

        } else {
            alert("Session invalid. Please rejoin the room.");
            localStorage.removeItem("session_token");
            window.location.href = "/";
        }
    })
    .catch(error => console.error('Error verifying session:', error));
});