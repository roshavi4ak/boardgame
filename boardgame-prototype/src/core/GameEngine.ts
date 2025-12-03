// Moved all required types here to avoid circular dependencies
type Guild = 'military' | 'culture' | 'technology' | 'royal' | 'trade';
type Color = 'blue' | 'red' | 'green' | 'yellow' | 'purple';
type PlayerId = string;
type GamePhase = 'setup' | 'playing' | 'ended';

interface Card {
  id: string;
  guild: Guild;
  color: Color;
  power1: string;
  power23: string;
  power45: string;
  bonus: string;
}

interface MapSpot {
  id: number;
  type: 'normal' | 'starting' | 'outpost';
  position: { row: number; col: number };
  adjacent: number[];
  isOutpost: boolean;
  occupyingPlayer: PlayerId | null;
  armies: number;
}

interface Player {
  id: PlayerId;
  name: string;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  exile: Card[];
  guildPiles: Record<Guild, Card[]>;
  resources: {
    gold: number;
    knowledge: number;
    victoryPoints: number;
  };
  armies: number;
  outposts: number[];
}

interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  commonDeck: Card[];
  map: MapSpot[];
  createdAt: string;
  updatedAt: string;
}

export interface GameAction {
  type: 'expand' | 'consolidate';
  playerId: string;
  cardId?: string;
  targetSpotId?: number;
  payload?: any;
}
import cardsData from '../data/cards.json';
import mapData from '../data/map.json';

export class GameEngine {
  private state: GameState;
  private storageKey = 'boardgame_state';

  constructor() {
    this.state = this.loadGame() || this.createInitialState();
  }

