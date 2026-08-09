import React, { useState } from "react";
import { MENU } from "../constants/kitchen.js";
import { itemsTotal } from "../utils/helpers.js";

export default function OrderForm({ selected, toggleItem, submitOrder }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const total = itemsTotal(selected, qty);

  const handleSubmit = (e) => {
    e.preventDefault();
    submitOrder(name);
  };

  return (
    <form className="order-form card" onSubmit={handleSubmit}>
      <div className="form-heading">
        <span className="step-number">01</span>
        <div>
          <h3>Elige tu antojo</h3>
          <p>Menú disponible hoy</p>
        </div>
      </div>
      <div className="menu-grid" role="group" aria-label="Plato">
        {MENU.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`menu-option${selected.includes(m.id) ? " selected" : ""}`}
            onClick={() => toggleItem(m.id)}
          >
            <span className="menu-icon">{m.icon}</span>
            <span>
              <b>{m.name}</b>
              <small>{m.detail}</small>
            </span>
            <strong>S/ {m.price}</strong>
          </button>
        ))}
      </div>
      <div className="form-split">
        <label>
          ¿A nombre de quién?
          <input
            maxLength={25}
            autoComplete="name"
            placeholder="Tu nombre"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Cantidad
          <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            <option value={1}>1 porción</option>
            <option value={2}>2 porciones</option>
            <option value={3}>3 porciones</option>
          </select>
        </label>
      </div>
      <div className="form-bottom">
        <span>
          Total estimado <b>S/ {total}</b>
        </span>
        <button className="button button-primary" type="submit" disabled={!selected.length}>
          Enviar a cocina <span>→</span>
        </button>
      </div>
    </form>
  );
}
