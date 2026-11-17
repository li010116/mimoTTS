"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  Download,
  GitCompareArrows,
  Headphones,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Star,
  X,
  CircleAlert,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { type Generation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";

export function Versions({
  generations,
  onFavorite,
  onRestore,
  onRename,
  generating,
}: {
  generations: Generation[];
  onFavorite: (generation: Generation) => void;
  onRestore: (generation: Generation) => void;
  onRename: (generation: Generation, name: string) => Promise<void>;
  generating: boolean;
}) {
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Generation | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const visible = favoritesOnly
    ? generations.filter((item) => item.favorite)
    : generations;
  const selected = compare
    .map((id) => generations.find((item) => item.id === id))
    .filter((item): item is Generation => Boolean(item));

  return (
    <section className="versions-section" aria-label="生成版本">
      <div className="versions-heading">
        <div className="heading-with-count">
          <h2>试听与版本</h2>
          <span>{generations.length}</span>
        </div>
        <div className="version-filters">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            aria-pressed={favoritesOnly}
          >
            <Star fill={favoritesOnly ? "currentColor" : "none"} />
            收藏
          </Button>
          <span className="compare-hint">
            <GitCompareArrows />
            选择两个版本对比
          </span>
        </div>
      </div>
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            className="compare-tray panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className="compare-title">
              <strong>A/B 试听</strong>
              <span>
                {selected.length === 1
                  ? "再选择一个版本"
                  : "点击播放，比较两次演绎"}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCompare([])}
                aria-label="关闭版本对比"
              >
                <X />
              </Button>
            </div>
            <div className="compare-grid">
              {selected.map((generation, index) => (
                <div key={generation.id}>
                  <div className="compare-label">
                    <Badge variant="secondary">{index === 0 ? "A" : "B"}</Badge>
                    <strong>{generation.name}</strong>
                    <span>{generation.voiceName}</span>
                  </div>
                  {generation.assetId && (
                    <AudioPlayer
                      assetId={generation.assetId}
                      label={`${index === 0 ? "A" : "B"} 版本`}
                      initialDuration={generation.duration}
                    />
                  )}
                  <p>{generation.instruction || "默认演绎"}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {visible.length === 0 ? (
        <Empty className="versions-empty">
          <EmptyHeader>
            <Headphones aria-hidden="true" />
            <EmptyTitle>
              {favoritesOnly ? "还没有收藏的版本" : "好声音，值得多试几次"}
            </EmptyTitle>
            <EmptyDescription>
              {favoritesOnly
                ? "点击版本旁的星标，留下喜欢的演绎。"
                : "生成第一版配音后，在这里试听、比较，找到最喜欢的表达。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="version-list">
          <AnimatePresence initial={false}>
            {visible.map((generation) => (
              <motion.article
                layout
                key={generation.id}
                className={cn(
                  "version-row",
                  compare.includes(generation.id) && "version-selected",
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="version-topline">
                  <div className="version-title">
                    <strong>{generation.name}</strong>
                    {generation.status === "generating" && (
                      <span className="generation-status">
                        <LoaderCircle className="spin" />
                        生成中
                      </span>
                    )}
                    {generation.status === "failed" && (
                      <span className="failure-status">
                        <CircleAlert />
                        生成失败
                      </span>
                    )}
                    <span className="version-date">
                      {new Date(generation.createdAt).toLocaleTimeString(
                        "zh-CN",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                  </div>
                  <div className="version-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${generation.favorite ? "取消收藏" : "收藏"}${generation.name}`}
                      onClick={() => onFavorite(generation)}
                    >
                      <Star
                        className={cn(generation.favorite && "starred")}
                        fill={generation.favorite ? "currentColor" : "none"}
                      />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${generation.name}更多操作`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={generating}
                            onSelect={() => onRestore(generation)}
                          >
                            <RotateCcw />
                            恢复此版本参数
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenaming(generation);
                              setName(generation.name);
                            }}
                          >
                            <Pencil />
                            重命名
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="version-body">
                  <div className="version-info">
                    <span>{generation.voiceName}</span>
                    <span>·</span>
                    <span>{generation.format.toUpperCase()}</span>
                    {generation.elapsed !== null && (
                      <>
                        <span>·</span>
                        <span>耗时 {generation.elapsed.toFixed(1)} 秒</span>
                      </>
                    )}
                    <p>{generation.instruction || "默认演绎"}</p>
                  </div>
                  <div className="version-playback">
                    {generation.assetId ? (
                      <AudioPlayer
                        assetId={generation.assetId}
                        label={generation.name}
                        initialDuration={generation.duration}
                      />
                    ) : (
                      <p
                        className="version-message"
                        role={
                          generation.status === "failed" ? "alert" : "status"
                        }
                      >
                        {generation.error ?? "正在为文字注入声音……"}
                      </p>
                    )}
                  </div>
                  <div className="version-download">
                    {generation.status === "completed" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${compare.includes(generation.id) ? "移除对比" : "加入对比"}${generation.name}`}
                          aria-pressed={compare.includes(generation.id)}
                          onClick={() =>
                            setCompare((current) =>
                              current.includes(generation.id)
                                ? current.filter((id) => id !== generation.id)
                                : [...current.slice(-1), generation.id],
                            )
                          }
                        >
                          {compare.includes(generation.id) ? (
                            <Check />
                          ) : (
                            <GitCompareArrows />
                          )}
                        </Button>
                        <Button asChild variant="ghost" size="icon-sm">
                          <a
                            href={`/api/assets/${generation.assetId}?download=1`}
                            download
                            aria-label={`下载${generation.name}`}
                          >
                            <Download />
                          </a>
                        </Button>
                      </>
                    )}
                    {generation.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={generating}
                        onClick={() => onRestore(generation)}
                      >
                        恢复参数
                        <ArrowUpRight />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名版本</DialogTitle>
            <DialogDescription>
              给这次满意的演绎起个容易找到的名字。
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renaming || !name.trim()) return;
              setSaving(true);
              try {
                await onRename(renaming, name.trim());
                setRenaming(null);
              } catch {
                // The caller shows the error; keep the dialog available to retry.
              } finally {
                setSaving(false);
              }
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="version-name">版本名称</FieldLabel>
                <Input
                  id="version-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  required
                  autoFocus
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="dialog-actions">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "保存中" : "保存名称"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
