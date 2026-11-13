import React, { useState } from 'react';
import { MapPin, Phone, Mail, X } from 'lucide-react';
import { fileUrl } from '../../utils/api.js';
import { RatingBadge, formatMoney } from './ui.jsx';

/** Ficha completa del emprendimiento para que la organización decida: fotos, productos y calificación. */
export function BusinessPreview({ business, onClose }) {
  const [photo, setPhoto] = useState(0);
  const photos = business.photos || [];
  return (
    <div className="messages-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="business-preview" role="dialog" aria-modal="true" aria-label={business.name}>
        <header>
          <div>
            <span className="market-kicker">EMPRENDIMIENTO</span>
            <h2>{business.name}</h2>
            <span className="business-preview-meta">{business.category} · {business.kind === 'ITINERANTE' ? 'Itinerante' : 'Local fijo'} · <RatingBadge rating={business.rating} /></span>
          </div>
          <button type="button" className="market-close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        {photos.length > 0 && (
          <div className="business-preview-gallery">
            <img src={fileUrl(photos[photo])} alt={`Foto de ${business.name}`} />
            {photos.length > 1 && <div className="business-preview-thumbs">{photos.map((url, index) => <button key={url} type="button" className={index === photo ? 'active' : ''} onClick={() => setPhoto(index)} aria-label={`Foto ${index + 1}`}><img src={fileUrl(url)} alt="" /></button>)}</div>}
          </div>
        )}
        {business.description && <p className="business-preview-text">{business.description}</p>}
        <ul className="business-preview-contact">
          <li><MapPin size={14} /> {business.address || business.locality}</li>
          {business.contactPhone && <li><Phone size={14} /> {business.contactPhone}</li>}
          {business.contactEmail && <li><Mail size={14} /> {business.contactEmail}</li>}
        </ul>
        {business.products?.length > 0 && (
          <>
            <h3>Productos</h3>
            <div className="business-preview-products">
              {business.products.map((product) => (
                <div key={product.id}>
                  {product.photoUrl ? <img src={fileUrl(product.photoUrl)} alt={product.name} loading="lazy" /> : <span className="no-photo" />}
                  <strong>{product.name}</strong>
                  <small>{formatMoney(product.price)}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default BusinessPreview;