  public initializeGame(playerNames: string[]): GameState {
    const commonDeck = this.createShuffledDeck();
    const map = this.initializeMap();

    // Create players
    const players = playerNames.map((name, index) => this.createPlayer(name, index));

    // Deal specific starting cards for testing
    if (players.length >= 1) {
      // Player 1 gets 2 red military cards
      const redMilitaryCards = commonDeck.filter(c => c.guild === 'military' && c.color === 'red');
      for (let i = 0; i < 2 && redMilitaryCards.length > 0; i++) {
        const cardIndex = commonDeck.findIndex(c => c.id === redMilitaryCards[i].id);
        if (cardIndex !== -1) {
          players[0].hand.push(commonDeck.splice(cardIndex, 1)[0]);
        }
      }
    }

    if (players.length >= 2) {
      // Player 2 gets 2 blue trade cards
      const blueTradeCards = commonDeck.filter(c => c.guild === 'trade' && c.color === 'blue');
      for (let i = 0; i < 2 && blueTradeCards.length > 0; i++) {
        const cardIndex = commonDeck.findIndex(c => c.id === blueTradeCards[i].id);
        if (cardIndex !== -1) {
          players[1].hand.push(commonDeck.splice(cardIndex, 1)[0]);
        }
      }
    }

    // Fill remaining hand slots with random cards
    players.forEach(player => {
      while (player.hand.length < 5 && commonDeck.length > 0) {
        player.hand.push(commonDeck.pop()!);
      }
    });

    this.state = {
      id: this.generateUUID(),
      players,
      currentPlayerIndex: 0,
      phase: 'playing', // Start in playing phase
      commonDeck,
      map,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveGame();
    return this.state;
  }

  public processAction(action: GameAction): GameState {
    const newState = this.applyAction(this.state, action);
    this.state = newState;
    this.saveGame();
    return newState;
  }

  public saveGame(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  public loadGame(): GameState | null {
    const savedState = localStorage.getItem(this.storageKey);
    return savedState ? JSON.parse(savedState) : null;
  }

  public getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  public getAdjacentSpots(spotId: number): number[] {
    const spot = this.state.map.find(s => s.id === spotId);
    return spot ? spot.adjacent : [];
  }

  public canPlaceArmy(playerId: string, spotId: number): boolean {
    const spot = this.state.map.find(s => s.id === spotId);
    if (!spot) return false;

    // Check if spot is already occupied by another player
    if (spot.occupyingPlayer && spot.occupyingPlayer !== playerId) return false;

    // Check if this is a starting position (always allowed for first placement)
    if (spot.type === 'starting') {
      return true;
    }

    // Check adjacency to player's existing armies or outposts
    const adjacentSpots = this.getAdjacentSpots(spotId);

    return adjacentSpots.some(adjSpotId => {
      const adjSpot = this.state.map.find(s => s.id === adjSpotId);
      return adjSpot && adjSpot.occupyingPlayer === playerId;
    });
  }

  public canPlayCard(playerId: string, cardId: string): boolean {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    const card = player.hand.find(c => c.id === cardId);
    if (!card) return false;

    // Check if player can play this card based on guild rules
    const guildPile = player.guildPiles[card.guild];
    if (guildPile.length > 0) {
      // Check color restriction: cannot play same color in same guild
      const existingColors = guildPile.map(c => c.color);
      if (existingColors.includes(card.color)) {
        console.log(`Cannot play ${card.color} ${card.guild} card - already have that color in guild`);
        return false;
      }
    }

    return true; // Can play first card in guild or different color
  }

  public placeArmy(playerId: string, spotId: number): GameState {
    const newState = { ...this.state, updatedAt: new Date().toISOString() };
    const player = newState.players.find(p => p.id === playerId);

    if (player && player.armies > 0) {
      this.handleArmyPlacement(newState, player, spotId);
      this.state = newState;
      this.saveGame();
    }

    return this.state;
  }

  private handleArmyPlacement(state: GameState, player: Player, spotId: number): void {
    const spot = state.map.find(s => s.id === spotId);
    if (!spot) return;

    // Place army on the spot
    spot.occupyingPlayer = player.id;
    spot.armies += 1;

    // Decrease player's army count
    player.armies -= 1;

    console.log(`Placed army on spot ${spotId} for player ${player.id}`);
  }

  private createInitialState(): GameState {
    return {
      id: '',
      players: [],
      currentPlayerIndex: 0,
      phase: 'setup',
      commonDeck: [],
      map: [],
      createdAt: '',
      updatedAt: ''
    };
  }

  private createPlayer(name: string, index: number): Player {
    return {
      id: `player-${index + 1}`,
      name,
      hand: [],
      deck: [],
      discard: [],
      exile: [],
      guildPiles: {
        military: [],
        culture: [],
        technology: [],
        royal: [],
        trade: []
      },
      resources: {
        gold: 5,
        knowledge: 0,
        victoryPoints: 0
      },
      armies: 0,
      outposts: []
    };
  }

  private createShuffledDeck(): Card[] {
    const allCards: Card[] = [];
    cardsData.guilds.forEach(guild => {
      guild.cards.forEach(cardData => {
        allCards.push({
          id: cardData.id,
          guild: cardData.guild as Guild,
          color: cardData.color as Color,
          power1: cardData.power1,
          power23: cardData.power23,
          power45: cardData.power45,
          bonus: cardData.bonus
        });
      });
    });

    return this.shuffleArray(allCards);
  }

  private initializeMap(): MapSpot[] {
    return mapData.spots.map(spot => ({
      ...spot,
      type: spot.type as 'normal' | 'starting' | 'outpost',
      occupyingPlayer: null,
      armies: 0
    }));
  }

  private applyAction(state: GameState, action: GameAction): GameState {
    const newState = { ...state, updatedAt: new Date().toISOString() };

    switch (action.type) {
      case 'expand':
        return this.handleExpandAction(newState, action);
      case 'consolidate':
        return this.handleConsolidateAction(newState, action);
      default:
        return newState;
    }
  }

  private handleExpandAction(state: GameState, action: GameAction): GameState {
    if (!action.cardId) return state;

    const currentPlayer = state.players[state.currentPlayerIndex];
    const cardIndex = currentPlayer.hand.findIndex(c => c.id === action.cardId);

    if (cardIndex === -1) return state;

    // Remove card from hand
    const [card] = currentPlayer.hand.splice(cardIndex, 1);

    // Add to appropriate guild pile
    const guildPile = currentPlayer.guildPiles[card.guild];
    guildPile.push(card);

    // Process card effects with power scaling
    this.processCardEffects(currentPlayer, card, guildPile);

    // Handle army placement if card gives army
    // Note: Armies are already added in processCardEffects, no need to add again
    // if (card.power.includes('Army') || card.bonus.includes('Army')) {
    //   // Store pending army placement for UI to handle
    //   state.players[state.currentPlayerIndex].armies += 1;
    //   // Army placement will be handled by UI interaction
    // }

    // End turn
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    return state;
  }

  private handleConsolidateAction(state: GameState, _action: GameAction): GameState {
    const currentPlayer = state.players[state.currentPlayerIndex];

    // Discard all cards from hand
    currentPlayer.discard.push(...currentPlayer.hand);
    currentPlayer.hand = [];

    // Reset guild piles (keep only one card per guild)
    Object.keys(currentPlayer.guildPiles).forEach(guild => {
      const guildKey = guild as Guild;
      if (currentPlayer.guildPiles[guildKey].length > 1) {
        const [keptCard] = currentPlayer.guildPiles[guildKey].splice(0, 1);
        currentPlayer.discard.push(...currentPlayer.guildPiles[guildKey]);
        currentPlayer.guildPiles[guildKey] = [keptCard];
      }
    });

    // Shuffle discard into deck
    currentPlayer.deck = this.shuffleArray(currentPlayer.discard);
    currentPlayer.discard = [];

    // Draw new hand
    for (let i = 0; i < 5 && currentPlayer.deck.length > 0; i++) {
      currentPlayer.hand.push(currentPlayer.deck.pop()!);
    }

    // End turn
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    return state;
  }

  private processCardEffects(player: Player, card: Card, guildPile: Card[]): void {
    // Determine power level based on position in guild pile
    // position is the card's position in the pile (1-based)
    const position = guildPile.length; // Current length after adding the card

    // Select the appropriate power based on position
    let powerText = '';
    if (position === 1) {
      powerText = card.power1;
    } else if (position >= 2 && position <= 3) {
      powerText = card.power23;
    } else if (position >= 4 && position <= 5) {
      powerText = card.power45;
    }

    // Parse and execute the selected power
    const powerParts = powerText.split('.');
    powerParts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed === 'Army') {
        player.armies += 1;
      } else if (trimmed === 'Pay 1 Gold → Army') {
        // This is an optional power, don't apply automatically
      } else if (trimmed.includes('Gold') && !trimmed.includes('→')) {
        player.resources.gold += 1;
      } else if (trimmed.includes('Knowledge') && !trimmed.includes('→')) {
        player.resources.knowledge += 1;
      } else if (trimmed.includes('VP') && !trimmed.includes('→')) {
        player.resources.victoryPoints += 1;
      }
    });

    // Process bonus effects (bonuses don't scale)
    const bonusParts = card.bonus.split('.');
    bonusParts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed === 'Gain 1 Gold') {
        player.resources.gold += 1;
      } else if (trimmed === 'Gain 1 Knowledge') {
        player.resources.knowledge += 1;
      } else if (trimmed === 'Gain 1 VP') {
        player.resources.victoryPoints += 1;
      } else if (trimmed === 'Gain 1 Army') {
        player.armies += 1;
      }
    });
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5);
  }
}