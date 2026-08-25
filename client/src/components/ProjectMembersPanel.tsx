import React, { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, Link2, LogIn, Mail, RefreshCcw, Send, ShieldCheck, Trash2, UserPlus, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startLogin } from "@/const";
import { useAppLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import "./project-members.css";

const editableRoles = ["planner", "contracts", "claims_manager", "viewer"] as const;
type EditableRole = (typeof editableRoles)[number];
type AppLanguage = "ar" | "en";

function roleLabels(language: AppLanguage) {
  return language === "ar"
    ? { owner: "مالك المشروع", planner: "مراجع التخطيط", contracts: "مراجع العقود", claims_manager: "مدير المطالبات", viewer: "للعرض فقط" }
    : { owner: "Project owner", planner: "Planning reviewer", contracts: "Contracts reviewer", claims_manager: "Claims manager", viewer: "View only" };
}

function accessDurations(language: AppLanguage) {
  return [7, 14, 30, 60, 90].map(value => ({ value, label: language === "ar" ? `${value} ${value === 7 ? "أيام" : "يوماً"}` : `${value} days` }));
}

function expiryText(expiresAt: Date | string | null, language: AppLanguage, isExpired?: boolean) {
  if (!expiresAt) return language === "ar" ? "تحتاج مراجعة: بلا تاريخ انتهاء" : "Review required: no expiry date";
  const date = new Date(expiresAt).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB");
  return language === "ar" ? (isExpired ? `انتهى الوصول في ${date}` : `الوصول متاح حتى ${date}`) : (isExpired ? `Access expired on ${date}` : `Access available until ${date}`);
}

export function ProjectMembersPanel({ projectKey, isAuthenticated }: { projectKey: string; isAuthenticated: boolean }) {
  const { language, direction } = useAppLanguage();
  const copy = language === "ar" ? {
    title: "أعضاء المشروع ومسار المراجعة", description: "الدعوة ترتبط بالبريد والدور، وتصبح عضوية بعد تسجيل الدخول بالبريد نفسه وقبول الرابط. مدة الوصول تبدأ من القبول وتُفرض على مراجعات مساحة الفريق، ولا تتحكم في نسخة سطح المكتب المحلية.", signInPrompt: "سجّل الدخول لإدارة أعضاء المشروع وتعيينات المراجعة.", signIn: "تسجيل الدخول", memberEmail: "بريد العضو", role: "الدور داخل المشروع", accessDuration: "مدة الوصول بعد القبول", createInvitation: "إنشاء دعوة", addRegistered: "إضافة مسجل", notice: "رابط الدعوة صالح لمدة 7 أيام، أما وصول العضو فيبدأ بعد القبول بالمدة المختارة. عند الانتهاء يمنع الخادم اعتماد المراجعة أو تعيين عضو منتهي، ويمكن للمالك تمديده أو إزالته. لا يرسل التطبيق بريدًا بنفسه.", invitationReady: "دعوة جاهزة إلى", copyLink: "نسخ الرابط", openDraft: "فتح مسودة بريد", invitations: "الدعوات", records: "سجل", loadingInvitations: "جار تحميل الدعوات…", linkExpires: "الرابط ينتهي", access: "الوصول", afterAcceptance: "بعد القبول", accepted: "مقبولة", pending: "بانتظار القبول", expired: "منتهية", cancelled: "ملغاة", resend: "إعادة إرسال دعوة", cancel: "إلغاء دعوة", noInvitations: "لا توجد دعوات بعد.", members: "الأعضاء المعتمدون", member: "عضو", loadingMembers: "جار تحميل الأعضاء…", roleFor: "دور", extendAccess: "تمديد وصول", remove: "إزالة", extend: "مد",
  } : {
    title: "Project members & review route", description: "An invitation is linked to an email address and role. Membership starts only after the same email signs in and accepts the link. Access begins on acceptance, applies to team-workspace reviews, and does not control the local desktop copy.", signInPrompt: "Sign in to manage project members and review assignments.", signIn: "Sign in", memberEmail: "Member email", role: "Project role", accessDuration: "Access duration after acceptance", createInvitation: "Create invitation", addRegistered: "Add registered member", notice: "The invitation link remains valid for 7 days. Member access starts upon acceptance for the selected duration. When access expires, the server blocks review approval and assignment; the owner can extend or remove the member. The app does not send email itself.", invitationReady: "Invitation ready for", copyLink: "Copy link", openDraft: "Open email draft", invitations: "Invitations", records: "records", loadingInvitations: "Loading invitations…", linkExpires: "Link expires", access: "Access", afterAcceptance: "after acceptance", accepted: "Accepted", pending: "Awaiting acceptance", expired: "Expired", cancelled: "Cancelled", resend: "Resend invitation", cancel: "Cancel invitation", noInvitations: "No invitations yet.", members: "Approved members", member: "member", loadingMembers: "Loading members…", roleFor: "Role", extendAccess: "Extend access", remove: "Remove", extend: "Extend",
  };
  const labels = roleLabels(language);
  const statusLabel = (status: "accepted" | "pending" | "expired" | "cancelled") => copy[status];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("planner");
  const [accessDurationDays, setAccessDurationDays] = useState(30);
  const [lastInvitation, setLastInvitation] = useState<{ inviteLink: string; emailSubject: string; emailBody: string; email: string } | null>(null);
  const input = useMemo(() => ({ projectKey }), [projectKey]);
  const members = trpc.projectMember.list.useQuery(input, { enabled: isAuthenticated });
  const invitations = trpc.projectInvitation.list.useQuery(input, { enabled: isAuthenticated });
  const refresh = () => members.refetch();
  const refreshInvitations = () => invitations.refetch();
  const add = trpc.projectMember.addByEmail.useMutation({ onSuccess: () => { setEmail(""); refresh(); toast.success(language === "ar" ? "تمت إضافة عضو المشروع لمدة الوصول المختارة ويمكن اختياره في مراحل الاعتماد." : "The member was added for the selected access duration and can be assigned to review stages."); } });
  const update = trpc.projectMember.updateRole.useMutation({ onSuccess: () => { refresh(); toast.success(language === "ar" ? "تم تحديث العضوية أو مدة الوصول." : "Membership or access duration was updated."); } });
  const remove = trpc.projectMember.remove.useMutation({ onSuccess: () => { refresh(); toast.success(language === "ar" ? "تمت إزالة عضو المشروع من هذه المساحة." : "The project member was removed from this workspace."); } });
  const invite = trpc.projectInvitation.create.useMutation({ onSuccess: result => { setLastInvitation(result); refreshInvitations(); toast.success(language === "ar" ? "أُنشئ رابط دعوة آمن بمدة وصول محددة. انسخه أو افتح مسودة البريد لإرساله للعضو." : "A secure invitation link with a fixed access duration was created. Copy it or open an email draft for the member."); } });
  const cancelInvite = trpc.projectInvitation.cancel.useMutation({ onSuccess: () => { refreshInvitations(); toast.success(language === "ar" ? "أُلغيت الدعوة ولن يعود الرابط صالحاً." : "The invitation was cancelled and its link is no longer valid."); } });
  const copyInvite = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success(language === "ar" ? "تم نسخ رابط الدعوة." : "Invitation link copied."); } catch { toast.error(language === "ar" ? "تعذر النسخ تلقائياً؛ انسخ الرابط يدوياً." : "Automatic copy failed; copy the link manually."); } };
  const openEmailDraft = (subject: string, body: string) => { window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
  const sendInvitation = (inviteEmail = email, inviteRole = role, duration = accessDurationDays) => invite.mutate({ projectKey, email: inviteEmail.trim(), projectRole: inviteRole, accessDurationDays: duration, origin: window.location.origin, draftLanguage: language });

  return <section className="workflow-panel" dir={direction}>
    <div className="workflow-heading"><div><p className="eyebrow">PROJECT MEMBERS</p><h2>{copy.title}</h2><p>{copy.description}</p></div><UsersRound size={23} /></div>
    {!isAuthenticated ? <div className="workflow-login"><LogIn size={18} /><span>{copy.signInPrompt}</span><Button className="run-button" onClick={startLogin}>{copy.signIn}</Button></div> : <>
      <div className="member-add-form">
        <div><Label>{copy.memberEmail}</Label><Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" /></div>
        <div><Label>{copy.role}</Label><Select value={role} onValueChange={value => setRole(value as EditableRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{copy.accessDuration}</Label><Select value={String(accessDurationDays)} onValueChange={value => setAccessDurationDays(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accessDurations(language).map(item => <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="member-invite-actions"><Button className="run-button" disabled={invite.isPending || !email.trim()} onClick={() => sendInvitation()}><Send size={16} />{copy.createInvitation}</Button><Button variant="outline" disabled={add.isPending || !email.trim()} onClick={() => add.mutate({ projectKey, email: email.trim(), projectRole: role, accessDurationDays })}><UserPlus size={16} />{copy.addRegistered}</Button></div>
      </div>
      <p className="workflow-subtle"><ShieldCheck size={15} /> {copy.notice}</p>
      {lastInvitation ? <div className="invite-delivery-card"><div><Mail size={18} /><span>{copy.invitationReady} <b dir="ltr">{lastInvitation.email}</b></span></div><div><Button size="sm" variant="outline" onClick={() => copyInvite(lastInvitation.inviteLink)}><ClipboardCopy size={15} />{copy.copyLink}</Button><Button size="sm" className="run-button" onClick={() => openEmailDraft(lastInvitation.emailSubject, lastInvitation.emailBody)}><Mail size={15} />{copy.openDraft}</Button></div></div> : null}
      <div className="member-list invitation-list"><div className="member-list-heading"><b>{copy.invitations}</b><span>{invitations.data?.length ?? 0} {copy.records}</span></div>
        {invitations.isLoading ? <p>{copy.loadingInvitations}</p> : invitations.data?.length ? invitations.data.map(invitation => <div className="member-card invitation-card" key={invitation.id}><div><b dir="ltr">{invitation.email}</b><span>{labels[invitation.projectRole]} · {copy.linkExpires} {new Date(invitation.expiresAt).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB")} · {copy.access} {invitation.accessDurationDays} {language === "ar" ? "يوماً" : "days"} {copy.afterAcceptance}</span></div><div className="invite-status-actions"><em className={`invite-status invite-status--${invitation.status}`}>{invitation.status === "accepted" ? <CheckCircle2 size={14} /> : invitation.status === "pending" ? <Link2 size={14} /> : <XCircle size={14} />}{statusLabel(invitation.status)}</em>{invitation.status !== "accepted" ? <Button variant="ghost" size="icon" aria-label={`${copy.resend} ${invitation.email}`} disabled={invite.isPending} onClick={() => sendInvitation(invitation.email, invitation.projectRole, invitation.accessDurationDays)}><RefreshCcw size={16} /></Button> : null}{invitation.status === "pending" ? <Button variant="ghost" size="icon" aria-label={`${copy.cancel} ${invitation.email}`} disabled={cancelInvite.isPending} onClick={() => cancelInvite.mutate({ projectKey, invitationId: invitation.id })}><Trash2 size={16} /></Button> : null}</div></div>) : <p className="workflow-subtle">{copy.noInvitations}</p>}
      </div>
      <div className="member-list"><div className="member-list-heading"><b>{copy.members}</b><span>{members.data?.length ?? 0} {copy.member}</span></div>
        {members.isLoading ? <p>{copy.loadingMembers}</p> : members.data?.map(member => <div className="member-card" key={`${member.memberUserId}-${member.id}`}><div><b>{member.name}</b><span dir="ltr">{member.email || "—"}</span>{member.isOwner ? null : <small className={member.isAccessExpired ? "member-access member-access--expired" : "member-access"}>{expiryText(member.accessExpiresAt, language, member.isAccessExpired)}</small>}</div>{member.isOwner ? <em>{labels.owner}</em> : <><Select value={member.projectRole} onValueChange={value => update.mutate({ projectKey, memberUserId: member.memberUserId, projectRole: value as EditableRole })}><SelectTrigger aria-label={`${copy.roleFor} ${member.name}`}><SelectValue /></SelectTrigger><SelectContent>{editableRoles.map(item => <SelectItem key={item} value={item}>{labels[item]}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" aria-label={`${copy.extendAccess} ${member.name}`} disabled={update.isPending} onClick={() => update.mutate({ projectKey, memberUserId: member.memberUserId, projectRole: member.projectRole as EditableRole, accessDurationDays })}>{copy.extend} {accessDurationDays} {language === "ar" ? "يوم" : "days"}</Button><Button variant="ghost" size="icon" aria-label={`${copy.remove} ${member.name}`} disabled={remove.isPending} onClick={() => remove.mutate({ projectKey, memberUserId: member.memberUserId })}><Trash2 size={16} /></Button></>}</div>)}
      </div>
    </>}
  </section>;
}
