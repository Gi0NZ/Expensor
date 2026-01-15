import React, { useState } from "react";
import "../styles/BudgetCard.css"; // (Crea tu lo stile CSS a piacere)

const BudgetCard = ({ budgetStatus, onSetBudget }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState("");

  // Se non c'è budget e non sto editando
  if (!budgetStatus && !isEditing) {
    return (
      <div className="budget-card empty">
        <h3>💰 Budget Mensile</h3>
        <p>Nessun limite impostato.</p>
        <button onClick={() => setIsEditing(true)}>Imposta Budget</button>
      </div>
    );
  }

  const limit = budgetStatus ? budgetStatus.monthly_limit : 0;
  const spent = budgetStatus ? budgetStatus.current_spent : 0;
  
  // Calcolo percentuale (max 100 per grafica)
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - spent, 0);
  const isOver = spent > limit;

  // Colore dinamico
  let barColor = "#4bc0c0"; // Verde
  if (percentage > 50) barColor = "#ffce56"; // Giallo
  if (percentage > 85) barColor = "#ff6384"; // Rosso

  const handleSave = () => {
    if(!amount) return;
    onSetBudget(amount);
    setIsEditing(false);
  };

  return (
    <div className="budget-card">
      <div className="header">
        <h3>💰 Budget {new Date().toLocaleString('it-IT', { month: 'long' })}</h3>
        <button className="icon-btn" onClick={() => setIsEditing(!isEditing)}>⚙️</button>
      </div>

      {isEditing ? (
        <div className="edit-mode">
          <input 
            type="number" 
            placeholder="Es. 500" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
          />
          <button onClick={handleSave}>Salva</button>
        </div>
      ) : (
        <div className="display-mode">
          <div className="progress-bg">
            <div 
              className="progress-fill" 
              style={{ width: `${percentage}%`, backgroundColor: barColor }}
            ></div>
          </div>
          
          <div className="stats">
            <span>Speso: <strong>€{spent.toFixed(2)}</strong></span>
            <span>Limite: <strong>€{limit.toFixed(2)}</strong></span>
          </div>
          
          <p className={`status-text ${isOver ? 'alert' : ''}`}>
            {isOver 
              ? `🚨 Hai sforato di €${(spent - limit).toFixed(2)}!` 
              : `Ti restano €${remaining.toFixed(2)}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetCard;