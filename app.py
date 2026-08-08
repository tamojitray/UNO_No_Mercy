from flask import Flask, render_template, request, jsonify, make_response, send_from_directory
from flask_socketio import SocketIO, join_room, leave_room, emit
import os
import random
import string
import secrets
import threading
import time
from flask_cors import CORS

from game import Unogame

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

rooms = {} # {'ROOMID' : {'player' : ['playername1','playername1'], 'started' : Flase, 'game' : None, 'coins': {}}}
sessions = {} # {'7c40fd705e1511751f6fbf5dd94936c7': {'username': 'player1', 'room_code': 'ANOLXK'}}
user_sockets = {} # {'_41gysDDBbyMJtXhAAAB': '7c40fd705e1511751f6fbf5dd94936c7'}
disconnect_timers = {}
connected_clients = set()

def broadcast_total_players():
    """Broadcasts the total number of live players to all connected clients."""
    socketio.emit("total_players_update", {"total_players": len(connected_clients)})

def emit_player_hand(player_name, room_code):
    """Helper to emit hand data and valid indices to a specific player."""
    sids = [sid for sid, token in user_sockets.items() if token in sessions and sessions[token]['username'] == player_name and sessions[token]['room_code'] == room_code]
    if room_code in rooms and rooms[room_code]['game']:
        game = rooms[room_code]['game']
        for sid in sids:
            socketio.emit("your_hand", {
                "hand": game.hands.get(player_name, []),
                "discard_top": game.top_card() if game.discard_pile else None,
                "cards_left": game.cards_remaining(),
                "valid_indices": game.get_valid_indices(player_name)
            }, room=sid)

def broadcast_game_state(room_code, player_who_acted=None):
    """Broadcasts game update to all and hand updates to relevant players."""
    if room_code not in rooms or rooms[room_code]['game'] is None:
        return
    game = rooms[room_code]['game']
    socketio.emit("game_update", {
        "current_player": game.current_players_turn(),
        "discard_top": game.top_card(),
        "cards_left": game.cards_remaining(),
        "stacked_cards": game.stacked_cards,
        "playing_color": game.playing_color,
        "player_hands": {p: len(game.hands[p]) for p in game.players},
        "draw_deck_size": len(game.deck),
        "discard_pile_size": len(game.discard_pile),
        "uno_flags": game.uno_flags,
        "players": game.players,
        "coins_available": game.coins_available if game and hasattr(game, "coins_available") else {},
        "player_coins": getattr(game, 'player_coins', {}),
        "awaiting_wild_discard_all_color": getattr(game, 'awaiting_wild_discard_all_color', False),
        "final_attack_pending": getattr(game, 'final_attack_pending', {}),
        "final_attack_attacker": getattr(game, 'final_attack_attacker', None),
        "awaiting_final_attack_color": getattr(game, 'awaiting_final_attack_color', False),
        "roulette": getattr(game, 'roulette', False),
        "roulette_attacker": getattr(game, 'roulette_attacker', None),
        "no_mercy_doubled": getattr(game, 'no_mercy_doubled', False),
        "min_stack_draw_value": getattr(game, 'min_stack_draw_value', 0)
    }, room=room_code)    
    # Update current player's hand (for valid indices)
    emit_player_hand(game.current_players_turn(), room_code)
    
    # Update the player who just acted (to refresh their hand)
    if player_who_acted and player_who_acted != game.current_players_turn():
        emit_player_hand(player_who_acted, room_code)

def generate_room_code():
    room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    while room_code in rooms:
        room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return room_code

def cleanup_room(room_code):
    """Thoroughly cleans up all data associated with a room code."""
    if room_code in rooms:
        del rooms[room_code]
    
    # Clean up sessions
    tokens_to_del = [t for t, s in sessions.items() if s.get('room_code') == room_code]
    for t in tokens_to_del:
        sessions.pop(t, None)
        # Also clean up sockets pointing to these tokens
        sids_to_del = [sid for sid, token in user_sockets.items() if token == t]
        for sid in sids_to_del:
            user_sockets.pop(sid, None)
        # Stop timers
        stop_thread(t)
    
    print(f"Room {room_code} and all associated sessions/sockets cleaned up.")

def generate_session_token():
    session_token = secrets.token_hex(16)
    while session_token in sessions:
        session_token = secrets.token_hex(16)
    return session_token

def start_thread(token, username, room_code):
        stop_event = threading.Event()
        thread = threading.Thread(target=delayed_removal, args=(token, stop_event, username, room_code))
        disconnect_timers[token] = (thread, stop_event)
        thread.start()

def stop_thread(token):
    timer_data = disconnect_timers.pop(token, None)
    if timer_data:
        print(f"Cancelled removal of {token}...")
        timer_data[1].set()  # Set the stop event
        if timer_data[0] != threading.current_thread():
            timer_data[0].join()  # Wait for the thread to finish if it's not the current one
    else:
        print(f"{token} not found.")

def delayed_removal(token, stop_event, username, room_code):
    print(f"Started removing of {token}...")

    # Starting a 30s timer
    for _ in range(90):
        if stop_event.is_set():
            print(f"User {username} with session token {token} rejoined, skipping removal.")
            return
        time.sleep(1)

    with app.app_context():
        # Checking if room and username exists before removing
        if room_code in rooms:
            room_data = rooms[room_code]
            current_game = room_data.get('game')

            if username in room_data['players']:
                # Remove the disconnected player
                room_data['players'].remove(username)

                if len(room_data['players']) == 1 and current_game is None:
                    # Notify the remaining player if game hasn't started or no game object
                    # Actually, if game is None, we just update players.
                    # If game HAS started, it's handled below in the current_game block.
                    pass

                # Case 1: Room is now empty
                if not room_data['players']:
                    print(f"Room {room_code} empty. Deleting and notifying.")
                    socketio.emit("room_deleted", {"message": "Game ended as all players left"}, room=room_code)
                    cleanup_room(room_code)
                    return

                # Handle game-specific removal
                if current_game is not None:
                    if current_game.remove_player(username):
                        print(f"Removed {username} from active game in {room_code}")

                        # If only one player left after removal, end the game
                        if len(current_game.players) == 1:
                            handle_game_over(room_code, current_game.players[0], current_game)

            # Cleanup session and timers
            if token in sessions:
                del sessions[token]
            disconnect_timers.pop(token, None)

            # Broadcast updates
            if room_data['started'] and current_game is not None:
                socketio.emit("update_players", {"players": current_game.players, "game_started": True}, room=room_code)
                broadcast_game_state(room_code)
            else:
                socketio.emit("update_players", {"players": room_data['players'], "game_started": False}, room=room_code)

        else:
            # Room already gone, just clean up session
            if token in sessions:
                del sessions[token]
            disconnect_timers.pop(token, None)

        print(f"User {token} permanently removed after inactivity.")
        print(f"Thread for {token} stopped")

