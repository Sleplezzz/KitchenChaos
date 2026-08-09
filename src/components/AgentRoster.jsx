import React from "react";
import { AGENT_META } from "../constants/kitchen.js";

export default function AgentRoster({ agents }) {
  return (
    <div className="agent-roster" id="agentRoster">
      {Object.entries(AGENT_META).map(([key, meta]) => {
        const a = agents[key];
        return (
          <article key={key} className="agent-card active" data-agent={key}>
            <div className={`agent-avatar ${meta.avatarClass}`}>{meta.avatarLetter}</div>
            <div>
              <span>{meta.role}</span>
              <h3>{meta.name}</h3>
              <p>{meta.tagline}</p>
            </div>
            <b>
              <i></i> {a?.status === "down" ? "OFF" : "ON"}
            </b>
          </article>
        );
      })}
    </div>
  );
}
