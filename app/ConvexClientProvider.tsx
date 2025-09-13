"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import Provider from "./Provider";


export function ConvexClientProvider({ children }: { children: ReactNode }) {
    const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    
    return <ConvexProvider client={convex}>
        <Provider>{children}</Provider>
    </ConvexProvider>;
}