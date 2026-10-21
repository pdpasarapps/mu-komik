import { CopyObjectCommand, DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parsePageTextOverlayDocument } from "@/lib/page-text-overlays";

export const runtime = "nodejs";

type ChapterPage = {
  id: string;
  object_key: string;
  text_overlays: unknown;
};

function createStorageClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function rewriteSoundKeys(value: unknown, keyMap: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteSoundKeys(item, keyMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      key === "soundObjectKey" && typeof item === "string" ? keyMap.get(item) ?? item : rewriteSoundKeys(item, keyMap),
    ]));
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const requiredEnv = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "R2_ACCOUNT_ID",
      "R2_BUCKET_NAME",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ] as const;
    const missing = requiredEnv.filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({ error: "Required environment variables are missing", missing }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

    const body = await request.json() as {
      sourceComicId?: string;
      destinationComicId?: string;
      chapterId?: string;
    };
    if (!body.sourceComicId || !body.destinationComicId || !body.chapterId
      || body.sourceComicId === body.destinationComicId) {
      return NextResponse.json({ error: "Source, destination, and chapter are required" }, { status: 400 });
    }

    let comicsQuery = supabase
      .from("comics")
      .select("id")
      .in("id", [body.sourceComicId, body.destinationComicId]);
    if (profile.role !== "admin") comicsQuery = comicsQuery.eq("creator_id", userData.user.id);
    const { data: comics, error: comicsError } = await comicsQuery;
    if (comicsError) {
      return NextResponse.json({ error: "Could not verify comic ownership" }, { status: 500 });
    }
    if (!comics?.some((comic) => comic.id === body.sourceComicId)
      || !comics.some((comic) => comic.id === body.destinationComicId)) {
      return NextResponse.json({ error: "Source or destination comic not found" }, { status: 404 });
    }

    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .select("id, comic_id, chapter_number, audio_object_key")
      .eq("id", body.chapterId)
      .eq("comic_id", body.sourceComicId)
      .maybeSingle();
    if (chapterError) {
      return NextResponse.json({ error: "Could not read chapter" }, { status: 500 });
    }
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found in source comic" }, { status: 404 });
    }

    const sourcePrefix = `comics/${body.sourceComicId}/chapters/${chapter.id}/`;
    const destinationPrefix = `comics/${body.destinationComicId}/chapters/${chapter.id}/`;
    if (chapter.audio_object_key && !chapter.audio_object_key.startsWith(`${sourcePrefix}audio/`)) {
      return NextResponse.json({ error: "Chapter contains an invalid audio storage key" }, { status: 500 });
    }

    const { data: pages, error: pagesError } = await supabase
      .from("pages")
      .select("id, object_key, text_overlays")
      .eq("chapter_id", chapter.id)
      .order("page_number", { ascending: true });
    if (pagesError) {
      return NextResponse.json({ error: "Could not read chapter pages" }, { status: 500 });
    }
    const sourceKeys = new Set<string>();
    const keyMap = new Map<string, string>();
    const pageSnapshots: ChapterPage[] = pages ?? [];
    for (const page of pageSnapshots) {
      if (!page.object_key.startsWith(sourcePrefix)) {
        return NextResponse.json({ error: "Chapter contains an invalid page storage key" }, { status: 500 });
      }
      sourceKeys.add(page.object_key);
      let markers;
      try {
        markers = parsePageTextOverlayDocument(page.text_overlays).interactiveMarkers;
      } catch (error) {
        console.error("Unable to validate interactive sounds before moving chapter:", error);
        return NextResponse.json({ error: "Interactive page data could not be verified" }, { status: 500 });
      }
      const interactivePrefix = `${sourcePrefix}pages/${page.id}/interactive/`;
      for (const marker of markers) {
        if (!marker.soundObjectKey) continue;
        if (!marker.soundObjectKey.startsWith(interactivePrefix)
          || !/^[a-f0-9-]{36}\.(mp3|ogg)$/i.test(marker.soundObjectKey.slice(interactivePrefix.length))) {
          return NextResponse.json({ error: "Chapter contains an invalid interactive audio key" }, { status: 500 });
        }
        keyMap.set(marker.soundObjectKey, marker.soundObjectKey.replace(sourcePrefix, destinationPrefix));
        sourceKeys.add(marker.soundObjectKey);
      }
    }
    if (chapter.audio_object_key) sourceKeys.add(chapter.audio_object_key);

    const { data: destinationChapters, error: destinationChaptersError } = await supabase
      .from("chapters")
      .select("chapter_number")
      .eq("comic_id", body.destinationComicId)
      .order("chapter_number", { ascending: false })
      .limit(1);
    if (destinationChaptersError) {
      return NextResponse.json({ error: "Could not determine destination chapter number" }, { status: 500 });
    }
    const destinationChapterNumber = Math.floor(destinationChapters?.[0]?.chapter_number ?? 0) + 1;
    const storage = createStorageClient();
    const copiedKeys: string[] = [];
    const cleanupCopies = async () => {
      if (!copiedKeys.length) return;
      try {
        await storage.send(new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Delete: { Objects: copiedKeys.map((key) => ({ Key: key })), Quiet: true },
        }));
      } catch (error) {
        console.error("Could not remove copied assets after failed chapter move:", error);
      }
    };

    try {
      for (const sourceKey of sourceKeys) {
        const destinationKey = sourceKey.replace(sourcePrefix, destinationPrefix);
        await storage.send(new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          CopySource: encodeURIComponent(`${process.env.R2_BUCKET_NAME}/${sourceKey}`).replace(/%2F/g, "/"),
          Key: destinationKey,
          MetadataDirective: "COPY",
        }));
        copiedKeys.push(destinationKey);
      }
    } catch (error) {
      await cleanupCopies();
      throw error;
    }

    const updatedPages: string[] = [];
    for (const page of pageSnapshots) {
      const overlays = keyMap.size ? rewriteSoundKeys(page.text_overlays, keyMap) : page.text_overlays;
      const { error } = await supabase
        .from("pages")
        .update({
          object_key: page.object_key.replace(sourcePrefix, destinationPrefix),
          text_overlays: overlays,
        })
        .eq("id", page.id)
        .eq("chapter_id", chapter.id);
      if (error) {
        let rollbackFailed = false;
        for (const updatedPage of updatedPages) {
          const snapshot = pageSnapshots.find((item) => item.id === updatedPage)!;
          const { error: rollbackError } = await supabase.from("pages")
            .update({ object_key: snapshot.object_key, text_overlays: snapshot.text_overlays })
            .eq("id", snapshot.id)
            .eq("chapter_id", chapter.id);
          rollbackFailed ||= Boolean(rollbackError);
        }
        await cleanupCopies();
        return NextResponse.json({
          error: rollbackFailed ? "Chapter move failed and some page data could not be restored" : "Chapter pages could not be moved",
        }, { status: 500 });
      }
      updatedPages.push(page.id);
    }

    const { data: movedChapter, error: moveError } = await supabase
      .from("chapters")
      .update({
        comic_id: body.destinationComicId,
        chapter_number: destinationChapterNumber,
        audio_object_key: chapter.audio_object_key
          ? chapter.audio_object_key.replace(sourcePrefix, destinationPrefix)
          : null,
      })
      .eq("id", chapter.id)
      .eq("comic_id", body.sourceComicId)
      .select("id")
      .maybeSingle();
    if (moveError || !movedChapter) {
      let rollbackFailed = false;
      for (const page of pageSnapshots) {
        const { error } = await supabase.from("pages")
          .update({ object_key: page.object_key, text_overlays: page.text_overlays })
          .eq("id", page.id)
          .eq("chapter_id", chapter.id);
        rollbackFailed ||= Boolean(error);
      }
      await cleanupCopies();
      return NextResponse.json({
        error: rollbackFailed ? "Chapter move failed and some page data could not be restored" : moveError?.message || "Chapter could not be moved",
      }, { status: 500 });
    }

    let storageCleanupPending = false;
    try {
      for (let index = 0; index < sourceKeys.size; index += 1000) {
        const oldKeys = Array.from(sourceKeys).slice(index, index + 1000);
        const result = await storage.send(new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Delete: { Objects: oldKeys.map((key) => ({ Key: key })), Quiet: true },
        }));
        if (result.Errors?.length) storageCleanupPending = true;
      }
    } catch (error) {
      console.error("Could not remove source assets after moving chapter:", error);
      storageCleanupPending = true;
    }

    return NextResponse.json({
      moved: true,
      chapterNumber: destinationChapterNumber,
      storageCleanupPending,
    });
  } catch (error) {
    console.error("Chapter move error", error);
    return NextResponse.json({ error: "Could not move chapter" }, { status: 500 });
  }
}
