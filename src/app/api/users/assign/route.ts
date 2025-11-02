import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  const body = await req.json().catch(() => ({}));

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!jwt) {
    return NextResponse.json({ error: "Missing auth session" }, { status: 401 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const normUUID = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === "string" && UUID_RE.test(v.trim())) return v.trim();
    if (typeof v === "object" && typeof v.id === "string" && UUID_RE.test(v.id.trim())) return v.id.trim();
    return null;
  };
  const targetUserId = normUUID(body?.target_user_id);
  const trainerRoutineId = normUUID(body?.trainer_routine_id);
  const rawRepeatDays = body?.repeat_days;
  const rawRepeatWeekly = body?.repeat_weekly;
  const rawAssignedDate = typeof body?.assigned_date === 'string' ? body.assigned_date : null;

  if (!targetUserId || !trainerRoutineId) {
    return NextResponse.json({ error: "Invalid or missing target_user_id or trainer_routine_id" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(jwt);
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trainerRow, error: trainerError } = await admin
    .from("trainer")
    .select("trainer_id")
    .eq("creator_id", user.id)
    .contains("subs", [targetUserId])
    .maybeSingle();

  if (trainerError) {
    return NextResponse.json({ error: trainerError.message }, { status: 500 });
  }
  if (!trainerRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: trainerRoutine, error: trainerRoutineError } = await admin
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
    days: (() => {
      if (typeof rawRepeatDays === 'number' && Number.isFinite(rawRepeatDays) && rawRepeatDays > 0) {
        return Math.trunc(rawRepeatDays);
      }
      if (typeof rawRepeatDays === 'string' && rawRepeatDays.trim()) {
        const parsed = Number(rawRepeatDays);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.trunc(parsed);
        }
      }
      return trainerRoutine?.days ?? null;
    })(),
    weekly: (() => {
      if (typeof rawRepeatWeekly === 'number' && Number.isFinite(rawRepeatWeekly) && rawRepeatWeekly > 0) {
        return Math.trunc(rawRepeatWeekly);
      }
      if (typeof rawRepeatWeekly === 'string' && rawRepeatWeekly.trim()) {
        const parsed = Number(rawRepeatWeekly);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.trunc(parsed);
        }
      }
      return trainerRoutine?.weekly ?? null;
    })(),
    date: (() => {
      if (rawAssignedDate) {
        try {
          const parsed = new Date(rawAssignedDate);
          if (!Number.isNaN(parsed.valueOf())) {
            return parsed.toISOString();
          }
        } catch {}
      }
      return new Date().toISOString();
    })(),
    duration: trainerRoutine?.duration ?? null,
    creator_id: targetUserId,
  };

  if (insertPayload.days && insertPayload.days > 0) {
    insertPayload.weekly = null;
  }
  if (insertPayload.weekly && insertPayload.weekly > 0) {
    insertPayload.days = null;
  }

  const { data: newRoutine, error: insertError } = await admin
    .from("routines")
    .insert(insertPayload)
    .select("id, name, type, text, picture, days, weekly, date, duration, creator_id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let copiedExercises = 0;
  let copiedSets = 0;

  const { data: srcExercises, error: exercisesError } = await admin
    .from("exercises")
    .select("id, name, text, eCode")
    .eq("routine_id", trainerRoutineId)
    .order("name", { ascending: true });

  if (exercisesError) {
    return NextResponse.json({ error: exercisesError.message }, { status: 500 });
  }

  if (srcExercises && srcExercises.length) {
    for (const exercise of srcExercises as any[]) {
      const { data: insertedExercise, error: insertExerciseError } = await admin
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

      const { data: srcSets, error: setsError } = await admin
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

        const { error: insertSetsError } = await admin.from("sets").insert(rows);

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
