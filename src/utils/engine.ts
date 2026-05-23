import { Vector, Premise, SolverResult, EntityNode, Contradiction, DimensionCount, Puzzle, PuzzleDifficulty } from '../types';

export const DEFAULT_BASIS_2D: Record<string, Vector> = {
  'NORTH': [1, 0],
  'SOUTH': [-1, 0],
  'EAST': [0, 1],
  'WEST': [0, -1],
  'NORTHEAST': [1, 1],
  'NORTHWEST': [1, -1],
  'SOUTHEAST': [-1, 1],
  'SOUTHWEST': [-1, -1]
};

export const DEFAULT_BASIS_3D: Record<string, Vector> = {
  'NORTH': [1, 0, 0],
  'SOUTH': [-1, 0, 0],
  'EAST': [0, 1, 0],
  'WEST': [0, -1, 0],
  'NORTHEAST': [1, 1, 0],
  'NORTHWEST': [1, -1, 0],
  'SOUTHEAST': [-1, 1, 0],
  'SOUTHWEST': [-1, -1, 0],
  'ABOVE': [0, 0, 1],
  'BELOW': [0, 0, -1],
  'NORTH-ABOVE': [1, 0, 1],
  'SOUTH-BELOW': [-1, 0, -1],
  'EAST-ABOVE': [0, 1, 1],
  'WEST-BELOW': [0, -1, -1],
  'NORTHEAST-ABOVE': [1, 1, 1],
  'SOUTHWEST-BELOW': [-1, -1, -1]
};

export const DEFAULT_BASIS_4D: Record<string, Vector> = {
  'NORTH': [1, 0, 0, 0],
  'SOUTH': [-1, 0, 0, 0],
  'EAST': [0, 1, 0, 0],
  'WEST': [0, -1, 0, 0],
  'NORTHEAST': [1, 1, 0, 0],
  'NORTHWEST': [1, -1, 0, 0],
  'SOUTHEAST': [-1, 1, 0, 0],
  'SOUTHWEST': [-1, -1, 0, 0],
  'ABOVE': [0, 0, 1, 0],
  'BELOW': [0, 0, -1, 0],
  'AFTER': [0, 0, 0, 1],   // Inward/future/hyper-up
  'BEFORE': [0, 0, 0, -1], // Outward/past/hyper-down
  'NORTH-ABOVE': [1, 0, 1, 0],
  'SOUTH-BELOW': [-1, 0, -1, 0],
  'EAST-ABOVE': [0, 1, 1, 0],
  'WEST-BELOW': [0, -1, -1, 0],
  'NORTHEAST-ABOVE': [1, 1, 1, 0],
  'SOUTHWEST-BELOW': [-1, -1, -1, 0],
  'NORTHEAST-ABOVE-AFTER': [1, 1, 1, 1],
  'SOUTHWEST-BELOW-BEFORE': [-1, -1, -1, -1]
};

export function getBasisRelations(dimension: DimensionCount): Record<string, Vector> {
  if (dimension === 2) return DEFAULT_BASIS_2D;
  if (dimension === 3) return DEFAULT_BASIS_3D;
  return DEFAULT_BASIS_4D;
}

export function parseVector(str: string, dimension: number): Vector | null {
  try {
    const raw = str.trim();
    if (!raw) return null;
    
    let cleaned = raw;
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      cleaned = cleaned.slice(1, -1);
    }
    
    const parts = cleaned.includes(',') 
      ? cleaned.split(',') 
      : cleaned.trim().split(/\s+/);
      
    if (parts.length !== dimension) return null;
    
    const parsed = parts.map(p => parseFloat(p.trim()));
    if (parsed.some(isNaN)) return null;
    
    return parsed;
  } catch (err) {
    return null;
  }
}

// Helper to check array equality
export function vectorsEqual(v1: Vector, v2: Vector): boolean {
  if (v1.length !== v2.length) return false;
  return v1.every((val, index) => Math.abs(val - v2[index]) < 1e-5);
}

// Vector addition
export function vecAdd(v1: Vector, v2: Vector): Vector {
  return v1.map((val, idx) => val + (v2[idx] || 0));
}

