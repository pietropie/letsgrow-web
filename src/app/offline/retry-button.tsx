"use client";

import { Button } from "@/components/ui";

export function RetryButton() {
  return <Button label="Tentar de novo" onClick={() => window.location.assign("/")} />;
}
