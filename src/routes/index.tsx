import { createFileRoute } from "@tanstack/react-router";
import { JoinScreen } from "../ui/JoinScreen";

export const Route = createFileRoute("/")({
  component: JoinShell,
});

function JoinShell() {
  return <JoinScreen />;
}
