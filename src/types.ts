export type Vector = number[];

export interface BasisRelation {
  name: string;
  vector: Vector;
  description: string;
}

export interface Premise {
  id: string;
  entityA: string;
  relation: string; // Key of the BasisRelation
  entityB: string;
}

export interface EntityNode {
  name: string;
  coordinates: Vector;
  componentId: number;
}

export interface Contradiction {
  entityA: string;
  entityB: string;
  expectedVector: Vector;
  actualVector: Vector;
  pathA: string[];
  pathB: string[];
}

export interface SolverResult {
  entities: Record<string, EntityNode>;
  componentCount: number;
  isConsistent: boolean;
  contradiction?: Contradiction;
}

export type DimensionCount = 2 | 3 | 4;

export interface TrainingStats {
  score: number;
  streak: number;
  accuracy: number;
  totalAnswered: number;
  totalCorrect: number;
  averageTimeMs: number;
  history: {
    timestamp: number;
    correct: boolean;
    timeMs: number;
    dimension: number;
    difficulty: string;
    scoreGained: number;
  }[];
}

export type PuzzleDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';

export interface Puzzle {
  id: string;
  premises: { entityA: string; relation: string; entityB: string }[];
  question: {
    entityA: string; // "Find relationship of entityA ..."
    entityB: string; // "... with respect to entityB"
  };
  options: {
    relation: string; // either a basis relation name or descriptive text
    vector: Vector;
    isCorrect: boolean;
  }[];
  explanation: string;
  dimension: DimensionCount;
  difficulty: PuzzleDifficulty;
}
