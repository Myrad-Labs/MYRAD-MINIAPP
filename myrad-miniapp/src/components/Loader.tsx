// src/components/Loader.tsx
import './Loader.css';

export function Loader() {
  return (
    <div className="loader-container">
      <div className="loader-content">
        <img 
          src="/testlogo.png" 
          alt="MYRAD Logo" 
          className="loader-logo"
        />
      </div>
    </div>
  );
}