def emit_sid_for_player(player_name, room_code, event, data):
    """Helper to emit an event to a specific player's socket."""
    for sid, token in user_sockets.items():
        if token in sessions and sessions[token]['username'] == player_name and sessions[token]['room_code'] == room_code:
            socketio.emit(event, data, room=sid)
            break

def broadcast_coin_update(room_code):
    """Broadcast coin selection status to entire room."""
    coins = rooms[room_code].get('coins', {})
    socketio.emit("coin_update", {"coins": coins}, room=room_code)

def handle_game_over(room_code, winner, game):
    """Ends the game, resets room state and game flags."""
    rooms[room_code]['started'] = False
    rooms[room_code]['game'] = None
    rooms[room_code]['coins'] = {}  # Reset coin choices
    broadcast_coin_update(room_code)
    if game:
        game.stacked_cards = 0
        game.draw_pending = False
        game.draw_started = False
        game.no_mercy_doubled = False
        game.min_stack_draw_value = 0
        socketio.emit("game_over", {"winner": winner, "discard_top": game.top_card()}, room=room_code)
    else:
        socketio.emit("game_over", {"winner": winner}, room=room_code)

def handle_elimination_check(game, player, room_code):
    """Check if a player should be eliminated (>= 25 cards). Returns True if eliminated."""
    if len(game.hands.get(player, [])) >= 25:
        if len(game.players) == 2:
            winner = [p for p in game.players if p != player][0]
            handle_game_over(room_code, winner, game)
            return True
        game.remove_player(player)
        socketio.emit("player_disqualified", {"player": player}, room=room_code)
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)
        return True
    return False

def handle_special_effects(game, card, player, color, room_code):
    # Implement special card logic here
    if card['type'] == 'Reverse':
        game.reverse_player()
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)

    elif card['type'] == 'Skip':
        game.next_player()

    elif card['type'] == '10':
        # Do NOT advance turn — player gets another turn immediately.
        # We signal the caller not to call next_player by setting a flag.
        game.play_again_active = True

    elif card['type'] == 'Draw Two':
        if game.no_mercy_active:
            game.stacked_cards += 2 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 4
            game.coins_available[player] = False
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 4}, room=room_code)
        else:
            game.stacked_cards += 2
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 2
        game.draw_pending = True

    elif card['type'] == 'Draw Four':
        if game.no_mercy_active:
            game.stacked_cards += 4 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 8
            game.coins_available[player] = False
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 8}, room=room_code)
        else:
            game.stacked_cards += 4
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 4
        game.draw_pending = True

    elif card['type'] == 'Draw Six':
        if game.no_mercy_active:
            game.stacked_cards += 6 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 12
            game.coins_available[player] = False
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 12}, room=room_code)
        else:
            game.stacked_cards += 6
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 6
        game.draw_pending = True

    elif card['type'] == 'Draw Ten':
        if game.no_mercy_active:
            game.stacked_cards += 10 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 20
            game.coins_available[player] = False
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 20}, room=room_code)
        else:
            game.stacked_cards += 10
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 10
        game.draw_pending = True
    elif card['type'] == 'Reverse Draw Four':
        game.draw_pending = True
        game.reverse_player()
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)
        if game.no_mercy_active:
            game.stacked_cards += 4 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 8
            game.coins_available[player] = False
            # After reversal, game.players[1] is the correct victim in all player counts
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 8}, room=room_code)
        else:
            game.stacked_cards += 4
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 4

    elif card['type'] == 'Wild Reverse Draw Eight':
        game.draw_pending = True
        game.reverse_player()
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)
        if game.no_mercy_active:
            game.stacked_cards += 8 * 2
            game.no_mercy_active = False
            game.no_mercy_doubled = True
            game.min_stack_draw_value = 16
            game.coins_available[player] = False
            # After reversal, game.players[1] is the correct victim in all player counts
            socketio.emit("coin_activated", {"player": player, "coin": "No Mercy", "victim": game.players[1], "used": True, "doubled_draw_val": 16}, room=room_code)
        else:
            game.stacked_cards += 8
            game.no_mercy_doubled = False
            game.min_stack_draw_value = 8

    elif card['type'] == 'Discard All of Color':
        valid_color_index = game.find_valid_color_index(player, color)
        print("Discard all color indexes", valid_color_index)
        temp_card = game.discard_pile.pop()
        while len(valid_color_index) != 0:
            card = game.hands[player].pop(int(valid_color_index[0]))
            game.discard_pile.append(card)
            valid_color_index = game.find_valid_color_index(player, color)
            print("Discard all color indexes 2", valid_color_index)
        game.discard_pile.append(temp_card)
        game.playing_color = temp_card['color']

    elif card['type'] == 'Wild Discard All':
        # Phase 1: Discard cards of the chosen color
        # The Wild Discard All card is already on top of the discard pile (from handle_play_card)
        # We temporarily remove it to place it back on top of the discarded cards
        wild_card = game.discard_pile.pop()
        
        valid_color_index = game.find_valid_color_index(player, color)
        while len(valid_color_index) != 0:
            card_to_discard = game.hands[player].pop(int(valid_color_index[0]))
            game.discard_pile.append(card_to_discard)
            valid_color_index = game.find_valid_color_index(player, color)
        
        # Now place the Wild Discard All card back on top
        game.discard_pile.append(wild_card)
        game.playing_color = color  # Color of cards discarded
        
        # Enter Phase 2: Awaiting final playing color choice
        game.awaiting_wild_discard_all_color = True
        game.awaiting_color_choice = True

    elif card['type'] == 'Wild Final Attack':
        # Phase 1: Reveal hand and set pending draws
        player_hand = game.hands[player]
        action_wild_count = game.count_action_and_wild_cards(player)
        
        # Determine draw counts
        if action_wild_count >= 7:
            next_draw_val = 24
            others_draw_val = 5
        else:
            next_draw_val = action_wild_count
            others_draw_val = 0
            
        game.final_attack_attacker = player
        game.final_attack_pending = {}
        
        # Identify next player (victim)
        idx = game.players.index(player)
        victim_idx = (idx + 1) % len(game.players)
        victim = game.players[victim_idx]
        
        # Set pending draws for victim
        if next_draw_val > 0:
            game.final_attack_pending[victim] = next_draw_val
            
        # Set pending draws for others if >= 7
        if others_draw_val > 0:
            for p in game.players:
                if p != player and p != victim:
                    game.final_attack_pending[p] = others_draw_val
                    
        # Emit reveal_hand to all
        socketio.emit("reveal_hand", {
            "player": player,
            "hand": player_hand,
            "action_wild_count": action_wild_count
        }, room=room_code)
        
        # No turn advancement yet, no color choice yet.
        return

    elif card['type'] == 'Wild Sudden Death':
        # All players draw until they have 24 cards
        for p in list(game.players):
            game.ensure_deck()
            game.draw_until_24(p)
            if not handle_elimination_check(game, p, room_code):
                emit_player_hand(p, room_code)

    elif card['type'] == 'Skip All':
        game.skip_all()

    elif card['type'] == '0':
        players_cards = list(game.hands.values())
        rotated_values = players_cards[-1:] + players_cards[:-1]
        game.hands = dict(zip(game.hands.keys(), rotated_values))
        for sid, session_token in user_sockets.items():
            if session_token in sessions:
                player_name = sessions[session_token]['username']
                if player_name in game.hands and player_name != player:
                    socketio.emit("your_hand", {
                        "hand": game.hands[player_name],
                        "discard_top": game.top_card() if game.discard_pile else None,
                        "cards_left": game.cards_remaining()
                    }, room=sid)

    elif card['type'] == '7':
        game.awaiting_player_choice = True  # Add flag to pause game progression
        # Emit event to prompt the player who played the '7' to select another player
        for sid, session_token in user_sockets.items():
            if session_token in sessions and sessions[session_token]['username'] == player:
                # Send list of other players (excluding the current player)
                other_players = [p for p in game.players if p != player]
                socketio.emit("select_player_for_swap", {"players": other_players}, room=sid)
                break



