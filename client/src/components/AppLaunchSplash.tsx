import React, { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, BookOpenCheck, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { ProductIdentity } from "./ProductIdentity";
import "./app-launch-splash.css";

type AppLaunchSplashProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterWorkspace: () => void;
  onOpenGuide: () => void;
  onOpenKnowledge?: () => void;
};

export const WEB_OPENING_INTRODUCTION_URL = "/manus-storage/tia-studio-opening-intro_221bda02.mp3";
export const DESKTOP_OPENING_INTRODUCTION_URL = "/desktop-media/tia-studio-opening-intro.mp3";

export function resolveOpeningIntroductionUrl(search = typeof window === "undefined" ? "" : window.location.search) {
  return new URLSearchParams(search).get("desktop") === "1"
    ? DESKTOP_OPENING_INTRODUCTION_URL
    : WEB_OPENING_INTRODUCTION_URL;
}

export function AppLaunchSplash({ open, onOpenChange, onEnterWorkspace, onOpenGuide, onOpenKnowledge = () => undefined }: AppLaunchSplashProps) {
  const { language, direction } = useAppLanguage();
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSound = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setIsSoundPlaying(false);
  }, []);

  useEffect(() => () => stopSound(), [stopSound]);

  const toggleSound = () => {
    if (isSoundPlaying) {
      stopSound();
      return;
    }
    const audio = new Audio(resolveOpeningIntroductionUrl());
    audioRef.current = audio;
    audio.preload = "auto";
    audio.onended = () => {
      audioRef.current = null;
      setIsSoundPlaying(false);
    };
    audio.onerror = () => {
      audioRef.current = null;
      setIsSoundPlaying(false);
    };
    void audio.play().then(() => setIsSoundPlaying(true)).catch(() => {
      audioRef.current = null;
      setIsSoundPlaying(false);
    });
  };

  const copy = language === "en"
    ? {
        eyebrow: "SCHEDULE FORENSICS · LOCAL-FIRST",
        title: "TIA Studio",
        description: "A traceable workspace for CPM, time impact, windows, and schedule review—built to keep your source files under your control.",
        slogan: "Schedule clarity. Defensible analysis.",
        enter: "Open workspace",
        guide: "View the guided start",
        knowledge: "Explore the method & case library",
        soundOn: "Play opening introduction",
        soundOff: "Stop opening introduction",
        signal: "Analysis signal ready",
      }
    : {
        eyebrow: "SCHEDULE FORENSICS · LOCAL-FIRST",
        title: "TIA Studio",
        description: "مساحة عمل قابلة للمراجعة لـCPM وTIA والنوافذ ومراجعة البرنامج، وملفاتك الأصلية تظل تحت سيطرتك.",
        slogan: "وضوح البرنامج. تحليل قابل للدفاع والمراجعة.",
        enter: "افتح مساحة العمل",
        guide: "شاهد بداية الاستخدام خطوة بخطوة",
        knowledge: "افتح مكتبة المنهجيات والحالات",
        soundOn: "شغّل المقدمة الصوتية",
        soundOff: "أوقف المقدمة الصوتية",
        signal: "إشارة التحليل جاهزة",
      };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onEnterWorkspace(); else onOpenChange(true); }}>
      <DialogContent dir={direction} showCloseButton={false} className="app-launch-splash">
        <div className="app-launch-splash__grid" aria-hidden="true" />
        <div className="app-launch-splash__orb app-launch-splash__orb--one" aria-hidden="true" />
        <div className="app-launch-splash__orb app-launch-splash__orb--two" aria-hidden="true" />
        <button className="app-launch-splash__sound" type="button" onClick={toggleSound} aria-pressed={isSoundPlaying} aria-label={isSoundPlaying ? copy.soundOff : copy.soundOn}>
          {isSoundPlaying ? <VolumeX size={17} /> : <Volume2 size={17} />}
          <span>{isSoundPlaying ? copy.soundOff : copy.soundOn}</span>
        </button>
        <div className="app-launch-splash__content">
          <div className="app-launch-splash__signal"><AudioLines size={14} aria-hidden="true" /><span>{copy.signal}</span></div>
          <p className="app-launch-splash__eyebrow">{copy.eyebrow}</p>
          <DialogTitle asChild><h1>{copy.title}</h1></DialogTitle>
          <p className="app-launch-splash__slogan">{copy.slogan}</p>
          <p className="app-launch-splash__description">{copy.description}</p>
          <DialogDescription className="sr-only">{copy.description}</DialogDescription>
          <div className="app-launch-splash__rule" aria-hidden="true"><i /><i /><i /></div>
          <ProductIdentity variant="splash" />
          <div className="app-launch-splash__actions">
            <Button className="app-launch-splash__primary" onClick={onEnterWorkspace}><span>{copy.enter}</span><ChevronRight size={18} className={direction === "rtl" ? "rotate-180" : ""} /></Button>
            <Button variant="outline" className="app-launch-splash__secondary" onClick={onOpenGuide}><BookOpenCheck size={17} /><span>{copy.guide}</span></Button>
            <Button variant="ghost" className="app-launch-splash__knowledge" onClick={onOpenKnowledge}><BookOpenCheck size={17} /><span>{copy.knowledge}</span></Button>
          </div>
        </div>
        <p className="app-launch-splash__note">TIA Studio · CPM / TIA / Windows / Time Slice · Review before reliance</p>
      </DialogContent>
    </Dialog>
  );
}
