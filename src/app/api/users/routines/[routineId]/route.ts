import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

export async function DELETE(
  req: NextRequest,
  // @ts-ignore
  { params }: { params: Promise<{ routineId: string }> }
)  {
  const supabase = createServerSupabase();
  const routineId = (await params).routineId;
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!routineId) {
    return NextResponse.json({ error: "Missing routine id" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trainerRows, error: trainerError } = await supabase
    .from("trainer")
    .select("subs")
    .eq("creator_id", user.id)
    .limit(1);

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }

  const subsList = Array.isArray(trainerRows?.[0]?.subs)
    ? (trainerRows?.[0]?.subs as string[])
    : [];

  if (!subsList.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: routineRow, error: fetchRoutineError } = await supabase
    .from("routines")
    .select("id, creator_id, type")
    .eq("id", routineId)
    .single();

  if (fetchRoutineError) {
    return NextResponse.json({ error: fetchRoutineError.message }, { status: 500 });
  }

  if (!routineRow) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  if (routineRow.creator_id !== userId) {
    return NextResponse.json({ error: "Routine not owned by user" }, { status: 403 });
  }

  if (String(routineRow.type || "").toLowerCase() !== "assigned") {
    return NextResponse.json({ error: "Only assigned routines can be deleted" }, { status: 400 });
  }

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id")
    .eq("routine_id", routineId);

  if (exercisesError) {
    return NextResponse.json({ error: exercisesError.message }, { status: 500 });
  }

  const exerciseIds = (exercises ?? []).map((ex: any) => ex.id);

  if (exerciseIds.length) {
    const { error: deleteSetsError } = await supabase
      .from("sets")
      .delete()
      .in("exercise_id", exerciseIds);

    if (deleteSetsError) {
      return NextResponse.json({ error: deleteSetsError.message }, { status: 500 });
    }

    const { error: deleteExercisesError } = await supabase
      .from("exercises")
      .delete()
      .in("id", exerciseIds);

    if (deleteExercisesError) {
      return NextResponse.json({ error: deleteExercisesError.message }, { status: 500 });
    }
  }

  const { error: deleteRoutineError } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId);

  if (deleteRoutineError) {
    return NextResponse.json({ error: deleteRoutineError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