@app.route('/')
def index():
    dist_index = os.path.join(app.root_path, 'frontend', 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'frontend', 'dist'), 'index.html')
    return render_template('main.html')

@app.route('/create_room', methods=['POST'], strict_slashes=False)
def create_room():
    data = request.get_json()
    player_name = data.get('username', '').strip()
    if not player_name:
        return jsonify({'status': 'invalid_username'}), 400
    room_code = generate_room_code()
    session_token = generate_session_token()

    if room_code not in rooms:
        rooms[room_code] = {'players': [], 'started': False, 'game': None, 'coins': {}}
    
    rooms[room_code]['players'].append(player_name)
    sessions[session_token] = {'username': player_name, 'room_code': room_code}
    print(sessions)
    response = make_response(jsonify({'room_code': room_code, 'session_token': session_token}))
    return response

@app.route('/join_room', methods=['POST'], strict_slashes=False)
def join_room_route():
    data = request.json
    room_code = data.get('room_code', '').strip().upper()
    username = data.get('username', '').strip()

    if room_code in rooms:
        if rooms[room_code]['started']:
            return jsonify({'status': 'game_started'})
        
        if len(rooms[room_code]['players']) >= 6:
            return jsonify({'status': 'room_full'})
        
        if username in rooms[room_code]['players']:
            return jsonify({'status': 'duplicate'})
        
        session_token = generate_session_token()
        rooms[room_code]['players'].append(username)
        sessions[session_token] = {'username': username, 'room_code': room_code}
        print(sessions)
        response = make_response(jsonify({'status': 'joined', 'session_token': session_token}))
        return response
    else:
        return jsonify({'status': 'room_not_found'})

@app.route('/room/<room_code>')
def room(room_code):
    dist_index = os.path.join(app.root_path, 'frontend', 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'frontend', 'dist'), 'index.html')
    if room_code in rooms:
        return render_template('room.html', room_code=room_code)
    else:
        return "Room not found", 404

@app.route('/<room_code>')
def catch_room_code(room_code):
    dist_index = os.path.join(app.root_path, 'frontend', 'dist', 'index.html')
    if os.path.exists(dist_index):
        return send_from_directory(os.path.join(app.root_path, 'frontend', 'dist'), 'index.html')
    if len(room_code) == 6 and room_code.isalnum():
        return render_template('main.html')
    return jsonify({'status': 'not_found'}), 404
    
@app.route('/get_username', methods=['POST'], strict_slashes=False)
def get_username():
    data = request.get_json()
    session_token = data.get('session_token')

    if session_token in sessions:
        return jsonify({'status': 'success', 'username': sessions[session_token]['username']})
    else:
        return jsonify({'status': 'invalid'})

@app.route('/start_game', methods=['POST'], strict_slashes=False)
def start_game():
    data = request.json
    room_code = data.get('room_code')
    username = data.get('username')

    if room_code in rooms and rooms[room_code]['players'][0] == username:
        if len(rooms[room_code]['players']) >= 2:
            # Validate all players have chosen a coin
            coins = rooms[room_code].get('coins', {})
            players_list = rooms[room_code]['players']
            missing_coins = [p for p in players_list if coins.get(p) not in ('Mercy', 'No Mercy')]
            if missing_coins:
                return jsonify({'status': 'coins_not_chosen', 'missing': missing_coins})

            rooms[room_code]['started'] = True

            game = Unogame(*players_list)
            game.set_coins(coins)
            rooms[room_code]['game'] = game

            for sid, session_token in user_sockets.items():
                if session_token in sessions:
                    session_data = sessions[session_token]
                    player_name = session_data['username']
                    player_room = session_data['room_code']
                    if player_room == room_code and player_name in game.hands:
                        emit_player_hand(player_name, room_code)

            socketio.emit("game_started", {
                "shuffled_players": game.players,
                "cards_left": game.cards_remaining(),
                "discard_top": game.top_card() if game.discard_pile else None,
                "coins": coins
            }, room=room_code)

            # Broadcast game update
            broadcast_game_state(room_code)

            return jsonify({'status': 'started'})
        return jsonify({'status': 'not_enough_players'})
    return jsonify({'status': 'unauthorized'})

