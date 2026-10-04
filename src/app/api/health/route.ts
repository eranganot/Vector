import { checkHealth } from "@/application/health";
import { config } from "@/infra/config";
import { getPool } from "@/infra/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkHealth(getPool(), config().VECTOR_ENV);
  return Response.json(report, { status: report.status === "ok" ? 200 : 503 });
}
