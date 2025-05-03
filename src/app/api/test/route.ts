import { NextRequest, NextResponse } from "next/server";
import { env, validateEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  // Validate environment variables
  const isValid = validateEnv();
  
  return NextResponse.json({
    status: "ok",
    environment: isValid ? "valid" : "missing variables",
    openaiKey: env.OPENAI_API_KEY ? "configured" : "missing",
    luminaKey: env.LUMINA_API_KEY ? "configured" : "missing",
  });
}
