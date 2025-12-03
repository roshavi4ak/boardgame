import { configureStore } from '@reduxjs/toolkit';
import { GameEngine } from '../core/GameEngine';

// Moved all required types here to avoid circular dependencies
type Guild = 'military' | 'culture' | 'technology' | 'royal' | 'trade';
type Color = 'blue' | 'red' | 'green' | 'yellow' | 'purple';
type PlayerId = string;
type GamePhase = 'setup' | 'playing' | 'ended';

interface Card {
  id: string;
  guild: Guild;
  color: Color;
  position: number;
  power: string;
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


const initialState: GameState = {
  id: '',
  players: [],
  currentPlayerIndex: 0,
  phase: 'setup',
  commonDeck: [],
  map: [],
  createdAt: '',
  updatedAt: ''
};

const gameEngine = new GameEngine();

const gameSlice = {
  name: 'game',
  initialState,
  reducers: {
    initializeGame: (_state: GameState, action: { payload: string[] }) => {
      return gameEngine.initializeGame(action.payload);
    },
    processAction: (_state: GameState, action: { payload: any }) => {
      return gameEngine.processAction(action.payload);
    },
    loadGame: (state: GameState) => {
      const savedGame = gameEngine.loadGame();
      return savedGame || state;
    }
  }
};

export const store = configureStore({
  reducer: {
    game: (state = initialState, action: any) => {
      if (gameSlice.reducers[action.type as keyof typeof gameSlice.reducers]) {
        return gameSlice.reducers[action.type as keyof typeof gameSlice.reducers](state, action);
      }
      return state;
    }
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;