import { Building } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <Building className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Westeel Control Dashboard
        </h1>
        <p className="text-xs text-slate-500 font-mono">
          Internal Management Portal
        </p>
      </div>
    </div>
  );
}
