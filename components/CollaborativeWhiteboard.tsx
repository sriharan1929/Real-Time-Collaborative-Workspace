"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Trash2,
  Download,
  Wifi,
  WifiOff,
  Palette,
  Maximize2,
  Sparkles,
} from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  size: number;
  points: Point[];
}

interface RemoteCursor {
  clientId: number;
  x: number;
  y: number;
  user: {
    name: string;
    color: string;
  };
}

interface CollaborativeWhiteboardProps {
  pageId: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
  };
}

const COLORS = [
  "#1a1a1a", // Charcoal/Black
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#e11d48", // Rose/Red
  "#16a34a", // Green
  "#d97706", // Amber
  "#64748b", // Slate
];

const SIZES = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 5 },
  { label: "Bold", value: 10 },
  { label: "Marker", value: 20 },
];

const USER_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#d97706",
  "#9333ea",
];

function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function CollaborativeWhiteboard({
  pageId,
  currentUser,
}: CollaborativeWhiteboardProps) {
  const wsUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      const envWs = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
      if (envWs && !envWs.includes("localhost") && !envWs.includes("127.0.0.1")) {
        return envWs;
      }
      const host = window.location.hostname;
      const port = process.env.NEXT_PUBLIC_COLLAB_PORT || "1234";
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${host}:${port}`;
    }
    return process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234";
  }, []);

  const [collab, setCollab] = useState<{ doc: Y.Doc; provider: WebsocketProvider } | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, `page/${pageId}`, doc, {
      connect: true,
    });
    setCollab({ doc, provider });

    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [pageId, wsUrl]);

  if (!collab) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-[#9b9a97] text-sm">
        Initializing collaborative whiteboard...
      </div>
    );
  }

  return (
    <CollaborativeWhiteboardCanvas
      pageId={pageId}
      currentUser={currentUser}
      doc={collab.doc}
      provider={collab.provider}
    />
  );
}

interface CanvasProps extends CollaborativeWhiteboardProps {
  doc: Y.Doc;
  provider: WebsocketProvider;
}

function CollaborativeWhiteboardCanvas({
  currentUser,
  doc,
  provider,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);

  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser">("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [size, setSize] = useState(3);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">(
    provider.wsconnected ? "connected" : "connecting"
  );
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  const userColor = useMemo(
    () => getRandomColor(currentUser.email || currentUser.id),
    [currentUser.email, currentUser.id]
  );

  const yStrokes = useMemo(() => doc.getArray<Stroke>("whiteboard-strokes"), [doc]);

  // Redraw the canvas from the current list of strokes
  const renderStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid dots pattern
    ctx.fillStyle = "#e5e7eb";
    const dotGap = 24;
    for (let x = dotGap; x < canvas.width; x += dotGap) {
      for (let y = dotGap; y < canvas.height; y += dotGap) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    const strokes = yStrokes.toArray();

    // Render each committed stroke
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }

    // Render currently active local stroke if drawing
    if (isDrawingRef.current && currentPointsRef.current.length > 1) {
      drawStroke(ctx, {
        id: "preview",
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color,
        size,
        points: currentPointsRef.current,
      });
    }
  }, [yStrokes, tool, color, size]);

  // Handle stroke drawing with smooth quadratic curves
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "highlighter") {
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = stroke.size * 3.5;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = stroke.size;
    }

    ctx.beginPath();
    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Keyboard shortcuts: P = Pen, H = Highlighter, E = Eraser, Ctrl/Cmd+Z = Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (yStrokes.length > 0) yStrokes.delete(yStrokes.length - 1, 1);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "p": setTool("pen"); break;
        case "h": setTool("highlighter"); break;
        case "e": setTool("eraser"); break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [yStrokes]);

  // Awareness (live cursor positions & presence)
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: currentUser.name,
      color: userColor,
    });

    const updateAwareness = () => {
      const states = provider.awareness.getStates();
      const cursors: RemoteCursor[] = [];
      states.forEach((state, clientId) => {
        if (clientId !== doc.clientID && state.wbCursor && state.user) {
          cursors.push({
            clientId,
            x: state.wbCursor.x,
            y: state.wbCursor.y,
            user: state.user,
          });
        }
      });
      setRemoteCursors(cursors);
    };

    const statusHandler = ({ status }: { status: "connecting" | "connected" | "disconnected" }) => {
      setConnectionStatus(status);
    };

    provider.on("status", statusHandler);
    provider.awareness.on("change", updateAwareness);

    if (provider.wsconnected) {
      setConnectionStatus("connected");
    }

    return () => {
      provider.off("status", statusHandler);
      provider.awareness.off("change", updateAwareness);
    };
  }, [provider, doc.clientID, currentUser.name, userColor]);

  // Sync canvas redraw on remote Yjs stroke changes
  useEffect(() => {
    const observer = () => {
      renderStrokes();
    };
    yStrokes.observe(observer);
    renderStrokes();

    return () => {
      yStrokes.unobserve(observer);
    };
  }, [yStrokes, renderStrokes]);

  // Resize canvas to fill container with proper pixel ratio
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = Math.max(650, rect.height) * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${Math.max(650, rect.height)}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      renderStrokes();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderStrokes]);

  // Coordinates helper
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const pt = getCanvasCoords(e);
    isDrawingRef.current = true;

    if (tool === "eraser") {
      eraseAtPoint(pt);
    } else {
      currentPointsRef.current = [pt];
      renderStrokes();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);

    // Broadcast live cursor position to other users
    provider.awareness.setLocalStateField("wbCursor", {
      x: pt.x,
      y: pt.y,
    });

    if (!isDrawingRef.current) return;

    if (tool === "eraser") {
      eraseAtPoint(pt);
    } else {
      currentPointsRef.current.push(pt);
      renderStrokes();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool !== "eraser" && currentPointsRef.current.length > 0) {
      const newStroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color,
        size,
        points: [...currentPointsRef.current],
      };

      // Commit stroke to Yjs shared array
      yStrokes.push([newStroke]);
      currentPointsRef.current = [];
    }
  };

  // Erase strokes intersecting with point
  const eraseAtPoint = (pt: Point) => {
    const threshold = 18;
    const strokes = yStrokes.toArray();
    const remaining: Stroke[] = [];

    let removedAny = false;
    for (const stroke of strokes) {
      let intersects = false;
      for (const p of stroke.points) {
        const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (dist <= threshold + stroke.size) {
          intersects = true;
          break;
        }
      }
      if (!intersects) {
        remaining.push(stroke);
      } else {
        removedAny = true;
      }
    }

    if (removedAny) {
      yStrokes.delete(0, yStrokes.length);
      if (remaining.length > 0) {
        yStrokes.push(remaining);
      }
    }
  };

  // Clear all strokes
  const handleClear = () => {
    if (yStrokes.length === 0) return;
    if (confirm("Clear entire whiteboard for all collaborators?")) {
      yStrokes.delete(0, yStrokes.length);
    }
  };

  // Undo last stroke
  const handleUndo = () => {
    if (yStrokes.length > 0) {
      yStrokes.delete(yStrokes.length - 1, 1);
    }
  };

  // Export as PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="w-full flex flex-col h-full bg-[#fbfbfa]">
      {/* Top Floating Whiteboard Toolbar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#e9e9e8] py-2 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Tool Mode Selectors */}
        <div className="flex items-center gap-1 bg-[#f4f4f3] p-1 rounded-xl border border-[#e9e9e8]">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tool === "pen"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-[#5f6368] hover:text-[#1a1a1a]"
            }`}
            title="Pen (P)"
          >
            <Pen className="w-3.5 h-3.5" />
            <span>Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setTool("highlighter")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tool === "highlighter"
                ? "bg-white text-purple-600 shadow-xs"
                : "text-[#5f6368] hover:text-[#1a1a1a]"
            }`}
            title="Highlighter (H)"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Highlighter</span>
          </button>

          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              tool === "eraser"
                ? "bg-white text-rose-600 shadow-xs"
                : "text-[#5f6368] hover:text-[#1a1a1a]"
            }`}
            title="Eraser (E)"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Color Palette (disabled in eraser mode) */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#fbfbfa] rounded-xl border border-[#e9e9e8]">
            <Palette className="w-3.5 h-3.5 text-[#9b9a97] mr-1 hidden sm:inline" />
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full transition transform cursor-pointer border ${
                  color === c ? "scale-125 ring-2 ring-blue-500 ring-offset-1 border-white" : "border-black/10 hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        )}

        {/* Size Presets */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-1 bg-[#f4f4f3] p-1 rounded-xl border border-[#e9e9e8]">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSize(s.value)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                  size === s.value
                    ? "bg-white text-[#1a1a1a] shadow-xs font-semibold"
                    : "text-[#787774] hover:text-[#1a1a1a]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Actions: Undo, Clear, Export, Connection Status */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleUndo}
            className="p-1.5 rounded-lg hover:bg-black/5 text-[#5f6368] hover:text-[#1a1a1a] transition cursor-pointer"
            title="Undo Last Stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-[#5f6368] hover:text-rose-600 transition cursor-pointer"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleExportPNG}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-black/5 text-[#5f6368] hover:text-[#1a1a1a] text-xs font-medium transition cursor-pointer"
            title="Download PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export PNG</span>
          </button>

          <div className="h-4 w-px bg-[#e9e9e8] mx-1" />

          {/* Connection badge */}
          <div className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-[#f4f4f3] border border-[#e9e9e8]">
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">Live Whiteboard Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span className="text-amber-700">Connecting...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Drawing Canvas Container */}
      <div className="flex-1 relative w-full h-[650px] min-h-[650px] overflow-hidden bg-white select-none touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-full h-full block ${
            tool === "eraser"
              ? "cursor-crosshair"
              : tool === "highlighter"
              ? "cursor-cell"
              : "cursor-crosshair"
          }`}
        />

        {/* Live Remote Collaborator Cursors */}
        {remoteCursors.map((c) => (
          <div
            key={c.clientId}
            className="absolute pointer-events-none transition-transform duration-75 z-30"
            style={{
              transform: `translate(${c.x}px, ${c.y}px)`,
            }}
          >
            {/* Pen cursor tip icon */}
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill={c.user.color}
              stroke="white"
              strokeWidth="1.5"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <div
              className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ml-2 -mt-2"
              style={{ backgroundColor: c.user.color }}
            >
              {c.user.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

