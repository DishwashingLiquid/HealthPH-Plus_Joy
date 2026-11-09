/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { stopCardPreviews } from "../../utils/healthLiteracyMedia";
import "../../assets/css/health-literacy.css";

export default function FeatureDialog({ title, onClose, children, photo = false, publicButtons = false }) {
  const ref = useRef(null);
  // Capture before the native dialog moves focus; retain through StrictMode effects.
  const opener = useRef(document.activeElement?.closest("button, a[href]") || document.activeElement);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = opener.current;
    const overflow = document.body.style.overflow;
    const dialog = ref.current;
    stopCardPreviews();
    document.body.style.overflow = "hidden";
    dialog.showModal(); // Native modal supplies background inertness and focus containment.
    return () => {
      if (photo && dialog.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [photo]);
  return createPortal(<dialog ref={ref} className={`hl-feature hl-dialog${photo ? " hl-dialog--photo" : ""} ${publicButtons ? "public-buttons" : "internal-buttons"}`} aria-label={title}
    onCancel={(event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (photo && ref.current?.contains(document.fullscreenElement)) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      close.current();
    }} onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>
    <div className="hl-dialog-content">
      <button autoFocus className={`hl-close hl-button${photo ? " hl-photo-icon-button" : ""}`} type="button" onClick={onClose}
        aria-label={photo ? "Close photo viewer" : undefined} title={photo ? "Close photo viewer" : undefined}>
        {photo ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg> : "Close"}
      </button>
      {children}
    </div>
  </dialog>, document.body);
}
