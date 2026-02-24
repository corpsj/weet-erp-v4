"use client";

import { Toaster } from "sonner";
import { PropsWithChildren } from "react";
import { QueryProvider } from "@/components/shared/query-provider";
import { PwaRegister } from "@/components/shared/pwa-register";

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <PwaRegister />
      {children}
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          style: {
            background: "#141414",
            border: "1px solid #2a2a2a",
            color: "#ffffff",
          },
        }}
      />
    </QueryProvider>
  );
}