@app.route('/debug')
def debug():
    # Auto-cleanup orphaned sessions (sessions for rooms that no longer exist)
    orphaned_sessions = [t for t, s in sessions.items() if s.get('room_code') not in rooms]
    for t in orphaned_sessions:
        sessions.pop(t, None)
        disconnect_timers.pop(t, None)

    debug_rooms = {}
    for room_code, room_data in rooms.items():
        # Create a copy to avoid modifying the original data
        room_info = room_data.copy()
        if room_info['game'] is not None:
            # Convert the game object to a dictionary
            room_info['game'] = room_info['game'].to_dict()
        debug_rooms[room_code] = room_info

    disconnect_timers_info = {}
    for token, (thread, event) in list(disconnect_timers.items()):
        disconnect_timers_info[token] = {
            "thread_alive": thread.is_alive(),
            "event_set": event.is_set()
        }

    return jsonify({
        "rooms": debug_rooms,
        "sessions": sessions,
        "user_sockets": user_sockets,
        "disconnect_timers": disconnect_timers_info
    })

@app.route('/admin/execute', methods=['POST'])
def admin_execute():
    data = request.json
    room_code = data.get('room_code')
    command = data.get('command')
    params = data.get('params', {})

    if room_code not in rooms:
        return jsonify({'status': 'error', 'message': 'Room not found'}), 404
    
    room = rooms[room_code]
    game = room.get('game')
    
    if not game:
        return jsonify({'status': 'error', 'message': 'Game not started'}), 400

    if command == 'set_hand':
        player = params.get('player')
        hand = params.get('hand') # list of card objects
        if player in game.hands:
            game.hands[player] = hand
            broadcast_game_state(room_code)
            emit_player_hand(player, room_code)
            return jsonify({'status': 'success'})

    elif command == 'add_card':
        player = params.get('player')
        card = params.get('card') # card object
        if player in game.hands:
            game.hands[player].append(card)
            broadcast_game_state(room_code)
            emit_player_hand(player, room_code)
            return jsonify({'status': 'success'})

    elif command == 'remove_card':
        player = params.get('player')
        index = params.get('index')
        if player in game.hands and 0 <= index < len(game.hands[player]):
            game.hands[player].pop(index)
            broadcast_game_state(room_code)
            emit_player_hand(player, room_code)
            return jsonify({'status': 'success'})

    elif command == 'set_turn':
        player = params.get('player')
        if player in game.players:
            # Move player to the front of the list
            attempts = 0
            while game.players[0] != player and attempts < len(game.players):
                game.players.append(game.players.pop(0))
                attempts += 1
            broadcast_game_state(room_code)
            return jsonify({'status': 'success'})

    elif command == 'set_param':
        key = params.get('key')
        value = params.get('value')
        if hasattr(game, key):
            setattr(game, key, value)
            broadcast_game_state(room_code)
            # Some params might require hand update (like valid indices)
            for p in game.players:
                emit_player_hand(p, room_code)
            return jsonify({'status': 'success'})

    elif command == 'set_discard':
        card = params.get('card')
        game.discard_pile.append(card)
        game.playing_color = card['color'] if card['color'] != 'Wild' else params.get('color', 'Red')
        broadcast_game_state(room_code)
        return jsonify({'status': 'success'})
            
    return jsonify({'status': 'error', 'message': 'Unknown command'}), 400

@app.route('/admin/cards')
def admin_cards():
    from cards import deck
    # Return unique card types (based on type and color)
    unique_cards = []
    seen = set()
    for card in deck:
        key = (card['color'], card['type'])
        if key not in seen:
            unique_cards.append(card)
            seen.add(key)
    return jsonify(unique_cards)



@app.route('/total_players', strict_slashes=False)
def get_total_players():
    # Return total connected sockets across the entire site
    return jsonify({'total_players': len(connected_clients)})



@socketio.on("draw_card")
def handle_draw_card(data):
    room_code = data.get('room')
    session_token = user_sockets.get(request.sid)
    
    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        # emit("error", {"message": "Invalid session or room"}, room=request.sid)
        return
    
    if room_code not in rooms or not rooms[room_code]['started']:
        # emit("error", {"message": "Game not started or room not found"}, room=request.sid)
        return
    
    game = rooms[room_code].get('game')
    player = sessions[session_token]['username'] 

    # Handle manual drawing for Wild Final Attack penalty
    if game and player in getattr(game, 'final_attack_pending', {}):
        drawn_card = game.draw_card(player)
        game.final_attack_pending[player] -= 1
        if game.final_attack_pending[player] <= 0:
            del game.final_attack_pending[player]
        
        # Emit card drawn event
        socketio.emit("card_drawn", {
            "player": player,
            "new_card": drawn_card,
            "cards_left": game.cards_remaining()
        }, room=request.sid)

        # Check for elimination
        if len(game.hands[player]) >= 25:
            if len(game.players) == 2:
                handle_game_over(room_code, [p for p in game.players if p != player][0], game)
                return
            game.remove_player(player)
            socketio.emit("player_disqualified", {"player": player}, room=room_code)
            socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)
            # Remove from pending if they were disqualified
            if player in game.final_attack_pending:
                del game.final_attack_pending[player]

        # Check if all finished
        if not game.final_attack_pending:
            game.awaiting_final_attack_color = True
            game.awaiting_color_choice = True
            
        broadcast_game_state(room_code, player)
        return

    # Normal turn checks
    if game.current_players_turn() != player:
        emit("play_error", {"message": "It's not your turn!"}, room=request.sid)
        return
        
    if bool(getattr(game, 'final_attack_pending', {})):
        emit("play_error", {"message": "Wait for others to finish drawing from Final Attack!"}, room=request.sid)
        return

    if game.roulette and game.awaiting_color_choice:
        emit("roulette", {}, room=request.sid)
        emit("play_error", {"message": "You must select a color for the Roulette before drawing!"}, room=request.sid)
        return

    if len(game.hands[player]) > 1:
            game.reset_uno(player)

    if len(game.hands[player]) >= 25:
        if len(game.players) == 2:
            handle_game_over(room_code, game.players[1], game)
            return
            
        game.remove_player(player)

        socketio.emit("player_disqualified", {"player": player}, room=room_code)
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)

        broadcast_game_state(room_code, player)
            
        
        # Send updated hand to player
        player_hand = game.get_player_hand(player)
        emit("your_hand", {
            "hand": player_hand,
            "discard_top": game.top_card(),
            "cards_left": game.cards_remaining()
        }, room=request.sid)

        return

            
        broadcast_game_state(room_code, player)
        return

    if game.awaiting_player_choice == True:
        emit("play_error", {"message": "You must select a player to swap hands with!"}, room=request.sid)
        return

    if len(game.deck) <= 1:
        game.deck  = game.deck + game.discard_pile[:-1]
        random.shuffle(game.deck)
        game.discard_pile = [game.discard_pile[-1]]

    if game and game.deck:
        if game.draw_pending == True and game.draw_started == True:
            
            drawn_card = game.draw_card(player)
            game.stacked_cards -= 1

            if len(game.hands[player]) >= 25:
                if len(game.players) == 2:
                    handle_game_over(room_code, game.players[1], game)
                    return
                game.remove_player(player)

                socketio.emit("player_disqualified", {"player": player}, room=room_code)
                socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)

                broadcast_game_state(room_code, player)
                return

            if game.stacked_cards == 0:
                game.draw_pending = False
                game.draw_started = False
                game.no_mercy_doubled = False
                game.min_stack_draw_value = 0
                game.next_player()

                # Emit updates
                socketio.emit("card_drawn", {
                    "player": player,
                    "new_card": drawn_card,
                    "cards_left": game.cards_remaining()
                }, room=request.sid)

                broadcast_game_state(room_code, player)
                return

        if game.draw_pending == True and game.draw_started == False:
            drawn_card = game.draw_card(player)
            game.draw_started = True
            game.stacked_cards -= 1

        if game.draw_pending == False and game.draw_started == False:
            drawn_card = game.draw_card(player)
            if game.roulette == True:
                socketio.emit("roulette_draw", {'card_drawn' : drawn_card, 'player': player}, room=room_code)
                if drawn_card['color'] == game.playing_color:
                    game.roulette = False
                    game.roulette_attacker = None
                    game.next_player()

        if len(game.hands[player]) >= 25:
            if len(game.players) == 2:
                handle_game_over(room_code, game.players[1], game)
                return
            game.remove_player(player)

            socketio.emit("player_disqualified", {"player": player}, room=room_code)
            socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)

            broadcast_game_state(room_code, player)
            return


        # Emit updates
        socketio.emit("card_drawn", {
            "player": player,
            "new_card": drawn_card,
            "cards_left": game.cards_remaining()
        }, room=request.sid)

        # Update hands and game state for everyone
        broadcast_game_state(room_code, player)
            
