import { useEffect, useState } from "react";
import { CheckCircle2, Link2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

export function ProjectInvitationAcceptPanel({ token, isAuthenticated, onAccepted }: { token: string | null; isAuthenticated: boolean; onAccepted: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const accept = trpc.projectInvitation.accept.useMutation({
    onSuccess: result => {
      window.history.replaceState({}, "", window.location.pathname);
      toast.success(`تم الانضمام إلى المشروع بدور ${result.projectRole}.`);
      setDismissed(true);
      onAccepted();
    },
  });
  useEffect(() => { setDismissed(false); }, [token]);
  if (!token || dismissed) return null;
  return <section className="invite-accept-banner"><div><Link2 size={20} /><div><b>لديك رابط دعوة للمشروع</b><span>{isAuthenticated ? "تحقق النظام من الجلسة. أكمل القبول لإضافة العضوية حسب الدور المدعو إليه." : "سجّل الدخول بالبريد الذي استلم الدعوة أولاً؛ لا يكفي فتح الرابط وحده."}</span></div></div>{isAuthenticated ? <Button className="run-button" disabled={accept.isPending} onClick={() => accept.mutate({ token })}>{accept.isPending ? "جارِ التحقق…" : <><CheckCircle2 size={16} />قبول الدعوة</>}</Button> : <Button className="run-button" onClick={startLogin}><LogIn size={16} />تسجيل الدخول</Button>}</section>;
}
