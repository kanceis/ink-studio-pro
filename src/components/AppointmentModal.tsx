import React, { useState, useEffect } from 'react';
import { useStudio } from '../context/StudioContext';
import { Appointment } from '../types';
import {
  Calendar,
  Clock,
  User,
  Euro,
  FileText,
  CalendarCheck2,
  Trash2,
  X,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { getWhatsAppUrl, generateConfirmationMessage } from '../services/messaging';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointmentToEdit?: Appointment | null;
}

export const AppointmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  appointmentToEdit,
}) => {
  const {
    clients,
    artists,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    addClient,
    googleToken,
    settings,
    showToast,
  } = useStudio();

  // Form State
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [artistId, setArtistId] = useState(artists[0]?.id || '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('17:00');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [price, setPrice] = useState<number>(200);
  const [deposit, setDeposit] = useState<number>(50);
  const [status, setStatus] = useState<Appointment['status']>('confirmed');
  const [placement, setPlacement] = useState('Antebraço');
  const [style, setStyle] = useState('Fineline');
  const [notes, setNotes] = useState('');
  const [syncToGoogle, setSyncToGoogle] = useState(true);
  const [sendInstantConfirmation, setSendInstantConfirmation] = useState(true);

  useEffect(() => {
    if (appointmentToEdit) {
      setClientId(appointmentToEdit.clientId);
      setClientName(appointmentToEdit.clientName);
      setClientPhone(appointmentToEdit.clientPhone);
      setClientEmail(appointmentToEdit.clientEmail);
      setArtistId(appointmentToEdit.artistId);
      setTitle(appointmentToEdit.title);
      setDate(appointmentToEdit.date);
      setStartTime(appointmentToEdit.startTime);
      setEndTime(appointmentToEdit.endTime);
      setDurationMinutes(appointmentToEdit.durationMinutes);
      setPrice(appointmentToEdit.price);
      setDeposit(appointmentToEdit.deposit);
      setStatus(appointmentToEdit.status);
      setPlacement(appointmentToEdit.placement);
      setStyle(appointmentToEdit.style);
      setNotes(appointmentToEdit.notes || '');
      setSyncToGoogle(!!appointmentToEdit.syncToGoogleCalendar);
      setSendInstantConfirmation(false);
    } else {
      // Default to first artist and clear
      setClientId('');
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setArtistId(artists[0]?.id || '');
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('14:00');
      setEndTime('17:00');
      setPrice(200);
      setDeposit(50);
      setStatus('confirmed');
      setPlacement('Antebraço');
      setStyle('Fineline');
      setNotes('');
      setSyncToGoogle(!!googleToken);
      setSendInstantConfirmation(true);
    }
  }, [appointmentToEdit, artists, googleToken]);

  if (!isOpen) return null;

  const handleClientSelect = (id: string) => {
    setClientId(id);
    const found = clients.find((c) => c.id === id);
    if (found) {
      setClientName(found.name);
      setClientPhone(found.phone);
      setClientEmail(found.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone) {
      showToast('Nome e telefone do cliente são obrigatórios.', 'info');
      return;
    }

    const selectedArtist = artists.find((a) => a.id === artistId);
    const artistName = selectedArtist ? selectedArtist.name : 'Artista';

    // Auto-create client if not existing
    let effectiveClientId = clientId;
    if (!effectiveClientId) {
      const createdClient = addClient({
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        birthDate: '1995-01-01',
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
          consentSigned: true,
          consentDate: new Date().toISOString().split('T')[0],
        },
        references: [],
      });
      effectiveClientId = createdClient.id;
    }

    if (appointmentToEdit) {
      await updateAppointment(appointmentToEdit.id, {
        clientId: effectiveClientId,
        clientName,
        clientPhone,
        clientEmail,
        artistId,
        artistName,
        title: title || `${style} em ${placement}`,
        date,
        startTime,
        endTime,
        durationMinutes,
        price,
        deposit,
        status,
        placement,
        style,
        notes,
        syncToGoogleCalendar: syncToGoogle,
      });
    } else {
      const createdAppt = await addAppointment({
        clientId: effectiveClientId,
        clientName,
        clientPhone,
        clientEmail,
        artistId,
        artistName,
        title: title || `${style} em ${placement}`,
        date,
        startTime,
        endTime,
        durationMinutes,
        price,
        deposit,
        status,
        placement,
        style,
        notes,
        syncToGoogleCalendar: syncToGoogle,
        confirmationSent: false,
        reminder24hSent: false,
      });

      if (sendInstantConfirmation) {
        // Open WhatsApp with confirmation ready using safe anchor click
        const msg = generateConfirmationMessage(createdAppt, settings);
        const url = getWhatsAppUrl(clientPhone, msg.text);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!appointmentToEdit) return;
    const deleted = await deleteAppointment(appointmentToEdit.id);
    if (deleted) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            {appointmentToEdit ? 'Editar Marcação' : 'Nova Marcação de Tatuagem'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Client Selection */}
          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
              Selecionar Cliente Existente ou Inserir Novo:
            </label>
            <select
              value={clientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-2 cursor-pointer"
            >
              <option value="">-- Novo Cliente (preencher abaixo) --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Nome do Cliente *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Ana Silva"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Telefone (com indicativo) *</label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+351 912 345 678"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Email (para notificações Gmail)</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@exemplo.com"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Artista Responsável</label>
              <select
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-pointer"
              >
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.commissionRate}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Data *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Início</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Término</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
          </div>

          {/* Placement & Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Local Anatómico</label>
              <input
                type="text"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder="Ex: Antebraço, Costelas, Omoplata"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Estilo / Projeto</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="Ex: Fineline Botânico, Blackwork"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
            </div>
          </div>

          {/* Price & Deposit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Valor Total (€)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Sinal Recebido (€)</label>
              <input
                type="number"
                min="0"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Appointment['status'])}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="confirmed">Confirmada</option>
                <option value="pending">Pendente</option>
                <option value="completed">Concluída</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Notas / Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções específicas para a agulha, cuidados especiais..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
          </div>

          {/* Integrations Toggles */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncToGoogle}
                onChange={(e) => setSyncToGoogle(e.target.checked)}
              />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <CalendarCheck2 className="w-3.5 h-3.5 text-blue-500" />
                Sincronizar com Google Agenda
              </span>
            </label>

            {!appointmentToEdit && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInstantConfirmation}
                  onChange={(e) => setSendInstantConfirmation(e.target.checked)}
                />
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Abrir envio de mensagem de confirmação imediata
                </span>
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            {appointmentToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-bold hover:bg-zinc-800 cursor-pointer"
              >
                {appointmentToEdit ? 'Atualizar Marcação' : 'Criar Marcação'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
