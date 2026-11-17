import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  assetPath,
  defaultVoice,
  getApiKey,
  getRecord,
  listRecords,
  putRecord,
  removeRecord,
  saveApiKey,
  saveAudio,
} from "@/lib/store";
import { generate } from "@/lib/generate";
import {
  draftSchema,
  saveVoiceSchema,
  type Asset,
  type Draft,
  type Generation,
  type Voice,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const missing = () =>
  Response.json({ error: "找不到这条记录。" }, { status: 404 });

function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    if (new URL(origin).host === host) return null;
  } catch {}
  return Response.json({ error: "请从工作台页面发起操作。" }, { status: 403 });
}

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  if (path[0] === "state") {
    return Response.json(
      {
        voices: listRecords<Voice>("voice"),
        drafts: listRecords<Draft>("draft").sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
        generations: listRecords<Generation>("generation").sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
        assets: listRecords<Asset>("asset"),
        configured: Boolean(getApiKey()),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (path[0] === "assets" && path[1]) {
    const asset = getRecord<Asset>("asset", path[1]);
    if (!asset) return missing();
    let bytes: Buffer;
    try {
      bytes = readFileSync(assetPath(asset));
    } catch {
      return missing();
    }
    const headers: Record<string, string> = {
      "Content-Type": `audio/${asset.format === "mp3" ? "mpeg" : "wav"}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": bytes.length.toString(),
      "X-Content-Type-Options": "nosniff",
    };
    if (new URL(request.url).searchParams.has("download"))
      headers["Content-Disposition"] =
        `attachment; filename="mimo-${asset.id.slice(0, 8)}.${asset.format}"`;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${bytes.length}` },
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, bytes.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), bytes.length - 1)
          : bytes.length - 1;
      if (start > end || start >= bytes.length)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${bytes.length}` },
        });
      headers["Content-Range"] = `bytes ${start}-${end}/${bytes.length}`;
      headers["Content-Length"] = (end - start + 1).toString();
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status: 206,
        headers,
      });
    }
    return new Response(new Uint8Array(bytes), { headers });
  }
  return missing();
}

export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { path } = await context.params;
  try {
    if (path[0] === "generations") return await generate(request);
    if (path[0] === "drafts") {
      const draft = {
        ...draftSchema.parse(await request.json()),
        updatedAt: Date.now(),
      };
      putRecord("draft", draft);
      return Response.json(draft);
    }
    if (path[0] === "voices") {
      const values = saveVoiceSchema.parse(await request.json());
      const existing = values.id ? getRecord<Voice>("voice", values.id) : null;
      const voice: Voice = {
        ...values,
        id: values.id ?? randomUUID(),
        isDefault: existing?.isDefault ?? false,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      putRecord("voice", voice);
      return Response.json(voice);
    }
    if (path[0] === "settings") {
      const { apiKey } = z
        .object({ apiKey: z.string().trim().min(8).max(512) })
        .parse(await request.json());
      saveApiKey(apiKey);
      return Response.json({ configured: true });
    }
    if (path[0] === "assets") {
      const form = await request.formData();
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 7.5 * 1024 * 1024
      )
        return Response.json(
          { error: "请上传小于 7.5 MB 的 MP3 或 WAV 文件。" },
          { status: 400 },
        );
      const bytes = Buffer.from(await file.arrayBuffer());
      const wav =
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WAVE";
      const mp3 =
        bytes.toString("ascii", 0, 3) === "ID3" ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224);
      if (!wav && !mp3)
        return Response.json(
          { error: "文件内容不是有效的 MP3 或 WAV 音频。" },
          { status: 400 },
        );
      return Response.json(
        saveAudio(bytes, wav ? "wav" : "mp3", file.name.slice(0, 100)),
      );
    }
    return missing();
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { error: "提交的内容有误，请检查后重试。" },
        { status: 400 },
      );
    return Response.json(
      { error: "操作未完成，请稍后重试。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { path } = await context.params;
  const id = path[1];
  if (!id) return missing();
  try {
    if (path[0] === "voices") {
      if (!getRecord<Voice>("voice", id)) return missing();
      defaultVoice(id);
      return Response.json({ ok: true });
    }
    if (path[0] === "generations") {
      const generation = getRecord<Generation>("generation", id);
      if (!generation) return missing();
      const update = z
        .object({
          favorite: z.boolean().optional(),
          name: z.string().trim().min(1).max(60).optional(),
        })
        .parse(await request.json());
      putRecord("generation", { ...generation, ...update });
      return Response.json({ ...generation, ...update });
    }
    return missing();
  } catch {
    return Response.json({ error: "修改内容有误。" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { path } = await context.params;
  if (!path[1]) return missing();
  if (path[0] === "drafts") {
    removeRecord("draft", path[1]);
    return Response.json({ ok: true });
  }
  if (path[0] === "voices") {
    const voices = listRecords<Voice>("voice");
    if (voices.length < 2)
      return Response.json({ error: "请至少保留一个声音。" }, { status: 400 });
    const current = getRecord<Voice>("voice", path[1]);
    removeRecord("voice", path[1]);
    if (current?.isDefault)
      defaultVoice(voices.find((voice) => voice.id !== path[1])!.id);
    return Response.json({ ok: true });
  }
  return missing();
}
