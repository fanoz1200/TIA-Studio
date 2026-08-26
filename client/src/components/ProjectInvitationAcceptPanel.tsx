import React, { useEffect, useState } from "react";
import { CheckCircle2, Link2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { bilingualUiLabel } from "@/lib/language";
import { trpc } from "@/lib/trpc";

export function ProjectInvitationAcceptPanel({ token, isAuthenticated, onAccepted }: { token: string | null; isAuthenticated: boolean; onAccepted: () => void }) {
  const { language, direction } = useAppLanguage();
  const bi = (arabic: string, english: string) => bilingualUiLabel(language, arabic, english);
  const copy = {
    joined: (role: string) => language === "en" ? `You joined the project as ${role}.` : `${bi("تم الانضمام إلى المشروع بدور", "You joined the project as")} ${role}.`,
    title: bi("رابط دعوة المشروع", "Project invitation link"),
    authenticated: language === "en" ? "Your session is confirmed. Accept to join with the invited role." : "تحقق النظام من الجلسة. أكمل القبول لإضافة العضوية حسب الدور المدعو إليه.",
    signInFirst: language === "en" ? "Sign in with the email address that received the invitation; opening the link alone is not enough." : "سجّل الدخول بالبريد الذي استلم الدعوة أولاً؛ لا يكفي فتح الرابط وحده.",
    verifying: bi("جارِ التحقق", "Verifying"),
    accept: bi("قبول الدعوة", "Accept invitation"),
    signIn: bi("تسجيل الدخول", "Sign in"),
  };
  const [dismissed, setDismissed] = useState(false);
  const accept = trpc.projectInvitation.accept.useMutation({
    onSuccess: result => {
      window.history.replaceState({}, "", window.location.pathname);
      toast.success(copy.joined(result.projectRole));
      setDismissed(true);
      onAccepted();
    },
  });
  useEffect(() => { setDismissed(false); }, [token]);
  if (!token || dismissed) return null;
  return <section className="invite-accept-banner" dir={direction}><div><Link2 size={20} /><div><b>{copy.title}</b><span>{isAuthenticated ? copy.authenticated : copy.signInFirst}</span></div></div>{isAuthenticated ? <Button className="run-button" disabled={accept.isPending} onClick={() => accept.mutate({ token })}>{accept.isPending ? copy.verifying : <><CheckCircle2 size={16} />{copy.accept}</>}</Button> : <Button className="run-button" onClick={startLogin}><LogIn size={16} />{copy.signIn}</Button>}</section>;
}
