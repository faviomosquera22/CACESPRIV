"use client";

import { useEffect, useRef, useState } from "react";
import { EyeOff } from "lucide-react";

const editableSelector =
  'input, textarea, select, [contenteditable="true"], [data-allow-selection="true"]';
function getElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function isEditableTarget(target: EventTarget | null) {
  return Boolean(getElement(target)?.closest(editableSelector));
}

function isPrintScreenEvent(event: KeyboardEvent) {
  return event.key === "PrintScreen" || event.code === "PrintScreen";
}

function isCopyShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();

  return (event.metaKey || event.ctrlKey) && (key === "c" || key === "x");
}

export function ContentProtection() {
  const [isObscured, setIsObscured] = useState(false);
  const temporaryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTemporaryTimer() {
      if (temporaryTimerRef.current) {
        window.clearTimeout(temporaryTimerRef.current);
        temporaryTimerRef.current = null;
      }
    }

    function revealIfActive() {
      clearTemporaryTimer();

      if (document.visibilityState === "visible" && document.hasFocus()) {
        setIsObscured(false);
      }
    }

    function obscureUntilFocused() {
      clearTemporaryTimer();
      setIsObscured(true);
    }

    function obscureTemporarily() {
      setIsObscured(true);
      clearTemporaryTimer();

      temporaryTimerRef.current = window.setTimeout(() => {
        if (document.visibilityState === "visible" && document.hasFocus()) {
          setIsObscured(false);
        }
      }, 1200);
    }

    function blockProtectedInteraction(event: Event) {
      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function handleKeyboard(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (isCopyShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (isPrintScreenEvent(event)) {
        event.preventDefault();
        event.stopPropagation();
        obscureTemporarily();
        void navigator.clipboard?.writeText?.("")?.catch(() => {});
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        obscureUntilFocused();
        return;
      }

      revealIfActive();
    }

    document.addEventListener("contextmenu", blockProtectedInteraction, true);
    document.addEventListener("copy", blockProtectedInteraction, true);
    document.addEventListener("cut", blockProtectedInteraction, true);
    document.addEventListener("selectstart", blockProtectedInteraction, true);
    document.addEventListener("dragstart", blockProtectedInteraction, true);
    document.addEventListener("keydown", handleKeyboard, true);
    document.addEventListener("keyup", handleKeyboard, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", obscureUntilFocused);
    window.addEventListener("focus", revealIfActive);
    window.addEventListener("pageshow", revealIfActive);
    window.addEventListener("pagehide", obscureUntilFocused);

    const initialFocusTimer = window.setTimeout(() => {
      if (!document.hasFocus()) {
        setIsObscured(true);
      }
    }, 0);

    return () => {
      clearTemporaryTimer();
      window.clearTimeout(initialFocusTimer);
      document.removeEventListener("contextmenu", blockProtectedInteraction, true);
      document.removeEventListener("copy", blockProtectedInteraction, true);
      document.removeEventListener("cut", blockProtectedInteraction, true);
      document.removeEventListener("selectstart", blockProtectedInteraction, true);
      document.removeEventListener("dragstart", blockProtectedInteraction, true);
      document.removeEventListener("keydown", handleKeyboard, true);
      document.removeEventListener("keyup", handleKeyboard, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", obscureUntilFocused);
      window.removeEventListener("focus", revealIfActive);
      window.removeEventListener("pageshow", revealIfActive);
      window.removeEventListener("pagehide", obscureUntilFocused);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden={!isObscured}
        aria-label="Contenido protegido mientras la ventana no esta activa"
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 text-white backdrop-blur-2xl transition-opacity duration-150 ${
          isObscured
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        role="status"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl">
          <EyeOff className="h-8 w-8" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}
