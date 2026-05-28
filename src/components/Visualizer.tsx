import React, { useMemo } from 'react';
import { EntityNode, DimensionCount, Vector, Premise } from '../types';
import { Compass, Maximize2, Move } from 'lucide-react';

interface VisualizerProps {
  entities: Record<string, EntityNode>;
  premises: Premise[];
  dimension: DimensionCount;
  basisRelations: Record<string, Vector>;
  highlightedPremiseId?: string | null;
}

export default function Visualizer({
  entities,
  premises,
  dimension,
  basisRelations,
  highlightedPremiseId
}: VisualizerProps) {
  const nodes = Object.values(entities);

  // --- MAP A: NORTH/SOUTH (Y, index 0) & EAST/WEST (X, index 1) ---
  const mapAPoints = useMemo(() => {
    if (nodes.length === 0) return [];
    
    let minX = -1, maxX = 1;
    let minY = -1, maxY = 1;
    nodes.forEach(node => {
      const x = node.coordinates[1] ?? 0; // East/West
      const y = node.coordinates[0] ?? 0; // North/South
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const spanX = Math.max(maxX - minX, 0.5);
    const spanY = Math.max(maxY - minY, 0.5);
    // Grid box size is 300x300, content centered around (150, 150)
    const scale = Math.min(200 / spanX, 200 / spanY, 45);

    const avgX = nodes.reduce((sum, n) => sum + (n.coordinates[1] ?? 0), 0) / nodes.length;
    const avgY = nodes.reduce((sum, n) => sum + (n.coordinates[0] ?? 0), 0) / nodes.length;

    return nodes.map(node => {
      const xVal = node.coordinates[1] ?? 0;
      const yVal = node.coordinates[0] ?? 0;
      const xScr = 150 + (xVal - avgX) * scale;
      const yScr = 150 - (yVal - avgY) * scale; // Inverted in screen Y space (North is positive Y, up)

      return {
        ...node,
        scrX: xScr,
        scrY: yScr,
      };
    });
  }, [nodes]);

  const mapAPointsMap = useMemo(() => {
    const map: Record<string, typeof mapAPoints[0]> = {};
    mapAPoints.forEach(p => {
      map[p.name] = p;
    });
    return map;
  }, [mapAPoints]);

  // --- MAP B: ABOVE/BELOW (Y, index 2) & AFTER/BEFORE (X, index 3) ---
  const mapBPoints = useMemo(() => {
    if (nodes.length === 0) return [];
    
    let minX = -1, maxX = 1;
    let minY = -1, maxY = 1;
    nodes.forEach(node => {
      const x = node.coordinates[3] ?? 0; // After/Before
      const y = node.coordinates[2] ?? 0; // Above/Below
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const spanX = Math.max(maxX - minX, 0.5);
    const spanY = Math.max(maxY - minY, 0.5);
    const scale = Math.min(200 / spanX, 200 / spanY, 45);

    const avgX = nodes.reduce((sum, n) => sum + (n.coordinates[3] ?? 0), 0) / nodes.length;
    const avgY = nodes.reduce((sum, n) => sum + (n.coordinates[2] ?? 0), 0) / nodes.length;

    return nodes.map(node => {
      const xVal = node.coordinates[3] ?? 0;
      const yVal = node.coordinates[2] ?? 0;
      const xScr = 150 + (xVal - avgX) * scale;
      const yScr = 150 - (yVal - avgY) * scale; // Inverted in screen Y space (Above is positive Y, up)

      return {
        ...node,
        scrX: xScr,
        scrY: yScr,
      };
    });
  }, [nodes]);

  const mapBPointsMap = useMemo(() => {
    const map: Record<string, typeof mapBPoints[0]> = {};
    mapBPoints.forEach(p => {
      map[p.name] = p;
    });
    return map;
  }, [mapBPoints]);

  return (
    <div className="flex flex-col flex-1 h-full bg-theme-card border border-theme-comp overflow-hidden relative">
      {/* Visualizer header */}
      <div className="px-5 py-3 border-b border-theme-comp bg-theme-bg flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-theme-comp" />
          <span className="font-serif italic text-theme-text text-sm tracking-wide">
            Orthogonal Map Projections <span className="text-[9px] font-mono border border-theme-comp bg-theme-card px-1.5 py-0.5 ml-2 uppercase tracking-widest">{dimension}D Coordinate Space</span>
          </span>
        </div>
      </div>

      {/* Grid Canvas Zone */}
      <div className="flex-1 p-4 bg-theme-bg shadow-inner overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="h-full min-h-[300px] flex items-center justify-center p-6 text-center text-theme-text/60 max-w-md mx-auto flex-col gap-2">
            <Maximize2 className="w-6 h-6 stroke-[1.5] text-theme-comp" />
            <p className="font-mono text-xs">No active logical constraints. Input entity relationships or start training to map the dimensional coordinate database.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${dimension > 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
            
            {/* Map A: North/South & East/West */}
            <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
              <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                <span className="tracking-wide">Map A: North/South & East/West Plane</span>
                <span className="opacity-55 px-1 bg-theme-bg text-theme-text">X: East/West | Y: North/South</span>
              </div>
              
              <div className="flex-1 min-h-[280px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/20">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                <svg
                  viewBox="0 0 300 300"
                  className="w-full h-full max-h-[300px] select-none z-10"
                >
                  <defs>
                    <marker
                      id="arrow-mapa-default"
                      viewBox="0 0 10 10"
                      refX="17"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.4" className="text-theme-comp" />
                    </marker>
                    <marker
                      id="arrow-mapa-highlight"
                      viewBox="0 0 10 10"
                      refX="17"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-theme-comp" />
                    </marker>
                  </defs>

                  {/* Axis lines */}
                  <line x1="150" y1="10" x2="150" y2="290" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" className="text-theme-comp" />
                  <line x1="10" y1="150" x2="290" y2="150" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" className="text-theme-comp" />

                  {/* Draw premise lines */}
                  {premises.map((premise, idx) => {
                    const nodeA = mapAPointsMap[premise.entityA];
                    const nodeB = mapAPointsMap[premise.entityB];
                    if (!nodeA || !nodeB) return null;

                    // Skip drawing if nodes overlap exactly in this projection to prevent rendering glitches
                    const dist = Math.hypot(nodeA.scrX - nodeB.scrX, nodeA.scrY - nodeB.scrY);
                    if (dist < 4) return null;

                    const isHighlighted = highlightedPremiseId === premise.id;

                    return (
                      <g key={`mapa-premise-${premise.id || idx}`}>
                        <line
                          x1={nodeB.scrX}
                          y1={nodeB.scrY}
                          x2={nodeA.scrX}
                          y2={nodeA.scrY}
                          stroke="currentColor"
                          strokeOpacity={isHighlighted ? 1 : 0.4}
                          strokeWidth={isHighlighted ? 2 : 1}
                          strokeDasharray={isHighlighted ? undefined : "3 3"}
                          markerEnd={`url(#${isHighlighted ? 'arrow-mapa-highlight' : 'arrow-mapa-default'})`}
                          className="text-theme-comp"
                        />
                      </g>
                    );
                  })}

                  {/* Draw points */}
                  {mapAPoints.map(point => {
                    return (
                      <g key={`mapa-node-${point.name}`} className="transition-all duration-300">
                        <rect
                          x={point.scrX - 5}
                          y={point.scrY - 5}
                          width="10"
                          height="10"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          transform={`rotate(45, ${point.scrX}, ${point.scrY})`}
                          className="text-theme-comp cursor-pointer hover:scale-125 transition-transform duration-100"
                        />
                        <g transform={`translate(${point.scrX}, ${point.scrY})`}>
                          <text
                            x="9"
                            y="4"
                            fill="var(--main-color)"
                            fontSize="9"
                            fontWeight="bold"
                            className="font-sans select-none"
                            stroke="var(--main-color)"
                            strokeWidth="3.5"
                            strokeLinejoin="round"
                          >
                            {point.name}
                          </text>
                          <text
                            x="9"
                            y="4"
                            fill="var(--text-color)"
                            fontSize="9"
                            fontWeight="bold"
                            className="font-sans"
                          >
                            {point.name}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Map B: Above/Below & After/Before (shown for 3D & 4D) */}
            {dimension > 2 && (
              <div className="flex flex-col border border-theme-comp bg-theme-card p-3.5 relative shadow-sm">
                <div className="text-[10px] font-mono font-bold text-theme-text border-b border-theme-comp/20 pb-1 mb-2.5 uppercase flex justify-between items-center select-none">
                  <span className="tracking-wide">Map B: Above/Below & After/Before Plane</span>
                  <span className="opacity-55 px-1 bg-theme-bg font-mono text-theme-text">
                    {dimension === 3 ? 'X: (N/A) | Y: Above/Below' : 'X: After/Before | Y: Above/Below'}
                  </span>
                </div>
                
                <div className="flex-1 min-h-[280px] relative flex items-center justify-center bg-theme-bg/50 border border-dashed border-theme-comp/20">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--main-color-complementary) 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                  <svg
                    viewBox="0 0 300 300"
                    className="w-full h-full max-h-[300px] select-none z-10"
                  >
                    <defs>
                      <marker
                        id="arrow-mapb-default"
                        viewBox="0 0 10 10"
                        refX="17"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.4" className="text-theme-comp" />
                      </marker>
                      <marker
                        id="arrow-mapb-highlight"
                        viewBox="0 0 10 10"
                        refX="17"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-theme-comp" />
                      </marker>
                    </defs>

                    {/* Axis lines */}
                    <line x1="150" y1="10" x2="150" y2="290" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" className="text-theme-comp" />
                    <line x1="10" y1="150" x2="290" y2="150" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" className="text-theme-comp" />

                    {/* Draw premise lines */}
                    {premises.map((premise, idx) => {
                      const nodeA = mapBPointsMap[premise.entityA];
                      const nodeB = mapBPointsMap[premise.entityB];
                      if (!nodeA || !nodeB) return null;

                      // Skip drawing line if exactly overlapping on this coordinate plane projection
                      const dist = Math.hypot(nodeA.scrX - nodeB.scrX, nodeA.scrY - nodeB.scrY);
                      if (dist < 4) return null;

                      const isHighlighted = highlightedPremiseId === premise.id;

                      return (
                        <g key={`mapb-premise-${premise.id || idx}`}>
                          <line
                            x1={nodeB.scrX}
                            y1={nodeB.scrY}
                            x2={nodeA.scrX}
                            y2={nodeA.scrY}
                            stroke="currentColor"
                            strokeOpacity={isHighlighted ? 1 : 0.4}
                            strokeWidth={isHighlighted ? 2 : 1}
                            strokeDasharray={isHighlighted ? undefined : "3 3"}
                            markerEnd={`url(#${isHighlighted ? 'arrow-mapb-highlight' : 'arrow-mapb-default'})`}
                            className="text-theme-comp"
                          />
                        </g>
                      );
                    })}

                    {/* Draw points */}
                    {mapBPoints.map(point => {
                      const wVal = point.coordinates[3] ?? 0;
                      const hasActiveW = dimension === 4 && Math.abs(wVal) > 0;
                      
                      return (
                        <g key={`mapb-node-${point.name}`} className="transition-all duration-300">
                          {/* Differentiate 4D offset shapes beautifully */}
                          <rect
                            x={point.scrX - 5}
                            y={point.scrY - 5}
                            width="10"
                            height="10"
                            fill={hasActiveW ? "none" : "currentColor"}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            transform={`rotate(45, ${point.scrX}, ${point.scrY})`}
                            className="text-theme-comp cursor-pointer hover:scale-125 transition-transform duration-100"
                          />
                          <g transform={`translate(${point.scrX}, ${point.scrY})`}>
                            <text
                              x="9"
                              y="4"
                              fill="var(--main-color)"
                              fontSize="9"
                              fontWeight="bold"
                              className="font-sans select-none"
                              stroke="var(--main-color)"
                              strokeWidth="3.5"
                              strokeLinejoin="round"
                            >
                              {point.name}
                            </text>
                            <text
                              x="9"
                              y="4"
                              fill="var(--text-color)"
                              fontSize="9"
                              fontWeight="bold"
                              className="font-sans"
                            >
                              {point.name}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Guide Info Overlay Panel */}
      <div className="px-5 py-3.5 border-t border-theme-comp bg-theme-bg text-[10px] text-theme-text leading-normal font-mono select-none flex items-start gap-2">
        <Move className="w-3.5 h-3.5 shrink-0 mt-0.5 text-theme-comp" />
        <p>
          {dimension === 2
            ? "Two-dimensional Cartesian configuration mapped in Map A. Initial spatial matrix verified."
            : dimension === 3
            ? "Three-dimensional configuration displayed. Map A projects North-South / East-West coordinate relationships. Map B tracks Above-Below vertical elevation vectors."
            : "Four-dimensional projection active. Map A renders standard planar coordinates. Map B maps the hyper-dimensional Above-Below & After-Before coordinate vectors concurrently."
          }
        </p>
      </div>
    </div>
  );
}