# Add to handle_play_card function

# Add to handle_play_card function
@socketio.on("play_card")
def handle_play_card(data):
    room_code = data.get('room')
    session_token = user_sockets.get(request.sid)
    
    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        # emit("error", {"message": "Invalid session or room"}, room=request.sid)
        return
    
    if room_code not in rooms or not rooms[room_code]['started']:
        # emit("error", {"message": "Game not started or room not found"}, room=request.sid)
        return
    
    game = rooms[room_code].get('game')
    player = sessions[session_token]['username']
    index = data.get('index')
    chosen_color = data.get('color', None)
    
    if not game or index is None:
        return
    
    if game.current_players_turn() != player:
        emit("play_error", {"message": "It's not your turn!"}, room=request.sid)
        return
        
    if bool(getattr(game, 'final_attack_pending', {})):
        emit("play_error", {"message": "Wait for others to finish drawing from Final Attack!"}, room=request.sid)
        return

    if game.awaiting_player_choice == True:
        emit("play_error", {"message": "You must select a player to swap hands with!"}, room=request.sid)
        return
        
    if game.roulette and game.awaiting_color_choice:
        emit("play_error", {"message": "You must select a color for the Roulette before drawing!"}, room=request.sid)
        return
    
    if len(game.hands[player]) >= 25:
        if len(game.players) == 2:
            handle_game_over(room_code, game.players[1], game)
            return
            
        game.remove_player(player)

        socketio.emit("player_disqualified", {"player": player}, room=room_code)
        socketio.emit("update_players", {"players": game.players, "game_started": rooms[room_code]['started']}, room=room_code)

        broadcast_game_state(room_code, player)
            
        
        # Send updated hand to player
        player_hand = game.get_player_hand(player)
        emit("your_hand", {
            "hand": player_hand,
            "discard_top": game.top_card(),
            "cards_left": game.cards_remaining()
        }, room=request.sid)

        return
    
    if game.roulette == False:

        # Validate turn
        if game.current_players_turn() != player:
            emit("play_error", {"message": "It's not your turn!"}, room=request.sid)
            return

        if game.draw_pending == True and game.draw_started == True:
            emit("play_error", {"message": "Draw started, Draw all the cards"}, room=request.sid)
            return

        if game.draw_pending == True and game.draw_started == False:
            valid_indices = game.find_staking_cards(player)

        if game.draw_pending == False and game.draw_started == False:
            valid_indices = game.find_valid_cards(player)

        if int(index) not in valid_indices:
            emit("play_error", {"message": "Invalid card selection!"}, room=request.sid)
            return

        # Remove card from hand
        try:
            card = game.hands[player].pop(int(index))
        except IndexError:
            emit("play_error", {"message": "Invalid card index!"}, room=request.sid)
            return

        if len(game.hands[player]) == 0:
            game.discard_pile.append(card)
            handle_game_over(room_code, player, game)
            return

        if card['color'] == 'Wild' and card['type'] == 'Color Roulette':
            game.roulette = True
            game.roulette_attacker = player
            game.awaiting_color_choice = True
            game.playing_color = 'Wild'
            print("Roulette mode activated")

        if card['color'] == 'Wild' and card['type'] not in ['Color Roulette', 'Wild Final Attack']:
            if not chosen_color or chosen_color not in ['Red', 'Blue', 'Green', 'Yellow']:
                emit("play_error", {"message": "Please select a valid color!"}, room=request.sid)
                game.hands[player].append(card)  # Return card to hand
                return
            game.playing_color = chosen_color
        elif card['color'] != 'Wild':
            game.playing_color = card['color']

        # Add to discard pile
        game.discard_pile.append(card)

        # Reset play_again flag before handling effects
        game.play_again_active = False

        # Handle special effects
        handle_special_effects(game, card, player, chosen_color or game.playing_color, room_code)

        # Check for win again after special effects (Discard All cards may empty hand)
        if len(game.hands[player]) == 0:
            handle_game_over(room_code, player, game)
            return


        # Deactivate No Mercy if it wasn't consumed by a draw card
        if getattr(game, 'no_mercy_active', False):
            game.no_mercy_active = False
            socketio.emit("coin_deactivated", {"player": player, "coin": "No Mercy"}, room=room_code)

        # Advance turn unless:
        # - player choice pending (7 card swap)
        # - play again active (10)
        # - awaiting any wild color choice (Discard All phase2)
        awaiting_any = (
            game.awaiting_player_choice
            or getattr(game, 'play_again_active', False)
            or getattr(game, 'awaiting_wild_discard_all_color', False)
            or bool(getattr(game, 'final_attack_pending', {}))
        )
        if not awaiting_any:
            game.next_player()

        if len(game.hands[player]) > 1:
            game.reset_uno(player)

        # Broadcast game update
        broadcast_game_state(room_code, player)

        if game.roulette and game.awaiting_color_choice:
            current_player = game.current_players_turn()
            for sid in user_sockets:
                token = user_sockets[sid]
                session_data = sessions.get(token)
                if session_data and session_data['room_code'] == room_code and session_data['username'] == current_player:
                    emit("roulette", {"attacker": player}, room=sid)
                    break

    else:
        socketio.emit("play_error", {"message": "You must draw cards until you get a card that matches the color chosen."}, room=request.sid)

