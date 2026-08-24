import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, Link2, LogIn, Mail, RefreshCcw, Send, ShieldCheck, Trash2, UserPlus, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import "./project-members.css";

const roleLabels = { owner: "مالك المشروع", planner: "مراجع التخطيط", contracts: "مراجع العقود", claims_manager: "مدير المطالبات", viewer: "للعرض فقط" } as const;
const editableRoles = ["planner", "contracts", "claims_manager", "viewer"] as const;
const accessDurations = [{ value: 7, label: "7 أيام" }, { value: 14, label: "14 يوماً" }, { value: 30, label: "30 يوماً" }, { value: 60, label: "60 يوماً" }, { value: 90, label: "90 يوماً" }];
type EditableRole = (typeof editableRoles)[number];

function expiryText(expiresAt: Date | string | null, isExpired?: boolean) {
  if (!expiresAt) return "تحتاج مراجعة: بلا تاريخ انتهاء";
  const date = new Date(expiresAt).toLocaleDateString("ar-EG");
  return isExpired ? `انتهى الوصول في ${date}` : `الوصول متاح حتى ${date}`;
}

export function ProjectMembersPanel({ projectKey, isAuthenticated }: { projectKey: string; isAuthenticated: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("planner");
  const [accessDurationDays, setAccessDurationDays] = useState(30);
  const [lastInvitation, setLastInvitation] = useState<{ inviteLink: string; emailSubject: string; emailBody: string; email: string } | null>(null);
  const input = useMemo(() => ({ projectKey }), [projectKey]);
  const members = trpc.projectMember.list.useQuery(input, { enabled: isAuthenticated });
  const invitations = trpc.projectInvitation.list.useQuery(input, { enabled: isAuthenticated });
  const refresh = () => members.refetch();
  const refreshInvitations = () => invitations.refetch();
  const add = trpc.projectMember.addByEmail.useMutation({ onSuccess: () => { setEmail(""); refresh(); toast.success("تمت إضافة عضو المشروع لمدة الوصول المختارة ويمكن اختياره في مراحل الاعتماد."); } });
  const update = trpc.projectMember.updateRole.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث العضوية أو مدة الوصول."); } });
  const remove = trpc.projectMember.remove.useMutation({ onSuccess: () => { refresh(); toast.success("تمت إزالة عضو المشروع من هذه المساحة."); } });
  const invite = trpc.projectInvitation.create.useMutation({ onSuccess: result => { setLastInvitation(result); refreshInvitations(); toast.success("أُنشئ رابط دعوة آمن بمدة وصول محددة. انسخه أو افتح مسودة البريد لإرساله للعضو."); } });
  const cancelInvite = trpc.projectInvitation.cancel.useMutation({ onSuccess: () => { refreshInvitations(); toast.success("أُلغيت الدعوة ولن يعود الرابط صالحاً."); } });
  const copyInvite = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success("تم نسخ رابط الدعوة."); } catch { toast.error("تعذر النسخ تلقائياً؛ انسخ الرابط يدوياً."); } };
  const openEmailDraft = (subject: string, body: string) => { window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  const sendInvitation = (inviteEmail = email, inviteRole = role, duration = accessDurationDays) => invite.mutate({ projectKey, email: inviteEmail.trim(), projectRole: inviteRole, accessDurationDays: duration, origin: window.location.origin });

  return <section className="workflow-panel">
    <div className="workflow-heading"><div><p className="eyebrow">PROJECT MEMBERS</p><h2>أعضاء المشروع ومسار المراجعة</h2><p>الدعوة ترتبط بالبريد والدور، وتصبح عضوية بعد تسجيل الدخول بالبريد نفسه وقبول الرابط. مدة الوصول تبدأ من القبول وتُفرض على مراجعات مساحة الفريق، ولا تتحكم في نسخة سطح المكتب المحلية.</p></div><UsersRound size={23} /></div>
    {!isAuthenticated ? <div className="workflow-login"><LogIn size={18} /><span>سجّل الدخول لإدارة أعضاء المشروع وتعيينات المراجعة.</span><Button className="run-button" onClick={startLogin}>تسجيل الدخول</Button></div> : <>
      <div className="member-add-form">
        <div><Label>بريد العضو</Label><Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" /></div>
        <div><Label>الدور داخل المشروع</Label><Select value={role} onValueChange={value => setRole(value as EditableRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{roleLabels[item]}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>مدة الوصول بعد القبول</Label><Select value={String(accessDurationDays)} onValueChange={value => setAccessDurationDays(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessDurations.map(item => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="member-invite-actions"><Button className="run-button" disabled={invite.isPending || !email.trim()} onClick={() => sendInvitation()}><Send size={16} />إنشاء دعوة</Button><Button variant="outline" disabled={add.isPending || !email.trim()} onClick={() => add.mutate({ projectKey, email: email.trim(), projectRole: role, accessDurationDays })}><UserPlus size={16} />إضافة مسجل</Button></div>
      </div>
      <p className="workflow-subtle"><ShieldCheck size={15} /> رابط الدعوة صالح لمدة 7 أيام، أما وصول العضو فيبدأ بعد القبول بالمدة المختارة. عند الانتهاء يمنع الخادم اعتماد المراجعة أو تعيين عضو منتهي، ويمكن للمالك تمديده أو إزالته. لا يرسل التطبيق بريدًا بنفسه.</p>
      {lastInvitation ? <div className="invite-delivery-card"><div><Mail size={18} /><span>دعوة جاهزة إلى <b dir="ltr">{lastInvitation.email}</b></span></div><div><Button size="sm" variant="outline" onClick={() => copyInvite(lastInvitation.inviteLink)}><ClipboardCopy size={15} />نسخ الرابط</Button><Button size="sm" className="run-button" onClick={() => openEmailDraft(lastInvitation.emailSubject, lastInvitation.emailBody)}><Mail size={15} />فتح مسودة بريد</Button></div></div> : null}
      <div className="member-list invitation-list"><div className="member-list-heading"><b>الدعوات</b><span>{invitations.data?.length ?? 0} سجل</span></div>
        {invitations.isLoading ? <p>جار تحميل الدعوات…</p> : invitations.data?.length ? invitations.data.map(invitation => <div className="member-card invitation-card" key={invitation.id}><div><b dir="ltr">{invitation.email}</b><span>{roleLabels[invitation.projectRole]} · الرابط ينتهي {new Date(invitation.expiresAt).toLocaleDateString("ar-EG")} · الوصول {invitation.accessDurationDays} يوماً بعد القبول</span></div><div className="invite-status-actions"><em className={`invite-status invite-status--${invitation.status}`}>{invitation.status === "accepted" ? <CheckCircle2 size={14} /> : invitation.status === "pending" ? <Link2 size={14} /> : <XCircle size={14} />}{invitation.status === "accepted" ? "مقبولة" : invitation.status === "pending" ? "بانتظار القبول" : invitation.status === "expired" ? "منتهية" : "ملغاة"}</em>{invitation.status !== "accepted" ? <Button variant="ghost" size="icon" aria-label={`إعادة إرسال دعوة ${invitation.email}`} disabled={invite.isPending} onClick={() => sendInvitation(invitation.email, invitation.projectRole, invitation.accessDurationDays)}><RefreshCcw size={16} /></Button> : null}{invitation.status === "pending" ? <Button variant="ghost" size="icon" aria-label={`إلغاء دعوة ${invitation.email}`} disabled={cancelInvite.isPending} onClick={() => cancelInvite.mutate({ projectKey, invitationId: invitation.id })}><Trash2 size={16} /></Button> : null}</div></div>) : <p className="workflow-subtle">لا توجد دعوات بعد.</p>}
      </div>
      <div className="member-list"><div className="member-list-heading"><b>الأعضاء المعتمدون</b><span>{members.data?.length ?? 0} عضو</span></div>
        {members.isLoading ? <p>جار تحميل الأعضاء…</p> : members.data?.map(member => <div className="member-card" key={`${member.memberUserId}-${member.id}`}><div><b>{member.name}</b><span dir="ltr">{member.email || "—"}</span>{member.isOwner ? null : <small className={member.isAccessExpired ? "member-access member-access--expired" : "member-access"}>{expiryText(member.accessExpiresAt, member.isAccessExpired)}</small>}</div>{member.isOwner ? <em>{roleLabels.owner}</em> : <><Select value={member.projectRole} onValueChange={value => update.mutate({ projectKey, memberUserId: member.memberUserId, projectRole: value as EditableRole })}><SelectTrigger aria-label={`دور ${member.name}`}><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{roleLabels[item]}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" aria-label={`تمديد وصول ${member.name}`} disabled={update.isPending} onClick={() => update.mutate({ projectKey, memberUserId: member.memberUserId, projectRole: member.projectRole as EditableRole, accessDurationDays })}>مد {accessDurationDays} يوم</Button><Button variant="ghost" size="icon" aria-label={`إزالة ${member.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ projectKey, memberUserId: member.memberUserId })}><Trash2 size={16} /></Button></>}</div>)}
      </div>
    </>}
  </section>;
}
