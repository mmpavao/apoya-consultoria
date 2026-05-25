import { createFileRoute } from "@tanstack/react-router";
import WorkflowsPage from "@/pages/workflows/WorkflowsPage";

export const Route = createFileRoute("/_app/workflows")({
  component: WorkflowsPage,
  head: () => ({ meta: [{ title: "Workflows · APOYA Gestão" }] }),
});
