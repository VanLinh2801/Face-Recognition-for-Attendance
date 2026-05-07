import { Badge } from "@/components/ui/badge";

const boxes = [
  { name: "Nguyen Van A", score: "96%", left: "22%", top: "25%", width: "18%", height: "28%", color: "border-emerald-400" },
  { name: "Unknown", score: "review", left: "62%", top: "30%", width: "14%", height: "24%", color: "border-amber-400" },
];

export function CameraView() {
  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.35),rgba(8,47,73,0.2)),radial-gradient(circle_at_center,rgba(20,184,166,0.16),transparent_35%)]" />
      <div className="absolute inset-8 rounded-xl border border-slate-800 bg-slate-900/60 shadow-2xl">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
          <Badge variant="danger">Live</Badge>
          <Badge variant="success">Camera online</Badge>
          <Badge variant="dark">30 FPS</Badge>
          <Badge variant="dark">42 ms</Badge>
        </div>
        <div className="absolute right-5 top-5 font-mono text-xs text-slate-400">CAM-ENTRY-01 · Main Gate</div>
        {boxes.map((box) => (
          <div
            key={box.name}
            className={`absolute rounded-md border-2 ${box.color}`}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            <div className="absolute -top-8 left-0 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs font-medium text-white ring-1 ring-slate-700">
              {box.name} · {box.score}
            </div>
          </div>
        ))}
        <div className="absolute bottom-5 left-5 max-w-md">
          <h1 className="text-2xl font-semibold">Realtime recognition monitor</h1>
          <p className="mt-2 text-sm text-slate-300">
            Mock camera surface prepared for backend overlay events, recognition boxes, spoof warnings, and stream health.
          </p>
        </div>
      </div>
    </section>
  );
}
