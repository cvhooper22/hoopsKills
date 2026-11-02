import './Field.css';

const cls = (size, className) => ['field', size === 'sm' ? 'field--sm' : '', className].filter(Boolean).join(' ');

// Text input and select in the BYU Hoops Stats design system's field style: white, hairline border, 4px corners, royal focus ring.
// `size` is 'md' (default, the design system's) or 'sm', a more compact version for dense editors. Everything else (value,
// onChange, placeholder, aria-label, className for layout) passes straight through to the element.
export function TextInput({ size = 'md', className = '', type = 'text', ...rest }) {
  return <input type={type} className={cls(size, className)} {...rest} />;
}

export function Select({ size = 'md', className = '', children, ...rest }) {
  return <select className={cls(size, className)} {...rest}>{children}</select>;
}
