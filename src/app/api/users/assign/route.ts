import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json().catch(() => ({}));
  const targetUserId = String(body?.target_user_id || "").trim();
  const trainerRoutineId = String(body?.trainer_routine_id || "").trim();

  if (!targetUserId || !trainerRoutineId) {
    return NextResponse.json({ error: "Missing target user or routine" }, { status: 400 });
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

  if (!subsList.includes(targetUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: trainerRoutine, error: trainerRoutineError } = await supabase
    .from("routines")
    .select("id, name, type, text, picture, days, weekly, date, duration")
    .eq("id", trainerRoutineId)
    .eq("creator_id", user.id)
    .eq("type", "trainer")
    .single();

  if (trainerRoutineError) {
    return NextResponse.json({ error: trainerRoutineError.message }, { status: 404 });
  }

  const insertPayload = {
    name: trainerRoutine?.name ? `Assigned: ${trainerRoutine.name}` : "Assigned Routine",
    type: "assigned",
    text: trainerRoutine?.text ?? null,
    picture: trainerRoutine?.picture ?? null,
    days: trainerRoutine?.days ?? null,
    weekly: trainerRoutine?.weekly ?? null,
    date: new Date().toISOString(),
    duration: trainerRoutine?.duration ?? null,
    creator_id: targetUserId,
  };

  const { data: newRoutine, error: insertError } = await supabase
    .from("routines")
    .insert(insertPayload)
    .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let copiedExercises = 0;
  let copiedSets = 0;

  const { data: srcExercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, name, text, eCode")
    .eq("routine_id", trainerRoutineId)
    .order("name", { ascending: true });

  if (exercisesError) {
    return NextResponse.json({ error: exercisesError.message }, { status: 500 });
  }

  if (srcExercises && srcExercises.length) {
    for (const exercise of srcExercises as any[]) {
      const { data: insertedExercise, error: insertExerciseError } = await supabase
        .from("exercises")
        .insert({
          name: exercise.name,
          text: exercise.text,
          eCode: exercise.eCode ?? null,
          routine_id: newRoutine.id,
          creator_id: targetUserId,
        })
        .select("id")
        .single();

      if (insertExerciseError) {
        return NextResponse.json({ error: insertExerciseError.message }, { status: 500 });
      }

      copiedExercises += 1;

      const { data: srcSets, error: setsError } = await supabase
        .from("sets")
        .select("reps, weight, completed, pr")
        .eq("exercise_id", exercise.id)
        .order("id", { ascending: true });

      if (setsError) {
        return NextResponse.json({ error: setsError.message }, { status: 500 });
      }

      if (srcSets && srcSets.length) {
        const rows = (srcSets as any[]).map((s) => ({
          reps: s.reps ?? null,
          weight: s.weight ?? null,
          completed: s.completed ?? null,
          pr: s.pr ?? null,
          exercise_id: insertedExercise.id,
          creator_id: targetUserId,
        }));

        const { error: insertSetsError } = await supabase.from("sets").insert(rows);

        if (insertSetsError) {
          return NextResponse.json({ error: insertSetsError.message }, { status: 500 });
        }

        copiedSets += rows.length;
      }
    }
  }

  return NextResponse.json({
    routine: newRoutine,
    copiedExercises,
    copiedSets,
  });
}
