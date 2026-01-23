// Sliding functionality
const mainContent = document.querySelector('.main-content');
const createRoomContent = document.querySelector('.create-room-content');
const joinRoomContent = document.querySelector('.join-room-content');

let errorTimeout; // To track and clear existing timeouts

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    
    // Clear any existing timeout to reset the timer if a new error occurs
    if (errorTimeout) {
        clearTimeout(errorTimeout);
    }
    
    // Set the message and show the container
    errorMessage.innerHTML = message;
    errorMessage.style.display = 'block';
    
    // Fade in after a slight delay to trigger the transition
    setTimeout(() => {
        errorMessage.style.opacity = '1';
    }, 10);
    
    // Fade out after 5 seconds and hide the container
    errorTimeout = setTimeout(() => {
        errorMessage.style.opacity = '0';
        errorMessage.addEventListener('transitionend', function handler() {
            errorMessage.style.display = 'none';
            errorMessage.removeEventListener('transitionend', handler); // Clean up
        });
    }, 5000);
}

document.getElementById('create-room-btn').addEventListener('click', function() {
    mainContent.classList.remove('active');
    mainContent.classList.add('left');
    createRoomContent.classList.remove('right');
    createRoomContent.classList.add('active');
});

document.getElementById('join-room-btn').addEventListener('click', function() {
    mainContent.classList.remove('active');
    mainContent.classList.add('left');
    joinRoomContent.classList.remove('right');
    joinRoomContent.classList.add('active');
});

const backBtns = document.querySelectorAll('.back-btn');
backBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const currentSection = btn.closest('.section');
        currentSection.classList.remove('active');
        currentSection.classList.add('right');
        mainContent.classList.remove('left');
        mainContent.classList.add('active');
    });
});

// Form submission logic
document.getElementById('create-room-submit').addEventListener('click', function() {
    let playerName = document.getElementById('create-player-name').value.trim();

    if (!playerName || /^\d+$/.test(playerName)) {
        showError("Name must contain at least one letter and cannot be empty.");
        return;
    }

    fetch('/create_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName })
    })
    .then(response => response.json())
    .then(data => {
        localStorage.setItem('session_token', data.session_token);
        window.location.href = `/room/${data.room_code}`;
    })
    .catch(error => console.error('Error creating room:', error));
});

document.getElementById('join-room-submit').addEventListener('click', function() {
    let playerName = document.getElementById('join-player-name').value.trim();
    let roomCode = document.getElementById('join-room-code').value.trim().toUpperCase();

    if (!playerName || /^\d+$/.test(playerName)) {
        showError("Name must contain at least one letter and cannot be empty.");
        return;
    }

    if (!roomCode) {
        showError("Room code cannot be empty.");
        return;
    }

    fetch('/join_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName, room_code: roomCode })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'joined') {
            localStorage.setItem('session_token', data.session_token);
            window.location.href = `/room/${roomCode}`;
        } else if (data.status === 'duplicate') {
            showError("Name already exists in the room. Please choose another name.");
        } else if (data.status === 'room_full') {
            showError("Room is full! Maximum 6 players allowed.");
        } else if (data.status === 'game_started') {
            showError("Game has already started. Cannot join.");
        } else {
            showError("Room not found.");
        }
    })
    .catch(error => console.error('Error joining room:', error));
});