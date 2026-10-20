"use client";

import { useState } from "react";

/* Password input with a Show/Hide button, so João can check what he's typed on a phone. */
export function PasswordField() {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password">
      <input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        autoFocus
      />
      <button
        type="button"
        className="password__toggle"
        aria-controls="password"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
