export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";


export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);
  const { target_trainer_id, target_user_id, source_routine_ids } = await req.json();

  if (!target_trainer_id || !target_user_id || !Array.isArray(source_routine_ids) || !source_routine_ids.length) {
    return NextResponse.json(
      { error: "target_trainer_id, target_user_id, and source_routine_ids are required" },
      { status: 400 }
    );
  }

  try {
    const copiedRoutines: any[] = [];

    for (const routineId of source_routine_ids) {
      if (!routineId) continue;
      const { data: routine, error: routineError } = await admin
        .from("routines")
        .select("id, name, text, duration, days, weekly, type, creator_id")
        .eq("id", routineId)
        .limit(1)
        .single();

      if (routineError || !routine) {
        continue;
      }

      const insertPayload = {
        name: routine.name ? String(routine.name) : "Imported routine",
        text: routine.text ?? null,
        duration: routine.duration ?? null,
        days: routine.days ?? null,
        weekly: routine.weekly ?? null,
        type: "trainer",
        creator_id: target_user_id,
        date: new Date().toISOString(),
      };

      const { data: newRoutine, error: insertError } = await admin
        .from("routines")
        .insert(insertPayload)
        .select("id, name, text, duration, type, date")
        .single();

      if (insertError || !newRoutine) {
        continue;
      }

      const { data: exercises } = await admin
        .from("exercises")
        .select("id, name, text, eCode")
        .eq("routine_id", routine.id)
        .order("id", { ascending: true });

      if (Array.isArray(exercises) && exercises.length) {
        for (const exercise of exercises) {
          const { data: newExercise, error: exerciseError } = await admin
            .from("exercises")
            .insert({
              name: exercise.name,
              text: exercise.text,
              eCode: exercise.eCode ?? null,
              routine_id: newRoutine.id,
              creator_id: target_user_id,
            })
            .select("id")
            .single();

          if (exerciseError || !newExercise) {
            continue;
          }

          const { data: sets } = await admin
            .from("sets")
            .select("reps, weight, completed, pr")
            .eq("exercise_id", exercise.id)
            .order("id", { ascending: true });

          if (Array.isArray(sets) && sets.length) {
            const rows = sets.map((s: any) => ({
              reps: s.reps ?? null,
              weight: s.weight ?? null,
              completed: s.completed ?? null,
              pr: s.pr ?? null,
              exercise_id: newExercise.id,
              creator_id: target_user_id,
            }));
            await admin.from("sets").insert(rows);
          }
        }
      }

      copiedRoutines.push(newRoutine);
    }

    return NextResponse.json({ routines: copiedRoutines });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unable to import routines" }, { status: 500 });
  }
}
