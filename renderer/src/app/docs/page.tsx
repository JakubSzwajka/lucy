"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { openApiSpec } from "@/lib/openapi/spec";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI spec={openApiSpec} />
    </div>
  );
}