@socketio.on("choose_coin")
def handle_choose_coin(data):
    room_code = data.get('room')
    coin = data.get('coin')  # 'Mercy' or 'No Mercy'
    session_token = user_sockets.get(request.sid)

    if not session_token or session_token not in sessions:
        return
    if room_code not in rooms or rooms[room_code]['started']:
        return
    if coin not in ('Mercy', 'No Mercy'):
        emit("play_error", {"message": "Invalid coin choice"}, room=request.sid)
        return

    username = sessions[session_token]['username']
    if username not in rooms[room_code]['players']:
        return

    rooms[room_code].setdefault('coins', {})[username] = coin
    broadcast_coin_update(room_code)

@socketio.on("use_coin")
def handle_use_coin(data):
    room_code = data.get('room')
    session_token = user_sockets.get(request.sid)

    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        return
    if room_code not in rooms or not rooms[room_code]['started']:
        return

    game = rooms[room_code].get('game')
    player = sessions[session_token]['username']

    is_mercy = game.player_coins.get(player) == 'Mercy'
    has_pending_attack = player in getattr(game, 'final_attack_pending', {})
    
    if not game or (game.current_players_turn() != player and not (is_mercy and has_pending_attack)):
        emit("play_error", {"message": "It's not your turn!"}, room=request.sid)
        return

    if not game.coins_available.get(player, False):
        emit("play_error", {"message": "You have already used your coin!"}, room=request.sid)
        return

    coin_type = game.player_coins.get(player)

    if coin_type == 'No Mercy':
        # Check player has a playable draw card
        if not game.has_playable_draw_card(player):
            emit("play_error", {"message": "No Mercy coin can only be used when you have a playable draw card!"}, room=request.sid)
            return
        game.no_mercy_active = True
        # Only notify the attacker that it's activated
        emit("coin_activated", {"player": player, "coin": "No Mercy", "activated_only": True}, room=request.sid)
        broadcast_game_state(room_code, player)

    elif coin_type == 'Mercy':
        # Clear any pending Final Attack draws for this player
        if has_pending_attack:
            del game.final_attack_pending[player]
            
        # Apply mercy immediately: put hand into deck, draw 7
        game.apply_mercy_coin(player)
        socketio.emit("coin_activated", {"player": player, "coin": "Mercy"}, room=room_code)
        
        # Check if all finished
        if has_pending_attack and not game.final_attack_pending:
            game.awaiting_final_attack_color = True
            game.awaiting_color_choice = True
            
        # Mercy does NOT end the player's turn - they still play normally after
        broadcast_game_state(room_code, player)

@socketio.on("wild_color_chosen")
def handle_wild_color_chosen(data):
    """Final color choice for Wild Final Attack or Wild Sudden Death."""
    room_code = data.get('room')
    color = data.get('color')
    card_type = data.get('card_type')
    session_token = user_sockets.get(request.sid)

    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        return
    if room_code not in rooms or not rooms[room_code]['started']:
        return

    game = rooms[room_code].get('game')
    player = sessions[session_token]['username']

    if not game:
        return
    if color not in ['Red', 'Blue', 'Green', 'Yellow']:
        emit("play_error", {"message": "Invalid color!"}, room=request.sid)
        return

    if card_type == 'Wild Final Attack' and game.awaiting_final_attack_color:
        game.playing_color = color
        game.awaiting_final_attack_color = False
        game.awaiting_color_choice = False
        if len(game.hands[player]) > 1:
            game.reset_uno(player)
        
        # Skip the next player (the one who would have drawn)
        # Advance turn twice. In 2-player, this returns to the current player.
        game.next_player()
        game.next_player()
        
        broadcast_game_state(room_code, player)

    elif card_type == 'Wild Sudden Death' and game.awaiting_sudden_death_color:
        game.playing_color = color
        game.awaiting_sudden_death_color = False
        if len(game.hands[player]) > 1:
            game.reset_uno(player)
        game.next_player()
        broadcast_game_state(room_code, player)

    elif card_type == 'Wild Discard All' and game.awaiting_wild_discard_all_color:
        game.playing_color = color
        game.awaiting_wild_discard_all_color = False
        game.awaiting_color_choice = False
        if len(game.hands[player]) > 1:
            game.reset_uno(player)
        game.next_player()
        broadcast_game_state(room_code, player)

@socketio.on("check_game_states")
def handle_check_game_states(data):
    room_code = data.get('room')
    if room_code in rooms:
        game = rooms[room_code].get('game')
        if game:
            current_player = game.current_players_turn()
            # Check for pending roulette
            if game.roulette and game.awaiting_color_choice:
                emit("pending_roulette", {
                    "needs_selection": True,
                    "current_player": current_player
                })
            # Check for pending player selection (card 7)
            elif game.awaiting_player_choice:
                other_players = [p for p in game.players if p != current_player]
                emit("pending_player_selection", {
                    "needs_selection": True,
                    "current_player": current_player,
                    "available_players": other_players
                })
            # Check for pending Wild Discard All color choice
            elif getattr(game, 'awaiting_wild_discard_all_color', False):
                emit("pending_wild_discard_all_color", {
                    "needs_selection": True,
                    "current_player": current_player
                })
            # Check for pending Wild Final Attack color choice
            elif getattr(game, 'awaiting_final_attack_color', False):
                emit("pending_final_attack_color", {
                    "needs_selection": True,
                    "current_player": current_player
                })

                
