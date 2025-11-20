import Header from "@/components/Header";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Trophy, Shield } from "lucide-react";

export const Route = createFileRoute("/_homepage")({
  component: () => (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Outlet />
    </div>
  ),
});
