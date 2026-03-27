import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body?.id;

    if (!id || typeof id !== "string") {
      return Response.json(
        { error: "invalid id" },
        { status: 400 }
      );
    }

    const { error, data } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", id)
      .select("id") // ← 更新確認
      .single();

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return Response.json(
        { error: "not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      id: data.id,
    });

  } catch (e) {
    return Response.json(
      { error: "invalid request" },
      { status: 400 }
    );
  }
}