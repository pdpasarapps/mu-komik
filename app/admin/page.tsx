"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RequestStatus = "pending" | "approved" | "rejected";
type CreatorRequest = { id: string; user_id: string; note: string; portfolio_url: string | null; instagram_url: string | null; other_url: string | null; status: RequestStatus; created_at: string; applicant: string; role: string };

const supabase = createClient();

export default function AdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequest | null>(null);

  const loadRequests = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "admin") {
      router.replace("/account");
      return;
    }
    const { data } = await supabase.from("creator_requests").select("id, user_id, note, portfolio_url, instagram_url, other_url, status, created_at").order("created_at", { ascending: false });
    const userIds = (data ?? []).map((request) => request.user_id);
    const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, role").in("id", userIds) : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setRequests((data ?? []).map((request) => ({
      ...request,
      applicant: profileMap.get(request.user_id)?.display_name || "Unnamed reader",
      role: profileMap.get(request.user_id)?.role || "reader",
    })));
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [router]);

  const reviewRequest = async (request: CreatorRequest, status: "approved" | "rejected") => {
    setActionId(request.id);
    setMessage("");
    const { error: requestError } = await supabase.from("creator_requests").update({ status, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    if (requestError) {
      setMessage(requestError.message);
      setActionId(null);
      return;
    }
    if (status === "approved") {
      const { error: profileError } = await supabase.from("profiles").update({ role: "creator" }).eq("id", request.user_id);
      if (profileError) {
        setMessage(profileError.message);
        setActionId(null);
        return;
      }
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, role: status === "approved" ? "creator" : item.role } : item));
    setMessage(status === "approved" ? "Creator access approved." : "Request rejected.");
    setActionId(null);
  };

  if (loading) return <main className="admin-shell"><LoaderCircle className="spin" size={24} /></main>;

  return <main className="admin-shell"><nav className="admin-nav"><a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a><a className="auth-back" href="/account"><ArrowLeft size={16} /> Back to account</a></nav><header className="admin-header"><p className="eyebrow"><span /> Administration</p><div className="admin-title"><div className="admin-icon"><ShieldCheck size={25} /></div><div><h1>Creator requests</h1><p>Review applications from readers who want to publish on mu-komik.</p></div></div></header><section className="admin-content">{message && <p className="admin-message">{message}</p>}{requests.length === 0 ? <div className="admin-empty"><ShieldCheck size={28} /><h2>No requests yet.</h2><p>New creator applications will appear here.</p></div> : <div className="request-table-wrap"><table className="request-table"><thead><tr><th>Applicant</th><th>Application</th><th>Portfolio & socials</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.applicant}</strong><code>{request.user_id.slice(0, 8)}...</code></td><td><p className="request-preview">{request.note || "No note provided."}</p><button className="view-button" onClick={() => setSelectedRequest(request)}>View</button></td><td><div className="request-links compact-links">{request.portfolio_url && <span>Portfolio</span>}{request.instagram_url && <span>Instagram</span>}{request.other_url && <span>Other</span>}{!request.portfolio_url && !request.instagram_url && !request.other_url && <span>None</span>}</div></td><td>{new Date(request.created_at).toLocaleDateString()}</td><td><span className={`request-status request-${request.status}`}>{request.status}</span>{request.status === "approved" && <small>Role: {request.role}</small>}</td><td>{request.status === "pending" ? <div className="request-actions"><button className="approve-button" onClick={() => reviewRequest(request, "approved")} disabled={actionId === request.id}><Check size={16} /> Approve</button><button className="reject-button" onClick={() => reviewRequest(request, "rejected")} disabled={actionId === request.id}><X size={16} /> Reject</button></div> : <span className="reviewed-label">Reviewed</span>}</td></tr>)}</tbody></table></div>}</section>{selectedRequest && <div className="request-modal-backdrop" role="presentation" onClick={() => setSelectedRequest(null)}><section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title" onClick={(event) => event.stopPropagation()}><div className="request-modal-header"><div><p className="eyebrow">Creator application</p><h2 id="request-modal-title">{selectedRequest.applicant}</h2></div><button className="modal-close" onClick={() => setSelectedRequest(null)} aria-label="Close application">×</button></div><div className="modal-meta"><span>{selectedRequest.status}</span><span>{new Date(selectedRequest.created_at).toLocaleDateString()}</span></div><p className="modal-note">{selectedRequest.note || "No note provided."}</p><div className="modal-links">{selectedRequest.portfolio_url && <a href={selectedRequest.portfolio_url} target="_blank" rel="noreferrer">Portfolio ↗</a>}{selectedRequest.instagram_url && <a href={selectedRequest.instagram_url} target="_blank" rel="noreferrer">Instagram ↗</a>}{selectedRequest.other_url && <a href={selectedRequest.other_url} target="_blank" rel="noreferrer">Other link ↗</a>}</div>{selectedRequest.status === "pending" && <div className="request-actions modal-actions"><button className="approve-button" onClick={() => { reviewRequest(selectedRequest, "approved"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><Check size={16} /> Approve</button><button className="reject-button" onClick={() => { reviewRequest(selectedRequest, "rejected"); setSelectedRequest(null); }} disabled={actionId === selectedRequest.id}><X size={16} /> Reject</button></div>}</section></div>}</main>;
}