// Vector subtraction
export function vecSub(v1: Vector, v2: Vector): Vector {
  return v1.map((val, idx) => val - (v2[idx] || 0));
}

// Vector scalar multiplication
export function vecMult(v: Vector, s: number): Vector {
  return v.map(val => val * s);
}

// Dynamic Coordinate Solver
export function solveRelations(
  premises: Premise[],
  basisRelations: Record<string, Vector>,
  dimension: DimensionCount
): SolverResult {
  const list: Record<string, { neighbor: string; relationName: string; vector: Vector; isForward: boolean; premiseId: string }[]> = {};
  const activeEntities = new Set<string>();

  // Extract all entities mentioned
  premises.forEach(p => {
    if (p.entityA && p.entityB) {
      activeEntities.add(p.entityA);
      activeEntities.add(p.entityB);
    }
  });

  // Build Adjacency List
  // A is R of B => A = B + vecR => B -> A (weight: vecR), A -> B (weight: -vecR)
  premises.forEach(p => {
    const { entityA, entityB, relation, id } = p;
    if (!entityA || !entityB || !relation) return;
    let vec = basisRelations[relation];
    if (!vec) {
      vec = parseVector(relation, dimension) || undefined;
    }
    if (!vec) return;

    if (!list[entityB]) list[entityB] = [];
    list[entityB].push({ neighbor: entityA, relationName: relation, vector: vec, isForward: true, premiseId: id });

    if (!list[entityA]) list[entityA] = [];
    list[entityA].push({ neighbor: entityB, relationName: relation, vector: vec, isForward: false, premiseId: id });
  });

  const entities: Record<string, EntityNode> = {};
  const visited = new Set<string>();
  let componentId = 0;

  // We want to track paths from the source to nodes to detail contradiction paths if any
  const pathsFromRoot: Record<string, { node: string; edgeDescr: string }[]> = {};

  for (const startEntity of activeEntities) {
    if (visited.has(startEntity)) continue;

    componentId++;
    const queue: string[] = [startEntity];
    visited.add(startEntity);
    
    // Assign root coordinate
    entities[startEntity] = {
      name: startEntity,
      coordinates: Array(dimension).fill(0),
      componentId
    };
    pathsFromRoot[startEntity] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      const uCoords = entities[u].coordinates;

      const edges = list[u] || [];
      for (const edge of edges) {
        const { neighbor, relationName, vector, isForward, premiseId } = edge;
        // Expected coordinate for neighbor
        const expected = isForward 
          ? vecAdd(uCoords, vector)
          : vecSub(uCoords, vector);

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          entities[neighbor] = {
            name: neighbor,
            coordinates: expected,
            componentId
          };
          
          pathsFromRoot[neighbor] = [
            ...pathsFromRoot[u],
            { 
              node: u, 
              edgeDescr: isForward 
                ? `${neighbor} is ${relationName} of ${u}`
                : `${u} is ${relationName} of ${neighbor}`
            }
          ];
          queue.push(neighbor);
        } else {
          // Verify consistency
          const current = entities[neighbor].coordinates;
          if (!vectorsEqual(current, expected)) {
            // Contradiction detected!
            return {
              entities,
              componentCount: componentId,
              isConsistent: false,
              contradiction: {
                entityA: u,
                entityB: neighbor,
                expectedVector: expected,
                actualVector: current,
                pathA: pathsFromRoot[u].map(e => e.edgeDescr),
                pathB: [
                  ...pathsFromRoot[neighbor].map(e => e.edgeDescr),
                  isForward 
                    ? `BUT we assert: ${neighbor} is ${relationName} of ${u} (which would require displacement ${vector.join(', ')})`
                    : `BUT we assert: ${u} is ${relationName} of ${neighbor} (which would require displacement ${vector.join(', ')})`
                ]
              }
            };
          }
        }
      }
    }
  }

  return {
    entities,
    componentCount: componentId,
    isConsistent: true
  };
}

