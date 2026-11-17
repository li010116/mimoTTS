"use client";

import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <MotionConfig
          reducedMotion="user"
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </MotionConfig>
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
