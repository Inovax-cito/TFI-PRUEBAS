import React from 'react';
import { Building2, ShieldCheck, Store } from 'lucide-react';

export const ROLE_OPTIONS = [
  {
    id: 'EMPRENDEDOR',
    icon: Store,
    title: 'Soy emprendedor/a',
    text: 'Busco ferias y espacios donde ofrecer mis productos, me postulo y llevo mis pedidos y ventas.',
  },
  {
    id: 'ORGANIZADOR',
    icon: Building2,
    title: 'Administro un espacio',
    text: 'Tengo una galería, un local, un salón o un permiso para usar un lugar y quiero recibir emprendedores.',
  },
];

export function RoleChoice({ value, onChange, compact = false }) {
  return (
    <div className={`role-choice ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="¿Cómo vas a usar Emprende?">
      {ROLE_OPTIONS.map(({ id, icon: Icon, title, text }) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'selected' : ''} onClick={() => onChange(id)}>
          <span className="role-choice-icon"><Icon size={20} /></span>
          <span className="role-choice-copy"><strong>{title}</strong>{!compact && <small>{text}</small>}</span>
        </button>
      ))}
      {value === 'ORGANIZADOR' && (
        <p className="role-choice-note">
          <ShieldCheck size={15} />
          Para publicar convocatorias vas a tener que acreditar que podés usar el espacio (escritura, contrato, permiso municipal o autorización del titular). Lo revisa la administración de Emprende.
        </p>
      )}
    </div>
  );
}
