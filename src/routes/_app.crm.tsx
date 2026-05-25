import { createFileRoute } from "@tanstack/react-router";
import CrmPage from "@/pages/crm/CrmPage";

export const Route = createFileRoute("/_app/crm")({
  component: CrmPage,
});
