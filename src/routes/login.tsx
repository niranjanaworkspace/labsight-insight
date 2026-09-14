import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/labsight/auth-form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — LABSIGHT AI" },
      {
        name: "description",
        content: "Log in to LABSIGHT AI to review patterns and changes across your lab reports.",
      },
      { property: "og:title", content: "Log in — LABSIGHT AI" },
      {
        property: "og:description",
        content: "Log in to LABSIGHT AI to review patterns and changes across your lab reports.",
      },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
