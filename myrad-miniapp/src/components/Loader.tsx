// src/components/Loader.tsx
export function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="relative flex flex-col items-center">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Ripple effect */}
          <div className="absolute inset-0 bg-slate-100 rounded-full animate-ping opacity-75"></div>
          <div className="absolute inset-4 bg-slate-200 rounded-full animate-pulse"></div>

          <img
            src="/testlogo.png"
            alt="MYRAD Logo"
            className="relative z-10 w-16 h-16 object-contain"
          />
        </div>
        <p className="mt-6 text-slate-400 font-medium tracking-widest text-sm uppercase animate-pulse">Loading Experience</p>
      </div>
    </div>
  );
}