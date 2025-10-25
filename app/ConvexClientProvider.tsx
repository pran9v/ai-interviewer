"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import Provider from "./Provider";
import { toast } from "sonner";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
        console.error('NEXT_PUBLIC_CONVEX_URL is not defined');
        toast.error('Application configuration error');
        return <div>Configuration Error</div>;
    }

    const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    
    return (
        <ConvexProvider client={convex}>
            <Provider>{children}</Provider>
        </ConvexProvider>
    );
}