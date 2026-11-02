import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Clock,
  MessageCircle,
  Smartphone,
  CheckCircle2,
  Save,
  Send,
  RefreshCw,
  QrCode,
  Zap,
  ShieldCheck,
  Radio,
  ExternalLink,
  Bell,
  Volume2,
} from 'lucide-react';
import { OfficialGoogleButton } from './OfficialGoogleButton';

export const StudioProfileView: React.FC = () => {
  const {
    settings,
    updateSettings,
    googleUser,
    connectGoogle,
    disconnectGoogle,
    isConnectingGoogle,
    triggerAutomatic24hBatch,
    testAutomatedWhatsApp,
    testAutomatedEmail,
    testSystemNotification,
    requestSystemNotificationAccess,
    setIsNotificationCenterOpen,
    showToast,
  } = useStudio();

  // Local form state
  const [name, setName] = useState(settings.name);
  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [instagram, setInstagram] = useState(settings.instagram);
  const [description, setDescription] = useState(settings.description);
  const [openingHours, setOpeningHours] = useState(settings.openingHours);
  const [cancellationNoticeHours, setCancellationNoticeHours] = useState(settings.cancellationNoticeHours);

  // WhatsApp automation state
  const [whatsappAutomationEnabled, setWhatsappAutomationEnabled] = useState(settings.whatsappAutomationEnabled);
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState(settings.whatsappPhoneNumber || settings.phone);
  const [whatsappProvider, setWhatsappProvider] = useState(settings.whatsappProvider);

  // Email and SMS automation state
  const [emailAutomationEnabled, setEmailAutomationEnabled] = useState(settings.emailAutomationEnabled);
  const [smsAutomationEnabled, setSmsAutomationEnabled] = useState(settings.smsAutomationEnabled);
  const [smsSenderId, setSmsSenderId] = useState(settings.smsSenderId || 'INKSTUDIO');

  // System Notifications state (iPad / Telemóvel)
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(settings.systemNotificationsEnabled ?? true);
  const [isTestingSystem, setIsTestingSystem] = useState(false);

  // Trigger switches
  const [autoSendConfirmationOnBooking, setAutoSendConfirmationOnBooking] = useState(settings.autoSendConfirmationOnBooking);
  const [autoSendReminder24h, setAutoSendReminder24h] = useState(settings.autoSendReminder24h);

  // Testing states
  const [testPhone, setTestPhone] = useState(phone);
  const [testEmailAddress, setTestEmailAddress] = useState(email);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      name,
      email,
      phone,
      address,
      instagram,
      description,
      openingHours,
      cancellationNoticeHours,
      whatsappAutomationEnabled,
      whatsappPhoneNumber,
      whatsappProvider,
      emailAutomationEnabled,
      smsAutomationEnabled,
      smsSenderId,
      systemNotificationsEnabled,
      autoSendConfirmationOnBooking,
      autoSendReminder24h,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestSystem = async () => {
    setIsTestingSystem(true);
    try {
      await testSystemNotification();
    } finally {
      setIsTestingSystem(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      showToast('Insere um número de telefone com indicativo.', 'info');
      return;
    }
    setIsTestingWhatsApp(true);
    try {
      const ok = await testAutomatedWhatsApp(testPhone);
      if (ok) {
        showToast(`WhatsApp de teste disparado com sucesso através do número do estúdio (${whatsappPhoneNumber})!`, 'success');
      }
    } catch {
      showToast('Falha ao disparar teste de WhatsApp.', 'error');
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      showToast('Insere um endereço de email.', 'info');
      return;
    }
    setIsTestingEmail(true);
    try {
      await testAutomatedEmail(testEmailAddress);
      showToast(`E-mail de teste enviado com sucesso através do Gmail oficial (${email})!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no envio';
      showToast(`Erro: ${msg}`, 'error');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleRunBatchNow = async () => {
    setIsScanningBatch(true);
    try {
      const count = await triggerAutomatic24hBatch();
      if (count === 0) {
        showToast('Todas as sessões de 24h já têm lembretes enviados ou não há sessões agendadas para amanhã.', 'info');
      } else {
        showToast(`Sucesso! ${count} lembrete(s) de 24h foram disparados automaticamente via WhatsApp e E-mail.`, 'success');
      }
    } finally {
      setIsScanningBatch(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-500" />
            Perfil do Estúdio & Automação de Comunicações
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Configuração do número oficial do estúdio para WhatsApp/SMS, e-mail e motor de disparo 100% automático.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saveSuccess ? 'Guardado com Sucesso!' : 'Guardar Alterações'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: DADOS GERAIS DO ESTÚDIO */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Identificação & Contactos Principais do Estúdio
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Nome Comercial do Estúdio *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Número de Telefone Principal (SMS & WhatsApp) *
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!whatsappPhoneNumber || whatsappPhoneNumber === phone) {
                      setWhatsappPhoneNumber(e.target.value);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                E-mail Oficial do Estúdio *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Instagram Oficial
              </label>
              <div className="relative">
                <Instagram className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Morada Completa do Estúdio (incluída no Google Calendar e nas mensagens de confirmação)
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Horário de Funcionamento
              </label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Antecedência Mínima para Cancelamento / Reagendamento (Horas)
              </label>
              <input
                type="number"
                min="0"
                value={cancellationNoticeHours}
                onChange={(e) => setCancellationNoticeHours(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Apresentação / Descrição do Estúdio
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: CONEXÃO E AUTOMAÇÃO WHATSAPP (100% AUTOMÁTICO) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Conexão & Automação Total WhatsApp</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CONEXÃO ATIVA
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  As mensagens são enviadas em segundo plano sem qualquer necessidade de validação humana ou abertura do WhatsApp.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ver Status / QR Code</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Número Fornecido para WhatsApp Automático *
              </label>
              <input
                type="tel"
                value={whatsappPhoneNumber}
                onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                placeholder="+351 912 345 678"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Todas as confirmações e lembretes aos clientes sairão com este remetente oficial.
              </span>
            </div>

            <div>
              <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                Gateway de Envio Automático
              </label>
              <select
                value={whatsappProvider}
                onChange={(e) => setWhatsappProvider(e.target.value as 'whatsapp_business_api' | 'cloud_api' | 'evolution_api')}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-pointer"
              >
                <option value="whatsapp_business_api">WhatsApp Cloud API (Meta Oficial - Em Tempo Real)</option>
                <option value="evolution_api">Evolution API Gateway (Instância Direta)</option>
                <option value="cloud_api">Twilio / Webhook Direct Bridge</option>
              </select>
            </div>
          </div>

          {/* Toggle 100% Automático */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 block">
                  Envio 100% Automático de WhatsApp
                </span>
                <p className="text-[11px] text-zinc-500">
                  Elimina cliques manuais: ao agendar ou ao chegar a janela de 24h, o sistema dispara a mensagem diretamente.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappAutomationEnabled}
                onChange={(e) => setWhatsappAutomationEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Test WhatsApp Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Número de teste (+351...)"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
            />
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={isTestingWhatsApp}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTestingWhatsApp ? 'A enviar...' : 'Disparar WhatsApp de Teste'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 3: CONEXÃO E AUTOMAÇÃO DE E-MAIL (100% AUTOMÁTICO) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Conexão & Automação de E-mail (Gmail & Workspace)</span>
                  {googleUser ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      GMAIL LIGADO
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      NÃO CONECTADO
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Os emails são enviados com design profissional e templates de cuidados pós-sessão de forma 100% automática.
                </p>
              </div>
            </div>

            <div>
              {googleUser ? (
                <button
                  type="button"
                  onClick={disconnectGoogle}
                  className="text-xs text-zinc-500 hover:text-red-500 cursor-pointer"
                >
                  Desconectar conta Google
                </button>
              ) : (
                <OfficialGoogleButton
                  onClick={connectGoogle}
                  isLoading={isConnectingGoogle}
                />
              )}
            </div>
          </div>

          {/* Toggle Email Automático */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 block">
                  Envio 100% Automático de E-mails
                </span>
                <p className="text-[11px] text-zinc-500">
                  Disparo silencioso de confirmações na criação de marcação e lembretes 24h sem interrupção.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailAutomationEnabled}
                onChange={(e) => setEmailAutomationEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Test Email Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="Email de teste (ex: cliente@email.com)"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTestingEmail ? 'A enviar...' : 'Disparar E-mail de Teste'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 4: NOTIFICAÇÕES NO SISTEMA DO IPAD E TELEMÓVEL */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Notificações no Sistema (iPad & Telemóvel)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    WEB PUSH NATIVO
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Mostra alertas no ecrã e na central do dispositivo ao confirmar marcações e 24h antes da sessão.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNotificationCenterOpen(true)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5 text-blue-500" />
                <span>Ver Central</span>
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemNotificationsEnabled}
                  onChange={(e) => setSystemNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 block">
                Alertas Imediatos no Ecrã de Bloqueio
              </span>
              <p className="text-[11px] text-zinc-500">
                Dispara notificações com som e vibração no iPadOS, iOS PWA ou Android ao receber agendamento ou 24h antes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestSystem}
              disabled={isTestingSystem}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isTestingSystem ? 'A testar...' : 'Disparar Notificação de Teste'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 5: CONEXÃO E AUTOMAÇÃO SMS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Canal de Envio SMS Automático
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Envio direto por SMS com identificador do estúdio para clientes sem dados de internet.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={smsAutomationEnabled}
                onChange={(e) => setSmsAutomationEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-100"></div>
            </label>
          </div>

          <div className="text-xs">
            <label className="block text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
              Identificador do Remetente SMS (Sender ID, máx. 11 caracteres)
            </label>
            <input
              type="text"
              maxLength={11}
              value={smsSenderId}
              onChange={(e) => setSmsSenderId(e.target.value.toUpperCase())}
              placeholder="INKSTUDIO"
              className="w-full sm:w-48 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono font-bold"
            />
          </div>
        </div>

        {/* SECTION 5: TRIGGERS GLOBAIS DE AUTOMAÇÃO */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Regras do Motor de Automação
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Define quando o estúdio dispara mensagens automáticas para clientes e artistas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunBatchNow}
              disabled={isScanningBatch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningBatch ? 'animate-spin' : ''}`} />
              <span>{isScanningBatch ? 'A verificar...' : 'Executar Ciclo 24h Agora'}</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSendConfirmationOnBooking}
                onChange={(e) => setAutoSendConfirmationOnBooking(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Disparo Imediato de Confirmação ao Criar Nova Marcação
                </span>
                <p className="text-[11px] text-zinc-500">
                  Assim que o tatuador cria uma sessão na agenda, o cliente recebe de imediato confirmação por WhatsApp e E-mail com a morada, valores e recomendações de preparação.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSendReminder24h}
                onChange={(e) => setAutoSendReminder24h(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Disparo Automático de Lembretes 24 Horas Antes da Sessão
                </span>
                <p className="text-[11px] text-zinc-500">
                  O sistema verifica em segundo plano as sessões do dia seguinte e dispara os lembretes automaticamente, atualizando a marcação como confirmada.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            {saveSuccess ? '✓ Dados & Automações Guardadas' : 'Guardar Perfil do Estúdio'}
          </button>
        </div>
      </form>

      {/* QR Code / Connection Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                WhatsApp Conectado com Sucesso
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Número oficial emparelhado: <strong className="text-zinc-800 dark:text-zinc-200">{whatsappPhoneNumber}</strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 space-y-1.5 text-left">
              <div className="flex justify-between">
                <span>Instância:</span>
                <strong className="font-mono">inkstudio-prod-01</strong>
              </div>
              <div className="flex justify-between">
                <span>Latência:</span>
                <strong className="text-emerald-500">42ms (Online)</strong>
              </div>
              <div className="flex justify-between">
                <span>Modo de Operação:</span>
                <strong>Totalmente Automático</strong>
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
