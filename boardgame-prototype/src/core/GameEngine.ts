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
    drawCards?: number;
    takeCards?: number;
    discardCards?: number;
    exileCards?: number;
    buryCards?: number;
    fight?: number;
    outpost?: number;
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
  pendingConditionalPowers?: { left: string, right: string, fullText: string }[];
  pendingChoicePowers?: { choices: string[], fullText: string }[];
}

export interface GameAction {
  type: 'expand' | 'consolidate' | 'endTurn';
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
        victoryPoints: 0,
        drawCards: 0,
        takeCards: 0,
        discardCards: 0,
        exileCards: 0,
        buryCards: 0,
        fight: 0,
        outpost: 0
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
      case 'endTurn':
        return this.handleEndTurnAction(newState, action);
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
    const { conditionalPowers, choicePowers } = this.processCardEffects(currentPlayer, card, guildPile);

    // Clear any existing pending powers and add new ones
    state.pendingConditionalPowers = conditionalPowers.length > 0 ? [...conditionalPowers] : [];
    state.pendingChoicePowers = choicePowers.length > 0 ? [...choicePowers] : [];

    // Don't automatically end turn - let player decide when to end turn
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

    // Reset non-persistent resources to 0 at end of turn
    this.resetNonPersistentResources(currentPlayer);

