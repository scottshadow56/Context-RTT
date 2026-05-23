import React, { useMemo } from 'react';
import { TrainingStats } from '../types';
import { Trophy, TrendingUp, Compass, HeartPulse, Activity, Zap, History, Milestone } from 'lucide-react';

interface AnalyticsPanelProps {
  stats: TrainingStats;
  onResetStats: () => void;
}

export default function AnalyticsPanel({ stats, onResetStats }: AnalyticsPanelProps) {
  
  // Calculate fluid IQ estimation
  // Base IQ = 100
  // Correct Beginner answer: +1 pts
  // Correct Intermediate answer: +2.5 pts
  // Correct Advanced answer: +5.5 pts
  // Correct Master answer: +10 pts
  // Streak bonuses can multiply
  const calculatedIQ = useMemo(() => {
    let baseIQ = 100;
    if (stats.history.length === 0) return 100;

    // Weight correct entries
    stats.history.forEach(h => {
      if (!h.correct) return;
      let weight = 1;
      if (h.difficulty === 'Intermediate') weight = 2.5;
      else if (h.difficulty === 'Advanced') weight = 5.5;
      else if (h.difficulty === 'Master') weight = 10;
      
      // Speed factor: if solved faster than 25 seconds
      const speedFactor = h.timeMs < 25000 ? 1.2 : 1.0;

      baseIQ += weight * 0.4 * speedFactor;
    });

    // Peak at 160
    return Math.min(160, Math.round(baseIQ));
  }, [stats.history]);

  // Dimensions accuracy breakdown
  const dimStats = useMemo(() => {
    const counts: Record<number, { total: number; correct: number }> = {
      2: { total: 0, correct: 0 },
      3: { total: 0, correct: 0 },
      4: { total: 0, correct: 0 }
    };

    stats.history.forEach(h => {
      const dim = h.dimension;
      if (counts[dim]) {
        counts[dim].total++;
        if (h.correct) counts[dim].correct++;
      }
    });

    return counts;
  }, [stats.history]);

  // IQ History points for custom SVG line chart
  const iqHistoryPoints = useMemo(() => {
    let runningIQ = 100;
    const points: { label: string; score: number }[] = [{ label: 'Init', score: 100 }];

    // We take last 8 submissions in chronological order (reverse of the state.history which is descending)
    const cronPoints = [...stats.history].reverse().slice(-8);

    cronPoints.forEach((h, idx) => {
      if (h.correct) {
        let weight = 1.2;
        if (h.difficulty === 'Intermediate') weight = 2.5;
        else if (h.difficulty === 'Advanced') weight = 5.5;
        else if (h.difficulty === 'Master') weight = 10;
        
        const speedFactor = h.timeMs < 25000 ? 1.2 : 1.0;
        runningIQ += weight * 0.4 * speedFactor;
      } else {
        // slight decay on penalty
        runningIQ = Math.max(100, runningIQ - 1.5);
      }
      points.push({
        label: `#${idx + 1}`,
        score: Math.min(160, Math.round(runningIQ))
      });
    });

    return points;
  }, [stats.history]);

  // Generate SVG plotting coordinates
  const svgWidth = 500;
  const svgHeight = 180;
  
  const chartCoordinates = useMemo(() => {
    if (iqHistoryPoints.length < 2) return '';
    
    const margin = { top: 20, right: 20, bottom: 25, left: 45 };
    const chartW = svgWidth - margin.left - margin.right;
    const chartH = svgHeight - margin.top - margin.bottom;

    // Y values map from 100 to 160 IQ
    const yMin = 100;
    const yMax = 160;

    return iqHistoryPoints.map((pt, idx) => {
      const x = margin.left + (idx / (iqHistoryPoints.length - 1)) * chartW;
      
      // Invert Y because SVG 0 is at top
      const normalizedY = (pt.score - yMin) / (yMax - yMin);
      const y = margin.top + chartH - (normalizedY * chartH);

      return { x, y, score: pt.score, label: pt.label };
    });
  }, [iqHistoryPoints]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="analytics-panel-root">
      
      {/* Visual Analytics main column */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* IQ Progress Line graph charting custom */}
        <div className="bg-white/40 border border-[#141414] p-5 shadow-sm rounded-none flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-1.5 mb-3 border-b border-[#141414]/15 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#141414]" />
              <h3 className="font-mono font-bold text-[#141414] text-xs uppercase tracking-wider">
                Fluid IQ Cognitive Mapping Progress
              </h3>
            </div>
            <span className="font-mono text-[9px] text-[#141414] border border-[#141414]/45 px-2 py-0.5 bg-white font-bold uppercase">
              Chronological Scale (IQ 100 - 160)
            </span>
          </div>

          <div className="flex-1 min-h-[200px] flex items-center justify-center bg-white/60 border border-[#141414]/35 p-3 relative rounded-none">
            {stats.history.length === 0 ? (
              <div className="text-center text-[#141414]/60 max-w-xs text-xs font-mono p-6 leading-relaxed flex flex-col items-center gap-2">
                <Milestone className="w-6 h-6" />
                <p>Telemetry graph locked. Perfect at least one multidimensional spatial reasoning problem in the workspace to construct dynamic fluid projections.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col p-2">
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full min-h-[160px]"
                >
                  {/* Grid guidelines */}
                  {[100, 115, 130, 145, 160].map((yVal, gridIdx) => {
                    const normY = (yVal - 100) / (160 - 100);
                    const yPos = 20 + (135 - (normY * 135));
                    return (
                      <g key={gridIdx}>
                        {/* Horizontal Line guide */}
                        <line
                          x1="45"
                          y1={yPos}
                          x2="480"
                          y2={yPos}
                          stroke="#141414"
                          strokeOpacity={0.15}
                          strokeWidth="1.2"
                          strokeDasharray="3 3"
                        />
                        {/* Numerical Axis tick labels */}
                        <text
                          x="38"
                          y={yPos + 3}
                          fill="#141414"
                          fillOpacity={0.7}
                          fontSize="9"
                          textAnchor="end"
                          className="font-mono font-bold"
                        >
                          {yVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw main connecting gradient line */}
                  {chartCoordinates.length > 1 && (
                    <>
                      {/* Connection Line */}
                      <path
                        d={chartCoordinates.reduce((acc, curr, idx) => {
                          return acc + `${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y} `;
                        }, '')}
                        fill="none"
                        stroke="#141414"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />

                      {/* Area Fill beneath curves gradient */}
                      <path
                        d={
                          chartCoordinates.reduce((acc, curr, idx) => {
                            return acc + `${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y} `;
                          }, '') + 
                          `L ${chartCoordinates[chartCoordinates.length - 1].x} ${155} ` +
                          `L ${chartCoordinates[0].x} ${155} Z`
                        }
                        fill="#141414"
                        opacity="0.05"
                      />

                      {/* Verticals and points mapping dots on coordinates */}
                      {chartCoordinates.map((pt, coordIdx) => (
                        <g key={coordIdx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="4.5"
                            fill="#E4E3E0"
                            stroke="#141414"
                            strokeWidth="2"
                            className="transition-transform duration-100 hover:scale-150 cursor-crosshair"
                          />
                          <text
                            x={pt.x}
                            y={pt.y - 9}
                            fill="#141414"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                            className="font-mono text-[9px]"
                          >
                            {pt.score}
                          </text>
                          {/* X-axis key labels */}
                          <text
                            x={pt.x}
                            y="172"
                            fill="#141414"
                            fillOpacity="0.6"
                            fontSize="8"
                            textAnchor="middle"
                            className="font-mono tracking-tighter"
                          >
                            {pt.label}
                          </text>
                        </g>
                      ))}
                    </>
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Level metrics bar stats */}
        <div className="bg-white/40 border border-[#141414] p-5 shadow-sm rounded-none flex flex-col">
          <div className="flex items-center gap-2 mb-4 border-b border-[#141414]/15 pb-2">
            <Compass className="w-4 h-4 text-[#141414]" />
            <h3 className="font-mono font-bold text-[#141414] text-xs uppercase tracking-wider">
              Cognitive Performance by Dimensional Space
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            {([2, 3, 4] as number[]).map((dim) => {
              const { total, correct } = dimStats[dim] || { total: 0, correct: 0 };
              const accPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
              
              let dimTitle = '2D (X, Y) Cardinal Plane';
              if (dim === 3) {
                dimTitle = '3D (X, Y, Z) Isometric Vector Sphere';
              } else if (dim === 4) {
                dimTitle = '4D (X, Y, Z, W) Hypercube Manifold';
              }

              return (
                <div key={dim} className="flex flex-col gap-1.5 p-3 bg-white/70 border border-[#141414]/30">
                  <div className="flex justify-between items-center text-xs flex-wrap gap-1">
                    <span className="font-mono font-bold text-[#141414]">{dimTitle}</span>
                    <span className="font-mono text-[#141414] font-bold bg-[#E4E3E0] border border-[#141414]/30 px-2 py-0.5 text-[10px]">
                      Accuracy: <span className={correct > 0 ? 'text-[#141414]' : 'text-[#111111]/50'}>{accPercent}%</span> ({correct}/{total})
                    </span>
                  </div>
                  <div className="w-full bg-[#E4E3E0] h-2.5 overflow-hidden border border-[#141414]/40 relative">
                    <div
                      className="h-full bg-[#141414] transition-all duration-300"
                      style={{ width: `${accPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Stats metrics panel right sidebar info */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Est IQ score block */}
        <div className="bg-white border-2 border-[#141414] p-5 shadow-none flex flex-col items-center justify-center text-center relative overflow-hidden rounded-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#141414]/5 rotate-45 pointer-events-none"></div>
          
          <Trophy className="w-8 h-8 text-[#141414] mb-2" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-[#141414] uppercase">Estimated Core Fluid IQ</span>
          
          <div className="text-4xl font-mono font-black text-[#141414] mt-1 mb-1 tracking-tighter border-b-2 border-dashed border-[#141414] pb-0.5">
            {calculatedIQ}
          </div>

          <div className="text-[10px] font-mono text-[#141414]/80 leading-normal max-w-[210px] bg-[#E4E3E0] p-2 mt-2 border border-[#141414] uppercase">
            {calculatedIQ === 100 
              ? "Baseline relational capability unlocked. Work through Advanced or Master problems to accelerate fluid scores."
              : calculatedIQ < 115 
              ? "Normalized standard intellectual spectrum. Keep challenging higher vector dimensions."
              : calculatedIQ < 130 
              ? "High logic capability index verified. Relational memory paths show enhanced plasticity."
              : "Superior multi-dimensional tracking profile. Fluid projection solvers operate at expert speed!"
            }
          </div>
        </div>

        {/* Numerical KPIs grid */}
        <div className="bg-white/40 border border-[#141414] p-4 shadow-sm grid grid-cols-2 gap-3.5 rounded-none">
          <div className="bg-white p-3 border border-[#141414] flex flex-col gap-1 rounded-none font-mono">
            <span className="text-[8px] text-[#141414]/65 font-bold tracking-wide uppercase">Accuracy Score</span>
            <span className="text-xl font-black text-[#141414]">{stats.accuracy}%</span>
            <span className="text-[9px] font-sans text-[#141414]/60">({stats.totalCorrect} / {stats.totalAnswered} Correct)</span>
          </div>

          <div className="bg-white p-3 border border-[#141414] flex flex-col gap-1 rounded-none font-mono">
            <span className="text-[8px] text-[#141414]/65 font-bold tracking-wide uppercase">Active Streak</span>
            <span className="text-xl font-black text-[#141414] flex items-center gap-1">
              <Zap className="w-4 h-4 fill-[#141414]" />
              {stats.streak}
            </span>
            <span className="text-[9px] font-sans text-[#141414]/60">Current Correct Loop</span>
          </div>

          <div className="bg-white p-3 border border-[#141414] flex flex-col gap-1 col-span-2 rounded-none font-mono">
            <span className="text-[8px] text-[#141414]/65 font-bold tracking-wide uppercase">Processing Reaction Time</span>
            <span className="text-lg font-black text-[#141414]">
              {stats.averageTimeMs > 0 ? `${(stats.averageTimeMs / 1000).toFixed(1)}s` : '0.0s'}
            </span>
            <span className="text-[9px] font-sans text-[#141414]/60">Average deductive logic resolve rate</span>
          </div>
        </div>

        {/* Historical entries log sidebar list */}
        <div className="bg-white/40 border border-[#141414] p-5 shadow-sm flex flex-col h-[230px] rounded-none">
          <div className="flex items-center gap-2 border-b border-[#141414] pb-2 mb-3 shrink-0">
            <History className="w-4 h-4 text-[#141414]" />
            <h4 className="font-mono font-bold text-[#141414] text-xs uppercase tracking-wider">
              Training Log Telemetry
            </h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
            {stats.history.length === 0 ? (
              <p className="text-center text-[10px] text-[#141414]/60 font-mono italic pt-6">No historical records available.</p>
            ) : (
              stats.history.map((h, hIdx) => (
                <div
                  key={hIdx}
                  className="bg-white hover:bg-white/90 border border-[#141414]/40 px-3 py-2 flex items-center justify-between transition-all rounded-none"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-[#141414] font-bold uppercase tracking-tight">
                      {h.dimension}D SPACE - <span className="font-black underline">{h.difficulty}</span>
                    </span>
                    <span className="text-[9px] font-mono text-[#141414]/60">Time: {((h.timeMs || 0) / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border ${
                      h.correct ? 'text-black bg-[#E4E3E0] border-[#141414]' : 'text-red-700 bg-red-50 border-red-500'
                    }`}>
                      {h.correct ? 'COMPLIANT' : 'DIVERGED'}
                    </span>
                    {h.correct && h.scoreGained > 0 && (
                      <span className="text-[9px] font-mono text-[#141414] font-bold">+{h.scoreGained} pts</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {stats.history.length > 0 && (
            <button
              id="reset-telemetry-btn"
              onClick={onResetStats}
              className="mt-3 text-[9px] font-mono text-[#141414]/60 hover:text-[#141414] text-center uppercase tracking-wider block font-bold cursor-pointer"
            >
              Flush Cognitive Logs
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
