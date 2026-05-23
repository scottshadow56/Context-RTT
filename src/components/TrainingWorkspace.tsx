import React, { useState, useEffect, useRef } from 'react';
import { DimensionCount, Puzzle, PuzzleDifficulty, TrainingStats } from '../types';
import { generateTrainerPuzzle, getBasisRelations } from '../utils/engine';
import { 
  Brain, Trophy, Clock, ShieldCheck, HelpCircle, 
  ArrowRight, RotateCw, Activity, Compass, Sliders 
} from 'lucide-react';

interface ContextOption {
  text: string;
  isCorrect: boolean;
}

interface ContextPuzzle {
  dimension: DimensionCount;
  difficulty: PuzzleDifficulty;
  nodeDefinitions: {
    node: string;
    relation: string;
    targetNode: string;
    baseOffset: number[];
  }[];
  contextVehicles: {
    id: string; 
    boundRelation: string; 
    boundNode: string; 
    boundVector: number[];
    shiftMultiplier: number; 
    shiftLabel: string; 
    axisIndex?: number;
    effectiveMultiplier?: number;
  }[];
  activeContextGroup: string[]; 
  queryNode: string; 
  queryTarget: string; 
  baseOffsetVector: number[]; 
  projectedVector: number[]; 
  baseRelation: string; 
  projectedRelation: string; 
  options: ContextOption[];
}

interface TrainingWorkspaceProps {
  stats: TrainingStats;
  onUpdateStats: (newStats: TrainingStats) => void;
  basisRelations2D: Record<string, number[]>;
  basisRelations3D: Record<string, number[]>;
  basisRelations4D: Record<string, number[]>;
  setDimension: (dim: DimensionCount) => void;
  setSelectedPremises: (premises: any[]) => void;
  setHighlightedPremiseId: (id: string | null) => void;
  workoutMode: 'classic' | 'context';
  setWorkoutMode: (mode: 'classic' | 'context') => void;
  onUpdateContextDetails: (details: {
    dimension: DimensionCount;
    baseVector: number[];
    projectedVector: number[];
    baseRelationName: string;
    projectedRelationName: string;
    activeModifiers: number[];
    nodeDefinitions: any[];
    contextVehicles: any[];
  }) => void;
}

const describeContextVector = (vec: number[], dim: DimensionCount): string => {
  const parts: string[] = [];
  const y = vec[0] ?? 0;
  const x = vec[1] ?? 0;
  
  let gridPart = '';
  if (y > 0) gridPart += 'North';
  else if (y < 0) gridPart += 'South';
  if (x > 0) gridPart += 'East';
  else if (x < 0) gridPart += 'West';
  
  if (gridPart) {
    if (Math.abs(y) > 1 || Math.abs(x) > 1) {
      gridPart += '-Scaled';
    }
    parts.push(gridPart);
  }
  
  if (dim >= 3) {
    const z = vec[2] ?? 0;
    if (z > 0) {
      parts.push(Math.abs(z) > 1 ? 'Above-Scaled' : 'Above');
    } else if (z < 0) {
      parts.push(Math.abs(z) > 1 ? 'Below-Scaled' : 'Below');
    }
  }
  
  if (dim >= 4) {
    const w = vec[3] ?? 0;
    if (w > 0) {
      parts.push(Math.abs(w) > 1 ? 'After-Scaled' : 'After');
    } else if (w < 0) {
      parts.push(Math.abs(w) > 1 ? 'Before-Scaled' : 'Before');
    }
  }
  
  if (parts.length === 0) return 'Origin';
  return parts.join('-');
};

