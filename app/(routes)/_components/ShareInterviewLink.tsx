"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Copy, Loader2, Mail, Share2 } from "lucide-react";

type ShareInterviewLinkProps = {
  interviewId: string;
  jobTitle?: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
};

const DEFAULT_EXPIRY_SECONDS = 48 * 60 * 60;
const PRIMARY_BLUE = "#1E90FF";
const PRIMARY_BLUE_DARK = "#1176D6";
const PRIMARY_BLUE_LIGHT = "#E6F3FF";

export function ShareInterviewLink({
  interviewId,
  jobTitle,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
  onContinue,
  continueLabel = "Edit questions",
  className,
}: ShareInterviewLinkProps) {
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

  const isControlled = useMemo(() => typeof open === "boolean", [open]);
  const dialogOpen = isControlled ? !!open : internalOpen;

  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  const createLink = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/shorten", {
        interviewId,
        expiresInSeconds: DEFAULT_EXPIRY_SECONDS,
        maxUses: 1,
        startAutomatically: true,
      });

      setShortUrl(response.data?.shortUrl);
      setToken(response.data?.token);
      toast.success("Shareable link ready");
    } catch (error: any) {
      console.error("Short link creation failed", error);
      toast.error(
        error?.response?.data?.error || "Could not create short link right now"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dialogOpen && !shortUrl && !loading) {
      createLink();
    }
  }, [dialogOpen, shortUrl, loading, interviewId]);

  useEffect(() => {
    setShortUrl(null);
    setToken(null);
  }, [interviewId]);

  const handleCopy = async () => {
    if (!shortUrl) {
      toast.error("Create the link first");
      return;
    }
    try {
      await navigator.clipboard.writeText(shortUrl);
      toast.success("Link copied");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("Could not copy link");
    }
  };

  const handleShare = async () => {
    if (!shortUrl) {
      toast.error("Create the link first");
      return;
    }
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: jobTitle ?? "Interview link",
          text: "Join your Matryc interview with this link.",
          url: shortUrl,
        });
        return;
      } catch (err) {
        console.warn("Web share failed, falling back to copy", err);
      }
    }
    await handleCopy();
  };

  const handleEmail = () => {
    if (!shortUrl) {
      toast.error("Create the link first");
      return;
    }
    if (!email.trim()) {
      toast.error("Enter an email to send");
      return;
    }
    const subject = encodeURIComponent("Matryc interview invite");
    const body = encodeURIComponent(
      `Hi,\n\nHere is your interview link:\n${shortUrl}\n\nThe link may expire after first use or in 48 hours.\n\nThanks!`
    );
    window.location.href = `mailto:${encodeURIComponent(
      email.trim()
    )}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={cn("sm:max-w-lg", className)}>
        <DialogHeader>
          <DialogTitle>Share interview link</DialogTitle>
          <DialogDescription>
            Generate a short, single-use link to start the interview
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-[#E0EEFF] bg-[#F7FBFF] px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#0F3B66]">Short URL</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-2 text-[#1E90FF] hover:bg-[#E6F3FF]"
                onClick={createLink}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Refresh
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-[#1E90FF]/10">
              <span className="min-w-0 flex-1 truncate">
                {shortUrl ?? "Generating link..."}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                disabled={!shortUrl}
                aria-label="Copy link"
                className="shrink-0 text-[#1E90FF] hover:bg-[#E6F3FF]"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {token && (
              <p className="mt-2 text-xs text-[#0F3B66]">
                Token: <span className="font-semibold text-[#1E90FF]">{token}</span> • Expires in 48h •
                One-time use
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="flex-1 border border-[#1E90FF] bg-[#1E90FF] text-white shadow-sm transition hover:bg-[#1176D6]"
              onClick={handleShare}
              disabled={!shortUrl}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-[#1E90FF] text-[#1E90FF] transition hover:bg-[#E6F3FF]"
              onClick={handleCopy}
              disabled={!shortUrl}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-gray-500">
              Send via email
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="candidate@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="bg-[#1E90FF] text-white hover:bg-[#1176D6]"
                onClick={handleEmail}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[#B5DAFF] bg-[#E6F3FF] px-4 py-3 text-sm text-[#0F3B66]">
            The link redirects to the interview start page with auto-start
            enabled. It expires after 48 hours or after the first use.
          </div>
        </div>

        <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
          {onContinue && (
            <Button
              type="button"
              className="bg-[#1E90FF] text-white hover:bg-[#1176D6]"
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

