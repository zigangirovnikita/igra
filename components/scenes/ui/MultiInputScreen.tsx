import { useState, type ReactNode } from 'react';

export type MultiInputField = {
  id: string;
  label: ReactNode;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
};

type Props = {
  title: ReactNode;
  description?: ReactNode;
  fields: MultiInputField[];
  initialValues?: Record<string, string | number>;
  buttonText: string;
  imageClass?: string;
  onSubmit: (values: Record<string, string | number>) => void;
  busy?: boolean;
};

export function MultiInputScreen({
  title,
  description,
  fields,
  initialValues = {},
  buttonText,
  imageClass,
  onSubmit,
  busy
}: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initialValues);

  const handleChange = (id: string, value: string | number) => {
    setValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busy) {
      onSubmit(values);
    }
  };

  return (
    <div className="scene-step">
      {imageClass && <div className={`scene-image ${imageClass}`} aria-hidden="true" />}
      
      <h2 className="scene-question">{title}</h2>
      {description && <p className="scene-description">{description}</p>}
      
      <form onSubmit={handleSubmit} className="scene-form">
        {fields.map(field => (
          <div key={field.id} className="scene-form-group">
            <label className="scene-label">{field.label}</label>
            {field.type === 'select' ? (
              <select
                className="scene-select"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={busy}
                required
              >
                <option value="" disabled>Выберите вариант...</option>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                className="scene-input"
                type={field.type}
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                disabled={busy}
                required
              />
            )}
          </div>
        ))}
        
        <button 
          type="submit" 
          className="btn-primary scene-submit-btn" 
          disabled={busy}
        >
          {busy ? 'Сохранение...' : buttonText}
        </button>
      </form>
    </div>
  );
}
