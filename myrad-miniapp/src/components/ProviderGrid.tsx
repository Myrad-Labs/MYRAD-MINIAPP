// src/components/ProviderGrid.tsx
import "./ProviderGrid.css";

type Provider = {
  id: string;
  label: string;
  description?: string;
  icon: string;
};

const providers: Provider[] = [
  { 
    id: "swiggy", 
    label: "Swiggy", 
    description: "Order History",
    icon: "🍔"
  },
  { 
    id: "zomato", 
    label: "Zomato", 
    description: "Order History",
    icon: "🍕"
  },
  { 
    id: "amazon", 
    label: "Amazon", 
    description: "Order History",
    icon: "📦"
  },
  { 
    id: "flipkart", 
    label: "Flipkart", 
    description: "Order History",
    icon: "🛒"
  },
  { 
    id: "myntra", 
    label: "Myntra", 
    description: "Fashion Orders",
    icon: "👕"
  },
];

export function ProviderGrid() {
  const handleClick = (providerId: string) => {
    console.log(`Clicked: ${providerId}`);
    alert(`Future feature: ${providerId} history will open here 🚀`);
  };

  return (
    <div className="provider-grid-container">
      <div className="provider-header">
        <h2>Contribute & Earn</h2>
        <p className="provider-subtitle">
          Share your opinions and earn rewards for your valuable insights
        </p>
      </div>
      
      <div className="provider-grid">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleClick(provider.id)}
            className="provider-card glass-card"
          >
            <div className="provider-icon">{provider.icon}</div>
            <div className="provider-content">
              <h3 className="provider-label">{provider.label}</h3>
              {provider.description && (
                <p className="provider-description">{provider.description}</p>
              )}
            </div>
            <div className="provider-arrow">→</div>
          </button>
        ))}
      </div>
    </div>
  );
}