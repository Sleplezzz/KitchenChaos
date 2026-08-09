import React from "react";

export default function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#inicio" aria-label="Kitchen Chaos, inicio">
        <span className="brand-mark" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span>
          kitchen<span>chaos</span>
        </span>
      </a>
      <div className="live-pill">
        <span className="pulse"></span> Operación en vivo
      </div>
      <nav aria-label="Navegación principal">
        <a href="#pedir">Hacer pedido</a>
        <a href="#tablero">Tablero</a>
        <a href="#agentes">Agentes</a>
      </nav>
      <a className="host-button" href="#chaos">
        Acceso host <span>↗</span>
      </a>
    </header>
  );
}