// Describe a vector in terms of base directions
export function describeVector(vector: Vector, basisRelations: Record<string, Vector>): string {
  // Try direct match
  for (const [name, vec] of Object.entries(basisRelations)) {
    if (vectorsEqual(vector, vec)) {
      return name;
    }
  }

  // Try opposite match
  const oppositeVec = vecMult(vector, -1);
  for (const [name, vec] of Object.entries(basisRelations)) {
    if (vectorsEqual(oppositeVec, vec)) {
      return `OPPOSITE of ${name}`;
    }
  }

  // Multi-dimensional breakdown descriptive text
  const parts: string[] = [];
  const dimNames = ['NORTH/SOUTH', 'EAST/WEST', 'ABOVE/BELOW', 'AFTER/BEFORE'];
  
  vector.forEach((val, idx) => {
    if (val === 0) return;
    
    if (idx === 0) {
      parts.push(val > 0 ? `${val} NORTH` : `${Math.abs(val)} SOUTH`);
    } else if (idx === 1) {
      parts.push(val > 0 ? `${val} EAST` : `${Math.abs(val)} WEST`);
    } else if (idx === 2) {
      parts.push(val > 0 ? `${val} ABOVE` : `${Math.abs(val)} BELOW`);
    } else if (idx === 3) {
      parts.push(val > 0 ? `${val} AFTER` : `${Math.abs(val)} BEFORE`);
    } else {
      parts.push(`${val} in Dim ${idx + 1}`);
    }
  });

  return parts.length > 0 ? parts.join(', ') : 'COINCIDENT (Same Position)';
}

