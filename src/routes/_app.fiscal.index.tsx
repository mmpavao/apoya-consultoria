import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/fiscal/")({
  beforeLoad: () => {
    throw redirect({ to: "/fiscal/das" });
  },
});
