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
};

export function AppLaunchSplash({ open, onOpenChange, onEnterWorkspace, onOpenGuide }: AppLaunchSplashProps) {
  const { language, direction } = useAppLanguage();
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundTimerRef = useRef<number | null>(null);

  const stopSound = useCallback(() => {
    if (soundTimerRef.current !== null) window.clearTimeout(soundTimerRef.current);
    soundTimerRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    setIsSoundPlaying(false);
  }, []);

  useEffect(() => () => stopSound(), [stopSound]);

  const toggleSound = () => {
    if (isSoundPlaying) {
      stopSound();
      return;
    }
    if (!("AudioContext" in window)) return;
    const context = new AudioContext();
    audioContextRef.current = context;
    const notes = [196, 293.66, 392, 587.33];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + index * 0.31;
      oscillator.type = index % 2 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.75);
    });
    setIsSoundPlaying(true);
    soundTimerRef.current = window.setTimeout(stopSound, 1800);
  };

  const copy = language === "en"
    ? {
        eyebrow: "SCHEDULE FORENSICS · LOCAL-FIRST",
        title: "TIA Studio",
        description: "A traceable workspace for CPM, time impact, windows, and schedule review—built to keep your source files under your control.",
        enter: "Open workspace",
        guide: "View the guided start",
        soundOn: "Enable opening sound",
        soundOff: "Stop opening sound",
        signal: "Analysis signal ready",
      }
    : {
        eyebrow: "SCHEDULE FORENSICS · LOCAL-FIRST",
        title: "TIA Studio",
        description: "مساحة عمل قابلة للمراجعة لـCPM وTIA والنوافذ ومراجعة البرنامج، وملفاتك الأصلية تظل تحت سيطرتك.",
        enter: "افتح مساحة العمل",
        guide: "شاهد بداية الاستخدام خطوة بخطوة",
        soundOn: "تشغيل نغمة البداية",
        soundOff: "إيقاف نغمة البداية",
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
          <p className="app-launch-splash__description">{copy.description}</p>
          <DialogDescription className="sr-only">{copy.description}</DialogDescription>
          <div className="app-launch-splash__rule" aria-hidden="true"><i /><i /><i /></div>
          <ProductIdentity variant="splash" />
          <div className="app-launch-splash__actions">
            <Button className="app-launch-splash__primary" onClick={onEnterWorkspace}><span>{copy.enter}</span><ChevronRight size={18} className={direction === "rtl" ? "rotate-180" : ""} /></Button>
            <Button variant="outline" className="app-launch-splash__secondary" onClick={onOpenGuide}><BookOpenCheck size={17} /><span>{copy.guide}</span></Button>
          </div>
        </div>
        <p className="app-launch-splash__note">TIA Studio · CPM / TIA / Windows / Time Slice · Review before reliance</p>
      </DialogContent>
    </Dialog>
  );
}
