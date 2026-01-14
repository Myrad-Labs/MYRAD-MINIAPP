import Iridescence from "./DynamicBackground";

export function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-20">
        <Iridescence
          color={[1.0, 1.0, 1.0]}
          mouseReact={false}
          amplitude={0.1}
          speed={0.5}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-24 h-24 flex items-center justify-center mb-8">
          {/* Subtle Glow */}
          <div className="absolute inset-0 bg-slate-200/50 rounded-full blur-xl animate-pulse"></div>

          {/* Logo Container */}
          <div className="relative bg-white/50 backdrop-blur-sm p-6 rounded-3xl shadow-2xl shadow-slate-200/50 border border-white/80 ring-1 ring-white/50">
            <img
              src="/testlogo.png"
              alt="MYRAD"
              className="w-12 h-12 object-contain mix-blend-multiply grayscale opacity-90"
            />
          </div>
        </div>

        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-bounce"></div>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Initializing</p>
        </div>
      </div>
    </div>
  );
}