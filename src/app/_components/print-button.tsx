"use client";
/** Opens the browser's print dialog (the report's print view; "Save as PDF" from there until the PDF export lands). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent print:hidden"
    >
      {label}
    </button>
  );
}
