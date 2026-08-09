import React from "react";
import { formatClock } from "../utils/helpers.js";

export default function Hero({ viewers, now, chaosActive }) {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="orange-dot"></span> RESTAURANTE AUTÓNOMO / EDICIÓN HACKATHON
        </p>
        <h1>
          La cocina está viva.
          <br />
          <em>Y piensa en público.</em>
        </h1>
        <p className="hero-text">
          Haz un pedido y sigue cada decisión operativa: del ingreso a cocina hasta su llegada. Cuando ocurre
          el caos, nuestros agentes se adaptan en tiempo real.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#pedir">
            Ordenar ahora <span>↓</span>
          </a>
          <a className="button button-ghost" href="#tablero">
            Ver la operación <span>→</span>
          </a>
        </div>
      </div>
      <aside className="hero-panel" aria-label="Estado de la cocina">
        <div className="panel-topline">
          <span>ESTADO DE COCINA</span>
          <strong>{chaosActive ? "EN CAOS" : "ESTABLE"}</strong>
        </div>
        <div className="status-orbit">
          <div className="orbit-core">
            <span>01</span>
            <strong>
              TODO
              <br />
              EN MARCHA
            </strong>
          </div>
          <span className="orbit-label orbit-chef">
            CHEF
            <br />
            <b>ACTIVO</b>
          </span>
          <span className="orbit-label orbit-manager">
            GERENTE
            <br />
            <b>ACTIVO</b>
          </span>
          <span className="orbit-label orbit-driver">
            RIDER
            <br />
            <b>ACTIVO</b>
          </span>
        </div>
        <div className="panel-footer">
          <span>
            <i className="pulse"></i>
            <b>{viewers}</b> espectadores
          </span>
          <span>
            actualizado <b>{formatClock(now)}</b>
          </span>
        </div>
      </aside>
    </section>
  );
}
