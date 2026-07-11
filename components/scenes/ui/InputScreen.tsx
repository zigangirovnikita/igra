import { useState, type ReactNode } from 'react';

type Props = {
  title: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  buttonText: string;
  defaultValue?: string;
  imageClass?: string;
  onSubmit: (value: string) => void;
  busy?: boolean;
};

export function InputScreen({ title, description, placeholder, buttonText, defaultValue = '', imageClass, onSubmit, busy }: Props) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !busy) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="scene-step">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}
      
      <h2 className="scene-question">{title}</h2>
      {description && <p className="scene-description">{description}</p>}
      
      <form onSubmit={handleSubmit} className="scene-form">
        <input
          className="scene-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          disabled={busy}
        />
        
        <button 
          type="submit" 
          className="btn-primary scene-submit-btn" 
          disabled={!value.trim() || busy}
        >
          {busy ? 'Сохранение...' : buttonText}
        </button>
      </form>
    </div>
  );
}
