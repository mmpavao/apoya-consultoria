import { createFileRoute } from "@tanstack/react-router";
import Administracao from "@/pages/Administracao";

export const Route = createFileRoute("/_app/administracao")({
  component: Administracao,
});
