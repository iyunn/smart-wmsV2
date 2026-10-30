import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { getDashboardStats } from "@/server/modules/reports/dashboard";

// GET /api/dashboard/stats — semua angka Dashboard.
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json(await getDashboardStats());
  } catch (err) {
    return serverError("dashboard/stats", err);
  }
}
