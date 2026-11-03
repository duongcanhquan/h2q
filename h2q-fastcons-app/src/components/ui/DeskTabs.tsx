"use client";

import { useState } from "react";

export function DeskTabs({ tabs, children }: { tabs: string[]; children: React.ReactNode[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div>
      <div role="tablist" className="desk-tabs">
        {tabs.map((label, at) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === at}
            className={index === at ? "is-on" : ""}
            onClick={() => setIndex(at)}
          >
            {label}
          </button>
        ))}
      </div>
      {children.map((child, at) => (
        <div key={tabs[at]} role="tabpanel" hidden={index !== at} className="mt-3">
          {child}
        </div>
      ))}
    </div>
  );
}