// Generate relational logical training riddle
export function generateTrainerPuzzle(
  dimension: DimensionCount,
  difficulty: PuzzleDifficulty
): Puzzle {
  const basis = getBasisRelations(dimension);
  const basisKeys = Object.keys(basis).filter(k => {
    // Limit beginner to cardinal 2D directions
    if (difficulty === 'Beginner') {
      return ['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(k);
    }
    // Limit intermediate key selections to omit 4D or complex diags if 3D
    return true;
  });

  // Pick entity names
  const potentialNames = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
    'Iota', 'Kappa', 'Lambda', 'Mu', 'Sigma', 'Omega'
  ];

  // Number of nodes based on difficulty
  let nodeCount = 3;
  if (difficulty === 'Intermediate') nodeCount = 4;
  else if (difficulty === 'Advanced') nodeCount = 5;
  else if (difficulty === 'Master') nodeCount = 6;

  const selectedNames = potentialNames.slice(0, nodeCount);
  
  // Create a coordinates grid starting at origin for node 0
  const nodesCoords: Record<string, Vector> = {};
  nodesCoords[selectedNames[0]] = Array(dimension).fill(0);

  const premises: Premise[] = [];
  const connected = [selectedNames[0]];
  const remaining = selectedNames.slice(1);

  // Growth loop: attach a random unplaced node to an already placed node using a random relation
  while (remaining.length > 0) {
    const parent = connected[Math.floor(Math.random() * connected.length)];
    const child = remaining.shift()!;
    const relation = basisKeys[Math.floor(Math.random() * basisKeys.length)];
    const relVec = basis[relation];

    // child is relation of parent => childCoords = parentCoords + relVec
    nodesCoords[child] = vecAdd(nodesCoords[parent], relVec);
    
    // Generate unique ID for each generated premise to adhere to the Premise model
    const prmId = `pzp_gen_${Math.floor(Math.random() * 1000000)}`;

    // We frame it as either: "child is relation of parent" OR "parent is opposite of child"
    // Let's randomize presentation
    if (Math.random() > 0.4) {
      premises.push({ id: prmId, entityA: child, relation, entityB: parent });
    } else {
      // Find opposite relation
      const oppVec = vecMult(relVec, -1);
      let oppRelation = '';
      for (const [k, v] of Object.entries(basis)) {
        if (vectorsEqual(v, oppVec)) {
          oppRelation = k;
          break;
        }
      }
      
      if (oppRelation) {
        premises.push({ id: prmId, entityA: parent, relation: oppRelation, entityB: child });
      } else {
        premises.push({ id: prmId, entityA: child, relation, entityB: parent });
      }
    }
    
    connected.push(child);
  }

  // Shuffle premises to increase working memory load (not linear sequence)
  const shuffledPremises = [...premises].sort(() => Math.random() - 0.5);

  // Add a redundant or checking constraint sometimes for higher difficulties
  // to make it interesting, but for puzzles we need to query relationship between 2 far away nodes.
  // Find two nodes that are not directly mapped in the basic tree
  let bestA = selectedNames[0];
  let bestB = selectedNames[nodeCount - 1];

  // Calculate distance or path length, but let's just make sure they are distinct
  // We want to ask: "Determine relationship of bestA with respect to bestB"
  // means: what vector do we add to bestB to get bestA? => bestA_coords - bestB_coords
  const targetVector = vecSub(nodesCoords[bestA], nodesCoords[bestB]);

  // Render a human descriptive answer for the correct relationship
  const correctAnswerName = describeVector(targetVector, basis);

  // Let's generate options
  const options: { relation: string; vector: Vector; isCorrect: boolean }[] = [];
  
  // 1. Correct option
  options.push({
    relation: correctAnswerName,
    vector: targetVector,
    isCorrect: true
  });

  // Calculate decoy options
  const usedRels = new Set<string>([correctAnswerName]);

  while (options.length < 4) {
    // Choose a random combination of dimensional values or a random basis relation
    let decoyVec: Vector;
    let decoyName: string;

    if (Math.random() > 0.5) {
      const randomBasisKey = basisKeys[Math.floor(Math.random() * basisKeys.length)];
      decoyVec = basis[randomBasisKey];
      decoyName = randomBasisKey;
    } else {
      // Perturb target vector
      decoyVec = targetVector.map((val, idx) => {
        // Perturb one dimension
        if (idx === Math.floor(Math.random() * dimension)) {
          const shift = Math.random() > 0.5 ? 1 : -1;
          return val + shift;
        }
        return val;
      });
      // Ensure dimensions are safe
      decoyName = describeVector(decoyVec, basis);
    }

    if (decoyName && !usedRels.has(decoyName)) {
      usedRels.add(decoyName);
      options.push({
        relation: decoyName,
        vector: decoyVec,
        isCorrect: false
      });
    }
    
    // Safety check to avoid infinite loop
    if (usedRels.size > 12) {
      // just push hardcoded vectors
      const fallbackVectors = [
        Array(dimension).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
        Array(dimension).fill(0).map((_, i) => (i === 1 ? -1 : 0)),
        Array(dimension).fill(0).map((_, i) => (i === 0 ? -1 : 1))
      ];
      fallbackVectors.forEach(fv => {
        const name = describeVector(fv, basis);
        if (options.length < 4 && !usedRels.has(name)) {
          options.push({ relation: name, vector: fv, isCorrect: false });
          usedRels.add(name);
        }
      });
      break;
    }
  }

  // Shuffle options
  const shuffledOptions = [...options].sort(() => Math.random() - 0.5);

  // Prepare clear step-by-step logic explanation
  const solver = solveRelations(premises, basis, dimension);
  const explainedSteps: string[] = [];
  
  explainedSteps.push(`Let's place **${selectedNames[0]}** at the origin: $${selectedNames[0]} = (${Array(dimension).fill(0).join(', ')})$`);
  
  // Group premises conceptually to show deduction
  premises.forEach(p => {
    const coordsA = nodesCoords[p.entityA];
    const coordsB = nodesCoords[p.entityB];
    explainedSteps.push(
      `• Since **${p.entityA}** is **${p.relation}** of **${p.entityB}**, we have:  \n  $${p.entityA} = ${p.entityB} + [${basis[p.relation].join(', ')}] = (${coordsA.join(', ')})$`
    );
  });

  explainedSteps.push(`Now, let's find **${bestA}** with respect to **${bestB}**:  \n  ` +
    `$Vector = \\vec{v}_{${bestA}} - \\vec{v}_{${bestB}} = (${nodesCoords[bestA].join(', ')}) - (${nodesCoords[bestB].join(', ')}) = [${targetVector.join(', ')}]$`
  );
  explainedSteps.push(`This spatial displacement corresponds to **${correctAnswerName}**.`);

  return {
    id: `puzzle_${Math.floor(Math.random() * 1000000)}`,
    premises: shuffledPremises,
    question: {
      entityA: bestA,
      entityB: bestB
    },
    options: shuffledOptions,
    explanation: explainedSteps.join('\n\n'),
    dimension,
    difficulty
  };
}