@socketio.on("call_uno")
def handle_call_uno(data):
    room_code = data.get('room')
    session_token = user_sockets.get(request.sid)
    
    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        # emit("error", {"message": "Invalid session or room"}, room=request.sid)
        return
    
    if room_code not in rooms or not rooms[room_code]['started']:
        # emit("error", {"message": "Game not started or room not found"}, room=request.sid)
        return
    
    game = rooms[room_code].get('game')
    player = sessions[session_token]['username']
    
    if game:
        if game.current_players_turn() == player:
            game.call_uno(player)
            socketio.emit("uno_called", {"player": player}, room=room_code)
            broadcast_game_state(room_code, player)

        elif len(game.hands[player]) == 1:
            if game.has_called_uno(player) == False:
                game.call_uno(player)
                socketio.emit("uno_called", {"player": player}, room=room_code)
                broadcast_game_state(room_code, player)
            else:
                emit("play_error", {"message": "You have already called UNO!"}, room=request.sid)
        else:
            emit("play_error", {"message": "You can't call uno now"}, room=request.sid)

@socketio.on("catch_uno")
def handle_catch_uno(data):
    room_code = data.get('room')
    target_player = data.get('target_player')
    session_token = user_sockets.get(request.sid)
    
    if not session_token or session_token not in sessions or sessions[session_token]['room_code'] != room_code:
        # emit("error", {"message": "Invalid session or room"}, room=request.sid)
        return
    
    if room_code not in rooms or not rooms[room_code]['started']:
        # emit("error", {"message": "Game not started or room not found"}, room=request.sid)
        return
    
    game = rooms[room_code].get('game')
    caller = sessions[session_token]['username']
    
    if game and target_player in game.players and caller != target_player:
        if len(game.hands[target_player]) == 1 and not game.has_called_uno(target_player):
            # Player failed to call UNO, draw 4 cards
            for _ in range(2):
                if game.deck:
                    game.draw_card(target_player)
            game.reset_uno(target_player)  # Reset UNO flag after penalty
            socketio.emit("uno_caught", {"target_player": target_player, "caller": caller}, room=room_code)
            
            # Update the target player's hand
            for sid, token in user_sockets.items():
                if token in sessions and sessions[token]['username'] == target_player:
                    socketio.emit("your_hand", {
                        "hand": game.hands[target_player],
                        "discard_top": game.top_card(),
                        "cards_left": game.cards_remaining()
                    }, room=sid)
                    break
            
            broadcast_game_state(room_code, caller)
        else:
            emit("play_error", {"message": f"{target_player} already called UNO or doesn't have 1 card!"}, room=request.sid)

@socketio.on("color_selected")
def handle_color_selected(data):
    room_code = data.get('room')
    color = data.get('color')

    game = rooms[room_code].get('game')
    if game and game.roulette and game.awaiting_color_choice:
        game.awaiting_color_choice = False
        game.playing_color = color

        # Broadcast game update
        broadcast_game_state(room_code)

@socketio.on("check_roulette_state")
def handle_check_roulette_state(data):
    room_code = data.get('room')
    if room_code in rooms:
        game = rooms[room_code].get('game')
        if game and game.roulette and game.awaiting_color_choice:
            current_player = game.current_players_turn()
            emit("pending_roulette", {
                "needs_selection": True,
                "current_player": current_player
            })
            
@socketio.on("player_selected_for_swap")
def handle_player_selected_for_swap(data):
    room_code = data.get('room')
    session_token = user_sockets.get(request.sid)
    selected_player = data.get('selected_player')
    
    if not session_token or room_code not in rooms:
        return
    
    game = rooms[room_code].get('game')
    player = sessions[session_token]['username']
    
    if game and game.awaiting_player_choice and selected_player in game.players and selected_player != player:
        # Swap hands between the current player and the selected player
        game.hands[player], game.hands[selected_player] = game.hands[selected_player], game.hands[player]
        
        # Update both players' hands
        for sid, token in user_sockets.items():
            if token in sessions:
                username = sessions[token]['username']
                if username in [player, selected_player]:
                    socketio.emit("your_hand", {
                        "hand": game.hands[username],
                        "discard_top": game.top_card(),
                        "cards_left": game.cards_remaining()
                    }, room=sid)
        
        game.awaiting_player_choice = False
        game.next_player()
        
        broadcast_game_state(room_code, player)
        # Also update the selected player's hand since it swapped
        emit_player_hand(selected_player, room_code)

@socketio.on("join_room")
def handle_join_room(data):
    room_code = data.get("room", "").strip().upper()
    username = data.get("username", "").strip()
    session_token = data.get("session")

    if room_code not in rooms:
        print(f"Attempt to join non-existent room: {room_code}")
        emit("room_not_found", {"message": "Room not found"}, room=request.sid)
        return

    print(session_token)
    print(user_sockets)
    print(sessions)
    print(rooms)

    if room_code in rooms and not rooms[room_code]['started']:
        if username not in rooms[room_code]['players']:
            # Check if room is full (max 6 players)
            if len(rooms[room_code]['players']) >= 6:
                emit("room_full", {"message": "Room is full! Maximum 6 players allowed."}, room=request.sid)
                return
            rooms[room_code]['players'].append(username)

    if session_token in disconnect_timers:
        stop_thread(session_token)
        print(f"User {username} rejoined within 30 sec. Canceling removal.")

    sessions[session_token] = {'username': username, 'room_code': room_code}
    user_sockets[request.sid] = session_token

    # Re-assigning new requesdt.sid to the old session token
    all_session_tokens = list(user_sockets.values())
    dublicate = 0
    for i in all_session_tokens:
        if session_token == i:
            dublicate += 1
    if dublicate >= 2:
        index_not_to_del = len(all_session_tokens) - 1 - all_session_tokens[::-1].index(session_token)
        for i, token in enumerate(all_session_tokens):
            if token == session_token and i != index_not_to_del:
                index_to_del = i
                token_to_delete = list(user_sockets.keys())[index_to_del]       
                del user_sockets[token_to_delete]    

    join_room(room_code)

    if rooms[room_code]['started'] == True:

        room_code = data.get('room')
        session_token = user_sockets.get(request.sid)

        game = rooms[room_code].get('game')
        player = sessions[session_token]['username']

        broadcast_game_state(room_code, player)

    print(user_sockets)
    print(sessions)
    print(rooms)
    emit("update_players", {"players": rooms[room_code]['players'], "game_started": rooms[room_code]['started']}, room=room_code)
    broadcast_coin_update(room_code)

