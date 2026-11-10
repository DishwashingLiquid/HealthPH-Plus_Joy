/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from "react";
import { commentRequest, commentResource, draftKey, getCommentSession, readDraft, saveDraft,
  setCommentSession, subscribeCommentSession } from "../../utils/publicCommentSession";

function CommentLogin({ onCancel, onSuccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const abort = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; abort.current?.abort(); }; }, []);
  const prefix = useId();
  return <form className="hl-login" aria-label="Sign in to comment" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
  }} onSubmit={async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    abort.current = new AbortController();
    try {
      const result = await commentRequest("/session", { method: "POST", signal: abort.current.signal,
        body: { email: values.get("email"), password: values.get("password") } });
      if (active.current) { setCommentSession(result); onSuccess(); }
    } catch (err) { if (active.current && err.name !== "AbortError") setError(err.message); }
    finally { if (active.current) setBusy(false); }
  }}>
    <h3>Sign in to comment</h3>
    <p>Use your HealthPH+ mobile account. Your draft stays here.</p>
    <label htmlFor={`${prefix}-email`}>Email</label>
    <input autoFocus id={`${prefix}-email`} name="email" type="email" autoComplete="username" required maxLength={254} />
    <label htmlFor={`${prefix}-password`}>Password</label>
    <input id={`${prefix}-password`} name="password" type="password" autoComplete="current-password" required maxLength={128} />
    {error && <p role="alert">{error}</p>}
    <div className="hl-actions"><button className="hl-button" disabled={busy}> {busy ? "Signing in…" : "Sign in"}</button>
      <button className="hl-button hl-secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function CommentSection({ article, readOnly = false }) {
  const resource = commentResource(article);
  const key = draftKey(resource);
  const [draft, setDraft] = useState(() => readDraft(key));
  const [session, setSession] = useState(getCommentSession);
  const [login, setLogin] = useState(false);
  const [items, setItems] = useState([]);
  const [own, setOwn] = useState([]);
  const [ownCursor, setOwnCursor] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const composer = useRef(null);
  const label = useId();
  const query = new URLSearchParams(resource).toString();
  useEffect(() => subscribeCommentSession(setSession), []);
  useEffect(() => { setDraft(readDraft(key)); setLogin(false); setOwn([]); setNotice(""); }, [key]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError(""); setItems([]); setCursor(null);
    commentRequest(`?${query}`, { signal: abort.signal }).then((result) => {
      setItems(result.items); setCursor(result.nextCursor);
    }).catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [query, revision]);
  useEffect(() => {
    if (!session || readOnly) { setOwn([]); setOwnCursor(null); return; }
    const abort = new AbortController();
    commentRequest(`/mine?${query}`, { authenticated: true, signal: abort.signal }).then((result) => { setOwn(result.items); setOwnCursor(result.nextCursor); })
      .catch((err) => { if (err.name !== "AbortError" && err.status !== 401) setError(err.message); });
    return () => abort.abort();
  }, [session, query, revision, readOnly]);
  const returnToComposer = () => { setLogin(false); requestAnimationFrame(() => composer.current?.focus()); };
  const authenticate = () => { setLogin(true); setError(""); };
  const perform = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); }
    catch (err) { setError(err.message); if (err.status === 401) authenticate(); }
    finally { setBusy(false); }
  };
  return <section className="hl-comments" aria-labelledby={`${label}-heading`}>
    <h2 id={`${label}-heading`}>Comments</h2>
    <p>Comments are reviewed before publication. Please avoid sharing personal health information.</p>
    {loading && <p role="status">Loading comments…</p>}
    {!loading && !error && items.length === 0 && <p>No approved comments yet.</p>}
    <ul className="hl-comment-list">{items.map((item) => <li key={item.id}>
      <strong>{item.author}</strong> <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
      <p>{item.body}</p>
      {!readOnly && <button className="hl-text-button" disabled={busy} type="button" onClick={() => {
        if (!session) return authenticate();
        perform(async () => { await commentRequest(`/${item.id}/report`, { method: "POST", authenticated: true }); setNotice("Comment reported for review."); });
      }}>Report</button>}
    </li>)}</ul>
    {cursor && <button className="hl-button hl-secondary" disabled={busy} type="button" onClick={() => perform(async () => {
      const result = await commentRequest(`?${query}&cursor=${encodeURIComponent(cursor)}`);
      setItems((previous) => [...previous, ...result.items]); setCursor(result.nextCursor);
    })}>Load more comments</button>}
    {own.length > 0 && <div><h3>Your submissions</h3><ul className="hl-comment-list">{own.map((item) => <li key={item.id}>
      <p>{item.body}</p><span>{item.status === "pending" ? "Pending approval — visible only to you" : item.status}</span>
      <button className="hl-text-button" disabled={busy} type="button" onClick={() => perform(async () => {
        await commentRequest(`/${item.id}`, { method: "DELETE", authenticated: true }); setRevision((v) => v + 1);
      })}>Delete my comment</button>
    </li>)}</ul></div>}
    {ownCursor && <button type="button" className="hl-button hl-secondary" disabled={busy} onClick={() => perform(async () => {
      const result = await commentRequest(`/mine?${query}&cursor=${encodeURIComponent(ownCursor)}`, { authenticated: true });
      setOwn((previous) => [...previous, ...result.items]); setOwnCursor(result.nextCursor);
    })}>Load more of your submissions</button>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="hl-text-button" onClick={() => setRevision((v) => v + 1)}>Retry comments</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!readOnly && (login ? <CommentLogin onCancel={returnToComposer} onSuccess={() => {
      returnToComposer(); setNotice("Signed in. Review your draft, then select Post comment.");
    }} /> : <form onSubmit={(event) => {
      event.preventDefault();
      if (!session) return authenticate();
      perform(async () => {
        const result = await commentRequest("", { method: "POST", authenticated: true, body: { ...resource, body: draft } });
        setOwn((previous) => [result, ...previous]); setDraft(""); saveDraft(key, "");
        setNotice("Submitted for approval. Your comment is visible only to you until approved.");
      });
    }}>
      <label htmlFor={`${label}-draft`}>Write a comment</label>
      <textarea ref={composer} id={`${label}-draft`} value={draft} required maxLength={2000} rows={4}
        onChange={(event) => { setDraft(event.target.value); saveDraft(key, event.target.value); }} />
      <p className="hl-meta">{draft.length}/2000 characters</p>
      <div className="hl-actions"><button className="hl-button" disabled={busy || !draft.trim()}>{busy ? "Posting…" : "Post comment"}</button>
        {session ? <button type="button" className="hl-text-button" onClick={() => { setCommentSession(null); setNotice("Signed out of comments."); }}>Sign out of comments</button>
          : <button type="button" className="hl-text-button" onClick={authenticate}>Sign in to write</button>}</div>
    </form>)}
  </section>;
}
