import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase environment variables are missing" }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: "Could not read creator profile" }, { status: 500 });
    }
    if (profile?.role !== "creator" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Creator access required" }, { status: 403 });
    }

    const body = await request.json() as { comicId?: string; chapterIds?: string[] };
    if (!body.comicId || !Array.isArray(body.chapterIds)
      || body.chapterIds.some((id) => typeof id !== "string")
      || new Set(body.chapterIds).size !== body.chapterIds.length) {
      return NextResponse.json({ error: "Comic and unique chapter IDs are required" }, { status: 400 });
    }

    let comicQuery = supabase.from("comics").select("id").eq("id", body.comicId);
    if (profile.role !== "admin") comicQuery = comicQuery.eq("creator_id", userData.user.id);
    const { data: comic, error: comicError } = await comicQuery.maybeSingle();
    if (comicError) {
      return NextResponse.json({ error: "Could not verify comic ownership" }, { status: 500 });
    }
    if (!comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("id, chapter_number")
      .eq("comic_id", comic.id)
      .order("chapter_number", { ascending: true });
    if (chaptersError) {
      return NextResponse.json({ error: "Could not read comic chapters" }, { status: 500 });
    }
    const orderedIds = body.chapterIds;
    if (chapters?.length !== orderedIds.length
      || chapters.some((chapter) => !orderedIds.includes(chapter.id))) {
      return NextResponse.json({ error: "The submitted chapter order does not match this comic" }, { status: 409 });
    }
    if (!chapters?.length) return NextResponse.json({ reordered: true, chapters: [] });

    const originalNumbers = new Map(chapters.map((chapter) => [chapter.id, chapter.chapter_number]));
    const temporaryBase = Math.max(...chapters.map((chapter) => chapter.chapter_number)) + chapters.length + 1;
    const updateChapterNumber = async (id: string, chapterNumber: number) => {
      const { error } = await supabase
        .from("chapters")
        .update({ chapter_number: chapterNumber })
        .eq("id", id)
        .eq("comic_id", comic.id);
      return error;
    };
    const restoreOrder = async () => {
      const ids = Array.from(originalNumbers.keys());
      for (const [index, id] of ids.entries()) {
        const error = await updateChapterNumber(id, temporaryBase + index);
        if (error) return error;
      }
      for (const [id, chapterNumber] of originalNumbers) {
        const error = await updateChapterNumber(id, chapterNumber);
        if (error) return error;
      }
      return null;
    };

    for (const [index, id] of chapters.map((chapter) => chapter.id).entries()) {
      const error = await updateChapterNumber(id, temporaryBase + index);
      if (error) {
        const rollbackError = await restoreOrder();
        return NextResponse.json({
          error: rollbackError ? "Chapter order could not be restored" : error.message,
        }, { status: 500 });
      }
    }

    const updated: Array<{ id: string; chapter_number: number }> = [];
    for (const [index, id] of orderedIds.entries()) {
      const chapterNumber = index + 1;
      const error = await updateChapterNumber(id, chapterNumber);
      if (error) {
        const rollbackError = await restoreOrder();
        return NextResponse.json({
          error: rollbackError ? "Chapter order could not be restored" : error.message,
        }, { status: 500 });
      }
      updated.push({ id, chapter_number: chapterNumber });
    }

    return NextResponse.json({ reordered: true, chapters: updated });
  } catch (error) {
    console.error("Chapter reorder error", error);
    return NextResponse.json({ error: "Could not reorder chapters" }, { status: 500 });
  }
}
