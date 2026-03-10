import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-sm font-semibold tracking-tight">Agents WebUI</h1>
        </div>
        <ScrollArea className="flex-1">
          {sidebar}
        </ScrollArea>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
