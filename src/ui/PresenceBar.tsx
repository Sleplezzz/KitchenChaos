import type { ChannelStatus } from "@portalsdk/core";
import type { KitchenProjection } from "../domain/projection";
import {
  formatConnectionLabel,
  formatRoomCode,
  selectLatestAgentSentences,
  selectPresenceView,
  type PresenceInput,
} from "./shell-header";

export type PresenceBarProps = {
  roomId: string;
  status: ChannelStatus | string;
  presence: PresenceInput;
  agents: KitchenProjection["agents"];
  meId?: string;
};

export function PresenceBar({
  roomId,
  status,
  presence,
  agents,
  meId,
}: PresenceBarProps) {
  const roomCode = formatRoomCode(roomId);
  const connectionLabel = formatConnectionLabel(status);
  const presenceView = selectPresenceView(presence, meId);
  const agentSentences = selectLatestAgentSentences(agents);

  return (
    <header className="shell-header">
      <div className="shell-header-section shell-header-room">
        <span className="shell-header-label">Room</span>
        <span className="shell-header-value">{roomCode}</span>
      </div>

      <div className="shell-header-section shell-header-status">
        <span className="shell-header-label">Status</span>
        <span className="shell-header-value" data-status={status}>
          {connectionLabel}
        </span>
      </div>

      <div className="shell-header-section shell-header-presence">
        <span className="shell-header-label">Presence</span>
        {presenceView.mode === "detailed" ? (
          <>
            <span className="shell-header-value">{presenceView.count}</span>
            <ul className="shell-presence-list">
              {presenceView.people.map((person) => (
                <li
                  key={person.id}
                  className={
                    person.isSelf
                      ? "shell-presence-person is-self"
                      : "shell-presence-person"
                  }
                >
                  <span className="shell-presence-name">
                    {person.displayName}
                    {person.isSelf ? " (you)" : null}
                  </span>
                  <span className="shell-presence-role">{person.role}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {presenceView.mode === "aggregate" ? (
          <span className="shell-header-value">{presenceView.count}</span>
        ) : null}
        {presenceView.mode === "unknown" ? (
          <span className="shell-header-value shell-header-muted">—</span>
        ) : null}
      </div>

      <div className="shell-header-section shell-header-agents">
        <span className="shell-header-label">Agents</span>
        {agentSentences.length === 0 ? (
          <span className="shell-header-value shell-header-muted">—</span>
        ) : (
          <ul className="shell-agent-list">
            {agentSentences.map((entry) => (
              <li key={entry.role} className="shell-agent-item">
                <span className="shell-agent-role">{entry.role}</span>
                <span className="shell-agent-sentence">{entry.sentence}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
