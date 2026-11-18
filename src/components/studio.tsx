"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  History,
  Keyboard,
  LoaderCircle,
  Menu,
  Mic2,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Settings2,
  Sun,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  initialConfig,
  type Draft,
  type Generation,
  type StudioState,
  type ApiSettingsState,
  type Voice,
  defaultInstruction,
  outputMode,
  usesTextPreview,
  voiceLabel,
} from "@/lib/types";
import { type TtsExample } from "@/lib/tts-examples";
import { cn } from "@/lib/utils";
import { readSse } from "@/lib/sse";
import { PcmPlayer } from "@/lib/pcm-player";
import { VoiceControls } from "./voice-controls";
import { Versions } from "./versions";
import { ScriptMenus } from "./script-menus";

type View = "studio" | "voices" | "history" | "settings";
const navigation = [
  { id: "studio" as const, label: "配音工作台", icon: AudioLines },
  { id: "voices" as const, label: "我的声音", icon: Mic2 },
  { id: "history" as const, label: "历史草稿", icon: History },
];
const viewTitles: Record<View, string> = {
  studio: "配音工作台",
  voices: "我的声音",
  history: "历史草稿",
  settings: "设置",
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "操作未完成，请重试。");
  return result;
}

function draftReducer(
  state: Draft | null,
  action:
    { type: "load"; draft: Draft } | { type: "edit"; values: Partial<Draft> },
): Draft | null {
  if (action.type === "load") return action.draft;
  return state ? { ...state, ...action.values, updatedAt: Date.now() } : null;
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="切换亮暗主题"
          title="切换主题"
        >
          <Sun className="theme-sun" />
          <Moon className="theme-moon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <Sun />
            浅色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            深色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            跟随系统
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Studio() {
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["studio"],
    queryFn: () => api<StudioState>("/api/state"),
    refetchInterval: (query) =>
      query.state.data?.generations.some((item) => item.status === "generating")
        ? 2500
        : false,
  });
  const [draft, dispatch] = useReducer(draftReducer, null);
  const [view, setView] = useState<View>("studio");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">(
    "saved",
  );
  const [voiceDialog, setVoiceDialog] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);
  const [helpDialog, setHelpDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const pcmPlayer = useRef<PcmPlayer | null>(null);
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["studio"] });
  }, [queryClient]);

  useEffect(() => {
    if (mobileMenu)
      sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [mobileMenu]);

  useEffect(() => {
    if (!data || draft) return;
    let lastDraft: string | null = null;
    try {
      lastDraft = localStorage.getItem("mimo:last-draft");
    } catch {}
    const existing =
      data.drafts.find((item) => item.id === lastDraft) ?? data.drafts[0];
    if (existing) dispatch({ type: "load", draft: existing });
    else {
      const voice =
        data.voices.find((item) => item.isDefault) ?? data.voices[0];
      dispatch({
        type: "load",
        draft: {
          id: crypto.randomUUID(),
          title: "未命名草稿",
          text: "",
          instruction: voice?.instruction ?? defaultInstruction,
          config: voice?.config ?? initialConfig,
          voiceId: voice?.id ?? null,
          format: "wav",
          stream: true,
          updatedAt: Date.now(),
        },
      });
    }
  }, [data, draft]);

  const persist = useCallback((value: Draft) => {
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() =>
        api("/api/drafts", { method: "POST", body: JSON.stringify(value) }),
      );
    return saveQueue.current;
  }, []);

  useEffect(() => {
    if (!draft) return;
    const currentRevision = ++revision.current;
    setSaveState("saving");
    try {
      localStorage.setItem("mimo:last-draft", draft.id);
    } catch {}
    const timeout = setTimeout(() => {
      void persist(draft)
        .then(() => {
          if (revision.current === currentRevision) setSaveState("saved");
          queryClient.setQueryData<StudioState>(["studio"], (current) =>
            current
              ? {
                  ...current,
                  drafts: [
                    draft,
                    ...current.drafts.filter((item) => item.id !== draft.id),
                  ],
                }
              : current,
          );
        })
        .catch(() => {
          if (revision.current === currentRevision) setSaveState("error");
        });
    }, 650);
    return () => clearTimeout(timeout);
  }, [draft, persist, queryClient]);

  useEffect(() => {
    const stopStream = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== "stream")
        pcmPlayer.current?.stop();
    };
    window.addEventListener("mimo:play", stopStream);
    return () => {
      window.removeEventListener("mimo:play", stopStream);
      pcmPlayer.current?.stop();
    };
  }, []);

  function changeView(next: View) {
    setView(next);
    setMobileMenu(false);
    setSearch("");
  }
  function edit(values: Partial<Draft>) {
    dispatch({ type: "edit", values });
  }
  function loadDraft(value: Draft) {
    if (draft)
      void persist(draft).catch(() =>
        toast.error("上一份草稿保存失败，请检查连接。"),
      );
    dispatch({ type: "load", draft: value });
    changeView("studio");
  }
  function newDraft() {
    const voice =
      data?.voices.find((item) => item.isDefault) ?? data?.voices[0];
    loadDraft({
      id: crypto.randomUUID(),
      title: "未命名草稿",
      text: "",
      instruction: voice?.instruction ?? defaultInstruction,
      config: { ...(voice?.config ?? initialConfig) },
      voiceId: voice?.id ?? null,
      format: "wav",
      stream: true,
      updatedAt: Date.now(),
    });
  }
  function applyExample(example: TtsExample) {
    if (!draft) return;
    const mode = example.mode ?? "preset";
    const referenceId = mode === "clone" ? draft.config.referenceId : null;
    loadDraft({
      id: crypto.randomUUID(),
      title: example.title,
      text: example.text,
      instruction: example.instruction ?? "",
      config: {
        mode,
        preset: example.voice ?? "mimo_default",
        description: example.description ?? "",
        referenceId,
      },
      voiceId: null,
      format: example.format ?? "wav",
      stream: mode === "preset" && Boolean(example.stream),
      compatibilityStream: mode !== "preset" && Boolean(example.stream),
      optimizeTextPreview: example.optimizeTextPreview,
      updatedAt: Date.now(),
    });
    toast.info(mode === "clone" && !referenceId
      ? "已创建案例草稿，请上传一段参考音频。"
      : "已用案例创建新草稿");
  }
  function insertTag(tag: string) {
    if (!draft) return;
    const position = textarea.current?.selectionStart ?? draft.text.length;
    const end = textarea.current?.selectionEnd ?? position;
    const value = `[${tag}]`;
    if (draft.text.length - (end - position) + value.length > 2000) return;
    edit({
      text: draft.text.slice(0, position) + value + draft.text.slice(end),
    });
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(
        position + value.length,
        position + value.length,
      );
    });
  }
  function insertOpeningTag(tag: string) {
    if (!draft) return;
    const text = draft.text.trimStart();
    const prefix = /^(?:\(([^()\r\n]+)\)|（([^（）\r\n]+)）|\[([^\[\]\r\n]+)\])/.exec(text);
    const current = prefix?.slice(1).find(Boolean)?.trim();
    if (current && /^(唱歌|sing|singing)$/i.test(current)) {
      if (tag !== "唱歌") toast.info("唱歌时请把歌词直接放在唱歌标签后。");
      return;
    }
    const singing = tag === "唱歌";
    const style = current && !singing ? `${current} ${tag}` : tag;
    const next = `(${style})${text.slice(prefix?.[0].length ?? 0)}`;
    if (next.length > 2000) {
      toast.error("文案已接近 2,000 字上限，请先缩短。");
      return;
    }
    edit({ text: next });
  }
  function updateGeneration(value: Generation) {
    queryClient.setQueryData<StudioState>(["studio"], (current) =>
      current
        ? {
            ...current,
            generations: [
              value,
              ...current.generations.filter((item) => item.id !== value.id),
            ].sort((a, b) => b.createdAt - a.createdAt),
          }
        : current,
    );
  }
  async function generateAudio() {
    if (!draft || generating || (!draft.text.trim() && !usesTextPreview(draft))) return;
    if (!data?.configured) {
      changeView("settings");
      toast.info("配置 MiMo API Key 后，就可以生成第一段配音。");
      return;
    }
    if (draft.config.mode === "design" && !draft.config.description.trim()) {
      toast.error("先描述一下你想要的音色。");
      return;
    }
    if (draft.config.mode === "clone" && !draft.config.referenceId) {
      toast.error("先上传一段参考音频。");
      return;
    }
    const snapshot = structuredClone(draft);
    setGenerating(true);
    pcmPlayer.current?.stop();
    let streamPlayer: PcmPlayer | null = null;
    let terminal = false;
    try {
      if (outputMode(snapshot) === "live") {
        streamPlayer = new PcmPlayer();
        pcmPlayer.current = streamPlayer;
        try {
          await streamPlayer.start();
        } catch {
          streamPlayer.stop();
          streamPlayer = null;
          toast.info("实时试听暂不可用，完成后可播放音频。");
        }
      }
      await persist(snapshot);
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
      for await (const raw of readSse(response)) {
        const event = JSON.parse(raw);
        if (event.type === "audio") streamPlayer?.push(event.data);
        if (event.generation) updateGeneration(event.generation);
        if (event.type === "completed") {
          terminal = true;
          streamPlayer?.finish();
          toast.success("配音已生成，试着听听这一版。");
        }
        if (event.type === "failed") {
          terminal = true;
          streamPlayer?.stop();
          toast.error(event.generation.error);
        }
      }
      if (!terminal)
        throw new Error("连接已中断，请在版本列表中查看生成状态。");
    } catch (error) {
      streamPlayer?.stop();
      toast.error(
        error instanceof Error ? error.message : "生成失败，请重试。",
      );
    } finally {
      setGenerating(false);
      refresh();
    }
  }

  async function favorite(generation: Generation) {
    try {
      const updated = await api<Generation>(
        `/api/generations/${generation.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ favorite: !generation.favorite }),
        },
      );
      updateGeneration(updated);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  async function rename(generation: Generation, name: string) {
    try {
      const updated = await api<Generation>(
        `/api/generations/${generation.id}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      updateGeneration(updated);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  }
  function restore(generation: Generation) {
    if (generating) return;
    const parameters = {
      text: generation.text,
      instruction: generation.instruction,
      config: { ...generation.config },
      format: generation.format,
      ...(generation.stream !== undefined ? { stream: generation.stream } : {}),
      compatibilityStream: generation.compatibilityStream,
      optimizeTextPreview: generation.optimizeTextPreview,
      voiceId: null,
    };
    if (view !== "studio") {
      const original = data?.drafts.find(
        (item) => item.id === generation.draftId,
      );
      if (original) {
        loadDraft({
          ...original,
          ...parameters,
        });
        toast.success(`已恢复「${generation.name}」的文案和参数`);
        return;
      }
    }
    edit(parameters);
    changeView("studio");
    toast.success(`已恢复「${generation.name}」的文案和参数`);
  }
  async function saveVoice(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !voiceName.trim()) return;
    if (draft.config.mode === "design" && !draft.config.description.trim()) {
      toast.error("请先填写音色描述。");
      return;
    }
    if (draft.config.mode === "clone" && !draft.config.referenceId) {
      toast.error("请先上传参考音频。");
      return;
    }
    setSavingVoice(true);
    try {
      const voice = await api<Voice>("/api/voices", {
        method: "POST",
        body: JSON.stringify({
          name: voiceName.trim(),
          instruction: draft.instruction,
          config: draft.config,
        }),
      });
      edit({ voiceId: voice.id });
      refresh();
      setVoiceDialog(false);
      toast.success("声音已保存，可以反复使用了。");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingVoice(false);
    }
  }

  const currentVersions =
    data?.generations.filter((item) => item.draftId === draft?.id) ?? [];
  const defaultSavedVoice = data?.voices.find(
    (item) => item.id === draft?.voiceId,
  );

  return (
    <div
      className="studio-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mobileMenu) setMobileMenu(false);
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter" &&
          view === "studio"
        ) {
          event.preventDefault();
          void generateAudio();
        }
        if (
          event.key.toLowerCase() === "n" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !(event.target instanceof HTMLInputElement) &&
          !(event.target instanceof HTMLTextAreaElement) &&
          !(event.target as HTMLElement).isContentEditable &&
          !voiceDialog &&
          !helpDialog
        ) {
          event.preventDefault();
          newDraft();
        }
      }}
    >
      <AnimatePresence>
        {mobileMenu && (
          <motion.button
            type="button"
            className="nav-backdrop"
            aria-label="关闭导航"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenu(false)}
          />
        )}
      </AnimatePresence>
      <aside
        ref={sidebar}
        className={cn("sidebar", mobileMenu && "sidebar-open")}
        aria-label="主导航"
      >
        <a
          href="/"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            changeView("studio");
          }}
        >
          <AudioLines strokeWidth={2.3} />
          <span>
            MiMo<span className="brand-studio"> Studio</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">我</span>
          <span>个人工作区</span>
          <span className="workspace-local">本地</span>
        </div>
        <Button variant="outline" className="new-draft" onClick={newDraft}>
          <Plus data-icon="inline-start" />
          新建配音<span className="shortcut-hint">N</span>
        </Button>
        <nav className="primary-nav">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={cn("nav-item", view === item.id && "nav-active")}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => changeView(item.id)}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="recent-section">
          <div className="sidebar-section-label">
            <span>最近草稿</span>
            <button
              type="button"
              aria-label="查看所有草稿"
              onClick={() => changeView("history")}
            >
              <MoreHorizontal />
            </button>
          </div>
          <div className="recent-drafts">
            {data?.drafts.slice(0, 4).map((item) => (
              <button
                type="button"
                key={item.id}
                className={cn(
                  "recent-draft",
                  draft?.id === item.id && view === "studio" && "recent-active",
                )}
                onClick={() => loadDraft(item)}
              >
                <FileText />
                <span>{item.title}</span>
              </button>
            ))}
            {isPending && <Skeleton className="h-7 w-full" />}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Headphones />
            <strong>找到你的声音</strong>
            <p>
              保存喜欢的音色，
              <br />
              让每一次表达都熟悉。
            </p>
            <button type="button" onClick={() => changeView("voices")}>
              管理我的声音
              <ArrowUpRight />
            </button>
          </div>
          <button
            type="button"
            className={cn("nav-item", view === "settings" && "nav-active")}
            onClick={() => changeView("settings")}
          >
            <Settings2 />
            <span>设置</span>
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => setHelpDialog(true)}
          >
            <CircleHelp />
            <span>使用帮助</span>
          </button>
          <div className="sidebar-footer">
            <span className="local-dot" />
            本地工作区<span>MiMo TTS</span>
          </div>
        </div>
      </aside>
      <div className="app-main" inert={mobileMenu}>
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon-sm"
              className="mobile-menu-button"
              aria-label="打开导航"
              onClick={() => setMobileMenu(true)}
            >
              <Menu />
            </Button>
            <span>个人工作区</span>
            <ChevronRight />
            <strong>{viewTitles[view]}</strong>
          </div>
          <div className="topbar-actions">
            <a
              href="https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5"
              target="_blank"
              rel="noreferrer"
              className="docs-link"
            >
              <BookOpen />
              文档
              <ArrowUpRight />
            </a>
            <Separator orientation="vertical" />
            <ThemeSwitch />
            <button
              type="button"
              className="account-button"
              aria-label="打开工作区设置"
              onClick={() => changeView("settings")}
            >
              我
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          <div className="page-heading">
            <div>
              <h1>{viewTitles[view]}</h1>
              <p>
                {view === "studio"
                  ? "写下文字，慢慢调出你喜欢的声音。"
                  : view === "voices"
                    ? "熟悉的声音，让每一次表达都有自己的样子。"
                    : view === "history"
                      ? "每一次尝试，都留在这里。"
                      : "让工作台适合你的使用习惯。"}
              </p>
            </div>
            {view === "studio" && (
              <Button
                variant="outline"
                onClick={() => {
                  setVoiceName(
                    defaultSavedVoice?.name
                      ? `${defaultSavedVoice.name} · 新预设`
                      : "我的声音",
                  );
                  setVoiceDialog(true);
                }}
                disabled={!draft}
              >
                <BookmarkPlus data-icon="inline-start" />
                保存声音
              </Button>
            )}
            {view === "voices" && (
              <Button
                variant="outline"
                onClick={() => {
                  changeView("studio");
                  setVoiceName("我的新声音");
                  setVoiceDialog(true);
                }}
              >
                <Plus />
                保存当前声音
              </Button>
            )}
          </div>
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>工作区加载失败</AlertTitle>
              <AlertDescription>
                请检查本地服务是否运行。
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void refetch();
                  }}
                >
                  重新加载
                </Button>
              </AlertDescription>
            </Alert>
          ) : !data || !draft ? (
            <div className="loading-layout">
              <Skeleton className="loading-editor" />
              <Skeleton className="loading-settings" />
            </div>
          ) : (
            <>
              {view === "studio" && (
                <>
                  <div className="workspace-grid">
                    <div className="editor-column">
                      <section
                        className="panel editor-panel"
                        aria-label="配音文案编辑器"
                      >
                        <div className="editor-toolbar">
                          <div>
                            <FileText />
                            <Input
                              aria-label="草稿名称"
                              value={draft.title}
                              maxLength={80}
                              onChange={(event) =>
                                edit({
                                  title: event.target.value || "未命名草稿",
                                })
                              }
                              className="draft-title"
                            />
                          </div>
                          <button
                            type="button"
                            className={cn(
                              "save-status",
                              saveState === "error" && "save-error",
                            )}
                            onClick={() => {
                              void persist(draft)
                                .then(() => setSaveState("saved"))
                                .catch(() => setSaveState("error"));
                            }}
                            aria-label="保存草稿"
                          >
                            {saveState === "saving" ? (
                              <LoaderCircle className="spin" />
                            ) : saveState === "saved" ? (
                              <Check />
                            ) : (
                              <CircleAlert />
                            )}
                            {saveState === "saving"
                              ? "保存中"
                              : saveState === "saved"
                                ? "已保存"
                                : "保存失败，点击重试"}
                          </button>
                        </div>
                        <div className="editor-paper">
                          <label htmlFor="script" className="editor-label">
                            配音文案
                          </label>
                          <Textarea
                            ref={textarea}
                            id="script"
                            value={draft.text}
                            maxLength={2000}
                            placeholder={usesTextPreview(draft)
                              ? "输入要润色的台词，或留空由 MiMo 写稿"
                              : "在这里写下，想让声音传达的文字……"}
                            onChange={(event) =>
                              edit({ text: event.target.value })
                            }
                            className="script-textarea"
                          />
                          <div className="editor-paper-footer">
                            <span>让标点成为声音里的呼吸。</span>
                            <span>
                              {Array.from(draft.text).length}
                              <span className="count-limit"> / 2,000 字</span>
                            </span>
                          </div>
                        </div>
                        <div className="script-tools">
                          <ScriptMenus
                            singingAvailable={draft.config.mode === "preset"}
                            onSing={() => insertOpeningTag("唱歌")}
                            onStyle={insertOpeningTag}
                            onInlineTag={insertTag}
                            onExample={applyExample}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="查看快捷键"
                            onClick={() => setHelpDialog(true)}
                          >
                            <Keyboard />
                          </Button>
                        </div>
                        <div className="editor-generate">
                          <div className="generation-context">
                            <span className="context-dot" />
                            <span>
                              {defaultSavedVoice?.name ??
                                voiceLabel(draft.config)}
                            </span>
                            <span className="context-divider">/</span>
                            <span>{draft.format.toUpperCase()}</span>
                            {outputMode(draft) === "live" && (
                                <span className="stream-label">
                                  <Radio />
                                  实时试听
                                </span>
                              )}
                          </div>
                          <Button
                            size="lg"
                            className="generate-button"
                            disabled={generating || (!draft.text.trim() && !usesTextPreview(draft))}
                            onClick={() => {
                              void generateAudio();
                            }}
                          >
                            {generating ? (
                              <LoaderCircle className="spin" />
                            ) : (
                              <AudioLines />
                            )}
                            <span>{generating ? "正在生成" : "生成配音"}</span>
                            <kbd>Ctrl ↵</kbd>
                          </Button>
                        </div>
                      </section>
                      <Versions
                        generations={currentVersions}
                        onFavorite={(generation) => {
                          void favorite(generation);
                        }}
                        onRestore={restore}
                        onRename={rename}
                        generating={generating}
                      />
                    </div>
                    <VoiceControls
                      draft={draft}
                      voices={data.voices}
                      assets={data.assets}
                      onChange={edit}
                      onSave={() => {
                        setVoiceName("我的声音");
                        setVoiceDialog(true);
                      }}
                      onRefresh={refresh}
                    />
                  </div>
                  <div className="workspace-footer">
                    <span>
                      <Volume2 />
                      每一次微调，都离理想的声音更近一点。
                    </span>
                    <button
                      type="button"
                      onClick={() => changeView("settings")}
                    >
                      <span
                        className={cn(
                          "api-dot",
                          data.configured && "api-configured",
                        )}
                      />
                      {data.configured ? "API 已配置" : "配置 API Key"}
                      <ArrowUpRight />
                    </button>
                  </div>
                </>
              )}
              {view === "voices" && (
                <div className="voice-library">
                  {data.voices.map((voice) => (
                    <article className="panel library-voice" key={voice.id}>
                      <div className="library-voice-heading">
                        <div className="voice-monogram peach">
                          {voiceLabel(voice.config).slice(0, 1)}
                        </div>
                        <div>
                          <h2>{voice.name}</h2>
                          <span>
                            {voiceLabel(voice.config)} ·{" "}
                            {voice.config.mode === "preset"
                              ? "预置音色"
                              : voice.config.mode === "design"
                                ? "声音设计"
                                : "声音克隆"}
                          </span>
                        </div>
                        {voice.isDefault && (
                          <span className="default-label">
                            <Check />
                            默认声音
                          </span>
                        )}
                      </div>
                      <p>
                        {voice.config.description ||
                          voice.instruction ||
                          "自然表达，保留声音本来的样子。"}
                      </p>
                      <div className="library-actions">
                        <Button
                          variant="outline"
                          onClick={() => {
                            edit({
                              voiceId: voice.id,
                              config: { ...voice.config },
                              instruction: voice.instruction,
                            });
                            changeView("studio");
                          }}
                        >
                          使用这个声音
                          <ArrowUpRight />
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={voice.isDefault}
                          onClick={async () => {
                            try {
                              await api(`/api/voices/${voice.id}`, {
                                method: "PATCH",
                                body: "{}",
                              });
                              refresh();
                              toast.success("默认声音已更新");
                            } catch (error) {
                              toast.error((error as Error).message);
                            }
                          }}
                        >
                          设为默认
                        </Button>
                      </div>
                    </article>
                  ))}
                  <button
                    type="button"
                    className="add-voice-panel"
                    onClick={() => {
                      edit({ voiceId: null, config: { ...initialConfig } });
                      changeView("studio");
                    }}
                  >
                    <Plus />
                    <strong>寻找一个新声音</strong>
                    <span>选择音色、描述声音，或上传参考音频</span>
                  </button>
                </div>
              )}
              {view === "history" && (
                <div className="history-view">
                  <div className="history-toolbar">
                    <div className="search-input">
                      <Search />
                      <Input
                        aria-label="搜索草稿"
                        placeholder="搜索草稿或文案…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <Button
                      variant={onlyFavorites ? "secondary" : "ghost"}
                      onClick={() => setOnlyFavorites(!onlyFavorites)}
                      aria-pressed={onlyFavorites}
                    >
                      <Bookmark />
                      只看收藏
                    </Button>
                  </div>
                  <div className="panel drafts-list">
                    {data.drafts
                      .filter(
                        (item) =>
                          (!search ||
                            `${item.title}${item.text}`
                              .toLowerCase()
                              .includes(search.toLowerCase())) &&
                          (!onlyFavorites ||
                            data.generations.some(
                              (generation) =>
                                generation.draftId === item.id &&
                                generation.favorite,
                            )),
                      )
                      .map((item) => (
                        <button
                          type="button"
                          className="draft-list-row"
                          key={item.id}
                          onClick={() => loadDraft(item)}
                        >
                          <FileText />
                          <div>
                            <strong>{item.title}</strong>
                            <p>
                              {item.text.replace(/\n/g, " ") ||
                                "还没有写下文案"}
                            </p>
                          </div>
                          <span>
                            {new Date(item.updatedAt).toLocaleDateString(
                              "zh-CN",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                          <ChevronRight />
                        </button>
                      ))}
                    {data.drafts.filter(
                      (item) =>
                        (!search ||
                          `${item.title}${item.text}`
                            .toLowerCase()
                            .includes(search.toLowerCase())) &&
                        (!onlyFavorites ||
                          data.generations.some(
                            (generation) =>
                              generation.draftId === item.id &&
                              generation.favorite,
                          )),
                    ).length === 0 && (
                      <Empty>
                        <EmptyHeader>
                          <EmptyTitle>没有找到草稿</EmptyTitle>
                          <EmptyDescription>
                            换个关键词，或新建一份配音。
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>
                </div>
              )}
              {view === "settings" && (
                <SettingsView
                  configured={data.configured}
                  baseUrl={data.baseUrl}
                  apiKeyLength={data.apiKeyLength ?? 0}
                  onSaved={(settings) => {
                    queryClient.setQueryData<StudioState>(
                      ["studio"],
                      (current) => current ? { ...current, ...settings } : current,
                    );
                    refresh();
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
      <Dialog open={voiceDialog} onOpenChange={setVoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存为我的声音</DialogTitle>
            <DialogDescription>
              保存当前音色和演绎要求，下次直接使用。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              void saveVoice(event);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="voice-name">声音名称</FieldLabel>
                <Input
                  id="voice-name"
                  value={voiceName}
                  maxLength={40}
                  onChange={(event) => setVoiceName(event.target.value)}
                  placeholder="例如，日常旁白、温柔讲述"
                  required
                  autoFocus
                />
              </Field>
              <FieldDescription>
                声音保存后，可在「我的声音」中设为默认。
              </FieldDescription>
            </FieldGroup>
            <DialogFooter className="dialog-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVoiceDialog(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={savingVoice || !voiceName.trim()}>
                {savingVoice ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <BookmarkPlus />
                )}
                保存声音
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={helpDialog} onOpenChange={setHelpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>把一句话，调到刚刚好</DialogTitle>
            <DialogDescription>
              写下文案，选择声音，再用演绎要求调整表达。
            </DialogDescription>
          </DialogHeader>
          <div className="help-content">
            <p>
              <strong>先选声音</strong>
              <span>
                预置音色开箱即用，也可以用文字设计音色或上传参考音频。
              </span>
            </p>
            <p>
              <strong>再调演绎</strong>
              <span>
                用自然语言描述语气、语速、重音与停顿，正文中可插入情绪标签。
              </span>
            </p>
            <p>
              <strong>比较版本</strong>
              <span>每次生成会保留文案与参数，选择两个版本进行 A/B 试听。</span>
            </p>
            <Separator />
            <div className="shortcut-row">
              <span>生成配音</span>
              <kbd>Ctrl / ⌘ + Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span>关闭弹窗</span>
              <kbd>Esc</kbd>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" asChild>
              <a
                href="https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5"
                target="_blank"
                rel="noreferrer"
              >
                查看 MiMo 文档
                <ArrowUpRight />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function readConnectionForm(form: HTMLFormElement) {
  const values = new FormData(form);
  return {
    apiKey: String(values.get("apiKey") ?? ""),
    baseUrl: String(values.get("baseUrl") ?? ""),
  };
}

function SettingsView({
  configured,
  baseUrl,
  apiKeyLength,
  onSaved,
}: {
  configured: boolean;
  baseUrl: string;
  apiKeyLength: number;
  onSaved: (settings: ApiSettingsState) => void;
}) {
  const keyInput = useRef<HTMLInputElement>(null);
  const [showKey, setShowKey] = useState(false);
  const [inputKeyLength, setInputKeyLength] = useState(0);
  const [endpoint, setEndpoint] = useState(baseUrl);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="settings-view">
      <section className="settings-section">
        <div>
          <h2>API 连接</h2>
          <p>配置配音服务的地址和 API Key。</p>
        </div>
        <form
          className="panel settings-panel"
          autoComplete="off"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || testingConnection) return;
            const values = readConnectionForm(event.currentTarget);
            setEndpoint(values.baseUrl);
            setConnectionResult(null);
            setSaving(true);
            try {
              const saved = await api<ApiSettingsState>("/api/settings", {
                method: "POST",
                body: JSON.stringify(values),
              });
              if (keyInput.current) keyInput.current.value = "";
              setInputKeyLength(0);
              setShowKey(false);
              setEndpoint(saved.baseUrl);
              onSaved(saved);
              toast.success("API 连接设置已保存");
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <div className="settings-label-row">
                <FieldLabel htmlFor="api-key">API Key</FieldLabel>
                <div className="api-key-actions">
                  <span
                    className={cn(
                      "configuration-status",
                      configured && "configured",
                    )}
                  >
                    {configured ? "已保存" : "待配置"}
                    {configured && apiKeyLength > 0 && ` · ${apiKeyLength} 字符`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={showKey ? "隐藏输入的 Key" : "显示输入的 Key"}
                    disabled={saving || testingConnection}
                    onClick={() => {
                      setInputKeyLength(keyInput.current?.value.length ?? 0);
                      setShowKey((visible) => !visible);
                    }}
                  >
                    {showKey ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <Input
                id="api-key"
                name="apiKey"
                ref={keyInput}
                type={showKey ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                defaultValue=""
                onInput={(event) => {
                  setInputKeyLength(event.currentTarget.value.length);
                  setConnectionResult(null);
                }}
                placeholder={
                  configured ? "已配置，留空保留原 Key" : "输入 API Key"
                }
                disabled={saving || testingConnection}
              />
              <FieldDescription>
                Key 保存在本机服务端，调用时由服务端携带。
                {inputKeyLength > 0 && ` 本次输入 ${inputKeyLength} 个字符。`}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="api-endpoint">服务地址</FieldLabel>
              <Input
                id="api-endpoint"
                name="baseUrl"
                type="url"
                value={endpoint}
                onChange={(event) => {
                  setEndpoint(event.target.value);
                  setConnectionResult(null);
                }}
                placeholder="https://api.xiaomimimo.com/v1"
                maxLength={2048}
                disabled={saving || testingConnection}
                required
              />
              <FieldDescription>
                填写基础地址（如 https://example.com/v1），也支持完整的
                /chat/completions 地址。
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="settings-actions">
            <a
              href="https://platform.xiaomimimo.com"
              target="_blank"
              rel="noreferrer"
            >
              前往 MiMo 获取 Key
              <ArrowUpRight />
            </a>
            <div className="settings-action-buttons">
              <Button
                type="button"
                variant="outline"
                disabled={saving || testingConnection || !endpoint.trim()}
                onClick={async (event) => {
                  const form = event.currentTarget.form;
                  if (!form || !form.reportValidity()) return;
                  const values = readConnectionForm(form);
                  setEndpoint(values.baseUrl);
                  setTestingConnection(true);
                  setConnectionResult(null);
                  try {
                    const result = await api<{
                      message: string;
                      latencyMs: number;
                    }>("/api/settings/test", {
                      method: "POST",
                      body: JSON.stringify(values),
                    });
                    setConnectionResult({
                      success: true,
                      message: `${result.message} 耗时 ${result.latencyMs} ms。`,
                    });
                  } catch (error) {
                    setConnectionResult({
                      success: false,
                      message:
                        error instanceof Error
                          ? error.message
                          : "连接失败，请稍后重试。",
                    });
                  } finally {
                    setTestingConnection(false);
                  }
                }}
              >
                {testingConnection ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <Radio />
                )}
                {testingConnection ? "测试中…" : "测试连接"}
              </Button>
              <Button
                type="submit"
                disabled={saving || testingConnection || !endpoint.trim()}
              >
                {saving ? <LoaderCircle className="spin" /> : <Check />}保存配置
              </Button>
            </div>
          </div>
          {connectionResult && (
            <Alert
              variant={connectionResult.success ? "default" : "destructive"}
              className="connection-test-result"
              data-success={connectionResult.success}
              role="status"
              aria-live="polite"
            >
              {connectionResult.success ? <Check /> : <CircleAlert />}
              <AlertDescription>{connectionResult.message}</AlertDescription>
            </Alert>
          )}
        </form>
      </section>
      <section className="settings-section">
        <div>
          <h2>外观</h2>
          <p>选择适合此刻的工作环境。</p>
        </div>
        <div className="panel settings-panel">
          <FieldGroup>
            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="theme-setting">主题模式</FieldLabel>
                <FieldDescription>偏好会在当前浏览器中保存。</FieldDescription>
              </div>
              {mounted ? (
                <Select value={theme ?? "system"} onValueChange={setTheme}>
                  <SelectTrigger id="theme-setting" className="theme-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="system">跟随系统</SelectItem>
                      <SelectItem value="light">浅色</SelectItem>
                      <SelectItem value="dark">深色</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-9 w-32" />
              )}
            </Field>
          </FieldGroup>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>关于工作区</h2>
          <p>属于你的声音与配音草稿。</p>
        </div>
        <div className="panel settings-panel">
          <div className="about-row">
            <span>数据存储</span>
            <strong>本地 SQLite 与音频文件</strong>
          </div>
          <Separator />
          <div className="about-row">
            <span>语音服务</span>
            <strong>Xiaomi MiMo · V2.5 TTS</strong>
          </div>
          <Separator />
          <div className="about-row">
            <span>工作台版本</span>
            <strong>0.1.0</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
