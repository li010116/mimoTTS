import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  draftSchema,
  modelForMode,
  voiceLabel,
  type Asset,
  type Generation,
  type Voice,
} from "./types";
import {
  assetPath,
  getApiKey,
  getRecord,
  listRecords,
  putRecord,
  saveAudio,
} from "./store";
import { readSse } from "./sse";

function pcmToWav(pcm: Buffer) {
  if (pcm.length % 2) throw new Error("返回的音频数据不完整，请重试。");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
function wavDuration(audio: Buffer): number | null {
  if (
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  )
    return null;
  let byteRate = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const kind = audio.toString("ascii", offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    if (kind === "fmt " && size >= 16 && offset + 24 <= audio.length)
      byteRate = audio.readUInt32LE(offset + 16);
    if (kind === "data") dataSize += Math.min(size, audio.length - offset - 8);
    offset += 8 + size + (size % 2);
  }
  return byteRate ? dataSize / byteRate : null;
}

export async function generate(request: Request) {
  const parsed = draftSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "文案或声音设置有误，请检查后重试。" },
      { status: 400 },
    );
  const draft = parsed.data;
  if (!draft.text.trim())
    return Response.json(
      { error: "先写一段想要朗读的文字。" },
      { status: 400 },
    );
  const apiKey = getApiKey();
  if (!apiKey)
    return Response.json(
      { error: "请先在设置中配置 MiMo API Key。" },
      { status: 422 },
    );
  const config = draft.config;
  if (config.mode === "design" && !config.description.trim())
    return Response.json({ error: "请填写音色描述。" }, { status: 400 });
  let reference: string | undefined;
  if (config.mode === "clone") {
    const asset = config.referenceId
      ? getRecord<Asset>("asset", config.referenceId)
      : null;
    if (!asset)
      return Response.json(
        { error: "请上传 MP3 或 WAV 参考音频。" },
        { status: 400 },
      );
    const bytes = readFileSync(assetPath(asset));
    const encoded = bytes.toString("base64");
    if (encoded.length > 10 * 1024 * 1024)
      return Response.json(
        { error: "参考音频编码后超过 10 MB，请使用更短的样本。" },
        { status: 400 },
      );
    reference = `data:audio/${asset.format === "mp3" ? "mpeg" : "wav"};base64,${encoded}`;
  }
  const voice = draft.voiceId ? getRecord<Voice>("voice", draft.voiceId) : null;
  const generation: Generation = {
    id: randomUUID(),
    draftId: draft.id,
    name: `版本 ${listRecords<Generation>("generation").filter((item) => item.draftId === draft.id).length + 1}`,
    text: draft.text,
    instruction: draft.instruction,
    config,
    voiceName: voice?.name ?? voiceLabel(config),
    format: draft.format,
    status: "generating",
    assetId: null,
    duration: null,
    elapsed: null,
    favorite: false,
    error: null,
    createdAt: Date.now(),
  };
  putRecord("draft", { ...draft, updatedAt: Date.now() });
  putRecord("generation", generation);
  const streaming =
    draft.stream && config.mode === "preset" && draft.format === "wav";
  const instruction = [
    config.mode === "design" ? config.description : "",
    draft.instruction,
  ]
    .filter(Boolean)
    .join("\n");
  const body = {
    model: modelForMode(config.mode),
    messages: [
      ...(instruction ? [{ role: "user", content: instruction }] : []),
      { role: "assistant", content: draft.text },
    ],
    audio: {
      format: streaming ? "pcm16" : draft.format,
      ...(config.mode === "preset" ? { voice: config.preset } : {}),
      ...(reference ? { voice: reference } : {}),
    },
    stream: streaming,
  };
  const encoder = new TextEncoder();
  let connected = true;
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => {
        if (!connected) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          connected = false;
        }
      };
      emit({ type: "started", generation });
      try {
        const response = await fetch(
          "https://api.xiaomimimo.com/v1/chat/completions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(180000),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          const errors: Record<number, string> = {
            401: "API Key 验证失败，请在设置中检查。",
            402: "账户余额或额度不足，请到 MiMo 平台检查。",
            403: "当前 API Key 没有调用此模型的权限。",
            429: "请求过于频繁，请稍后再试。",
          };
          throw new Error(
            errors[response.status] ??
              `MiMo 服务返回 ${response.status}，请检查输入或稍后重试。`,
          );
        }
        let bytes: Buffer;
        let duration: number | null = null;
        if (streaming) {
          const chunks: Buffer[] = [];
          let received = 0;
          let finished = false;
          for await (const data of readSse(response)) {
            if (data === "[DONE]") {
              finished = true;
              break;
            }
            const chunk = JSON.parse(data);
            if (chunk.error)
              throw new Error("MiMo 未能完成本次生成，请稍后重试。");
            const choice = chunk.choices?.[0];
            if (choice?.finish_reason === "stop") finished = true;
            if (
              choice?.finish_reason === "content_filter" ||
              choice?.finish_reason === "length"
            )
              throw new Error("本次生成未完整完成，请调整文案后重试。");
            const audio = choice?.delta?.audio?.data;
            if (typeof audio === "string" && audio) {
              const pcm = Buffer.from(audio, "base64");
              received += pcm.length;
              if (received > 64 * 1024 * 1024)
                throw new Error("音频超过单次生成大小限制。");
              chunks.push(pcm);
              emit({ type: "audio", data: audio });
            }
          }
          const pcm = Buffer.concat(chunks);
          if (!pcm.length)
            throw new Error("MiMo 没有返回音频，请调整输入后重试。");
          if (!finished)
            throw new Error("音频传输中断，本次生成未完整完成，请重试。");
          bytes = pcmToWav(pcm);
          duration = pcm.length / 48000;
        } else {
          const result = await response.json();
          const choice = result.choices?.[0];
          if (
            choice?.finish_reason === "content_filter" ||
            choice?.finish_reason === "length"
          )
            throw new Error("本次生成未完整完成，请调整文案后重试。");
          const data = choice?.message?.audio?.data;
          if (typeof data !== "string" || !data)
            throw new Error("MiMo 没有返回音频，请调整输入后重试。");
          bytes = Buffer.from(data, "base64");
          duration = draft.format === "wav" ? wavDuration(bytes) : null;
        }
        const asset = saveAudio(
          bytes,
          draft.format,
          `${generation.name}.${draft.format}`,
        );
        const completed: Generation = {
          ...generation,
          status: "completed",
          assetId: asset.id,
          duration,
          elapsed: (Date.now() - generation.createdAt) / 1000,
        };
        putRecord("generation", completed);
        emit({ type: "completed", generation: completed });
      } catch (error) {
        const message =
          error instanceof Error &&
          error.name !== "TimeoutError" &&
          error.name !== "TypeError"
            ? error.message
            : "连接 MiMo 超时或网络不可用，请稍后重试。";
        const failed: Generation = {
          ...generation,
          status: "failed",
          error: message,
          elapsed: (Date.now() - generation.createdAt) / 1000,
        };
        putRecord("generation", failed);
        emit({ type: "failed", generation: failed });
      } finally {
        if (connected) {
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      connected = false;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
