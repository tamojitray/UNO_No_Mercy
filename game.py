from cards import deck as original_deck
import random

class Unogame:
    def __init__(self, *player_names):
        self.deck = original_deck.copy()
        random.shuffle(self.deck)
        self.discard_pile = []
        self.stacked_cards = 0
        self.playing_color = None
        self.roulette = False
        self.players = list(player_names)
        random.shuffle(self.players)
        self.hands = {player: [] for player in self.players}
        self._init_discard_pile()
        self.distribute_cards()
        self.awaiting_color_choice = False

    def _init_discard_pile(self):
        if self.deck:
            card = self.deck.pop()
            while card['color'] == 'Wild':
                self.deck.append(card)
                random.shuffle(self.deck)
                card = self.deck.pop()
            self.playing_color = card['color']
            self.discard_pile.append(card)        

    def distribute_cards(self):
        for player in self.players:
            self.hands[player] = [self.deck.pop() for _ in range(7)]       
    
    def get_player_hand(self, player):
        return self.hands.get(player, [])
    
    def cards_remaining(self):
        return len(self.deck)
    
    def current_players_turn(self):
        return self.players[0]
    
    def top_card(self):
        return self.discard_pile[-1]
    
    def draw_card(self, player):
        card = self.deck.pop()
        self.hands[player].append(card)            
        return card
    
    # def draw_card(self, player):
    #     cards = []
    #     if self.roulette == False and self.stacked_cards == 0:
    #         card = self.deck.pop()
    #         cards.append(card)
    #         self.hands[player].append(card)
    #         return cards

    #     elif self.stacked_cards != 0:
    #         for i in range(self.stacked_cards):
    #             card = self.deck.pop()
    #             cards.append(card)
    #             self.hands[player].append(card)
    #         return cards

    #     elif self.roulette == True:
    #         card = self.deck.pop()
    #         cards.append(card)
    #         self.hands[player].append(card)
    #         while card['color'] != self.playing_color:
    #             card = self.deck.pop()
    #             cards.append(card)
    #             self.hands[player].append(card)
    #         return cards

    def next_player(self):
        self.players.append(self.players.pop(0))

    def find_valid_cards(self, player):
        valid_indices = []
        top_card = self.discard_pile[-1]
        player_deck = self.hands[player]
        for i, player_card in enumerate(player_deck):
            if (player_card["color"] == self.playing_color or player_card["type"] == top_card["type"] or player_card["color"] == "Wild"):
                valid_indices.append(i)

        return valid_indices
    
    def find_staking_cards(self, player):
        player_deck = self.hands[player]
        top_card = self.discard_pile[-1]
        playing_color = self.playing_color
        valid_staking_cards = []
        
        if top_card["type"] == "Draw Two":
            for i, player_card in enumerate(player_deck):
                if player_card["type"] == "Draw Two" or player_card["type"] == "Reverse Draw Four" or player_card["type"] == "Draw Six" or player_card["type"] == "Draw Ten":
                    valid_staking_cards.append(i)
                elif player_card["color"] == playing_color and player_card["type"] == "Draw Four":
                    valid_staking_cards.append(i)

        elif top_card["type"] == "Draw Four":
            for i, player_card in enumerate(player_deck):
                if player_card["type"] == "Draw Four" or player_card["type"] == "Reverse Draw Four" or player_card["type"] == "Draw Six" or player_card["type"] == "Draw Ten":
                    valid_staking_cards.append(i)

        elif top_card["type"] == "Reverse Draw Four":
            for i, player_card in enumerate(player_deck):
                if player_card["type"] == "Reverse Draw Four" or player_card["type"] == "Draw Six" or player_card["type"] == "Draw Ten":
                    valid_staking_cards.append(i)
        
        elif top_card["type"] == "Draw Six":
            for i, player_card in enumerate(player_deck):
                if player_card["type"] == "Draw Six" or player_card["type"] == "Draw Ten":
                    valid_staking_cards.append(i)

        elif top_card["type"] == "Draw Tex":
            for i, player_card in enumerate(player_deck):
                if player_card["type"] == "Draw Ten":
                    valid_staking_cards.append(i)

        return valid_staking_cards
    
    def find_valid_color_index(self, player, color):
        player_deck = self.hands[player]
        valid_color_indexes = []
        for i, player_card in enumerate(player_deck):
            if player_card["color"] == color:
                valid_color_indexes.append(i)
        return valid_color_indexes

    def play_card(self, player):
        pass

    def to_dict(self):
        return {
            "players": self.players,
            "current_player": self.current_players_turn(),
            "deck": self.deck,  # Assuming deck is a list of serializable cards
            "discard_pile": self.discard_pile,
            "hands": {player: hand for player, hand in self.hands.items()},
            "playing_color": self.playing_color,
            "roulette": self.roulette,
            "stacked_cards":self.stacked_cards
        }