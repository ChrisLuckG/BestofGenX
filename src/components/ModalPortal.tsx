"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Renders full-screen overlays directly into <body>. A `fixed inset-0` overlay
// rendered inside the page content is trapped in that content's stacking context,
// so the sticky desktop header and sidebar (z-50) painted on top of the backdrop
// no matter how high the overlay's own z-index was.
export default function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
