"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Bookmark, LogOut, Settings2, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = { display_name: string; role: "reader" | "creator" | "admin" };
type CreatorRequest = { status: "pending" | "approved" | "rejected" };

const supabase = createClient();

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [creatorRequest, setCreatorRequest] = useState<CreatorRequest | null>(null);
  const [requestingCreator, setRequestingCreator] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");

  useEffect(() => {
    const loadAccount = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
      setProfile(data);
      const { data: request } = await supabase.from("creator_requests").select("status").eq("user_id", user.id).maybeSingle();
      setCreatorRequest(request);
      setLoading(false);
    };
    loadAccount();
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleCreatorRequest = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setRequestingCreator(true);
    setRequestMessage("");
    const requestPayload = { note: applicationNote.trim(), portfolio_url: portfolioUrl.trim() || null, instagram_url: instagramUrl.trim() || null, other_url: otherUrl.trim() || null, status: "pending" };
    const query = creatorRequest?.status === "rejected"
      ? supabase.from("creator_requests").update(requestPayload).eq("user_id", userData.user.id).select("status").single()
      : supabase.from("creator_requests").insert({ user_id: userData.user.id, ...requestPayload }).select("status").single();
    const { data, error } = await query;
    if (error) {
      setRequestMessage(error.code === "23505" ? "Your creator request is already being reviewed." : "Could not send the request. Run creator-request.sql first.");
    } else {
      setCreatorRequest(data);
      setRequestMessage("Request sent. An admin will review your creator access.");
    }
    setRequestingCreator(false);
  };

  if (loading) return <main className="account-shell"><p className="account-loading">Opening your shelf...</p></main>;

  return (
    <main className="account-shell">
      <nav className="account-nav"><a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a><button className="account-logout" onClick={handleLogout} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "Logging out..." : "Log out"}</button></nav>
      <section className="account-header"><a className="auth-back" href="/"><ArrowLeft size={16} /> Back to discovery</a><div className="account-heading"><div className="account-avatar"><UserRound size={30} /></div><div><p className="eyebrow"><span /> Your reading space</p><h1>Hi, {profile?.display_name || "Reader"}.</h1><p>{email}</p></div></div></section>
      <section className="account-grid">
        <article className="account-panel account-panel-wide"><div className="panel-heading"><div><p className="eyebrow">Keep your place</p><h2>Continue reading</h2></div><BookOpen size={22} /></div><div className="account-empty"><div className="empty-icon"><BookOpen size={23} /></div><h3>Your shelf is waiting.</h3><p>Start reading a story and your latest chapter will appear here.</p><a className="button button-dark" href="/#discover">Discover stories</a></div></article>
        <article className="account-panel"><div className="panel-heading"><div><p className="eyebrow">Saved for later</p><h2>Bookmarks</h2></div><Bookmark size={22} /></div><div className="account-empty compact"><div className="empty-icon"><Bookmark size={23} /></div><p>No bookmarks yet.</p><a className="text-link" href="/#discover">Find a story <span>↗</span></a></div></article>
        <article className="account-panel"><div className="panel-heading"><div><p className="eyebrow">Your space</p><h2>Settings</h2></div><Settings2 size={22} /></div><div className="settings-row"><span>Account type</span><strong>{profile?.role || "reader"}</strong></div><div className="settings-row"><span>Email</span><strong>{email}</strong></div>{profile?.role === "creator" && <a className="account-creator-link" href="/creator"><Sparkles size={16} /> Open creator space <ArrowUpRight size={15} /></a>}{profile?.role === "admin" && <a className="account-creator-link" href="/admin"><Settings2 size={16} /> Open admin panel <ArrowUpRight size={15} /></a>}{profile?.role === "reader" && <div className="creator-request"><div className="creator-request-title"><Sparkles size={16} /> Become a creator</div><p>{creatorRequest?.status === "rejected" ? "Your request was rejected. Update your application and submit it again." : "Tell the admin what you want to publish and why your work belongs here."}</p>{creatorRequest?.status === "pending" || creatorRequest?.status === "approved" ? <span className={`request-status request-${creatorRequest.status}`}>{creatorRequest.status === "pending" ? "Request under review" : `Request ${creatorRequest.status}`}</span> : <><textarea className="creator-note" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Write your creator application..." maxLength={1000} rows={4} /><input className="creator-link-input" type="url" value={portfolioUrl} onChange={(event) => setPortfolioUrl(event.target.value)} placeholder="Portfolio komik (https://...)" /><input className="creator-link-input" type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="Instagram (https://instagram.com/...)" /><input className="creator-link-input" type="url" value={otherUrl} onChange={(event) => setOtherUrl(event.target.value)} placeholder="Website atau sosial media lain (opsional)" /><button className="text-link request-button" onClick={handleCreatorRequest} disabled={requestingCreator || !applicationNote.trim()}>{requestingCreator ? "Sending..." : creatorRequest?.status === "rejected" ? "Submit again" : "Apply for creator access"} <span>↗</span></button></>}{requestMessage && <small>{requestMessage}</small>}</div>}</article>
      </section>
    </main>
  );
}