@socketio.on("leave_room")
def handle_leave_room(data):
    room_code = data.get("room")
    username = data.get("username")
    session_token = data.get("session")

    if room_code in rooms:
        room_data = rooms[room_code]
        current_game = room_data.get('game')

        if username in room_data['players']:
            room_data['players'].remove(username)
            
            if current_game is not None:
                if current_game.remove_player(username):
                    print(f"Removed {username} from active game in {room_code} via leave_room")
                    
                    if len(current_game.players) == 1:
                        handle_game_over(room_code, current_game.players[0], current_game)
                    
                    # Broadcast updates
                    socketio.emit("update_players", {"players": current_game.players, "game_started": room_data['started']}, room=room_code)
                    if room_data['started']:
                        broadcast_game_state(room_code)
            
            # If room is empty, delete it
            if not room_data['players']:  
                cleanup_room(room_code)
                return # Exit early as room is gone

    sessions.pop(session_token, None)
    user_sockets.pop(request.sid, None)

    leave_room(room_code)

    print("Updated Sessions:", sessions)
    print("Updated Rooms:", rooms)    
    print(rooms)
    if room_code in rooms:
        emit("update_players", {"players": rooms[room_code]['players'], "game_started": rooms[room_code]['started']}, room=room_code)

@socketio.on("kick_player")
def handle_kick_player(data):
    room_code = data.get("room")
    target_username = data.get("target_username")
    
    session_token = user_sockets.get(request.sid)
    if not session_token or session_token not in sessions:
        return
        
    leader_username = sessions[session_token]['username']
    
    if room_code in rooms and not rooms[room_code]['started']:
        # First player in list is the leader
        if rooms[room_code]['players'][0] == leader_username:
            if target_username in rooms[room_code]['players'] and target_username != leader_username:
                # Notify everyone that a player was kicked
                emit("player_kicked", {"username": target_username}, room=room_code)
                
                # Remove from room
                rooms[room_code]['players'].remove(target_username)
                
                # Find and remove target's session and socket
                target_token = None
                for token, info in sessions.items():
                    if info['username'] == target_username and info['room_code'] == room_code:
                        target_token = token
                        break
                
                if target_token:
                    sessions.pop(target_token, None)
                    sids_to_del = [sid for sid, token in user_sockets.items() if token == target_token]
                    for sid in sids_to_del:
                        user_sockets.pop(sid, None)
                
                # Broadcast updated player list
                emit("update_players", {"players": rooms[room_code]['players'], "game_started": False}, room=room_code)

@socketio.on("transfer_leadership")
def handle_transfer_leadership(data):
    room_code = data.get("room")
    target_username = data.get("target_username")
    
    session_token = user_sockets.get(request.sid)
    if not session_token or session_token not in sessions:
        return
        
    current_leader = sessions[session_token]['username']
    
    if room_code in rooms and not rooms[room_code]['started']:
        # Only the current leader (first in list) can transfer
        if rooms[room_code]['players'][0] == current_leader:
            if target_username in rooms[room_code]['players'] and target_username != current_leader:
                # Remove target from their current position and insert at the beginning
                rooms[room_code]['players'].remove(target_username)
                rooms[room_code]['players'].insert(0, target_username)
                
                # Broadcast the update to everyone
                emit("update_players", {"players": rooms[room_code]['players'], "game_started": False}, room=room_code)
                print(f"Leadership in {room_code} transferred to {target_username}")

@socketio.on("connect")
def handle_connect():
    connected_clients.add(request.sid)
    print(f"Client connected: {request.sid}. Total: {len(connected_clients)}")
    broadcast_total_players()

@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    connected_clients.discard(sid)
    broadcast_total_players()
    print(f"Client disconnected. SID: {sid}. Total: {len(connected_clients)}")

    if sid not in user_sockets:
        print(f"Socket ID {sid} not found in active sessions. Possible early disconnect.")
        return

    session_token = user_sockets.pop(sid, None)

    if not session_token or session_token not in sessions:
        print(f"Session token {session_token} not found or invalid.")
        return

    user_data = sessions.get(session_token, {})
    username = user_data.get("username")
    room_code = user_data.get("room_code")    
        
    if not username or not room_code:
        print("Invalid user data found, skipping cleanup.")
        return
    
    if room_code not in rooms:
        del sessions[session_token]
        print("Room not found, clearing session")
        return 

    start_thread(session_token, username, room_code)

    print(f"User {username} disconnected. Waiting 90 sec before removal.")

@socketio.on("send_message")
def handle_send_message(data):
    room_code = data.get('room')
    message = data.get('message')
    session_token = user_sockets.get(request.sid)
    
    if not session_token or session_token not in sessions:
        return
        
    username = sessions[session_token]['username']
    
    if room_code in rooms:
        # Simple message broadcast to everyone in the room
        socketio.emit("receive_message", {
            "username": username,
            "message": message,
            "timestamp": time.strftime("%H:%M:%S")
        }, room=room_code)

@app.route('/report_bug', methods=['POST'], strict_slashes=False)
def report_bug():
    data = request.json
    bug_message = data.get('bug')
    if not bug_message:
        return jsonify({'status': 'error', 'message': 'No bug message provided'}), 400
    
    print(f"Received bug report: {bug_message}")
    with open('bugs.txt', 'a') as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {bug_message}\n")
    
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8001, debug=True, allow_unsafe_werkzeug=True)


# Todo:
# implement point system if last is any special card hard the situation correctly so correct point distribution. (in v2)

# implement player list like who is after who. visual implement (need some more ideas) ---- done
# when a player is eliminated remove the player from the turn but not from room. so clicking leave button closes the game. -- done(need testing)
# if a player disconnects then the player is not removed from the game.players list ---- done (need testing)
# playing color implementation ------ done(testing needed)
# stacking draw card is drawed 1 extra -------- done(testing needed)
# if a player is eleminated the it doesnt move to next player. right now eleminated player need some imput to continue. -- done (testing needed)
# if deck is less then 1 add discard pile to deck and shuffle exceppt the top card of discard pile. -- done (testing needed)
# if a player disconnects then let player to join using the same session token from join room page.---done(this already exists but need to join using link)
# show stack counter. --- done
# show playing color ---- done
# Show the no of cards in the players hand next to the player name in the player list ---- done
# Implement 0 and 7 rule ---- done
# Remove space before sending to server room code --- done
# Make room code not case sensitive ----  done
# turn of roulette alert ---- done
# username cant be numeric ----  done
# # Uno call implementation --- done
