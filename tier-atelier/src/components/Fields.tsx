import { useId, type ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label>{children(id)}{hint && <p className="field-hint">{hint}</p>}</div>;
}