export function generateContextPuzzle(
  dim: DimensionCount,
  difficulty: PuzzleDifficulty,
  customSettings?: {
    useCustom: boolean;
    anchorCount: number;
    shiftsPerAnchor: number;
    interrelation: 'chain' | 'cross';
    scaleType: 'integer' | 'mixed';
  }
): ContextPuzzle {
  const getRandomOffset = (d: number): number[] => {
    const out: any[] = [0, 0, 0, 0];
    const choices = [-1, 0, 1];
    for (let i = 0; i < d; i++) {
      out[i] = choices[Math.floor(Math.random() * choices.length)];
    }
    if (out.every(v => v === 0)) {
      out[0] = 1;
    }
    return out;
  };

  const Gamma = [0, 0, 0, 0];
  const Beta = getRandomOffset(dim);
  const AlphaOffset = getRandomOffset(dim);
  const DeltaOffset = getRandomOffset(dim);
  const EpsilonOffset = getRandomOffset(dim);

  const Alpha = [
    Beta[0] + AlphaOffset[0],
    Beta[1] + AlphaOffset[1],
    Beta[2] + AlphaOffset[2],
    Beta[3] + AlphaOffset[3],
  ];
  const Delta = [
    Gamma[0] + DeltaOffset[0],
    Gamma[1] + DeltaOffset[1],
    Gamma[2] + DeltaOffset[2],
    Gamma[3] + DeltaOffset[3],
  ];

  const baseOffsetVector = [
    Alpha[0] - Delta[0],
    Alpha[1] - Delta[1],
    Alpha[2] - Delta[2],
    Alpha[3] - Delta[3],
  ];

  if (baseOffsetVector.slice(0, dim).every(v => v === 0)) {
    baseOffsetVector[0] = 1;
  }

  const contextVehicles: any[] = [];
  const activeContextGroup: string[] = [];

  const axes = [
    { boundNode: 'Beta', boundVector: Beta, boundName: describeContextVector(Beta, dim) },
    { boundNode: 'Delta', boundVector: DeltaOffset, boundName: describeContextVector(DeltaOffset, dim) }
  ];
  if (dim >= 3) {
    axes.push({ boundNode: 'Alpha', boundVector: AlphaOffset, boundName: describeContextVector(AlphaOffset, dim) });
  }
  if (dim >= 4) {
    axes.push({ boundNode: 'Omega', boundVector: EpsilonOffset, boundName: describeContextVector(EpsilonOffset, dim) });
  }

  if (customSettings && customSettings.useCustom) {
    const { anchorCount, shiftsPerAnchor, interrelation, scaleType } = customSettings;
    const actualAnchorsCount = Math.min(anchorCount, axes.length);

    const levels: any[][] = [];
    levels[0] = [];

    const assignedNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    let nameIdx = 0;

    for (let i = 0; i < actualAnchorsCount; i++) {
      const name = assignedNames[nameIdx++];
      const anchorObj = {
        id: name,
        boundRelation: axes[i].boundName,
        boundNode: axes[i].boundNode,
        boundVector: axes[i].boundVector,
        shiftMultiplier: 1,
        shiftLabel: `IDENTITY`,
        axisIndex: i,
        effectiveMultiplier: 1,
        isAnchor: true
      };
      contextVehicles.push(anchorObj);
      levels[0].push(anchorObj);
    }

    const intMults = [2, -1, -2, 1];
    const mixMults = [1.5, -0.5, 0.5, -1.5];

    for (let j = 1; j <= shiftsPerAnchor; j++) {
      levels[j] = [];
      for (let i = 0; i < actualAnchorsCount; i++) {
        if (nameIdx >= assignedNames.length) break;
        const name = assignedNames[nameIdx++];
        
        let parent = levels[j - 1][i];
        if (interrelation === 'cross' && actualAnchorsCount > 1) {
          parent = levels[j - 1][(i + 1) % actualAnchorsCount] || levels[j - 1][i];
        }

        const multPool = scaleType === 'integer' ? intMults : mixMults;
        const multChoice = multPool[Math.floor(Math.random() * multPool.length)];

        // Clamp compile: Make sure that cumulative product is strictly between [-2, 2]
        let chosenMult = multChoice;
        if (Math.abs(parent.effectiveMultiplier * chosenMult) > 2) {
          const safeChoices = multPool.filter(m => Math.abs(parent.effectiveMultiplier * m) <= 2 && m !== 0);
          if (safeChoices.length > 0) {
            chosenMult = safeChoices[Math.floor(Math.random() * safeChoices.length)];
          } else {
            chosenMult = parent.effectiveMultiplier > 0 ? -1 : 1;
          }
        }

        const labelRel = chosenMult === 1 
          ? 'IDENTITY' 
          : chosenMult > 1 
            ? 'AFTER' 
            : chosenMult < 0 && Math.abs(chosenMult) < 1 
              ? 'OPAL' 
              : 'BEFORE';
        const labelText = chosenMult === 1 ? `IDENTITY OF ${parent.id}` : `${labelRel} ${parent.id}`;

        const shiftObj = {
          id: name,
          boundRelation: parent.boundRelation,
          boundNode: parent.boundNode,
          boundVector: parent.boundVector,
          shiftMultiplier: chosenMult,
          shiftLabel: labelText,
          axisIndex: parent.axisIndex,
          effectiveMultiplier: parent.effectiveMultiplier * chosenMult,
          isAnchor: false
        };

        contextVehicles.push(shiftObj);
        levels[j].push(shiftObj);
      }
    }

    const leafLevel = levels[shiftsPerAnchor] || levels[0];
    leafLevel.forEach(cv => {
      activeContextGroup.push(cv.id);
    });

  } else {
    if (difficulty === 'Beginner') {
      contextVehicles.push({
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: 'IDENTITY ANCHOR',
        axisIndex: 0,
        effectiveMultiplier: 1
      });

      contextVehicles.push({
        id: 'B',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 2,
        shiftLabel: 'AFTER A',
        axisIndex: 0,
        effectiveMultiplier: 2
      });

      contextVehicles.push({
        id: 'C',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: -1,
        shiftLabel: 'BEFORE A',
        axisIndex: 0,
        effectiveMultiplier: -1
      });

      const activeVar = Math.random() > 0.5 ? 'B' : 'C';
      activeContextGroup.push(activeVar);

    } else if (difficulty === 'Intermediate') {
      const isBShiftAfter = Math.random() > 0.5;

      contextVehicles.push({
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: 'IDENTITY ANCHOR',
        axisIndex: 0,
        effectiveMultiplier: 1
      });

      contextVehicles.push({
        id: 'B',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: isBShiftAfter ? 2 : -1,
        shiftLabel: isBShiftAfter ? 'AFTER A' : 'BEFORE A',
        axisIndex: 0,
        effectiveMultiplier: isBShiftAfter ? 2 : -1
      });

      contextVehicles.push({
        id: 'C',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: isBShiftAfter ? -1 : 2,
        shiftLabel: isBShiftAfter ? 'BEFORE B' : 'AFTER B',
        axisIndex: 0,
        effectiveMultiplier: -2
      });

      activeContextGroup.push('C');

    } else if (difficulty === 'Advanced') {
      const isSignPatternA = Math.random() > 0.5;

      contextVehicles.push({
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: 'IDENTITY ANCHOR',
        axisIndex: 0,
        effectiveMultiplier: 1
      });

      if (isSignPatternA) {
        contextVehicles.push({
          id: 'B',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: -1,
          shiftLabel: 'BEFORE A',
          axisIndex: 0,
          effectiveMultiplier: -1
        });

        contextVehicles.push({
          id: 'C',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: 2,
          shiftLabel: 'AFTER B',
          axisIndex: 0,
          effectiveMultiplier: -2
        });

        contextVehicles.push({
          id: 'D',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: -1,
          shiftLabel: 'BEFORE C',
          axisIndex: 0,
          effectiveMultiplier: 2
        });
      } else {
        contextVehicles.push({
          id: 'B',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: -1,
          shiftLabel: 'BEFORE A',
          axisIndex: 0,
          effectiveMultiplier: -1
        });

        contextVehicles.push({
          id: 'C',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: -2,
          shiftLabel: 'BEFORE B',
          axisIndex: 0,
          effectiveMultiplier: 2
        });

        contextVehicles.push({
          id: 'D',
          boundRelation: axes[0].boundName,
          boundNode: axes[0].boundNode,
          boundVector: axes[0].boundVector,
          shiftMultiplier: -1,
          shiftLabel: 'BEFORE C',
          axisIndex: 0,
          effectiveMultiplier: -2
        });
      }

      activeContextGroup.push('D');

    } else {
      contextVehicles.push({
        id: 'A',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 1,
        shiftLabel: 'IDENTITY',
        axisIndex: 0,
        effectiveMultiplier: 1
      });

      contextVehicles.push({
        id: 'B',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: 2,
        shiftLabel: 'AFTER A',
        axisIndex: 0,
        effectiveMultiplier: 2
      });

      contextVehicles.push({
        id: 'C',
        boundRelation: axes[0].boundName,
        boundNode: axes[0].boundNode,
        boundVector: axes[0].boundVector,
        shiftMultiplier: -1,
        shiftLabel: 'BEFORE B',
        axisIndex: 0,
        effectiveMultiplier: -2
      });

      contextVehicles.push({
        id: 'D',
        boundRelation: axes[1].boundName,
        boundNode: axes[1].boundNode,
        boundVector: axes[1].boundVector,
        shiftMultiplier: -1,
        shiftLabel: 'BEFORE A',
        axisIndex: 1,
        effectiveMultiplier: -1
      });

      activeContextGroup.push('C', 'D');
    }
  }

  const aggregateScales = [1, 1, 1, 1];
  contextVehicles.forEach(cv => {
    if (activeContextGroup.includes(cv.id)) {
      const scaleFactor = cv.effectiveMultiplier !== undefined ? cv.effectiveMultiplier : cv.shiftMultiplier;
      for (let idx = 0; idx < dim; idx++) {
        if (cv.boundVector[idx] !== 0) {
          aggregateScales[idx] *= scaleFactor;
        }
      }
    }
  });

  const projectedVector = [
    baseOffsetVector[0] * aggregateScales[0],
    baseOffsetVector[1] * aggregateScales[1],
    baseOffsetVector[2] * aggregateScales[2],
    baseOffsetVector[3] * aggregateScales[3],
  ];

  if (projectedVector.slice(0, dim).every(v => v === 0)) {
    projectedVector[0] = 1;
  }

  const baseRelation = describeContextVector(baseOffsetVector, dim);
  const projectedRelation = describeContextVector(projectedVector, dim);

  const correctOptionText = projectedRelation;
  const incorrectChoices = new Set<string>();

  if (baseRelation !== correctOptionText) {
    incorrectChoices.add(baseRelation);
  }

  const cardinalDistractors = [
    'North', 'South', 'East', 'West', 'Northeast', 'Northwest', 'Southeast', 'Southwest',
    'North-Above', 'South-Below', 'Northeast-Above', 'Southwest-Below', 
    'North-Scaled', 'South-Above-Scaled', 'East-After', 'West-Before',
    'North-After', 'South-Before', 'Northeast-After', 'Southwest-Before-Scaled'
  ];

  while (incorrectChoices.size < 3) {
    const randChoice = cardinalDistractors[Math.floor(Math.random() * cardinalDistractors.length)];
    if (randChoice !== correctOptionText && randChoice !== 'Origin') {
      incorrectChoices.add(randChoice);
    }
  }

  const options = [
    { text: correctOptionText, isCorrect: true },
    ...Array.from(incorrectChoices).map(txt => ({ text: txt, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  const nodeDefinitions = [
    { node: 'Beta', relation: describeContextVector(Beta, dim), targetNode: 'Gamma', baseOffset: Beta },
    { node: 'Alpha', relation: describeContextVector(AlphaOffset, dim), targetNode: 'Beta', baseOffset: AlphaOffset },
    { node: 'Delta', relation: describeContextVector(DeltaOffset, dim), targetNode: 'Gamma', baseOffset: DeltaOffset },
  ];
  if (dim >= 4) {
    nodeDefinitions.push({
      node: 'Omega',
      relation: describeContextVector(EpsilonOffset, dim),
      targetNode: 'Alpha',
      baseOffset: EpsilonOffset
    });
  }

  return {
    dimension: dim,
    difficulty,
    nodeDefinitions,
    contextVehicles,
    activeContextGroup,
    queryNode: 'Alpha',
    queryTarget: 'Delta',
    baseOffsetVector,
    projectedVector,
    baseRelation,
    projectedRelation,
    options
  };
}

export default function TrainingWorkspace({
  stats,
  onUpdateStats,
  setDimension,
  setSelectedPremises,
  setHighlightedPremiseId,
  workoutMode,
  setWorkoutMode,
  onUpdateContextDetails
}: TrainingWorkspaceProps) {
  const [selectedDim, setSelectedDim] = useState<DimensionCount>(2);
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('Beginner');

  // Custom configuration states
  const [generatorMode, setGeneratorMode] = useState<'preset' | 'custom'>('preset');
  const [customAnchors, setCustomAnchors] = useState<number>(2);
  const [customShiftsCount, setCustomShiftsCount] = useState<number>(2);
  const [customInterrelation, setCustomInterrelation] = useState<'chain' | 'cross'>('chain');
  const [customMultiplierScale, setCustomMultiplierScale] = useState<'integer' | 'mixed'>('integer');
  
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const [currentCtxPuzzle, setCurrentCtxPuzzle] = useState<ContextPuzzle | null>(null);
  const [selectedCtxAnswerIdx, setSelectedCtxAnswerIdx] = useState<number | null>(null);
  const [isCtxSubmitted, setIsCtxSubmitted] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [seconds, setSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartTraining = () => {
    setIsPlaying(true);
    setDimension(selectedDim);

    if (workoutMode === 'classic') {
      const newPuzzle = generateTrainerPuzzle(selectedDim, difficulty);
      const visualPremises = newPuzzle.premises.map((p, idx) => ({
        id: `pzp-${idx}`,
        entityA: p.entityA,
        relation: p.relation,
        entityB: p.entityB
      }));
      setSelectedPremises(visualPremises);
      setHighlightedPremiseId(null);
      setCurrentPuzzle(newPuzzle);
      setSelectedAnswerIdx(null);
      setIsSubmitted(false);
      setSeconds(0);
    } else {
      const newCtxPuzzle = generateContextPuzzle(selectedDim, difficulty, {
        useCustom: generatorMode === 'custom',
        anchorCount: customAnchors,
        shiftsPerAnchor: customShiftsCount,
        interrelation: customInterrelation,
        scaleType: customMultiplierScale
      });
      setCurrentCtxPuzzle(newCtxPuzzle);
      setSelectedCtxAnswerIdx(null);
      setIsCtxSubmitted(false);
      setSeconds(0);

      onUpdateContextDetails({
        dimension: selectedDim,
        baseVector: newCtxPuzzle.baseOffsetVector,
        projectedVector: newCtxPuzzle.projectedVector,
        baseRelationName: newCtxPuzzle.baseRelation,
        projectedRelationName: newCtxPuzzle.projectedRelation,
        nodeDefinitions: newCtxPuzzle.nodeDefinitions,
        contextVehicles: newCtxPuzzle.contextVehicles,
        activeModifiers: (() => {
          const aggregateScales = [1, 1, 1, 1];
          newCtxPuzzle.contextVehicles.forEach(cv => {
            if (newCtxPuzzle.activeContextGroup.includes(cv.id)) {
              const scaleFactor = cv.effectiveMultiplier !== undefined ? cv.effectiveMultiplier : cv.shiftMultiplier;
              for (let idx = 0; idx < selectedDim; idx++) {
                if (cv.boundVector[idx] !== 0) {
                  aggregateScales[idx] *= scaleFactor;
                }
              }
            }
          });
          return aggregateScales;
        })()
      });
    }
  };

  useEffect(() => {
    if (isPlaying) {
      handleStartTraining();
    }
  }, [selectedDim, difficulty, workoutMode, generatorMode, customAnchors, customShiftsCount, customInterrelation, customMultiplierScale]);

  useEffect(() => {
    const maxVal = selectedDim;
    if (customAnchors > maxVal) {
      setCustomAnchors(maxVal);
    }
  }, [selectedDim, customAnchors]);

  useEffect(() => {
    const isOver = workoutMode === 'classic' ? isSubmitted : isCtxSubmitted;
    if (isPlaying && !isOver) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isSubmitted, isCtxSubmitted, workoutMode]);

  const handleSelectAnswer = (idx: number) => {
    if (workoutMode === 'classic') {
      if (isSubmitted) return;
      setSelectedAnswerIdx(idx);
    } else {
      if (isCtxSubmitted) return;
      setSelectedCtxAnswerIdx(idx);
    }
  };

  const handleSubmitAnswer = () => {
    if (workoutMode === 'classic') {
      if (selectedAnswerIdx === null || isSubmitted || !currentPuzzle) return;
      
      setIsSubmitted(true);
      const selectedOption = currentPuzzle.options[selectedAnswerIdx];
      const isCorrect = selectedOption.isCorrect;
      const timeTakenMs = seconds * 1000;

      const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
        'Beginner': 100,
        'Intermediate': 200,
        'Advanced': 400,
        'Master': 800
      };

      const speedBonus = Math.max(0, Math.floor((60 - seconds) * 1.5));
      const scoreGained = isCorrect ? (difficultyMultiplier[currentPuzzle.difficulty] + speedBonus) : 0;

      const newStreak = isCorrect ? stats.streak + 1 : 0;
      const newTotalAnswered = stats.totalAnswered + 1;
      const newTotalCorrect = isCorrect ? stats.totalCorrect + 1 : stats.totalCorrect;
      const newAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);
      const newAverageTimeMs = Math.round(((stats.averageTimeMs * stats.totalAnswered) + timeTakenMs) / newTotalAnswered);

      const historyItem = {
        timestamp: Date.now(),
        correct: isCorrect,
        timeMs: timeTakenMs,
        dimension: currentPuzzle.dimension,
        difficulty: currentPuzzle.difficulty,
        scoreGained
      };

      const newStats: TrainingStats = {
        score: stats.score + scoreGained,
        streak: newStreak,
        accuracy: newAccuracy,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        averageTimeMs: newAverageTimeMs,
        history: [historyItem, ...stats.history]
      };

      onUpdateStats(newStats);
    } else {
      if (selectedCtxAnswerIdx === null || isCtxSubmitted || !currentCtxPuzzle) return;

      setIsCtxSubmitted(true);
      const selectedOption = currentCtxPuzzle.options[selectedCtxAnswerIdx];
      const isCorrect = selectedOption.isCorrect;
      const timeTakenMs = seconds * 1000;

      const difficultyMultiplier: Record<PuzzleDifficulty, number> = {
        'Beginner': 120,
        'Intermediate': 240,
        'Advanced': 480,
        'Master': 960
      };

      const speedBonus = Math.max(0, Math.floor((90 - seconds) * 1.5));
      const scoreGained = isCorrect ? (difficultyMultiplier[currentCtxPuzzle.difficulty] + speedBonus) : 0;

      const newStreak = isCorrect ? stats.streak + 1 : 0;
      const newTotalAnswered = stats.totalAnswered + 1;
      const newTotalCorrect = isCorrect ? stats.totalCorrect + 1 : stats.totalCorrect;
      const newAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);
      const newAverageTimeMs = Math.round(((stats.averageTimeMs * stats.totalAnswered) + timeTakenMs) / newTotalAnswered);

      const historyItem = {
        timestamp: Date.now(),
        correct: isCorrect,
        timeMs: timeTakenMs,
        dimension: currentCtxPuzzle.dimension,
        difficulty: currentCtxPuzzle.difficulty,
        scoreGained
      };

      const newStats: TrainingStats = {
        score: stats.score + scoreGained,
        streak: newStreak,
        accuracy: newAccuracy,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        averageTimeMs: newAverageTimeMs,
        history: [historyItem, ...stats.history]
      };

      onUpdateStats(newStats);
    }
  };

  const handleNextPuzzle = () => {
    handleStartTraining();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6" id="training-workspace-container">
      
      {/* Workout mode sub-toggle */}
      <div className="flex bg-white/45 p-1 border border-[#141414] select-none">
        <button
          onClick={() => setWorkoutMode('classic')}
          className={`flex-1 py-2 text-xs font-sans font-bold flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer rounded-none transition-all duration-150 ${
            workoutMode === 'classic'
              ? 'bg-[#141414] text-[#E4E3E0]'
              : 'text-[#141414] hover:bg-[#141414]/10'
          }`}
        >
          <Brain className="w-4 h-4" />
          Classic Deductions
        </button>
        <button
          onClick={() => setWorkoutMode('context')}
          className={`flex-1 py-2 text-xs font-sans font-bold flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer rounded-none transition-all duration-150 ${
            workoutMode === 'context'
              ? 'bg-[#141414] text-[#E4E3E0]'
              : 'text-[#141414] hover:bg-[#141414]/10'
          }`}
        >
          <Compass className="w-4 h-4" />
          Context Mutators (Context)
        </button>
      </div>

      {/* Configuration row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white/40 border border-[#141414] p-4 shadow-sm">
        {/* Dim toggle */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <label className="text-xs font-mono text-[#141414] font-bold tracking-wider">DIMENSIONAL SPACE</label>
          <div className="grid grid-cols-3 gap-1 bg-white/60 p-1 border border-[#141414]">
            {([2, 3, 4] as DimensionCount[]).map(dim => (
              <button
                key={dim}
                id={`dim-toggle-${dim}`}
                onClick={() => setSelectedDim(dim)}
                className={`py-1.5 text-xs font-mono font-bold transition-all duration-150 rounded-none cursor-pointer ${
                  selectedDim === dim
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'text-[#141414] hover:bg-[#141414]/10'
                }`}
              >
                {dim}D SPACE
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="md:col-span-5 flex flex-col gap-2">
          <label className="text-xs font-mono text-[#141414] font-bold tracking-wider">COGNITIVE LEVEL</label>
          <div className="grid grid-cols-4 gap-1 bg-white/60 p-1 border border-[#141414]">
            {(['Beginner', 'Intermediate', 'Advanced', 'Master'] as PuzzleDifficulty[]).map(diff => (
              <button
                key={diff}
                id={`diff-level-${diff}`}
                onClick={() => setDifficulty(diff)}
                className={`py-1.5 text-[10px] font-mono font-bold transition-all duration-150 uppercase tracking-tight rounded-none cursor-pointer ${
                  difficulty === diff
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'text-[#141414] hover:bg-[#141414]/10'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="md:col-span-3 flex items-end">
          <button
            id="start-training-btn"
            onClick={handleStartTraining}
            className="w-full bg-[#141414] hover:bg-[#141414]/90 text-[#E4E3E0] text-xs font-sans font-bold py-3 px-4 border border-[#141414] flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider h-[40px]"
          >
            {isPlaying ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                Regenerate Map
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Start Workout
              </>
            )}
          </button>
        </div>
      </div>

      {/* Decoupled Custom parameters for Context Mode */}
      {workoutMode === 'context' && (
        <div className="flex flex-col gap-3 bg-[#E4E3E0]/45 border border-[#141414] p-4 select-none -mt-2 animate-fadeIn" id="context-generator-settings-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#141414]/15 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#141414]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">Generator Strategy Option</span>
            </div>
            
            {/* Toggles between Presets and Custom Mode */}
            <div className="flex bg-white border border-[#141414] p-0.5">
              <button
                onClick={() => setGeneratorMode('preset')}
                className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide transition-all duration-150 rounded-none cursor-pointer ${
                  generatorMode === 'preset'
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'text-[#141414] hover:bg-[#141414]/10'
                }`}
              >
                Level Presets
              </button>
              <button
                onClick={() => setGeneratorMode('custom')}
                className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide transition-all duration-150 rounded-none cursor-pointer ${
                  generatorMode === 'custom'
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'text-[#141414] hover:bg-[#141414]/10'
                }`}
              >
                Custom Parameters
              </button>
            </div>
          </div>

          {/* Render parameters only if useCustom is enabled */}
          {generatorMode === 'custom' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slideDown">
              
              {/* Anchor Count Parameter */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-[#141414]/75 font-bold uppercase">Identity Anchors</span>
                <div className="grid grid-cols-4 gap-0.5 bg-white p-0.5 border border-[#141414]/40">
                  {[1, 2, 3, 4].map(val => {
                    const maxVal = selectedDim;
                    const disabled = val > maxVal;
                    return (
                      <button
                        key={val}
                        disabled={disabled}
                        onClick={() => setCustomAnchors(val)}
                        className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                          disabled 
                            ? 'opacity-25 cursor-not-allowed bg-neutral-200/50 text-neutral-400' 
                            : customAnchors === val
                              ? 'bg-[#141414] text-[#E4E3E0]'
                              : 'text-[#141414] hover:bg-[#141414]/5'
                        }`}
                      >
                        {val} {val === 1 ? 'Anchor' : 'Anchors'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift Registers Depth Count */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-[#141414]/75 font-bold uppercase">Shift Pipeline Depth</span>
                <div className="grid grid-cols-4 gap-0.5 bg-white p-0.5 border border-[#141414]/40">
                  {[0, 1, 2, 3].map(val => (
                    <button
                      key={val}
                      onClick={() => setCustomShiftsCount(val)}
                      className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                        customShiftsCount === val
                          ? 'bg-[#141414] text-[#E4E3E0]'
                          : 'text-[#141414] hover:bg-[#141414]/5'
                      }`}
                    >
                      {val === 0 ? 'Pure' : `${val} Level`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cross-channel references option */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-[#141414]/75 font-bold uppercase">Register Interrelation</span>
                <div className="grid grid-cols-2 gap-0.5 bg-white p-0.5 border border-[#141414]/40">
                  <button
                    onClick={() => setCustomInterrelation('chain')}
                    className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                      customInterrelation === 'chain'
                        ? 'bg-[#141414] text-[#E4E3E0]'
                        : 'text-[#141414] hover:bg-[#141414]/5'
                    }`}
                  >
                    Direct Chained
                  </button>
                  <button
                    disabled={customAnchors < 2 || customShiftsCount < 1}
                    onClick={() => setCustomInterrelation('cross')}
                    className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                      (customAnchors < 2 || customShiftsCount < 1)
                        ? 'opacity-25 cursor-not-allowed bg-neutral-200/50 text-neutral-400'
                        : customInterrelation === 'cross'
                          ? 'bg-[#141414] text-[#E4E3E0]'
                          : 'text-[#141414] hover:bg-[#141414]/5'
                    }`}
                  >
                    Cross Registers
                  </button>
                </div>
              </div>

              {/* Multipliers bounds option */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-[#141414]/75 font-bold uppercase">Multiplier Scales</span>
                <div className="grid grid-cols-2 gap-0.5 bg-white p-0.5 border border-[#141414]/40">
                  <button
                    onClick={() => setCustomMultiplierScale('integer')}
                    className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                      customMultiplierScale === 'integer'
                        ? 'bg-[#141414] text-[#E4E3E0]'
                        : 'text-[#141414] hover:bg-[#141414]/5'
                    }`}
                  >
                    Integer
                  </button>
                  <button
                    onClick={() => setCustomMultiplierScale('mixed')}
                    className={`py-1 text-[9px] font-mono font-bold uppercase transition-all duration-150 ${
                      customMultiplierScale === 'mixed'
                        ? 'bg-[#141414] text-[#E4E3E0]'
                        : 'text-[#141414] hover:bg-[#141414]/5'
                    }`}
                  >
                    Mixed Scales
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <p className="text-[10px] text-neutral-500 font-sans leading-relaxed">
              Applying standard preset templates (
              <span className="font-mono font-bold text-[#141414]">{difficulty.toUpperCase()}</span>). Toggle to the custom panel to fully decouple features, setup multiple concurrent identity anchors, and program multidimensional compounding shift registers.
            </p>
          )}

        </div>
      )}

      {/* Main puzzle board */}
      {!isPlaying ? (
        <div className="flex flex-col items-center justify-center border border-[#141414] p-12 text-center bg-white/30 relative overflow-hidden h-[400px]">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
          
          <Brain className="w-16 h-16 text-[#141414]/75 stroke-[1.2] mb-4" />
          <h3 className="font-serif italic text-xl text-[#141414] mb-2 uppercase tracking-wide">
            {workoutMode === 'classic' ? 'Classic Vector Deduction System' : 'Mutational Context Space Initiator'}
          </h3>
          <p className="font-sans text-[#141414] max-w-md text-xs leading-relaxed mb-6 opacity-80">
            {workoutMode === 'classic' 
              ? 'Deconstruct multi-dimensional coordinate displacement graphs. Use spatial deduction matrices to solve absolute coordinates of query nodes relative to target benchmarks.'
              : 'Evaluate absolute vector definitions under active linear context shifts. Compile and modify axis directions to predict mutated coordinate vectors across hyperspatial maps.'
            }
          </p>
          <button
            id="lobby-start-btn"
            onClick={handleStartTraining}
            className="bg-[#141414] hover:bg-[#141414]/90 text-[#E4E3E0] font-bold font-sans text-xs px-6 py-3 border border-[#141414] uppercase tracking-wider cursor-pointer transition-transform duration-100"
          >
            Initialize Relational Matrix
          </button>
        </div>
      ) : workoutMode === 'classic' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left panel - Premise list */}
          <div className="lg:col-span-7 flex flex-col gap-4 bg-white/40 border border-[#141414] p-6 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            <div className="flex justify-between items-center border-b border-[#141414] pb-3 mb-2 z-10">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-[#141414]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Riddle Engine ({currentPuzzle?.difficulty})</span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-[#141414] py-1 px-2.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono text-xs font-bold text-[#141414]">{formatTime(seconds)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 z-10">
              <p className="text-xs font-mono text-[#141414] font-bold uppercase tracking-wide">Premises Declarations:</p>
              <div className="flex flex-col gap-1.5">
                {currentPuzzle?.premises.map((p, idx) => {
                  const puzzleBasis = currentPuzzle ? getBasisRelations(currentPuzzle.dimension) : {};
                  const relVector = puzzleBasis[p.relation] || [];
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHighlightedPremiseId(`pzp-${idx}`)}
                      onMouseLeave={() => setHighlightedPremiseId(null)}
                      className="flex flex-wrap items-center justify-between bg-white border border-[#141414]/40 hover:border-[#141414] px-4 py-2 text-xs font-sans transition-all duration-150 cursor-help"
                    >
                      <span className="flex items-center gap-2 flex-wrap text-[#141414]">
                        <span className="w-1.5 h-1.5 bg-[#141414] rotate-45"></span>
                        <strong className="text-[#141414] font-mono">{p.entityA}</strong>
                        <span className="opacity-60 font-serif italic">is</span>
                        <span className="font-mono font-bold text-[#E4E3E0] bg-[#141414] px-1.5 py-0.5">{p.relation}</span>
                        {relVector.length > 0 && (
                          <span className="font-mono text-[9px] font-bold text-[#141414]/80 bg-[#E4E3E0] border border-[#141414]/25 px-1.5 py-0.5 select-none uppercase tracking-tighter">
                            [{relVector.slice(0, currentPuzzle.dimension).join(', ')}]
                          </span>
                        )}
                        <span className="opacity-60 font-serif italic">of</span>
                        <strong className="text-[#141414] font-mono">{p.entityB}</strong>
                      </span>
                      <span className="text-[9px] font-mono text-neutral-500 bg-[#141414]/5 px-2 py-0.5 border border-dashed border-[#141414]/20 mt-1 sm:mt-0 font-bold">Premise #{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/85 border border-[#141414] p-4 my-2 z-10">
              <div className="flex gap-2.5 items-start">
                <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#141414]" />
                <div className="flex flex-col">
                  <p className="text-xs font-mono font-bold text-[#141414] uppercase tracking-wide">Deduce Vector Displacement</p>
                  <p className="text-sm font-sans font-bold text-[#141414] leading-relaxed mt-1">
                    Determine the coordinates position of <strong className="font-mono bg-[#141414] text-[#E4E3E0] px-1 ml-1">{currentPuzzle?.question.entityA}</strong> with respect to <strong className="font-mono border border-[#141414] px-1 ml-1">{currentPuzzle?.question.entityB}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {isSubmitted && currentPuzzle && (
              <div className="mt-2 bg-white/70 border border-[#141414] p-4 text-xs font-sans z-10">
                <div className="flex items-center gap-1 text-[#141414] font-bold border-b border-[#141414] pb-2 mb-2 font-mono uppercase tracking-wider text-[10px]">
                  <Activity className="w-4 h-4" />
                  <span>Interactive Proof Tracing Dashboard</span>
                </div>
                <div className="space-y-1.5 text-[#141414] font-mono whitespace-pre-line leading-relaxed text-[11px]">
                  {currentPuzzle.explanation}
                </div>
              </div>
            )}
          </div>

          {/* Multiple Choice Answers column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white/40 border border-[#141414] p-5 shadow-sm flex flex-col flex-1">
              <span className="text-xs font-mono text-[#141414] font-bold uppercase tracking-wider mb-3">SELECT RESPONSE CARD</span>
              
              <div className="flex flex-col gap-2.5 flex-1 justify-center">
                {currentPuzzle?.options.map((opt, idx) => {
                  const isSelected = selectedAnswerIdx === idx;
                  let cardStyle = "border-[#141414]/30 bg-white/50 text-[#141414] hover:bg-[#141414]/10";
                  
                  if (isSelected) {
                    cardStyle = "border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] font-bold";
                  }

                  if (isSubmitted) {
                    if (opt.isCorrect) {
                      cardStyle = "border-2 border-green-600 bg-white text-green-700 font-bold shadow-sm";
                    } else if (isSelected) {
                      cardStyle = "border-2 border-red-500 bg-white text-red-500 line-through opacity-70";
                    } else {
                      cardStyle = "border-[#141414]/20 bg-white/20 opacity-40 cursor-not-allowed";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      id={`mc-option-${idx}`}
                      onClick={() => handleSelectAnswer(idx)}
                      disabled={isSubmitted}
                      className={`w-full text-left p-3.5 border transition-all duration-150 cursor-pointer flex items-center justify-between rounded-none ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 border text-[10px] font-mono flex items-center justify-center font-bold rounded-none ${
                          isSelected ? 'bg-[#141414] border-[#141414] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]/50'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-wide">{opt.relation}</span>
                      </div>
                      <span className="font-mono text-[9px] text-neutral-600 border border-[#141414]/20 px-1.5 py-0.5 bg-white/60">
                        [{opt.vector.slice(0, currentPuzzle.dimension).join(',')}]
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-[#141414]">
                {!isSubmitted ? (
                  <button
                    id="submit-answer-btn"
                    onClick={handleSubmitAnswer}
                    disabled={selectedAnswerIdx === null}
                    className="w-full bg-[#141414] hover:bg-[#141414]/90 disabled:opacity-30 disabled:cursor-not-allowed text-[#E4E3E0] text-xs font-mono font-bold py-3 px-4 border border-[#141414] flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 uppercase tracking-widest h-[44px]"
                  >
                    <span>Submit Relational Deductions</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-center py-1 text-xs font-sans font-bold uppercase tracking-wider">
                      {currentPuzzle?.options[selectedAnswerIdx ?? 0]?.isCorrect ? (
                        <span className="text-green-700 flex items-center justify-center gap-1.5 bg-white border border-green-600 py-2 font-bold font-mono">
                          <Trophy className="w-4 h-4" /> SUCCESS • +{100 + Math.max(0, Math.floor((60 - seconds) * 1.5))} SCORE ACCUMULATED
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center justify-center gap-1.5 bg-white border border-red-500 py-2 font-bold font-mono">
                          DEDUCTION ENCOUNTERED COGNITIVE DIVERGENCE
                        </span>
                      )}
                    </div>
                    <button
                      id="next-puzzle-btn"
                      onClick={handleNextPuzzle}
                      className="w-full bg-[#141414] hover:bg-[#141414]/90 text-[#E4E3E0] text-xs font-sans font-bold py-3 px-4 border border-[#141414] flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wide h-[44px]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Request Next Vector Matrix</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // PLAYGROUND: CONTEXT MUTATOR MODE (Relational Workout "Context")
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          <div className="lg:col-span-7 flex flex-col gap-4 bg-white/40 border border-[#141414] p-6 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            <div className="flex justify-between items-center border-b border-[#141414] pb-3 mb-2 z-10 select-none">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-[#141414]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#141414]" />
                <span>Context Multiplier Engine ({currentCtxPuzzle?.difficulty})</span>
              </div>
              <div className="flex items-center gap-1 bg-white border border-[#141414] py-1 px-2.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono text-xs font-bold text-[#141414]">{formatTime(seconds)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 z-10 select-text">
              <p className="text-xs font-mono text-[#141414] font-bold uppercase tracking-wide">Anchor Definitions:</p>
              <div className="flex flex-col gap-1.5 font-sans text-xs">
                {currentCtxPuzzle?.nodeDefinitions.map((def, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border border-[#141414]/40 px-4 py-2">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 border border-[#141414] rotate-45"></span>
                      <strong className="text-[#141414] font-mono">{def.node}</strong>
                      <span className="opacity-60 font-serif italic">is initially positioned</span>
                      <span className="font-mono font-bold text-[#E4E3E0] bg-[#141414] px-1.5 py-0.5">{def.relation}</span>
                      <span className="opacity-60 font-serif italic">of</span>
                      <strong className="text-[#141414] font-mono">{def.targetNode}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 z-10 mt-1 select-text">
              <p className="text-xs font-mono text-[#141414] font-bold uppercase tracking-wide">Linear Shift Registers (Active Stack):</p>
              <div className="flex flex-col gap-1.5">
                {currentCtxPuzzle?.contextVehicles.map((ctx, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/70 border border-[#141414]/35 px-4 py-2 font-sans text-xs">
                    <span className="flex items-center gap-2 flex-wrap">
                      <Sliders className="w-3.5 h-3.5 text-[#141414]" />
                      <span>Context <strong className="font-mono text-white bg-[#141414] px-1">{ctx.id}</strong> shifts direction vector of relation with <strong className="font-mono">{ctx.boundNode}</strong>:</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                      ctx.shiftMultiplier < 0 
                        ? 'bg-amber-100 border-amber-400 text-amber-900' 
                        : ctx.shiftMultiplier > 1 
                          ? 'bg-blue-100 border-blue-400 text-blue-900' 
                          : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                    }`}>
                      {ctx.shiftLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/85 border border-[#141414] p-4 my-2 z-10 select-text font-sans">
              <div className="flex gap-2.5 items-start">
                <HelpCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#141414]" />
                <div className="flex flex-col flex-1">
                  <p className="text-xs font-mono font-bold text-[#141414] uppercase tracking-wide text-neutral-500">Hyperspatial Resolution Inquiry</p>
                  <p className="text-sm font-sans font-bold text-[#141414] leading-relaxed mt-1">
                    Solve the coordinate vector relationship of <strong className="font-mono bg-[#141414] text-[#E4E3E0] px-1 ml-1">{currentCtxPuzzle?.queryNode}</strong> with respect to <strong className="font-mono border border-[#141414] px-1 ml-1">{currentCtxPuzzle?.queryTarget}</strong> under compiled context modifiers: <strong className="font-mono bg-neutral-100 border border-neutral-300 text-neutral-800 px-1 ml-1">[{currentCtxPuzzle?.activeContextGroup.join(', ')}]</strong>.
                  </p>
                </div>
              </div>
            </div>

            {isCtxSubmitted && currentCtxPuzzle && (
              <div className="mt-2 bg-white/75 border border-[#141414] p-4 text-xs font-mono z-10 select-text">
                <div className="flex items-center gap-1.5 text-[#141414] font-bold border-b border-[#141414] pb-2 mb-2 uppercase tracking-wide text-[10px]">
                  <Activity className="w-4 h-4" />
                  <span>Hyperspatial Logic Resolution Log</span>
                </div>
                <div className="space-y-2 text-[#141414] leading-relaxed text-[11px] font-mono">
                  <p>
                    <span className="opacity-55">1. Base Vector Calculation:</span> <br />
                    - Relative offset vector <code className="font-bold">({currentCtxPuzzle.queryNode} - {currentCtxPuzzle.queryTarget})</code> is initially: <br />
                    <code className="bg-neutral-100 px-1 font-bold">[{currentCtxPuzzle.baseOffsetVector.slice(0, selectedDim).join(', ')}]</code> ({currentCtxPuzzle.baseRelation})
                  </p>
                  <p className="mt-2">
                    <span className="opacity-55">2. Compile Linear Shift Modifiers:</span> <br />
                    {currentCtxPuzzle.contextVehicles.map((cv, id) => (
                      <span key={id} className="block pl-2">
                        • {cv.id} modifies non-zero indices of vector <code className="bg-neutral-50 px-1">{cv.boundRelation}</code> by <code className="font-bold">{cv.shiftMultiplier}x</code>.
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 text-neutral-900 border-l-2 border-[#141414] pl-2.5 font-bold">
                    3. Resulting Projected Vector: <br />
                    <code className="bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5">[{currentCtxPuzzle.projectedVector.slice(0, selectedDim).join(', ')}]</code> ({currentCtxPuzzle.projectedRelation})
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white/40 border border-[#141414] p-5 shadow-sm flex flex-col flex-1">
              <span className="text-xs font-mono text-[#141414] font-bold uppercase tracking-wider mb-3">SELECT RESPONSE CARD</span>
              
              <div className="flex flex-col gap-2.5 flex-1 justify-center select-none">
                {currentCtxPuzzle?.options.map((opt, idx) => {
                  const isSelected = selectedCtxAnswerIdx === idx;
                  let cardStyle = "border-[#141414]/30 bg-white/50 text-[#141414] hover:bg-[#141414]/10";
                  
                  if (isSelected) {
                    cardStyle = "border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] font-bold";
                  }

                  if (isCtxSubmitted) {
                    if (opt.isCorrect) {
                      cardStyle = "border-2 border-green-600 bg-white text-green-700 font-bold shadow-sm";
                    } else if (isSelected) {
                      cardStyle = "border-2 border-red-500 bg-white text-red-500 line-through opacity-70";
                    } else {
                      cardStyle = "border-[#141414]/20 bg-white/20 opacity-40 cursor-not-allowed";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectAnswer(idx)}
                      disabled={isCtxSubmitted}
                      className={`w-full text-left p-3.5 border transition-all duration-150 cursor-pointer flex items-center justify-between rounded-none ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-5 h-5 border text-[10px] font-mono flex items-center justify-center font-bold rounded-none ${
                          isSelected ? 'bg-[#141414] border-[#141414] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]/50'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-wide">{opt.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-[#141414] select-none">
                {!isCtxSubmitted ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={selectedCtxAnswerIdx === null}
                    className="w-full bg-[#141414] hover:bg-[#141414]/90 disabled:opacity-30 disabled:cursor-not-allowed text-[#E4E3E0] text-xs font-mono font-bold py-3 px-4 border border-[#141414] flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 uppercase tracking-widest h-[44px]"
                  >
                    <span>Submit Projections deductions</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-center py-1 text-xs font-sans font-bold uppercase tracking-wider">
                      {currentCtxPuzzle?.options[selectedCtxAnswerIdx ?? 0]?.isCorrect ? (
                        <span className="text-green-700 flex items-center justify-center gap-1.5 bg-white border border-green-600 py-2 font-bold font-mono">
                          <Trophy className="w-4 h-4" /> SUCCESS • +{120 + Math.max(0, Math.floor((90 - seconds) * 1.5))} SCORE GAINED
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center justify-center gap-1.5 bg-white border border-red-500 py-2 font-bold font-mono">
                          PROJECTION DEVIAVATION DETECTED BY MATRIX
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleNextPuzzle}
                      className="w-full bg-[#141414] hover:bg-[#141414]/90 text-[#E4E3E0] text-xs font-sans font-bold py-3 px-4 border border-[#141414] flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wide h-[44px]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Request Next Coordinate Domain</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
