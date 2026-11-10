import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { Client, TattooReference, ClinicalHistory } from '../types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Instagram,
  FileHeart,
  Image as ImageIcon,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Euro,
  Edit2,
  Trash2,
  Upload,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  MessageCircle,
} from 'lucide-react';
import { getWhatsAppUrl } from '../services/messaging';

export const ClientCRMView: React.FC = () => {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    updateClinicalHistory,
    addClientReference,
    deleteClientReference,
    appointments,
    selectedClientId,
    setSelectedClientId,
    showToast,
  } = useStudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMedicalAlert, setFilterMedicalAlert] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isEditingClinical, setIsEditingClinical] = useState(false);
  const [isAddingReference, setIsAddingReference] = useState(false);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientBirthDate, setNewClientBirthDate] = useState('1995-01-01');
  const [newClientInstagram, setNewClientInstagram] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // New Reference Form State
  const [newRefTitle, setNewRefTitle] = useState('');
  const [newRefUrl, setNewRefUrl] = useState('');
  const [newRefType, setNewRefType] = useState<'past_work' | 'inspiration'>('past_work');
  const [newRefPlacement, setNewRefPlacement] = useState('');
  const [newRefNotes, setNewRefNotes] = useState('');

  // Selected client
  const activeClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  // Filtered clients list
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.instagram && c.instagram.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterMedicalAlert) {
      const hasAllergies = c.clinicalHistory.allergies.length > 0;
      const hasSkin = c.clinicalHistory.skinConditions.length > 0;
      const hasMedicalCondition =
        c.clinicalHistory.hasBleedingDisorder ||
        c.clinicalHistory.hasDiabetes ||
        c.clinicalHistory.hasEpilepsy ||
        c.clinicalHistory.hasHeartCondition ||
        c.clinicalHistory.isPregnantOrNursing;
      return hasAllergies || hasSkin || hasMedicalCondition;
    }

    return true;
  });

  // Client appointments
  const clientAppointments = activeClient
    ? appointments.filter((a) => a.clientId === activeClient.id)
    : [];

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) {
      showToast('Nome e telefone são obrigatórios.', 'info');
      return;
    }

    const created = addClient({
      name: newClientName,
      email: newClientEmail,
      phone: newClientPhone,
      birthDate: newClientBirthDate,
      instagram: newClientInstagram,
      notes: newClientNotes,
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

    setSelectedClientId(created.id);
    setIsAddingClient(false);
    // Reset
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientInstagram('');
    setNewClientNotes('');
  };

  const handleAddReferenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !newRefTitle || !newRefUrl) {
      showToast('Por favor insere o título e o link da imagem.', 'info');
      return;
    }

    addClientReference(activeClient.id, {
      title: newRefTitle,
      imageUrl: newRefUrl,
      type: newRefType,
      placement: newRefPlacement,
      notes: newRefNotes,
      date: new Date().toISOString().split('T')[0],
    });

    setIsAddingReference(false);
    setNewRefTitle('');
    setNewRefUrl('');
    setNewRefPlacement('');
    setNewRefNotes('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setNewRefUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sample presets for quick demo addition
  const samplePresets = [
    {
      title: 'Trabalho Fineline Floral Healed',
      url: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=600&auto=format&fit=crop&q=80',
      type: 'past_work' as const,
      placement: 'Braço',
    },
    {
      title: 'Ideia Blackwork Geométrico',
      url: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=600&auto=format&fit=crop&q=80',
      type: 'inspiration' as const,
      placement: 'Costas / Omoplata',
    },
    {
      title: 'Referência Dragão Oriental',
      url: 'https://images.unsplash.com/photo-1590246814883-578345c26b9a?w=600&auto=format&fit=crop&q=80',
      type: 'inspiration' as const,
      placement: 'Coxa',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-500" />
            Base de Dados de Clientes & CRM
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ficha clínica completa, anamnese médica, consentimentos e histórico de referências visuais.
          </p>
        </div>

        <button
          onClick={() => setIsAddingClient(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Main CRM Grid: Client list (left) & Detailed dossier (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Client List (4 cols on lg, iPad friendly) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search & Medical alert filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Pesquisar cliente, tel, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <button
              onClick={() => setFilterMedicalAlert(!filterMedicalAlert)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                filterMedicalAlert
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                  : 'bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {filterMedicalAlert ? 'A filtrar por Alerta Clínico' : 'Filtrar Alertas Clínicos'}
            </button>
          </div>

          {/* Clients Scrollable List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredClients.length === 0 ? (
              <div className="text-center py-10 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500">
                Nenhum cliente encontrado.
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = activeClient?.id === client.id;
                const hasAllergies = client.clinicalHistory.allergies.length > 0;
                const hasHealthAlert =
                  client.clinicalHistory.hasBleedingDisorder ||
                  client.clinicalHistory.hasDiabetes ||
                  client.clinicalHistory.hasEpilepsy ||
                  client.clinicalHistory.hasHeartCondition ||
                  client.clinicalHistory.isPregnantOrNursing;

                return (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-900 dark:border-white shadow-sm'
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm truncate">
                          {client.name}
                        </span>
                        {(hasAllergies || hasHealthAlert) && (
                          <span
                            title="Atenção clínica / Alergias"
                            className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                          />
                        )}
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {client.phone} • {client.email}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-white dark:text-zinc-950' : 'text-zinc-400'
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Client Deep Dossier (8 cols on lg) */}
        {activeClient ? (
          <div className="lg:col-span-8 space-y-5">
            {/* Client Top Card: Info & Contact Quick Links */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {activeClient.name}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Cliente desde {activeClient.createdAt}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Nascimento: {activeClient.birthDate} {activeClient.instagram ? `• Instagram: ${activeClient.instagram}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsAppUrl(activeClient.phone, `Olá ${activeClient.name}! Entramos em contacto do estúdio.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${activeClient.phone}`}
                    className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs transition-colors"
                    title="Ligar"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`mailto:${activeClient.email}`}
                    className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs transition-colors"
                    title="Enviar Email"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => deleteClient(activeClient.id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs transition-colors cursor-pointer"
                    title="Remover cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {activeClient.notes && (
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mr-1">Notas gerais:</span>
                  {activeClient.notes}
                </div>
              )}

              {/* Messages after a session (services/followUps.ts) */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!activeClient.marketingConsentAt}
                    onChange={(e) => updateClient(activeClient.id, { marketingConsentAt: e.target.checked ? new Date().toISOString() : '' })}
                  />
                  Aceita que voltemos a falar daqui a uns meses
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!activeClient.followUpOptOutAt}
                    onChange={(e) => updateClient(activeClient.id, { followUpOptOutAt: e.target.checked ? new Date().toISOString() : '' })}
                  />
                  Pediu para não receber mensagens
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeClient.language === 'en'}
                    onChange={(e) => updateClient(activeClient.id, { language: e.target.checked ? 'en' : '' })}
                  />
                  Escrever em inglês
                </label>
              </div>
            </div>

            {/* Ficha Clínica & Anamnese */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500">
                    <FileHeart className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Histórico Clínico & Anamnese
                  </h4>
                </div>

                <button
                  onClick={() => setIsEditingClinical(!isEditingClinical)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {isEditingClinical ? 'Fechar Edição' : 'Editar Ficha'}
                </button>
              </div>

              {/* Clinical Overview Badges */}
              {!isEditingClinical ? (
                <div className="space-y-3">
                  {/* Consent Status */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/80 text-xs">
                    <span className="text-zinc-500">Termo de Consentimento Informado:</span>
                    {activeClient.clinicalHistory.consentSigned ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Assinado {activeClient.clinicalHistory.consentDate && `(${activeClient.clinicalHistory.consentDate})`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-500">
                        <XCircle className="w-3.5 h-3.5" />
                        Pendente de Assinatura
                      </span>
                    )}
                  </div>

                  {/* Allergies & Skin Conditions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-1.5">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Alergias Registadas:
                      </span>
                      {activeClient.clinicalHistory.allergies.length === 0 ? (
                        <span className="text-zinc-400 italic">Nenhuma alergia conhecida.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activeClient.clinicalHistory.allergies.map((a, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
                            >
                              ⚠️ {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-1.5">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                        Condições Dermatológicas:
                      </span>
                      {activeClient.clinicalHistory.skinConditions.length === 0 ? (
                        <span className="text-zinc-400 italic">Pele normal, sem lesões ativas.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activeClient.clinicalHistory.skinConditions.map((s, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checklist of High Risk Conditions */}
                  <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                      Fatores Médicos de Atenção:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.hasDiabetes ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Diabetes: {activeClient.clinicalHistory.hasDiabetes ? 'Sim' : 'Não'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.hasBleedingDisorder ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Distúrbios Hemorrágicos: {activeClient.clinicalHistory.hasBleedingDisorder ? 'Sim' : 'Não'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.hasEpilepsy ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Epilepsia: {activeClient.clinicalHistory.hasEpilepsy ? 'Sim' : 'Não'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.hasHeartCondition ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Problemas Cardíacos: {activeClient.clinicalHistory.hasHeartCondition ? 'Sim' : 'Não'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.isPregnantOrNursing ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Grávida / A amamentar: {activeClient.clinicalHistory.isPregnantOrNursing ? 'Sim' : 'Não'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        {activeClient.clinicalHistory.hasKeloidHistory ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Historial Quelóides: {activeClient.clinicalHistory.hasKeloidHistory ? 'Sim' : 'Não'}</span>
                      </div>
                    </div>
                  </div>

                  {activeClient.clinicalHistory.clinicalNotes && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                      <span className="font-semibold block mb-0.5">Observações Clínicas do Tatuador:</span>
                      {activeClient.clinicalHistory.clinicalNotes}
                    </div>
                  )}
                </div>
              ) : (
                /* Edit Clinical Form */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setIsEditingClinical(false);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Alergias (separadas por vírgula):
                    </label>
                    <input
                      type="text"
                      value={activeClient.clinicalHistory.allergies.join(', ')}
                      onChange={(e) =>
                        updateClinicalHistory(activeClient.id, {
                          ...activeClient.clinicalHistory,
                          allergies: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Ex: Látex, Níquel, Pomada Bepanthene..."
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Condições de Pele (separadas por vírgula):
                    </label>
                    <input
                      type="text"
                      value={activeClient.clinicalHistory.skinConditions.join(', ')}
                      onChange={(e) =>
                        updateClinicalHistory(activeClient.id, {
                          ...activeClient.clinicalHistory,
                          skinConditions: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Ex: Dermatite atópica, Psoríase, Pele muito sensível..."
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.hasDiabetes}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            hasDiabetes: e.target.checked,
                          })
                        }
                      />
                      <span>Diabetes</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.hasBleedingDisorder}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            hasBleedingDisorder: e.target.checked,
                          })
                        }
                      />
                      <span>Distúrbios Hemorrágicos</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.hasEpilepsy}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            hasEpilepsy: e.target.checked,
                          })
                        }
                      />
                      <span>Epilepsia</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.hasHeartCondition}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            hasHeartCondition: e.target.checked,
                          })
                        }
                      />
                      <span>Doença Cardíaca</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.isPregnantOrNursing}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            isPregnantOrNursing: e.target.checked,
                          })
                        }
                      />
                      <span>Grávida ou a amamentar</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClient.clinicalHistory.consentSigned}
                        onChange={(e) =>
                          updateClinicalHistory(activeClient.id, {
                            ...activeClient.clinicalHistory,
                            consentSigned: e.target.checked,
                            consentDate: e.target.checked ? new Date().toISOString().split('T')[0] : undefined,
                          })
                        }
                      />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Consentimento Assinado
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Observações Clínicas Adicionais:
                    </label>
                    <textarea
                      rows={2}
                      value={activeClient.clinicalHistory.clinicalNotes || ''}
                      onChange={(e) =>
                        updateClinicalHistory(activeClient.id, {
                          ...activeClient.clinicalHistory,
                          clinicalNotes: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                    >
                      Guardar Alterações Clínicas
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Referências de Trabalhos Anteriores & Inspiração */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Galeria de Referências & Trabalhos Anteriores
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Tatuagens cicatrizadas e imagens de referência para projetos futuros.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddingReference(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Foto
                </button>
              </div>

              {/* Add Reference Modal / Inline Form */}
              {isAddingReference && (
                <form
                  onSubmit={handleAddReferenceSubmit}
                  className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs"
                >
                  <h5 className="font-bold text-zinc-900 dark:text-zinc-100">
                    Nova Foto / Referência de Tatuagem
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-500 mb-1">Título / Descrição:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Peónia Healed Antebraço"
                        value={newRefTitle}
                        onChange={(e) => setNewRefTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">Tipo de Imagem:</label>
                      <select
                        value={newRefType}
                        onChange={(e) => setNewRefType(e.target.value as 'past_work' | 'inspiration')}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      >
                        <option value="past_work">Trabalho Anterior Feito no Estúdio (Cicatrizado)</option>
                        <option value="inspiration">Inspiração / Projeto Futuro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">Local Anatómico:</label>
                      <input
                        type="text"
                        placeholder="Ex: Costelas, Braço esquerdo"
                        value={newRefPlacement}
                        onChange={(e) => setNewRefPlacement(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">URL da Imagem:</label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={newRefUrl}
                        onChange={(e) => setNewRefUrl(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                  </div>

                  {/* Or upload local photo */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Carregar do Dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <div className="text-[11px] text-zinc-400">
                      Ou escolhe um exemplo rápido:
                      {samplePresets.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setNewRefTitle(p.title);
                            setNewRefUrl(p.url);
                            setNewRefType(p.type);
                            setNewRefPlacement(p.placement);
                          }}
                          className="ml-1 text-blue-500 hover:underline cursor-pointer"
                        >
                          [{p.title.split(' ')[0]}]
                        </button>
                      ))}
                    </div>
                  </div>

                  {newRefUrl && (
                    <div className="mt-2">
                      <img
                        src={newRefUrl}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingReference(false)}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold"
                    >
                      Adicionar à Galeria
                    </button>
                  </div>
                </form>
              )}

              {/* Gallery Grid */}
              {activeClient.references.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-400">
                  Nenhuma referência ou foto de trabalho guardada para este cliente.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {activeClient.references.map((ref) => (
                    <div
                      key={ref.id}
                      className="group relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                        <img
                          src={ref.imageUrl}
                          alt={ref.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              ref.type === 'past_work'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {ref.type === 'past_work' ? 'Trabalho Feito' : 'Inspiração'}
                          </span>
                          <button
                            onClick={() => deleteClientReference(activeClient.id, ref.id)}
                            className="text-zinc-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                            title="Eliminar referência"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <h5 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {ref.title}
                        </h5>
                        {ref.placement && (
                          <p className="text-[11px] text-zinc-500">📍 {ref.placement}</p>
                        )}
                        {ref.notes && (
                          <p className="text-[10px] text-zinc-400 line-clamp-2">{ref.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico de Marcações do Cliente */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                  <History className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Histórico de Marcações do Cliente ({clientAppointments.length})
                </h4>
              </div>

              {clientAppointments.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3">Sem marcações no histórico.</p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {clientAppointments.map((appt) => (
                    <div key={appt.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {appt.date} ({appt.startTime})
                          </span>
                          <span className="text-zinc-500">• {appt.artistName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              appt.status === 'confirmed'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {appt.placement} — {appt.style}
                        </p>
                      </div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        €{appt.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400">
            Seleciona um cliente da lista para ver o dossier clínico e referências.
          </div>
        )}
      </div>

      {/* New Client Modal */}
      {isAddingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Registar Novo Cliente
            </h3>

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Telefone *</label>
                  <input
                    type="tel"
                    required
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="+351 9..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={newClientBirthDate}
                    onChange={(e) => setNewClientBirthDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Instagram</label>
                  <input
                    type="text"
                    placeholder="@perfil"
                    value={newClientInstagram}
                    onChange={(e) => setNewClientInstagram(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Notas Gerais</label>
                <textarea
                  rows={2}
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="Preferências, recomendações..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold cursor-pointer"
                >
                  Criar Ficha de Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
