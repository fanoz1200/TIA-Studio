import React, { useEffect, useState } from "react";
import { CheckCircle2, Link2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

export function ProjectInvitationAcceptPanel({ token, isAuthenticated, onAccepted }: { token: string | null; isAuthenticated: boolean; onAccepted: () => void }) {
  const { language, direction } = useAppLanguage();
  const copy = language === "en" ? {
    joined: (role: string) => `You joined the project as ${role}.`,
    title: "You have a project invitation link",
    authenticated: "Your session is confirmed. Accept to join with the invited role.",
    signInFirst: "Sign in with the email address that received the invitation; opening the link alone is not enough.",
    verifying: "Verifying…",
    accept: "Accept invitation",
    signIn: "Sign in",
  } : {
    joined: (role: string) => `تم الانضمام إلى المشروع بدور ${role}.`,
    title: "لديك رابط دعوة للمشروع",
    authenticated: "تحقق النظام من الجلسة. أكمل القبول لإضافة العضوية حسب الدور المدعو إليه.",
    signInFirst: "سجّل الدخول بالبريد الذي استلم الدعوة أولاً؛ لا يكفي فتح الرابط وحده.",
    verifying: "جارِ التحقق…",
    accept: "قبول الدعوة",
    signIn: "تسجيل الدخول",
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
