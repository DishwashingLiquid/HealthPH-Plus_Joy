import { useState } from "react";
import { useFetchCommentModerationQueueQuery, useModerateHealthLiteracyCommentMutation } from "../../../../features/api/healthLiteracyHubSlice";

export default function CommentModeration() {
  const [status, setStatus] = useState("pending");
  const [cursor, setCursor] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const { data, isFetching, error, refetch } = useFetchCommentModerationQueueQuery({ status, cursor });
  const [moderate, { isLoading }] = useModerateHealthLiteracyCommentMutation();
  return <section className="hl-moderation" aria-label="Website comment moderation">
    <h2 className="text-[20px] font-semibold text-primary-800">Website comment moderation</h2>
    <p className="hl-meta">New submissions require approval. Only approved comments appear publicly.</p>
    <label htmlFor="hl-moderation-status">Review comments: </label>
    <select id="hl-moderation-status" value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null); setHistory([]); }}>
      <option value="pending">Pending</option><option value="approved">Approved / reported</option><option value="hidden">Hidden</option>
    </select>
    {isFetching && <p role="status">Loading moderation queue…</p>}
    {error && <p role="alert">Unable to load comments. <button type="button" className="hl-text-button" onClick={refetch}>Retry</button></p>}
    {!isFetching && data?.items.length === 0 && <p>No {status} comments.</p>}
    <ul className="hl-comment-list">{data?.items.map((comment) => <li key={comment.id}>
      <p className="hl-meta">{comment.contentOrigin} · {comment.contentType} · {comment.contentId} · {new Date(comment.createdAt).toLocaleString()} · {comment.reportCount} reports</p>
      <p>{comment.body}</p>
      <div className="hl-actions">{["approved", "hidden", "deleted"].filter((value) => value !== status).map((value) => <button key={value} type="button" disabled={isLoading}
        className="hl-button hl-secondary" onClick={async () => {
          try { await moderate({ id: comment.id, status: value }).unwrap(); setMessage(`Comment ${value}.`); }
          catch (err) { setMessage(err?.data?.detail || "Moderation failed. Please retry."); }
        }}>{value === "approved" ? "Approve" : value === "hidden" ? "Hide" : "Delete"}</button>)}</div>
    </li>)}</ul>
    <div className="hl-actions"><button className="hl-button hl-secondary" type="button" disabled={!history.length || isFetching} onClick={() => { setCursor(history.at(-1)); setHistory((v) => v.slice(0, -1)); }}>Previous comments</button>
      <button className="hl-button hl-secondary" type="button" disabled={!data?.nextCursor || isFetching} onClick={() => { setHistory((v) => [...v, cursor]); setCursor(data.nextCursor); }}>Next comments</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
