"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AudioLines,
  BookmarkPlus,
  Check,
  FileAudio,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import {
  type Asset,
  type Draft,
  type Voice,
  type VoiceMode,
  presetVoices,
} from "@/lib/types";
import { AudioPlayer } from "./audio-player";

const tones = [
  {
    label: "自然",
    instruction: "自然、亲切，像与朋友轻松聊天。语速适中，表达流畅。",
  },
  {
    label: "温柔",
    instruction: "自然、温柔，像与朋友分享日常。语速舒缓，句间留一点呼吸感。",
  },
  {
    label: "活力",
    instruction: "明亮、有活力，带着愉快的笑意。语速稍快，重点词语清晰有力。",
  },
  {
    label: "沉稳",
    instruction: "沉稳、从容，声音有分量。语速稍慢，句尾干净，停顿自然。",
  },
];

export function VoiceControls({
  draft,
  voices,
  assets,
  onChange,
  onSave,
  onRefresh,
}: {
  draft: Draft;
  voices: Voice[];
  assets: Asset[];
  onChange: (value: Partial<Draft>) => void;
  onSave: () => void;
  onRefresh: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const reference = assets.find(
    (asset) => asset.id === draft.config.referenceId,
  );
  const currentPreset = presetVoices.find(
    (voice) => voice.id === draft.config.preset,
  );
  const savedVoice = voices.find((voice) => voice.id === draft.voiceId);
  const updateConfig = (value: Partial<Draft["config"]>) =>
    onChange({ config: { ...draft.config, ...value } });
  const streamingAvailable =
    draft.config.mode === "preset" && draft.format === "wav";

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/assets", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      updateConfig({ referenceId: result.id });
      onRefresh();
      toast.success("参考音频已保存");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "上传失败，请重试。",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <aside className="voice-controls" aria-label="声音与演绎设置">
      <section className="panel voice-panel">
        <div className="panel-heading">
          <h2>声音</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="保存当前声音"
            title="保存当前声音"
            onClick={onSave}
          >
            <BookmarkPlus />
          </Button>
        </div>
        <Select
          value={draft.voiceId ?? "custom"}
          onValueChange={(id) => {
            const voice = voices.find((value) => value.id === id);
            if (voice)
              onChange({
                voiceId: voice.id,
                config: { ...voice.config },
                instruction: voice.instruction,
              });
          }}
        >
          <SelectTrigger
            className="saved-voice-select"
            aria-label="选择我的声音"
          >
            <SelectValue placeholder="选择我的声音" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.name}
                  {voice.isDefault ? " · 默认" : ""}
                </SelectItem>
              ))}
              {!savedVoice && (
                <SelectItem value="custom">自定义声音</SelectItem>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Tabs
          value={draft.config.mode}
          onValueChange={(mode) => updateConfig({ mode: mode as VoiceMode })}
          className="voice-tabs"
        >
          <TabsList className="voice-mode-list">
            <TabsTrigger value="preset">预置音色</TabsTrigger>
            <TabsTrigger value="design">声音设计</TabsTrigger>
            <TabsTrigger value="clone">声音克隆</TabsTrigger>
          </TabsList>
          <TabsContent value="preset">
            <div className="voice-identity">
              <div
                className={`voice-monogram ${currentPreset?.color ?? "peach"}`}
              >
                {draft.config.preset.slice(0, 1)}
              </div>
              <div>
                <strong>{draft.config.preset}</strong>
                <span>
                  {currentPreset?.description} · {currentPreset?.gender}
                </span>
              </div>
              <AudioLines aria-hidden="true" />
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="preset-voice" className="sr-only">
                  预置音色
                </FieldLabel>
                <Select
                  value={draft.config.preset}
                  onValueChange={(preset) => updateConfig({ preset })}
                >
                  <SelectTrigger id="preset-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {presetVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.id} · {voice.language}
                          {voice.gender}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="design">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="voice-description">
                  描述你想要的声音
                </FieldLabel>
                <Textarea
                  id="voice-description"
                  value={draft.config.description}
                  maxLength={2000}
                  placeholder="例如，二十多岁的女性，声音温暖清透，带一点气声，像深夜电台的主持人。"
                  onChange={(event) =>
                    updateConfig({ description: event.target.value })
                  }
                  className="voice-description"
                />
                <FieldDescription>
                  年龄、质感和说话习惯，越具体越贴近预期。
                </FieldDescription>
              </Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="clone">
            <input
              ref={fileInput}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              className="sr-only"
              aria-label="上传参考音频"
              onChange={(event) => {
                void upload(event.target.files?.[0]);
              }}
            />
            <AnimatePresence mode="wait">
              {reference ? (
                <motion.div
                  key={reference.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="reference-audio"
                >
                  <div className="reference-name">
                    <FileAudio />
                    <span>{reference.filename}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="移除参考音频"
                      onClick={() => updateConfig({ referenceId: null })}
                    >
                      <X />
                    </Button>
                  </div>
                  <AudioPlayer assetId={reference.id} label="参考音频" />
                </motion.div>
              ) : (
                <motion.button
                  key="upload"
                  type="button"
                  className="upload-zone"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {uploading ? <LoaderCircle className="spin" /> : <Upload />}
                  <strong>{uploading ? "正在上传" : "上传参考音频"}</strong>
                  <span>MP3 / WAV，最大 7.5 MB</span>
                </motion.button>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
        <div className="voice-note">
          <Check />
          {savedVoice
            ? `已载入「${savedVoice.name}」`
            : "保存后可在下次配音时复用"}
        </div>
      </section>

      <section className="panel performance-panel">
        <div className="panel-heading">
          <h2>本次演绎</h2>
          <span className="quiet-label">让表达更贴近你</span>
        </div>
        <ToggleGroup
          type="single"
          value={
            tones.find((tone) => tone.instruction === draft.instruction)
              ?.label ?? ""
          }
          onValueChange={(label) => {
            const tone = tones.find((value) => value.label === label);
            if (tone) onChange({ instruction: tone.instruction });
          }}
          className="tone-options"
          aria-label="演绎风格"
        >
          {tones.map((tone) => (
            <ToggleGroupItem key={tone.label} value={tone.label}>
              {tone.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="instruction" className="sr-only">
              演绎要求
            </FieldLabel>
            <Textarea
              id="instruction"
              maxLength={2000}
              value={draft.instruction}
              onChange={(event) =>
                onChange({ instruction: event.target.value })
              }
              placeholder="描述语气、语速、停顿和情绪……"
              className="instruction-input"
            />
          </Field>
        </FieldGroup>
        <p className="control-hint">试着加一句“最后一句带一点笑意”。</p>
        <Separator />
        <FieldGroup className="output-fields">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="output-format">输出格式</FieldLabel>
            <Select
              value={draft.format}
              onValueChange={(format) =>
                onChange({ format: format as "wav" | "mp3" })
              }
            >
              <SelectTrigger id="output-format" className="format-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="mp3">MP3</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <div>
              <FieldLabel htmlFor="streaming">边生成边试听</FieldLabel>
              <FieldDescription>
                {streamingAvailable
                  ? "生成时即时听见声音"
                  : "当前模式将在生成后播放"}
              </FieldDescription>
            </div>
            <Switch
              id="streaming"
              checked={draft.stream && streamingAvailable}
              onCheckedChange={(stream) => onChange({ stream })}
              disabled={!streamingAvailable}
            />
          </Field>
        </FieldGroup>
      </section>
    </aside>
  );
}
