import React, { useState, useMemo } from 'react';
import { DimensionCount } from '../types';
import { Compass, Move, Sliders, Layers, Network, Zap } from 'lucide-react';

interface ContextProjectorProps {
  dimension: DimensionCount;
  baseVector: number[];
  projectedVector: number[];
  baseRelationName: string;
  projectedRelationName: string;
  activeModifiers: number[];
  nodeDefinitions?: {
    node: string;
    relation: string;
    targetNode: string;
    baseOffset: number[];
  }[];
  contextVehicles?: {
    id: string; 
    boundRelation: string; 
    boundNode: string; 
    boundVector: number[];
    shiftMultiplier: number; 
    shiftLabel: string; 
  }[];
}

export default function ContextProjector({
  dimension,
  baseVector,
  projectedVector,
  baseRelationName,
  projectedRelationName,
  activeModifiers,
  nodeDefinitions = [],
  contextVehicles = []
}: ContextProjectorProps) {
  // Toggle between Node Workspace projections and Context Shift Space vectors
  const [projectorTab, setProjectorTab] = useState<'nodes' | 'context'>('nodes');

  // Format modifier badges
  const formatModifier = (val: number) => {
    if (val > 0) return `+${val}x`;
    return `${val}x`;
  };

  // 1. Calculate and map Node coordinates in Real Space (Gamma, Beta, Alpha, Delta)
  const computedNodes = useMemo(() => {
    const Gamma = [0, 0, 0, 0];
    let Beta = [1, 0, 0, 0];
    let AlphaOffset = [0, 1, 0, 0];
    let DeltaOffset = [0, 0, 1, 0];

    let GammaName = 'Gamma';
    let BetaName = 'Beta';
    let AlphaName = 'Alpha';
    let DeltaName = 'Delta';
    let OmegaName = 'Omega';

    // Read generated values if available
    if (nodeDefinitions && nodeDefinitions.length > 0) {
      const bDef = nodeDefinitions[0];
      const aDef = nodeDefinitions[1];
      const dDef = nodeDefinitions[2];
      const oDef = nodeDefinitions[3];
      if (bDef) {
        GammaName = bDef.targetNode;
        BetaName = bDef.node;
        Beta = bDef.baseOffset;
      }
      if (aDef) {
        AlphaName = aDef.node;
        AlphaOffset = aDef.baseOffset;
      }
      if (dDef) {
        DeltaName = dDef.node;
        DeltaOffset = dDef.baseOffset;
      }
      if (oDef) {
        OmegaName = oDef.node;
      }
    }

    const Alpha = [
      Beta[0] + AlphaOffset[0],
      Beta[1] + AlphaOffset[1],
      Beta[2] + AlphaOffset[2],
      Beta[3] + AlphaOffset[3],
    ];
    const Delta = [...DeltaOffset];

    const S_y = activeModifiers[0] ?? 1;
    const S_x = activeModifiers[1] ?? 1;
    const S_z = activeModifiers[2] ?? 1;
    const S_w = activeModifiers[3] ?? 1;

    // Projected counterparts
    const GammaProj = [0, 0, 0, 0];
    const BetaProj = [Beta[0] * S_y, Beta[1] * S_x, Beta[2] * S_z, Beta[3] * S_w];
    const AlphaProj = [Alpha[0] * S_y, Alpha[1] * S_x, Alpha[2] * S_z, Alpha[3] * S_w];
    const DeltaProj = [Delta[0] * S_y, Delta[1] * S_x, Delta[2] * S_z, Delta[3] * S_w];

    return {
      base: { Gamma, Beta, Alpha, Delta },
      projected: { Gamma: GammaProj, Beta: BetaProj, Alpha: AlphaProj, Delta: DeltaProj },
      labels: {
        Gamma: GammaName,
        Beta: BetaName,
        Alpha: AlphaName,
        Delta: DeltaName,
        Omega: OmegaName
      }
    };
  }, [nodeDefinitions, activeModifiers]);

  // 2. Map Context Variables into 4D Context Vectors space abstractly
  const computedContextPoints = useMemo(() => {
    if (!contextVehicles || contextVehicles.length === 0) return [];
    
    return contextVehicles.map(cv => {
      let coords = [0, 0, 0, 0];
      let mult = 1;
      if ((cv as any).axisMultipliers) {
        coords = [...(cv as any).axisMultipliers];
        // retrieve characteristic non-zero multiplier or default
        const nonZero = coords.find(c => c !== 1);
        mult = nonZero !== undefined ? nonZero : 1;
      } else {
        mult = (cv as any).effectiveMultiplier !== undefined ? (cv as any).effectiveMultiplier : (cv.shiftMultiplier ?? 1);
        const axisIdx = typeof (cv as any).axisIndex === 'number'
          ? (cv as any).axisIndex
          : (cv.id === 'C' || cv.id === 'D' ? 1 : 0);
        coords[axisIdx] = mult;
      }

      return {
        id: cv.id,
        coordinates: coords,
        rawBound: cv.boundVector || [0, 0, 0, 0],
        multiplier: mult,
        label: cv.id
      };
    });
  }, [contextVehicles]);

  // Dynamic Scale and Translation for Grid One [x, y] - Node Space
  const nodeScaleA = useMemo(() => {
    const { base, projected } = computedNodes;
    const pts = [base.Gamma, base.Beta, base.Alpha, base.Delta, projected.Gamma, projected.Beta, projected.Alpha, projected.Delta];
    const xs = pts.map(p => p[1]);
    const ys = pts.map(p => p[0]);
    const minX = Math.min(...xs, -1);
    const maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, -1);
    const maxY = Math.max(...ys, 1);
    const spanX = Math.max(maxX - minX, 1.5);
    const spanY = Math.max(maxY - minY, 1.5);
    return Math.min(130 / spanX, 130 / spanY, 32);
  }, [computedNodes]);

  // Dynamic Scale and Translation for Grid Two [z, w] - Node Space
  const nodeScaleB = useMemo(() => {
    const { base, projected } = computedNodes;
    const pts = [base.Gamma, base.Beta, base.Alpha, base.Delta, projected.Gamma, projected.Beta, projected.Alpha, projected.Delta];
    const zs = pts.map(p => p[2]);
    const ws = pts.map(p => p[3]);
    const minZ = Math.min(...zs, -1);
    const maxZ = Math.max(...zs, 1);
    const minW = Math.min(...ws, -1);
    const maxW = Math.max(...ws, 1);
    const spanZ = Math.max(maxZ - minZ, 1.5);
    const spanW = Math.max(maxW - minW, 1.5);
    return Math.min(130 / spanZ, 130 / spanW, 32);
  }, [computedNodes]);

  // Dynamic Scale for Context Shifts Map One [x, y] & Two [z, w]
  const contextScaleA = useMemo(() => {
    if (computedContextPoints.length === 0) return 40;
    const xs = computedContextPoints.map(p => p.coordinates[0]);
    const ys = computedContextPoints.map(p => p.coordinates[1]);
    const minX = Math.min(...xs, -1);
    const maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, -1);
    const maxY = Math.max(...ys, 1);
    const spanX = Math.max(maxX - minX, 1.5);
    const spanY = Math.max(maxY - minY, 1.5);
    return Math.min(130 / spanX, 130 / spanY, 40);
  }, [computedContextPoints]);

  const contextScaleB = useMemo(() => {
    if (computedContextPoints.length === 0) return 40;
    const zs = computedContextPoints.map(p => p.coordinates[2]);
    const ws = computedContextPoints.map(p => p.coordinates[3]);
    const minZ = Math.min(...zs, -1);
    const maxZ = Math.max(...zs, 1);
    const minW = Math.min(...ws, -1);
    const maxW = Math.max(...ws, 1);
    const spanZ = Math.max(maxZ - minZ, 1.5);
    const spanW = Math.max(maxW - minW, 1.5);
    return Math.min(130 / spanZ, 130 / spanW, 40);
  }, [computedContextPoints]);

  return (
    <div className="flex flex-col flex-1 h-full bg-theme-card border border-theme-comp overflow-hidden relative">
      
      {/* Projector Header Tabs */}
      <div className="px-5 py-3 border-b border-theme-comp bg-theme-bg flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-theme-comp" />
          <span className="font-serif italic text-theme-text text-sm tracking-wide">
            Contextual Model Viewers
          </span>
        </div>
        
        {/* Tab switch controller */}
        <div className="flex gap-1 border border-theme-comp/45 bg-theme-card p-0.5">
          <button
            onClick={() => setProjectorTab('nodes')}
            className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all duration-100 cursor-pointer ${
              projectorTab === 'nodes'
                ? 'bg-theme-comp text-theme-bg'
                : 'text-theme-text/80 hover:bg-theme-bg'
            }`}
          >
            Workspace Nodes
          </button>
          <button
            onClick={() => setProjectorTab('context')}
            className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all duration-100 cursor-pointer ${
              projectorTab === 'context'
                ? 'bg-theme-comp text-theme-bg'
                : 'text-theme-text/80 hover:bg-theme-bg'
            }`}
          >
            Context Shifts ({contextVehicles.length})
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 bg-theme-bg shadow-inner overflow-y-auto">
        {projectorTab === 'nodes' ? (
          /* ==================== NODE RELATION MAPS ==================== */
          <div className="flex flex-col gap-4">
            <div className="bg-theme-card border border-theme-comp/30 p-2.5 text-[10px] font-sans text-theme-text leading-normal flex items-start gap-1.5 rounded-none">
              <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-theme-comp" />
              <span>
                <strong>Workspace Map Legend:</strong> Slate-colored dashed vectors represent the reference <strong>Base/Classic</strong> coordinates. Blue/Indigo solid vectors depict the mutated <strong>Context-Projected</strong> coordinates under the active relationships.
              </span>
            </div>

            <div className={`grid gap-4 ${dimension > 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
              
              {/* Map One: North/South & East/West Plane */}
              <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
                <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                  <span className="tracking-wide">Node Space [x, y]</span>
                  <span className="opacity-55 px-1 bg-theme-bg text-theme-text font-mono">X: East/West | Y: North/South</span>
                </div>

                <div className="flex-1 min-h-[260px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/30">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                  
                  <svg viewBox="0 0 200 200" className="w-full h-full max-h-[220px] select-none z-10">
                    <defs>
                      <marker id="arr-base-n" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--main-color-complementary)" fillOpacity="0.4" />
                      </marker>
                      <marker id="arr-proj-n" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-color-accent)" />
                      </marker>
                    </defs>

                    {/* Axes lines */}
                    <line x1="100" y1="10" x2="100" y2="190" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.2" />
                    <line x1="10" y1="100" x2="190" y2="100" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.2" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="2,2" strokeOpacity="0.1" />
                    <circle cx="100" cy="100" r="80" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="2,2" strokeOpacity="0.1" />

                    {/* Axis Labels */}
                    <text x="100" y="15" textAnchor="middle" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">North (+y)</text>
                    <text x="100" y="190" textAnchor="middle" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">South (-y)</text>
                    <text x="188" y="102" textAnchor="end" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">East (+x)</text>
                    <text x="12" y="102" textAnchor="start" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">West (-x)</text>

                    {/* Draw Vectors */}
                    {(() => {
                      const { base, projected } = computedNodes;
                      
                      const tX = (val: number) => 100 + val * nodeScaleA;
                      const tY = (val: number) => 100 - val * nodeScaleA; // Y axis invert

                      const drawLink = (x1: number, y1: number, x2: number, y2: number, solid: boolean, isTarget: boolean = false) => {
                        const dist = Math.hypot(x2 - x1, y2 - y1);
                        if (dist < 3) return null;
                        return (
                          <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={solid ? "var(--text-color-accent)" : isTarget ? "#ef4444" : "var(--main-color-complementary)"}
                            strokeWidth={solid ? "1.5" : "1"}
                            strokeDasharray={solid ? undefined : "2,2"}
                            strokeOpacity={solid ? "0.95" : isTarget ? "0.8" : "0.35"}
                            markerEnd={`url(#${solid ? 'arr-proj-n' : 'arr-base-n'})`}
                          />
                        );
                      };

                      return (
                        <>
                          {/* 1. Base Relations Path: Gamma -> Beta -> Alpha and Gamma -> Delta */}
                          {drawLink(tX(base.Gamma[1]), tY(base.Gamma[0]), tX(base.Beta[1]), tY(base.Beta[0]), false)}
                          {drawLink(tX(base.Beta[1]), tY(base.Beta[0]), tX(base.Alpha[1]), tY(base.Alpha[0]), false)}
                          {drawLink(tX(base.Gamma[1]), tY(base.Gamma[0]), tX(base.Delta[1]), tY(base.Delta[0]), false)}
                          {/* Target relation (Delta -> Alpha) */}
                          {drawLink(tX(base.Delta[1]), tY(base.Delta[0]), tX(base.Alpha[1]), tY(base.Alpha[0]), false, true)}

                          {/* 2. Projected Relations Path: GammaProj -> BetaProj -> AlphaProj */}
                          {drawLink(tX(projected.Gamma[1]), tY(projected.Gamma[0]), tX(projected.Beta[1]), tY(projected.Beta[0]), true)}
                          {drawLink(tX(projected.Beta[1]), tY(projected.Beta[0]), tX(projected.Alpha[1]), tY(projected.Alpha[0]), true)}
                          {drawLink(tX(projected.Gamma[1]), tY(projected.Gamma[0]), tX(projected.Delta[1]), tY(projected.Delta[0]), true)}
                          {/* Expected/Target Relation (DeltaProj -> AlphaProj) in solid indigo */}
                          {drawLink(tX(projected.Delta[1]), tY(projected.Delta[0]), tX(projected.Alpha[1]), tY(projected.Alpha[0]), true)}

                          {/* Base Points of All Relations */}
                          {Object.entries(base).map(([key, coords]) => (
                            <g key={`base-${key}`}>
                              <circle cx={tX(coords[1])} cy={tY(coords[0])} r="3" fill="none" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.6" />
                              <text x={tX(coords[1]) + 4} y={tY(coords[0]) - 3} className="text-[7.5px] font-sans font-bold opacity-45" fill="var(--text-color)">
                                {computedNodes.labels[key as keyof typeof computedNodes.labels] || key}
                              </text>
                            </g>
                          ))}

                          {/* Projected Points of All Relations */}
                          {Object.entries(projected).map(([key, coords]) => (
                            <g key={`proj-${key}`}>
                              <circle cx={tX(coords[1])} cy={tY(coords[0])} r="4.5" fill="var(--text-color-accent)" stroke="var(--main-color-accent)" strokeWidth="1.2" />
                              <text 
                                x={tX(coords[1]) + 6} 
                                y={tY(coords[0]) + 3.5} 
                                className="text-[8.5px] font-mono font-bold" 
                                fill="var(--text-color-accent)"
                              >
                                {computedNodes.labels[key as keyof typeof computedNodes.labels] || key}'
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              {/* Map Two: Above/Below & After/Before Plane (Dimension > 2) */}
              {dimension > 2 ? (
                <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
                  <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                    <span className="tracking-wide">Node Space [z, w]</span>
                    <span className="opacity-55 px-1 bg-theme-bg text-theme-text font-mono">
                      {dimension === 3 ? 'X: (N/A) | Y: Above/Below' : 'X: After/Before | Y: Above/Below'}
                    </span>
                  </div>

                  <div className="flex-1 min-h-[260px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/30">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    
                    <svg viewBox="0 0 200 200" className="w-full h-full max-h-[220px] select-none z-10">
                      <defs>
                        <marker id="arr-base-w" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--main-color-complementary)" fillOpacity="0.4" />
                        </marker>
                        <marker id="arr-proj-w" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--text-color-accent)" />
                        </marker>
                      </defs>

                      {/* Axes lines */}
                      <line x1="100" y1="10" x2="100" y2="190" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.2" />
                      <line x1="10" y1="100" x2="190" y2="100" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.2" />
                      <circle cx="100" cy="100" r="40" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="2,2" strokeOpacity="0.1" />
                      <circle cx="100" cy="100" r="80" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="2,2" strokeOpacity="0.1" />

                      {/* Axis labels */}
                      <text x="100" y="15" textAnchor="middle" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">Above (+z)</text>
                      <text x="100" y="190" textAnchor="middle" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">Below (-z)</text>
                      
                      {dimension === 4 ? (
                        <>
                          <text x="188" y="102" textAnchor="end" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">After (+w)</text>
                          <text x="12" y="102" textAnchor="start" className="text-[6px] font-mono opacity-50 font-bold" fill="var(--text-color)">Before (-w)</text>
                        </>
                      ) : (
                        <text x="188" y="102" textAnchor="end" className="text-[6px] font-mono opacity-20 font-bold" fill="var(--text-color)">N/A</text>
                      )}

                      {/* Vectors for plane-B */}
                      {(() => {
                        const { base, projected } = computedNodes;

                        const tW = (val: number) => dimension === 4 ? (100 + val * nodeScaleB) : 100;
                        const tZ = (val: number) => 100 - val * nodeScaleB; // Elevation Z invert

                        const drawLink = (x1: number, y1: number, x2: number, y2: number, solid: boolean, isTarget: boolean = false) => {
                          const dist = Math.hypot(x2 - x1, y2 - y1);
                          if (dist < 3) return null;
                          return (
                            <line
                              x1={x1} y1={y1} x2={x2} y2={y2}
                              stroke={solid ? "var(--text-color-accent)" : isTarget ? "#ef4444" : "var(--main-color-complementary)"}
                              strokeWidth={solid ? "1.5" : "1"}
                              strokeDasharray={solid ? undefined : "2,2"}
                              strokeOpacity={solid ? "0.95" : isTarget ? "0.8" : "0.35"}
                              markerEnd={`url(#${solid ? 'arr-proj-w' : 'arr-base-w'})`}
                            />
                          );
                        };

                        return (
                          <>
                            {/* Base Links */}
                            {drawLink(tW(base.Gamma[3]), tZ(base.Gamma[2]), tW(base.Beta[3]), tZ(base.Beta[2]), false)}
                            {drawLink(tW(base.Beta[3]), tZ(base.Beta[2]), tW(base.Alpha[3]), tZ(base.Alpha[2]), false)}
                            {drawLink(tW(base.Gamma[3]), tZ(base.Gamma[2]), tW(base.Delta[3]), tZ(base.Delta[2]), false)}
                            {drawLink(tW(base.Delta[3]), tZ(base.Delta[2]), tW(base.Alpha[3]), tZ(base.Alpha[2]), false, true)}

                            {/* Projected Links */}
                            {drawLink(tW(projected.Gamma[3]), tZ(projected.Gamma[2]), tW(projected.Beta[3]), tZ(projected.Beta[2]), true)}
                            {drawLink(tW(projected.Beta[3]), tZ(projected.Beta[2]), tW(projected.Alpha[3]), tZ(projected.Alpha[2]), true)}
                            {drawLink(tW(projected.Gamma[3]), tZ(projected.Gamma[2]), tW(projected.Delta[3]), tZ(projected.Delta[2]), true)}
                            {drawLink(tW(projected.Delta[3]), tZ(projected.Delta[2]), tW(projected.Alpha[3]), tZ(projected.Alpha[2]), true)}

                            {/* Base Points */}
                            {Object.entries(base).map(([key, coords]) => (
                              <g key={`base-b-${key}`}>
                                <circle cx={tW(coords[3])} cy={tZ(coords[2])} r="3" fill="none" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.6" />
                                <text x={tW(coords[3]) + 4} y={tZ(coords[2]) - 3} className="text-[7.5px] font-sans font-bold opacity-45" fill="var(--text-color)">
                                  {computedNodes.labels[key as keyof typeof computedNodes.labels] || key}
                                </text>
                              </g>
                            ))}

                            {/* Projected Points */}
                            {Object.entries(projected).map(([key, coords]) => (
                              <g key={`proj-b-${key}`}>
                                <circle cx={tW(coords[3])} cy={tZ(coords[2])} r="4.5" fill="var(--text-color-accent)" stroke="var(--main-color-accent)" strokeWidth="1.2" />
                                <text 
                                  x={tW(coords[3]) + 6} 
                                  y={tZ(coords[2]) + 3.5} 
                                  className="text-[8.5px] font-mono font-bold" 
                                  fill="var(--text-color-accent)"
                                >
                                  {computedNodes.labels[key as keyof typeof computedNodes.labels] || key}'
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col border border-dashed border-theme-comp/35 bg-theme-bg/10 p-5 items-center justify-center min-h-[295px] text-center select-none">
                  <Layers className="w-10 h-10 text-theme-comp/20 shrink-0 mb-2 stroke-[1.2]" />
                  <span className="font-mono text-xs text-theme-text/60 uppercase font-bold">Workspace Map Two Deactivated</span>
                  <p className="text-[10px] text-neutral-500 font-sans max-w-[200px] leading-relaxed mt-1">Multi-dimensional planes (z & w) are activated upon initializing 3D Space and 4D Hyper-Planes.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ==================== CONTEXT SHIFT VECTOR SPACE ==================== */
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="bg-theme-card border border-theme-comp/30 p-2.5 text-[10px] font-sans text-theme-text leading-normal flex items-start gap-1.5 rounded-none">
              <Network className="w-3.5 h-3.5 mt-0.5 shrink-0 text-theme-comp" />
              <span>
                <strong>Context Multipliers Vector Space:</strong> Graphing each active context variable as its exact vector position (C = boundVector * shiftMultiplier) starting from [0,0,0,0]. Shows where the context elements define relationship direction (strictly bounded to +1 and -1).
              </span>
            </div>

            {computedContextPoints.length === 0 ? (
              <div className="min-h-[280px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-theme-comp/30 bg-theme-bg/30">
                <Sliders className="w-8 h-8 text-theme-comp/40 stroke-[1.5] mb-2" />
                <span className="font-mono text-xs font-bold text-theme-text/60 uppercase">No Active Context Variables</span>
                <p className="text-[10px] text-theme-text/55 max-w-[200px] mt-1">Select intermediate or advanced difficulties under Context Mode to activate multipliers.</p>
              </div>
            ) : (
              <div className={`grid gap-4 ${dimension > 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
                
                {/* Context space Map A [x, y] */}
                <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
                  <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                    <span className="tracking-wide">Context Space [x, y]</span>
                    <span className="opacity-55 px-1 bg-theme-bg text-theme-text font-mono">X Shift | Y Shift (Boundaries +/-1)</span>
                  </div>

                  <div className="flex-1 min-h-[260px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/30">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    
                    <svg viewBox="0 0 200 200" className="w-full h-full max-h-[220px] select-none z-10">
                      <defs>
                        <marker id="arr-ctx" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                        </marker>
                      </defs>

                      {/* Axes lines */}
                      <line x1="100" y1="10" x2="100" y2="190" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.15" />
                      <line x1="10" y1="100" x2="190" y2="100" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.15" />
                      
                      {/* Grid tick bounds */}
                      <circle cx="100" cy="100" r="40" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.15" />
                      <circle cx="100" cy="100" r="80" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.15" />

                      {/* Origin tick indicator */}
                      <circle cx="100" cy="100" r="2" fill="var(--main-color-complementary)" />

                      {/* Axes labels */}
                      <text x="100" y="15" textAnchor="middle" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis II (Delta Shifts)</text>
                      <text x="100" y="195" textAnchor="middle" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis II (Inverted)</text>
                      <text x="188" y="103" textAnchor="end" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis I (Forward Shifts)</text>
                      <text x="12" y="103" textAnchor="start" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis I (Inverted)</text>

                      {/* Tick Lines and Value Labels along Axis I (Horizontal) */}
                      {[1, 2, -1, -2].map(val => (
                        <g key={`tick-axis-i-${val}`}>
                          <line
                            x1={100 + val * contextScaleA} y1="97"
                            x2={100 + val * contextScaleA} y2="103"
                            stroke="var(--main-color-complementary)" strokeWidth="0.75" strokeOpacity="0.4"
                          />
                          <text
                            x={100 + val * contextScaleA} y="111"
                            textAnchor="middle" className="text-[5.5px] font-mono opacity-50 font-bold" fill="var(--text-color)"
                          >
                            {val === 1 ? '1x (Anchor)' : `${val}x`}
                          </text>
                        </g>
                      ))}

                      {/* Tick Lines and Value Labels along Axis II (Vertical) */}
                      {[1, 2, -1, -2].map(val => (
                        <g key={`tick-axis-ii-${val}`}>
                          <line
                            x1="97" y1={100 - val * contextScaleA}
                            x2="103" y2={100 - val * contextScaleA}
                            stroke="var(--main-color-complementary)" strokeWidth="0.75" strokeOpacity="0.4"
                          />
                          <text
                            x="91" y={100 - val * contextScaleA + 2}
                            textAnchor="end" className="text-[5.5px] font-mono opacity-50 font-bold" fill="var(--text-color)"
                          >
                            {val === 1 ? '1x' : `${val}x`}
                          </text>
                        </g>
                      ))}

                      {/* Render active context shifts */}
                      {computedContextPoints.map(cp => {
                        const shiftX = cp.coordinates[0];
                        const shiftY = cp.coordinates[1];
                        const targetX = 100 + shiftX * contextScaleA;
                        const targetY = 100 - shiftY * contextScaleA; // invert y

                        const isAtOrigin = Math.hypot(shiftX, shiftY) < 0.1;

                        return (
                          <g key={`ctx-map-a-${cp.id}`}>
                            {/* Line from origin only if shifted */}
                            {!isAtOrigin && (
                              <line
                                x1="100" y1="100" x2={targetX} y2={targetY}
                                stroke="#f59e0b"
                                strokeWidth="2"
                                markerEnd="url(#arr-ctx)"
                              />
                            )}
                            {/* Point dot */}
                            <circle cx={targetX} cy={targetY} r={isAtOrigin ? "4" : "5.5"} fill={isAtOrigin ? "#737373" : "#f59e0b"} stroke="var(--main-color-accent)" strokeWidth="1.2" />
                            <text 
                              x={targetX + 6} 
                              y={targetY + 2.5} 
                              className="text-[8px] font-mono font-bold"
                              fill="var(--text-color)"
                            >
                              {cp.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Context Space Map B [z, w] (for dimension > 2) */}
                {dimension > 2 ? (
                  <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
                    <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                      <span className="tracking-wide">Context Space [z, w]</span>
                      <span className="opacity-55 px-1 bg-theme-bg text-theme-text font-mono">
                        {dimension === 3 ? 'X: (N/A) | Y: Z Shift' : 'X: W Shift | Y: Z Shift'}
                      </span>
                    </div>

                    <div className="flex-1 min-h-[260px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/30">
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                      
                      <svg viewBox="0 0 200 200" className="w-full h-full max-h-[220px] select-none z-10">
                        {/* Axes lines */}
                        <line x1="100" y1="10" x2="100" y2="190" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.15" />
                        <line x1="10" y1="100" x2="190" y2="100" stroke="var(--main-color-complementary)" strokeWidth="1" strokeOpacity="0.15" />
                        <circle cx="100" cy="100" r="40" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.15" />
                        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--main-color-complementary)" strokeWidth="0.5" strokeDasharray="1,1" strokeOpacity="0.15" />

                        {/* Axis labels */}
                        <text x="100" y="15" textAnchor="middle" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis IV (W Shifts)</text>
                        <text x="100" y="195" textAnchor="middle" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis IV (Inverted)</text>
                        
                        {dimension === 4 ? (
                          <>
                            <text x="188" y="103" textAnchor="end" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis III (Z Shifts)</text>
                            <text x="12" y="103" textAnchor="start" className="text-[6.5px] font-mono opacity-65 font-bold" fill="var(--text-color)">Axis III (Inverted)</text>
                          </>
                        ) : (
                          <text x="188" y="103" textAnchor="end" className="text-[6.5px] font-mono opacity-30 font-bold" fill="var(--text-color)">N/A</text>
                        )}

                        {/* Tick Lines and Value Labels along Horizontal (Axis III) */}
                        {[1, 2, -1, -2].map(val => (
                          <g key={`tick-axis-iii-${val}`}>
                            <line
                              x1={100 + val * contextScaleB} y1="97"
                              x2={100 + val * contextScaleB} y2="103"
                              stroke="var(--main-color-complementary)" strokeWidth="0.75" strokeOpacity="0.4"
                            />
                            <text
                              x={100 + val * contextScaleB} y="111"
                              textAnchor="middle" className="text-[5.5px] font-mono opacity-50 font-bold" fill="var(--text-color)"
                            >
                              {val === 1 ? '1x (Anchor)' : `${val}x`}
                            </text>
                          </g>
                        ))}

                        {/* Tick Lines and Value Labels along Vertical (Axis IV) */}
                        {[1, 2, -1, -2].map(val => (
                          <g key={`tick-axis-iv-${val}`}>
                            <line
                              x1="97" y1={100 - val * contextScaleB}
                              x2="103" y2={100 - val * contextScaleB}
                              stroke="var(--main-color-complementary)" strokeWidth="0.75" strokeOpacity="0.4"
                            />
                            <text
                              x="91" y={100 - val * contextScaleB + 2}
                              textAnchor="end" className="text-[5.5px] font-mono opacity-50 font-bold" fill="var(--text-color)"
                            >
                              {val === 1 ? '1x' : `${val}x`}
                            </text>
                          </g>
                        ))}

                        {/* Render active z/w context shifts */}
                        {computedContextPoints.map(cp => {
                          const shiftW = dimension === 4 ? cp.coordinates[3] : 0;
                          const shiftZ = cp.coordinates[2];
                          const targetW = 100 + shiftW * contextScaleB;
                          const targetZ = 100 - shiftZ * contextScaleB; // Elevation invert

                          const isAtOrigin = Math.hypot(shiftW, shiftZ) < 0.1;

                          return (
                            <g key={`ctx-map-b-${cp.id}`}>
                              {!isAtOrigin && (
                                <line
                                  x1="100" y1="100" x2={targetW} y2={targetZ}
                                  stroke="#f59e0b"
                                  strokeWidth="2"
                                  markerEnd="url(#arr-ctx)"
                                />
                              )}
                              <circle cx={targetW} cy={targetZ} r={isAtOrigin ? "4" : "5.5"} fill={isAtOrigin ? "#737373" : "#f59e0b"} stroke="var(--main-color-accent)" strokeWidth="1.2" />
                              <text 
                                x={targetW + 6} 
                                y={targetZ + 2.5} 
                                className="text-[8px] font-mono font-bold"
                                fill="var(--text-color)"
                              >
                                {cp.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col border border-dashed border-theme-comp/35 bg-theme-bg/30 p-5 items-center justify-center min-h-[295px] text-center select-none">
                    <Layers className="w-10 h-10 text-theme-comp/40 shrink-0 mb-2 stroke-[1.2]" />
                    <span className="font-mono text-xs text-theme-text/60 uppercase font-bold">Context Map Two Deactivated</span>
                    <p className="text-[10px] text-theme-text/80 font-sans max-w-[200px] leading-relaxed mt-1">Multi-dimensional context vectors (z & w) are activated only under 3D and 4D configurations.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dimension HUD and Spatial projections details */}
      <div className="border-t border-theme-comp bg-theme-bg p-4 font-mono text-xs flex flex-col gap-3 select-none">
        
        {/* Real-time Multipliers Tracker */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-theme-card/60 border border-theme-comp/35 p-2 px-3">
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-theme-text">
            <Sliders className="w-3.5 h-3.5 text-theme-comp" />
            <span>Active Dimension Factor Relationships</span>
          </div>
          <div className="flex items-center gap-2.5">
            {['y', 'x', 'z', 'w'].map((ax, idx) => {
              const val = activeModifiers[idx] ?? 1;
              const isActive = dimension > idx;
              return (
                <div key={ax} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 border font-bold ${
                  isActive 
                    ? val < 0 
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-500' 
                      : val > 1 
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-500' 
                        : 'bg-blue-950/20 border-blue-500/40 text-blue-500'
                    : 'bg-theme-bg/10 border-theme-comp/20 text-theme-text/45'
                }`}>
                  <span className="opacity-50 uppercase">{ax}:</span>
                  <span className="font-mono">{isActive ? formatModifier(val) : 'N/A'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend descriptor */}
        <div className="flex gap-2 text-[10px] leading-relaxed select-text text-theme-text/80">
          <Move className="w-4 h-4 text-theme-comp shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <p>
              <strong className="text-theme-text">Base Coordinate Relation: </strong>
              <code className="bg-theme-card border border-theme-comp/30 px-1 text-theme-text">{baseRelationName} [{baseVector.slice(0, dimension).join(', ')}]</code>
            </p>
            <p className="mt-1">
              <strong className="text-theme-text">Mutated Coordinate Outcome: </strong>
              <code className="bg-theme-card border border-theme-comp/40 px-1 font-bold text-theme-accent">{projectedRelationName} [{projectedVector.slice(0, dimension).join(', ')}]</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
