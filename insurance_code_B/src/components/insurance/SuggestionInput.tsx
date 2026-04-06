import React from 'react';

interface SuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxSuggestions?: number;
  onBlur?: () => void;
  noMatchText?: string;
}

function normalize(text: string) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildSuggestions(options: string[], currentValue: string, maxSuggestions: number) {
  const unique = Array.from(new Set((options || []).map((option) => String(option || '').trim()).filter(Boolean)));
  const query = normalize(currentValue);
  if (!query) return unique.slice(0, maxSuggestions);

  const startsWith = unique.filter((option) => normalize(option).startsWith(query));
  const contains = unique.filter((option) => !startsWith.includes(option) && normalize(option).includes(query));
  return [...startsWith, ...contains].slice(0, maxSuggestions);
}

export default function SuggestionInput({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
  type = 'text',
  inputMode,
  maxSuggestions = 8,
  onBlur,
  noMatchText = '没有匹配项，可直接保存当前输入',
}: SuggestionInputProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);

  const suggestions = React.useMemo(() => buildSuggestions(options, value, maxSuggestions), [maxSuggestions, options, value]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  const showNoMatch = open && Boolean(value.trim()) && suggestions.length === 0;
  const showPanel = open && (suggestions.length > 0 || showNoMatch);

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          onBlur?.();
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        type={type}
        inputMode={inputMode}
        autoComplete="off"
      />
      {showPanel ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          {suggestions.length ? (
            <div className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
          {showNoMatch ? <div className="px-4 py-3 text-sm text-slate-500">{noMatchText}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
