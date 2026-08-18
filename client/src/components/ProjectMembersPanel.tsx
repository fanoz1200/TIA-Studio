import { useMemo, useState } from "react";
import { LogIn, Trash2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

const roleLabels = { owner: "مالك المشروع", planner: "مراجع التخطيط", contracts: "مراجع العقود", claims_manager: "مدير المطالبات", viewer: "للعرض فقط" } as const;
const editableRoles = ["planner", "contracts", "claims_manager", "viewer"] as const;

export function ProjectMembersPanel({ projectKey, isAuthenticated }: { projectKey: string; isAuthenticated: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof editableRoles)[number]>("planner");
  const input = useMemo(() => ({ projectKey }), [projectKey]);
  const members = trpc.projectMember.list.useQuery(input, { enabled: isAuthenticated });
  const refresh = () => members.refetch();
  const add = trpc.projectMember.addByEmail.useMutation({ onSuccess: () => { setEmail(""); refresh(); toast.success("تمت إضافة عضو المشروع ويمكن اختياره في مراحل الاعتماد."); } });
  const update = trpc.projectMember.updateRole.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث دور عضو المشروع."); } });
  const remove = trpc.projectMember.remove.useMutation({ onSuccess: () => { refresh(); toast.success("تمت إزالة عضو المشروع من هذه المساحة."); } });

  return <section className="workflow-panel"><div className="workflow-heading"><div><p className="eyebrow">PROJECT MEMBERS</p><h2>أعضاء المشروع ومسار المراجعة</h2><p>أضف أعضاءً لديهم حساب مسجل في التطبيق، ثم اخترهم بالاسم في مراحل التخطيط والعقود ومدير المطالبات.</p></div><UsersRound size={23} /></div>{!isAuthenticated ? <div className="workflow-login"><LogIn size={18} /><span>سجّل الدخول لإدارة أعضاء المشروع وتعيينات المراجعة.</span><Button className="run-button" onClick={startLogin}>تسجيل الدخول</Button></div> : <><div className="member-add-form"><div><Label>بريد العضو المسجل</Label><Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" /></div><div><Label>الدور داخل المشروع</Label><Select value={role} onValueChange={value => setRole(value as typeof role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{roleLabels[item]}</SelectItem>)}</SelectContent></Select></div><Button className="run-button" disabled={add.isPending || !email.trim()} onClick={() => add.mutate({ projectKey, email: email.trim(), projectRole: role })}><UserPlus size={16} />إضافة عضو</Button></div><p className="workflow-subtle">يتحقق النظام من أن البريد يخص مستخدماً سجّل دخوله مرة واحدة؛ لا تُنشأ حسابات أو تُرسل دعوات تلقائياً.</p><div className="member-list">{members.isLoading ? <p>جار تحميل الأعضاء…</p> : members.data?.map(member => <div className="member-card" key={`${member.memberUserId}-${member.id}`}><div><b>{member.name}</b><span dir="ltr">{member.email || "—"}</span></div>{member.isOwner ? <em>{roleLabels.owner}</em> : <><Select value={member.projectRole} onValueChange={value => update.mutate({ projectKey, memberUserId: member.memberUserId, projectRole: value as (typeof editableRoles)[number] })}><SelectTrigger aria-label={`دور ${member.name}`}><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{roleLabels[item]}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" aria-label={`إزالة ${member.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ projectKey, memberUserId: member.memberUserId })}><Trash2 size={16} /></Button></>}</div>)}</div></>}</section>;
}
