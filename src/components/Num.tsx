/** Campo numérico que acepta coma decimal y solo guarda al salir (no en cada tecla). */
export default function Num({ value, onCommit, label, className = '' }: {
  value: number; onCommit: (n: number) => void; label: string; className?: string;
}) {
  const text = String(value).replace('.', ',');
  return (
    <input
      key={value}
      className={`input px-1 py-2 text-center tabular-nums ${className}`}
      aria-label={label}
      inputMode="decimal"
      defaultValue={text}
      onFocus={e => e.target.select()}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onBlur={e => {
        const n = parseFloat(e.target.value.replace(',', '.'));
        if (Number.isFinite(n) && n >= 0 && n !== value) onCommit(n);
        else e.target.value = text;
      }}
    />
  );
}
