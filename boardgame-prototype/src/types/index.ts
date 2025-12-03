export type Guild = 'military' | 'culture' | 'technology' | 'royal' | 'building';
export type Color = 'blue' | 'red' | 'green' | 'yellow' | 'purple';
export type PlayerId = string;
export type GamePhase = 'setup' | 'playing' | 'ended';
export type ActionType = 'expand' | 'consolidate';

export interface Card {
  id: string;
  guild: Guild;
  color: Color;
  position: number;
  power: string;
  bonus: string;
}

export interface MapSpot {
  id: number;
  type: 'normal' | 'starting' | 'outpost';
  position: { row: number; col: number };
  adjacent: number[];
  isOutpost: boolean;
  occupyingPlayer: PlayerId | null;
  armies: number;
}

export interface Player {
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

export interface GameState {
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
  type: ActionType;
  playerId: PlayerId;
  cardId?: string;
  targetSpotId?: number;
  payload?: any;
}

export interface GameEngine {
  state: GameState;
  initializeGame: (playerNames: string[]) => GameState;
  processAction: (action: GameAction) => GameState;
  saveGame: () => void;
  loadGame: () => GameState | null;
  getCurrentPlayer: () => Player;
  getAdjacentSpots: (spotId: number) => number[];
  canPlaceArmy: (playerId: PlayerId, spotId: number) => boolean;
  canPlayCard: (playerId: PlayerId, cardId: string) => boolean;
}