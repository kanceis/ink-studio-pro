import React, { useState } from 'react';
import { Check, X, Trash2, Mail, Phone, Instagram, ExternalLink } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { patchItem, removeItem } from '../../services/studioStore';
import { BookingRequest } from '../../types';
import { cardClass, chip, Detail, EmptyState, ghostBtn, primaryBtn } from './ui';
import { SiteContent } from './useSiteContent';

export const BookingRequestsPanel: React.FC<{ content: SiteContent }> = ({ content }) => {
  const { bookingRequests, addClient, showToast, setSelectedClientId, setActiveTab } = useStudio();
  const [status, setStatus] = useState<'new' | 'all'>('new');
  const [artist, setArtist] = useState<string>('all');

  const visible = bookingRequests.filter(
    (r) =>
      (status === 'all' || r.status === 'new') &&
      (artist === 'all' || (artist === 'none' ? !r.artistId : r.artistId === artist))
  );

  const accept = (req: BookingRequest) => {
    const notes = [
      `Pedido pelo site (${new Date(req.createdAt).toLocaleDateString('pt-PT')}):`,
      req.idea,
      req.artistName && `Artista: ${req.artistName}`,
      req.tattooType && `Tipo: ${req.tattooType}${req.flashNumber ? ` (flash #${req.flashNumber})` : ''}`,
      req.firstTattoo !== undefined && `Primeira tatuagem: ${req.firstTattoo ? 'sim' : 'não'}`,
      req.placement && `Zona: ${req.placement}`,
      req.size && `Tamanho: ${req.size}`,
      req.style && `Estilo: ${req.style}`,
      req.preferredDates && `Disponibilidade: ${req.preferredDates}`,
      req.referenceUrl && `Referência: ${req.referenceUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
    const client = addClient({
      name: req.name,
      email: req.email,
      phone: req.phone,
      birthDate: '',
      instagram: req.instagram,
      notes,
      references: [],
      clinicalHistory: {
        allergies: [],
        skinConditions: [],
        medications: [],
        hasBleedingDisorder: false,
        hasDiabetes: false,
        hasEpilepsy: false,
        hasHeartCondition: false,
        isPregnantOrNursing: false,
        hasKeloidHistory: false,
        consentSigned: false,
      },
    });
    patchItem('bookingRequests', req.id, { status: 'accepted', clientId: client.id }).catch(() =>
      showToast('Não foi possível atualizar o pedido.', 'error')
    );
    showToast(`Pedido aceite. ${req.name} foi adicionado aos clientes.`, 'success');
  };

  const decline = (req: BookingRequest) =>
    patchItem('bookingRequests', req.id, { status: 'declined' }).catch(() =>
      showToast('Não foi possível atualizar o pedido.', 'error')
    );

  const remove = (req: BookingRequest) => {
    if (!window.confirm(`Apagar o pedido de ${req.name}?`)) return;
    removeItem('bookingRequests', req.id).catch(() => showToast('Não foi possível apagar o pedido.', 'error'));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button className={chip(status === 'new')} onClick={() => setStatus('new')}>
          Novos
        </button>
        <button className={chip(status === 'all')} onClick={() => setStatus('all')}>
          Todos ({bookingRequests.length})
        </button>
        <span className="w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
        <button className={chip(artist === 'all')} onClick={() => setArtist('all')}>
          Todos os artistas
        </button>
        {content.artistOptions.map((a) => (
          <button key={a.id} className={chip(artist === a.id)} onClick={() => setArtist(a.id)}>
            {a.label}
          </button>
        ))}
        <button className={chip(artist === 'none')} onClick={() => setArtist('none')}>
          Sem preferência
        </button>
      </div>

      {visible.length === 0 && (
        <EmptyState>{status === 'new' ? 'Não há pedidos novos.' : 'Ainda não chegaram pedidos pelo site.'}</EmptyState>
      )}

      {visible.map((req) => (
        <div key={req.id} className={`${cardClass} p-4 space-y-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{req.name}</p>
              <p className="text-xs text-zinc-500">
                {new Date(req.createdAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })}
                {' · '}
                {req.artistName ? `para ${req.artistName}` : 'qualquer artista'}
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                req.status === 'new'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : req.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {req.status === 'new' ? 'Novo' : req.status === 'accepted' ? 'Aceite' : 'Recusado'}
            </span>
          </div>

          <p className="text-sm whitespace-pre-wrap">{req.idea}</p>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {req.tattooType && (
              <Detail label="Tipo" value={`${req.tattooType}${req.flashNumber ? ` · #${req.flashNumber}` : ''}`} />
            )}
            {req.firstTattoo !== undefined && <Detail label="1.ª tatuagem" value={req.firstTattoo ? 'Sim' : 'Não'} />}
            {req.placement && <Detail label="Zona" value={req.placement} />}
            {req.size && <Detail label="Tamanho" value={req.size} />}
            {req.style && <Detail label="Estilo" value={req.style} />}
            {req.preferredDates && <Detail label="Disponibilidade" value={req.preferredDates} />}
          </dl>

          <div className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <a href={`mailto:${req.email}`} className="inline-flex items-center gap-1 hover:underline">
              <Mail className="w-3.5 h-3.5" /> {req.email}
            </a>
            <a href={`tel:${req.phone}`} className="inline-flex items-center gap-1 hover:underline">
              <Phone className="w-3.5 h-3.5" /> {req.phone}
            </a>
            {req.instagram && (
              <span className="inline-flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5" /> {req.instagram}
              </span>
            )}
            {req.referenceUrl && /^https?:\/\//.test(req.referenceUrl) && (
              <a
                href={req.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Referência
              </a>
            )}
          </div>

          {(req.adultConfirmedAt || req.privacyAcceptedAt) && (
            <p className="text-[11px] text-zinc-500">
              {req.adultConfirmedAt && `Confirmou 18+ em ${new Date(req.adultConfirmedAt).toLocaleString('pt-PT')}`}
              {req.adultConfirmedAt && req.privacyAcceptedAt && ' · '}
              {req.privacyAcceptedAt && `Aceitou a política de privacidade em ${new Date(req.privacyAcceptedAt).toLocaleString('pt-PT')}`}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {req.status === 'new' && (
              <>
                <button className={primaryBtn} onClick={() => accept(req)}>
                  <Check className="w-4 h-4" /> Aceitar e criar cliente
                </button>
                <button className={ghostBtn} onClick={() => decline(req)}>
                  <X className="w-4 h-4" /> Recusar
                </button>
              </>
            )}
            {req.status === 'accepted' && req.clientId && (
              <button
                className={ghostBtn}
                onClick={() => {
                  setSelectedClientId(req.clientId!);
                  setActiveTab('clients');
                }}
              >
                Ver ficha do cliente
              </button>
            )}
            <button className={`${ghostBtn} ml-auto`} onClick={() => remove(req)} aria-label="Apagar pedido">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
