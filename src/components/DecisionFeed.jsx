import React from "react";
import { AGENT_META } from "../constants/kitchen.js";
import { formatClock } from "../utils/helpers.js";

export default function DecisionFeed({ chaosLog }) {
  return (
    <div className="decision-feed card">
      <div className="feed-header">
        <div>
          <span className="eyebrow">ACTIVIDAD EN VIVO</span>
          <h3>Bitácora de decisiones</h3>
        </div>
        <span className="feed-time">
          <i className="pulse"></i> LIVE
        </span>
      </div>
      <ol id="decisionFeed" className="feed-list">
        {chaosLog.length === 0 && <li>Sin eventos todavía.</li>}
        {chaosLog.map((c) => {
          const meta = c.who ? AGENT_META[c.who] : null;
          return (
            <li key={c.id}>
              <time>{formatClock(c.ts)}</time>
              {meta ? (
                <span className={`feed-avatar ${meta.avatarClass}`}>{meta.avatarLetter}</span>
              ) : (
                <span className="feed-avatar" style={{ background: "var(--orange)", color: "var(--night)" }}>
                  !
                </span>
              )}
              <p>
                {meta && <b>{meta.label}: </b>}
                {c.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
