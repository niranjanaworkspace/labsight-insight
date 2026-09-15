import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/labsight/auth-form";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — LABSIGHT AI" },
      {
        name: "description",
        content:
          "Create a LABSIGHT AI account and start tracking how your lab values change over time.",
      },
      { property: "og:title", content: "Create account — LABSIGHT AI" },
      {
        property: "og:description",
        content:
          "Create a LABSIGHT AI account and start tracking how your lab values change over time.",
      },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
