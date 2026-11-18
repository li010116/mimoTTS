import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeApiKey } from "./api-auth";
import {
  type Asset,
  type AudioFormat,
  type Draft,
  type Generation,
  type Voice,
  initialConfig,
  defaultInstruction,
  exampleText,
  apiBaseUrlSchema,
  defaultApiBaseUrl,
} from "./types";

export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.MIMO_DATA_DIR || "data",
);
export const audioDir = path.join(dataDir, "audio");
mkdirSync(audioDir, { recursive: true });

const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload", { mode: "json" })
    .$type<Voice | Draft | Generation | Asset>()
    .notNull(),
});
type Store = ReturnType<typeof createStore>;
const globalStore = globalThis as unknown as { mimoStore?: Store };

function createStore() {
  const connection = new Database(path.join(dataDir, "studio.sqlite"));
  connection.pragma("journal_mode = WAL");
  connection.exec(
    "CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS records_kind ON records(kind);",
  );
  const database = drizzle(connection);
  const interrupted = database
    .select()
    .from(records)
    .where(eq(records.kind, "generation"))
    .all();
  for (const record of interrupted) {
    const generation = record.payload as Generation;
    if (generation.status === "generating") {
      database
        .update(records)
        .set({
          payload: {
            ...generation,
            status: "failed",
            error: "服务已重启，本次生成中断，请重新生成。",
          },
        })
        .where(eq(records.id, generation.id))
        .run();
    }
  }
  if (!database.select().from(records).where(eq(records.kind, "voice")).get()) {
    const voice: Voice = {
      id: randomUUID(),
      name: "日常旁白",
      instruction: defaultInstruction,
      config: initialConfig,
      isDefault: true,
      createdAt: Date.now(),
    };
    const draft: Draft = {
      id: randomUUID(),
      title: "生活里的小事",
      text: exampleText,
      instruction: defaultInstruction,
      config: initialConfig,
      voiceId: voice.id,
      format: "wav",
      stream: true,
      updatedAt: Date.now(),
    };
    database
      .insert(records)
      .values([
        { id: voice.id, kind: "voice", payload: voice },
        { id: draft.id, kind: "draft", payload: draft },
      ])
      .run();
  }
  return { connection, database };
}

function getStore() {
  return (globalStore.mimoStore ??= createStore());
}
export function listRecords<T extends Voice | Draft | Generation | Asset>(
  kind: string,
): T[] {
  return getStore()
    .database.select()
    .from(records)
    .where(eq(records.kind, kind))
    .all()
    .map((record) => record.payload as T);
}
export function getRecord<T extends Voice | Draft | Generation | Asset>(
  kind: string,
  id: string,
): T | null {
  const record = getStore()
    .database.select()
    .from(records)
    .where(eq(records.id, id))
    .get();
  return record?.kind === kind ? (record.payload as T) : null;
}
export function putRecord(
  kind: string,
  value: Voice | Draft | Generation | Asset,
) {
  getStore()
    .database.insert(records)
    .values({ id: value.id, kind, payload: value })
    .onConflictDoUpdate({ target: records.id, set: { payload: value } })
    .run();
}
export function removeRecord(kind: string, id: string) {
  if (getRecord(kind, id))
    getStore().database.delete(records).where(eq(records.id, id)).run();
}
export function defaultVoice(id: string) {
  const store = getStore();
  const voices = listRecords<Voice>("voice");
  store.connection.transaction(() => {
    for (const voice of voices)
      putRecord("voice", { ...voice, isDefault: voice.id === id });
  })();
}
const secretPath = path.join(dataDir, ".credentials.json");
export function getApiSettings(): { apiKey: string; baseUrl: string } {
  let saved: { apiKey?: unknown; baseUrl?: unknown } = {};
  if (existsSync(secretPath)) {
    try {
      const parsed = JSON.parse(readFileSync(secretPath, "utf8"));
      if (parsed && typeof parsed === "object") saved = parsed;
    } catch {}
  }
  const savedUrl = apiBaseUrlSchema.safeParse(saved.baseUrl);
  const environmentUrl = apiBaseUrlSchema.safeParse(process.env.MIMO_BASE_URL);
  return {
    apiKey:
      (typeof saved.apiKey === "string" ? normalizeApiKey(saved.apiKey) : "") ||
      normalizeApiKey(process.env.MIMO_API_KEY || "") ||
      "",
    baseUrl: savedUrl.success
      ? savedUrl.data
      : environmentUrl.success
        ? environmentUrl.data
        : defaultApiBaseUrl,
  };
}
export function saveApiSettings(update: { apiKey?: string; baseUrl?: string }) {
  const current = getApiSettings();
  const settings = {
    apiKey: normalizeApiKey(update.apiKey || "") || current.apiKey,
    baseUrl: update.baseUrl ?? current.baseUrl,
  };
  const temporary = `${secretPath}.tmp`;
  writeFileSync(temporary, JSON.stringify(settings), { mode: 0o600 });
  renameSync(temporary, secretPath);
  const persisted = getApiSettings();
  if (
    persisted.apiKey !== settings.apiKey ||
    persisted.baseUrl !== settings.baseUrl
  ) {
    throw new Error("配置写入后校验失败，请检查数据目录权限后重试。");
  }
  return {
    configured: Boolean(persisted.apiKey),
    baseUrl: persisted.baseUrl,
    apiKeyLength: persisted.apiKey.length,
  };
}
export function assetPath(asset: Asset) {
  return path.join(audioDir, `${asset.id}.${asset.format}`);
}
export function saveAudio(
  bytes: Buffer,
  format: AudioFormat,
  filename: string,
): Asset {
  const asset: Asset = {
    id: randomUUID(),
    format,
    filename,
    bytes: bytes.length,
    createdAt: Date.now(),
  };
  const destination = assetPath(asset);
  writeFileSync(`${destination}.tmp`, bytes);
  renameSync(`${destination}.tmp`, destination);
  putRecord("asset", asset);
  return asset;
}