    // End turn
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    return state;
  }

  private processCardEffects(player: Player, card: Card, guildPile: Card[]): {
    conditionalPowers: { left: string, right: string, fullText: string }[],
    choicePowers: { choices: string[], fullText: string }[]
  } {
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

    const conditionalPowers: { left: string, right: string, fullText: string }[] = [];
    const choicePowers: { choices: string[], fullText: string }[] = [];

    // Parse and execute the selected power (case-insensitive)
    const powerParts = powerText.split('.');
    powerParts.forEach(part => {
      const trimmed = part.trim();

      // Check if this is a conditional power
      const conditionalPower = this.parseConditionalPower(trimmed);
      if (conditionalPower) {
        // Check if player can execute this conditional power
        if (this.canExecuteConditionalPower(player, conditionalPower.left)) {
          conditionalPowers.push({
            left: conditionalPower.left,
            right: conditionalPower.right,
            fullText: trimmed
          });
        }
      } else {
        // Check if this is a choice power (contains " or ")
        const choicePower = this.parseChoicePower(trimmed);
        if (choicePower) {
          // Add choice power for player to select
          choicePowers.push({
            choices: choicePower,
            fullText: trimmed
          });
        } else {
          // Handle non-conditional powers
          const normalized = this.normalizeText(trimmed);

          if (normalized === 'army') {
            player.armies += 1;
          } else if (this.textContains(trimmed, 'gold') && !trimmed.includes('→')) {
            player.resources.gold += 1;
          } else if (this.textContains(trimmed, 'knowledge') && !trimmed.includes('→')) {
            player.resources.knowledge += 1;
          } else if (this.textContains(trimmed, 'vp') && !trimmed.includes('→')) {
            player.resources.victoryPoints += 1;
          } else if (this.textContains(trimmed, 'draw') || this.textContains(trimmed, 'take') ||
            this.textContains(trimmed, 'discard') || this.textContains(trimmed, 'exile') ||
            this.textContains(trimmed, 'bury') || this.textContains(trimmed, 'fight')) {
            // These will be handled by the new resource tracking system
            this.updateResourceCounters(player, trimmed);
          } else if (this.textContains(trimmed, 'army (x2)')) {
            player.armies += 2;
          }
        }
      }
    });

    // Process bonus effects (bonuses don't scale) (case-insensitive)
    const bonusParts = card.bonus.split('.');
    bonusParts.forEach(part => {
      const trimmed = part.trim();

      // Check if this is a conditional power
      const conditionalPower = this.parseConditionalPower(trimmed);
      if (conditionalPower) {
        // Check if player can execute this conditional power
        if (this.canExecuteConditionalPower(player, conditionalPower.left)) {
          conditionalPowers.push({
            left: conditionalPower.left,
            right: conditionalPower.right,
            fullText: trimmed
          });
        }
      } else {
        // Check if this is a choice power (contains " or ")
        const choicePower = this.parseChoicePower(trimmed);
        if (choicePower) {
          // Add choice power for player to select
          choicePowers.push({
            choices: choicePower,
            fullText: trimmed
          });
        } else {
          // Handle non-conditional bonuses
          const normalized = this.normalizeText(trimmed);

          if (normalized === 'gain 1 gold') {
            player.resources.gold += 1;
          } else if (normalized === 'gain 1 knowledge') {
            player.resources.knowledge += 1;
          } else if (normalized === 'gain 1 vp') {
            player.resources.victoryPoints += 1;
          } else if (normalized === 'gain 1 army') {
            player.armies += 1;
          } else if (this.textContains(trimmed, 'draw') || this.textContains(trimmed, 'take') ||
            this.textContains(trimmed, 'discard') || this.textContains(trimmed, 'exile') ||
            this.textContains(trimmed, 'bury') || this.textContains(trimmed, 'fight')) {
            // These will be handled by the new resource tracking system
            this.updateResourceCounters(player, trimmed);
          }
        }
      }
    });

    return { conditionalPowers, choicePowers };
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  private textContains(text: string, keyword: string): boolean {
    return this.normalizeText(text).includes(this.normalizeText(keyword));
  }

  private parseConditionalPower(powerText: string): { left: string, right: string } | null {
    // Look for conditional powers in format "left -> right" or "left → right"
    let arrowIndex = powerText.indexOf('→');
    if (arrowIndex === -1) {
      arrowIndex = powerText.indexOf('->');
      if (arrowIndex === -1) return null;
    }

    const left = powerText.substring(0, arrowIndex).trim();
    const right = powerText.substring(arrowIndex + (powerText[arrowIndex] === '→' ? 1 : 2)).trim();

    return { left, right };
  }

  private parseChoicePower(powerText: string): string[] | null {
    // Look for choice powers in format "option1 or option2 or option3"
    const orIndex = powerText.indexOf(' or ');
    if (orIndex === -1) return null;

    // Split by " or " to get all choices
    const choices = powerText.split(' or ').map(choice => choice.trim());
    return choices.length > 1 ? choices : null;
  }

  private canExecuteConditionalPower(player: Player, leftPart: string): boolean {
    // Check if player can execute the left part of conditional power
    const normalizedLeft = this.normalizeText(leftPart);

    if (normalizedLeft.includes('pay') && normalizedLeft.includes('gold')) {
      // Check if player has enough gold
      const goldMatch = normalizedLeft.match(/pay (\d+) gold/i);
      if (goldMatch) {
        const requiredGold = parseInt(goldMatch[1]);
        return player.resources.gold >= requiredGold;
      }
      return player.resources.gold > 0;
    }

    // Add more condition checks here as needed
    return true;
  }

  public executeConditionalPower(player: Player, leftPart: string, rightPart: string): void {
    // Initialize resources if they don't exist
    if (!player.resources.fight) player.resources.fight = 0;

    // Execute the left part (cost) and right part (benefit)
    const normalizedLeft = this.normalizeText(leftPart);
    const normalizedRight = this.normalizeText(rightPart);

    // Execute left part (cost)
    if (normalizedLeft.includes('pay') && normalizedLeft.includes('gold')) {
      const goldMatch = normalizedLeft.match(/pay (\d+) gold/i);
      if (goldMatch) {
        const goldToPay = parseInt(goldMatch[1]);
        player.resources.gold -= goldToPay;
      } else {
        player.resources.gold -= 1; // Default to 1 if no number specified
      }
    }

    // Execute right part (benefit)
    if (normalizedRight.includes('fight')) {
      player.resources.fight += 1;
    } else if (normalizedRight.includes('army')) {
      player.armies += 1;
    } else if (normalizedRight.includes('gold')) {
      const goldMatch = normalizedRight.match(/gain (\d+) gold/i);
      if (goldMatch) {
        const goldToGain = parseInt(goldMatch[1]);
        player.resources.gold += goldToGain;
      } else {
        player.resources.gold += 1;
      }
    } else if (normalizedRight.includes('knowledge')) {
      player.resources.knowledge += 1;
    } else if (normalizedRight.includes('vp')) {
      player.resources.victoryPoints += 1;
    }
    // Add more benefit executions as needed
  }

  public executeChoicePower(player: Player, choice: string): void {
    // Initialize resources if they don't exist
    if (!player.resources.drawCards) player.resources.drawCards = 0;
    if (!player.resources.takeCards) player.resources.takeCards = 0;
    if (!player.resources.fight) player.resources.fight = 0;

    const normalizedChoice = this.normalizeText(choice);

    // Execute the chosen option
    if (normalizedChoice.includes('draw') && normalizedChoice.includes('card')) {
      player.resources.drawCards += 1;
    } else if (normalizedChoice.includes('take') && normalizedChoice.includes('card')) {
      player.resources.takeCards += 1;
    } else if (normalizedChoice.includes('gain') && normalizedChoice.includes('knowledge')) {
      player.resources.knowledge += 1;
    } else if (normalizedChoice.includes('gain') && normalizedChoice.includes('vp')) {
      player.resources.victoryPoints += 1;
    } else if (normalizedChoice.includes('gain') && normalizedChoice.includes('gold')) {
      const goldMatch = normalizedChoice.match(/gain (\d+) gold/i);
      if (goldMatch) {
        const goldToGain = parseInt(goldMatch[1]);
        player.resources.gold += goldToGain;
      } else {
        player.resources.gold += 1;
      }
    } else if (normalizedChoice.includes('fight')) {
      player.resources.fight += 1;
    } else if (normalizedChoice.includes('army')) {
      player.armies += 1;
    }
    // Add more choice executions as needed
  }

  private updateResourceCounters(player: Player, actionText: string): void {
    // Initialize resource counters if they don't exist
    if (!player.resources.drawCards) player.resources.drawCards = 0;
    if (!player.resources.takeCards) player.resources.takeCards = 0;
    if (!player.resources.discardCards) player.resources.discardCards = 0;
    if (!player.resources.exileCards) player.resources.exileCards = 0;
    if (!player.resources.buryCards) player.resources.buryCards = 0;
    if (!player.resources.fight) player.resources.fight = 0;
    if (!player.resources.outpost) player.resources.outpost = 0;

    // Update counters based on action text (case-insensitive)
    const normalizedText = this.normalizeText(actionText);

    if (normalizedText.includes('draw')) {
      player.resources.drawCards += 1;
    } else if (normalizedText.includes('take')) {
      player.resources.takeCards += 1;
    } else if (normalizedText.includes('discard')) {
      player.resources.discardCards += 1;
    } else if (normalizedText.includes('exile')) {
      player.resources.exileCards += 1;
    } else if (normalizedText.includes('bury')) {
      player.resources.buryCards += 1;
    } else if (normalizedText.includes('fight')) {
      player.resources.fight += 1;
    } else if (normalizedText.includes('outpost')) {
      player.resources.outpost += 1;
    }
  }

  private resetNonPersistentResources(player: Player): void {
    // Only Gold and Victory Points persist between rounds
    // Everything else resets to 0
    player.resources.knowledge = 0;
    player.resources.drawCards = 0;
    player.resources.takeCards = 0;
    player.resources.discardCards = 0;
    player.resources.exileCards = 0;
    player.resources.buryCards = 0;
    player.resources.fight = 0;
    player.resources.outpost = 0;
  }

  private handleEndTurnAction(state: GameState, _action: GameAction): GameState {
    // Reset non-persistent resources to 0 at end of turn
    const currentPlayer = state.players[state.currentPlayerIndex];
    this.resetNonPersistentResources(currentPlayer);

    // End turn
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

    return state;
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