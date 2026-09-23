import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASS =
  'w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg ' +
  'px-space-md py-space-sm font-body-md text-body-md text-on-surface ' +
  'placeholder:text-outline focus:outline-none focus:border-primary';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Public field props: everything except the wrapper-managed children. */
type BaseFieldProps = Omit<FieldWrapperProps, 'children'>;

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <label className="block space-y-space-xs">
      {label ? (
        <span className="font-label-md text-label-md text-on-surface-variant block">
          {label}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="font-body-sm text-body-sm text-error block">{error}</span>
      ) : hint ? (
        <span className="font-body-sm text-body-sm text-outline block">{hint}</span>
      ) : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseFieldProps;

export function Input({ label, hint, error, className = '', ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input className={`${FIELD_CLASS} ${className}`} {...rest} />
    </FieldWrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseFieldProps;

export function Textarea({ label, hint, error, className = '', ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea className={`${FIELD_CLASS} min-h-24 ${className}`} {...rest} />
    </FieldWrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & BaseFieldProps;

export function Select({ label, hint, error, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <select className={`${FIELD_CLASS} cursor-pointer ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className = '', ...rest }: CheckboxProps) {
  return (
    <label className={`flex items-start gap-space-sm cursor-pointer ${className}`}>
      <input
        type="checkbox"
        className="mt-1 w-4 h-4 accent-primary shrink-0"
        {...rest}
      />
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
    </label>
  );
}
