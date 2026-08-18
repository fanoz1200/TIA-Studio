import React, { useMemo, useRef, useState } from "react";
import { BookOpenCheck, ExternalLink, FileCode2, LibraryBig, Link2, LoaderCircle, LogIn, PlayCircle, Plus, ShieldCheck, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import "./knowledge-centre.css";

type Track = "tia" | "concurrent" | "primavera";
const trackLabels: Record<Track, string> = { tia: "TIA من الصفر إلى التقرير", concurrent: "التأخيرات المتزامنة", primavera: "تطبيق Primavera P6" };
const defaultTracks: { id: Track; title: string; description: string; outcome: string }[] = [
  { id: "tia", title: "مسار TIA العملي", description: "من تثبيت الـ Baseline إلى Fragnet وقياس أثر الإكمال.", outcome: "نتيجة قابلة للتتبع" },
  { id: "concurrent", title: "مسار التزامن", description: "تحديد الفترات المتداخلة وتمييز السببية والأثر الحرج.", outcome: "مصفوفة تزامن قابلة للمراجعة" },
  { id: "primavera", title: "مسار Primavera P6", description: "تجهيز XER/XML وقراءة WBS والعلاقات والموارد قبل التحليل.", outcome: "بيانات جاهزة لـ CPM" },
];

function base64Of(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة ملف المكتبة."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  return value < 1_024 ? `${value} B` : value < 1_048_576 ? `${(value / 1_024).toFixed(1)} KB` : `${(value / 1_048_576).toFixed(1)} MB`;
}

export function KnowledgeCentrePanel({ view, projectKey, isAuthenticated }: { view: string; projectKey: string; isAuthenticated: boolean }) {
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTrack, setVideoTrack] = useState<Track>("tia");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [libraryFile, setLibraryFile] = useState<File | null>(null);
  const [libraryTitle, setLibraryTitle] = useState("");
  const [libraryVersion, setLibraryVersion] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const queryInput = useMemo(() => ({ projectKey }), [projectKey]);
  const videos = trpc.knowledgeCentre.videoList.useQuery(queryInput, { enabled: isAuthenticated });
  const documents = trpc.knowledgeCentre.libraryList.useQuery(queryInput, { enabled: isAuthenticated });
  const documentContent = trpc.knowledgeCentre.libraryRead.useQuery({ id: selectedDocumentId ?? 0 }, { enabled: isAuthenticated && selectedDocumentId !== null });
  const refresh = () => { void videos.refetch(); void documents.refetch(); };
  const addVideo = trpc.knowledgeCentre.videoCreate.useMutation({ onSuccess: () => { setVideoTitle(""); setVideoUrl(""); setVideoDescription(""); refresh(); toast.success("تمت إضافة الرابط إلى المسار التعليمي."); } });
  const removeVideo = trpc.knowledgeCentre.videoRemove.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف الرابط من مركز الفيديو."); } });
  const uploadLibrary = trpc.knowledgeCentre.libraryUpload.useMutation({ onSuccess: result => { setLibraryFile(null); setLibraryTitle(""); setLibraryVersion(""); refresh(); setSelectedDocumentId(result.id); toast.success("حُفظت نسخة مقروءة وآمنة من موسوعة HTML في المكتبة."); } });
  const removeLibrary = trpc.knowledgeCentre.libraryRemove.useMutation({ onSuccess: () => { setSelectedDocumentId(null); refresh(); toast.success("تمت إزالة فهرس نسخة المكتبة من هذا المشروع."); } });

  if (view !== "learning") return null;
  const addLibrary = async () => {
    if (!libraryFile || !libraryTitle.trim()) { toast.error("اختر ملف HTML وأدخل عنواناً واضحاً للنسخة."); return; }
    try { uploadLibrary.mutate({ projectKey, title: libraryTitle.trim(), versionLabel: libraryVersion.trim() || undefined, fileName: libraryFile.name, dataBase64: await base64Of(libraryFile) }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تجهيز ملف المكتبة."); }
  };
  const selectedDocument = documents.data?.find(item => item.id === selectedDocumentId);

  return <section className="knowledge-centre workflow-panel"><div className="workflow-heading"><div><p className="eyebrow">LEARNING & METHODOLOGY CENTRE</p><h2>مركز التدريب والمكتبة المنهجية</h2><p>المسارات التدريبية تُنظم التطبيق العملي، والمكتبة تحفظ نسخ موسوعتك كمحتوى قراءة خامل لتبقى قابلة للمراجعة دون تشغيل أي برمجيات مضمّنة.</p></div><LibraryBig size={24} /></div>{!isAuthenticated ? <div className="workflow-login"><LogIn size={18} /><span>سجّل الدخول لإضافة روابط التدريب أو رفع نسخة موسوعة خاصة بالمشروع.</span><Button className="run-button" onClick={startLogin}>تسجيل الدخول</Button></div> : <><div className="learning-path-grid">{defaultTracks.map(track => <article className="learning-path" key={track.id}><span><PlayCircle size={18} /> {trackLabels[track.id]}</span><h3>{track.title}</h3><p>{track.description}</p><b>{track.outcome}</b><Button variant="outline" size="sm" onClick={() => document.getElementById("video-library-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Plus size={15} />إضافة فيديو لهذا المسار</Button></article>)}</div><div className="knowledge-layout"><article className="knowledge-card"><div className="knowledge-card-heading"><div><Video size={20} /><h3>مكتبة الفيديو المنظمة</h3></div><span>روابط خارجية فقط</span></div><p>أضف روابط HTTPS من YouTube أو Vimeo. لا يدّعي المركز امتلاك أو توثيق محتوى الطرف الثالث؛ راجع الملاءمة التعاقدية قبل الاستناد إليه.</p><div className="video-add-form" id="video-library-form"><div><Label>عنوان الدرس</Label><Input value={videoTitle} onChange={event => setVideoTitle(event.target.value)} placeholder="مثال: إدخال Fragnet داخل P6" /></div><div><Label>المسار</Label><Select value={videoTrack} onValueChange={value => setVideoTrack(value as Track)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(trackLabels) as Track[]).map(track => <SelectItem key={track} value={track}>{trackLabels[track]}</SelectItem>)}</SelectContent></Select></div><div><Label>رابط الفيديو</Label><Input dir="ltr" type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/..." /></div><div className="video-description"><Label>ملاحظة تعليمية (اختياري)</Label><Textarea value={videoDescription} onChange={event => setVideoDescription(event.target.value)} placeholder="ما الذي يغطيه هذا الفيديو؟" /></div><Button className="run-button" disabled={addVideo.isPending || !videoTitle.trim() || !videoUrl.trim()} onClick={() => addVideo.mutate({ projectKey, title: videoTitle.trim(), track: videoTrack, videoUrl: videoUrl.trim(), description: videoDescription.trim() || undefined })}>{addVideo.isPending ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}إضافة الرابط</Button></div><div className="tutorial-list">{videos.isLoading ? <p>جار تحميل روابط الدروس…</p> : videos.data?.length ? videos.data.map(video => <div className="tutorial-row" key={video.id}><div><span>{trackLabels[video.track]}</span><b>{video.title}</b>{video.description ? <small>{video.description}</small> : null}</div><div><Button size="sm" variant="outline" onClick={() => window.open(video.videoUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={15} />فتح الدرس</Button><Button size="icon" variant="ghost" aria-label={`حذف ${video.title}`} disabled={removeVideo.isPending} onClick={() => removeVideo.mutate({ id: video.id })}><Trash2 size={16} /></Button></div></div>) : <p className="workflow-subtle">لا توجد روابط بعد. أضف الفيديوهات العربية الخاصة بفريقك لتظهر تحت مسارها الصحيح.</p>}</div></article><article className="knowledge-card library-card"><div className="knowledge-card-heading"><div><BookOpenCheck size={20} /><h3>مكتبة منهجيات HTML</h3></div><span>قراءة آمنة</span></div><p>تُزال العناصر النشطة والمضمّنة قبل الحفظ، ثم يُخزن النص المعقّم خارج قاعدة البيانات وتُحفظ بصمته وسجل نسخته فقط.</p><div className="library-upload-form"><input ref={libraryInputRef} className="sr-only" type="file" accept=".html,.htm,text/html" onChange={event => { const next = event.target.files?.[0] ?? null; setLibraryFile(next); if (next && !libraryTitle) setLibraryTitle(next.name.replace(/\.html?$/i, "")); }} /><div><Label>نسخة الموسوعة</Label><Button type="button" variant="outline" className="file-picker" onClick={() => libraryInputRef.current?.click()}><FileCode2 size={16} />{libraryFile ? libraryFile.name : "اختيار HTML"}</Button></div><div><Label>عنوان النسخة</Label><Input value={libraryTitle} onChange={event => setLibraryTitle(event.target.value)} placeholder="الموسوعة المرجعية للتأخيرات" /></div><div><Label>رقم/تاريخ الإصدار</Label><Input value={libraryVersion} onChange={event => setLibraryVersion(event.target.value)} placeholder="إصدار 1.0" /></div><Button className="run-button" disabled={uploadLibrary.isPending || !libraryFile || !libraryTitle.trim()} onClick={() => void addLibrary()}>{uploadLibrary.isPending ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}رفع نسخة القراءة</Button></div><div className="library-list">{documents.isLoading ? <p>جار تحميل نسخ المكتبة…</p> : documents.data?.length ? documents.data.map(document => <div className={`library-row ${selectedDocumentId === document.id ? "selected" : ""}`} key={document.id}><button type="button" onClick={() => setSelectedDocumentId(document.id)}><b>{document.title}</b><span>{document.versionLabel || "دون إصدار"} · {formatBytes(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString("ar-EG")}</span></button><Button size="icon" variant="ghost" aria-label={`حذف ${document.title}`} disabled={removeLibrary.isPending} onClick={() => removeLibrary.mutate({ id: document.id })}><Trash2 size={16} /></Button></div>) : <p className="workflow-subtle">لم تُرفع موسوعة بعد. عند توفير ملفك الضخم، اختره هنا ليصبح مرجع قراءة داخل المشروع.</p>}</div></article></div>{selectedDocumentId ? <article className="safe-reader"><div><div><ShieldCheck size={20} /><h3>{selectedDocument?.title || "عارض المكتبة"}</h3></div><span>iframe sandbox · لا JavaScript</span></div>{documentContent.isLoading ? <p>جار تجهيز نسخة القراءة المعقّمة…</p> : documentContent.error ? <p className="analysis-error">{documentContent.error.message}</p> : <iframe title={`قراءة ${selectedDocument?.title || "المكتبة"}`} sandbox="" referrerPolicy="no-referrer" srcDoc={documentContent.data?.sanitizedHtml || ""} />}</article> : null}<p className="knowledge-boundary"><ShieldCheck size={16} /> هذا المركز تنظيمي ومرجعي فقط. تُستخلص نتيجة TIA من بيانات المشروع وحساباته الموثقة، لا من فيديو أو نص مكتبة منفرد.</p></>}</section>;
}
