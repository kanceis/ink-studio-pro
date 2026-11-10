import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Artist,
  Client,
  Appointment,
  InventoryItem,
  NotificationLog,
  StudioSettings,
  ThemeMode,
  TattooReference,
  ClinicalHistory,
  ToastNotification,
  BookingRequest,
} from '../types';
import { defaultSettings } from './initialData';
import {
  subscribeCollection,
  subscribeSettings,
  saveItem,
  patchItem,
  removeItem,
  incrementStock,
  saveSettings,
  batchWrite,
  newId,
} from '../services/studioStore';
import {
  initAuth,
  googleSignIn,
  disconnectGoogleWorkspace,
  getAccessToken,
} from '../services/firebaseAuth';
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '../services/googleCalendar';
import {
  isAppointmentIn24hWindow,
  sendAutomatedWhatsApp,
  sendAutomatedSms,
  generateConfirmationMessage,
  generate24hReminderMessage,
} from '../services/messaging';
import { sendGmailMessage } from '../services/gmail';
import {
  dispatchSystemNotification,
  requestSystemNotificationPermission,
  getSystemNotificationPermission,
} from '../services/systemNotifications';

interface StudioContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  activeTab: 'calendar' | 'clients' | 'artists' | 'stock' | 'messages' | 'analytics' | 'profile' | 'site';
  setActiveTab: (tab: 'calendar' | 'clients' | 'artists' | 'stock' | 'messages' | 'analytics' | 'profile' | 'site') => void;
  
  // Google Workspace Integration
  googleUser: User | null;
  googleToken: string | null;
  isConnectingGoogle: boolean;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  
  // Appointments
  appointments: Appointment[];
  addAppointment: (appt: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, appt: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<boolean>;
  syncAppointmentToGoogle: (apptId: string) => Promise<void>;
  
  // Clients
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  updateClinicalHistory: (clientId: string, history: ClinicalHistory) => void;
  addClientReference: (clientId: string, reference: Omit<TattooReference, 'id'>) => void;
  deleteClientReference: (clientId: string, refId: string) => void;
  
  // Artists
  artists: Artist[];
  addArtist: (artist: Omit<Artist, 'id'>) => Artist;
  updateArtist: (id: string, updates: Partial<Artist>) => void;
  deleteArtist: (id: string) => void;
  
  // Inventory
  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => InventoryItem;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  adjustStockQuantity: (id: string, delta: number) => void;
  
  // Notifications & Automation
  notificationLogs: NotificationLog[];
  logNotification: (log: Omit<NotificationLog, 'id' | 'timestamp'>) => void;
  triggerAutomatic24hBatch: () => Promise<number>;
  testAutomatedWhatsApp: (targetPhone: string) => Promise<boolean>;
  testAutomatedEmail: (targetEmail: string) => Promise<boolean>;
  testSystemNotification: () => Promise<boolean>;
  requestSystemNotificationAccess: () => Promise<string>;
  unreadNotificationCount: number;
  isNotificationCenterOpen: boolean;
  setIsNotificationCenterOpen: (open: boolean) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  
  // Settings
  settings: StudioSettings;
  updateSettings: (newSettings: Partial<StudioSettings>) => void;
  
  // Website booking requests
  bookingRequests: BookingRequest[];
  newBookingRequestCount: number;

  // Computed alerts
  expiringItems: { item: InventoryItem; daysUntilExpiration: number; isExpired: boolean }[];
  lowStockItems: InventoryItem[];
  upcoming24hAppointments: Appointment[];
  
  // Quick navigation
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;

  // In-app toasts (replaces window.alert for iframe compatibility)
  toasts: ToastNotification[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

const byNewestId = (a: { id: string }, b: { id: string }) => b.id.localeCompare(a.id, undefined, { numeric: true });

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('inkstudio_theme');
    return (saved as ThemeMode) || 'dark';
  });

  const [activeTab, setActiveTab] = useState<'calendar' | 'clients' | 'artists' | 'stock' | 'messages' | 'analytics' | 'profile' | 'site'>('calendar');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // In-app toasts state
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Google Auth state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Studio entities state (live from Firestore, see services/studioStore.ts)
  const [settings, setSettings] = useState<StudioSettings>(defaultSettings);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const newBookingRequestCount = useMemo(
    () => bookingRequests.filter((r) => r.status === 'new').length,
    [bookingRequests]
  );

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const unreadNotificationCount = useMemo(() => {
    return notificationLogs.filter((n) => n.read === false).length;
  }, [notificationLogs]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('inkstudio_theme', theme);
  }, [theme]);

  // Live sync with Firestore: every device signed in to the studio sees the same data.
  useEffect(() => {
    const onError = (err: Error) => {
      console.error('Erro de sincronização com a base de dados:', err);
      showToast('Sem ligação à base de dados. As alterações ficam guardadas e sincronizam quando voltar a ligação.', 'error');
    };
    const unsubs = [
      subscribeSettings((data) => setSettings({ ...defaultSettings, ...(data ?? {}) }), onError),
      subscribeCollection('artists', (items) => setArtists([...items].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))), onError),
      subscribeCollection(
        'clients',
        (items) => setClients([...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || byNewestId(a, b))),
        onError
      ),
      subscribeCollection(
        'appointments',
        (items) => setAppointments([...items].sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`))),
        onError
      ),
      subscribeCollection('inventory', (items) => setInventory([...items].sort((a, b) => a.name.localeCompare(b.name, 'pt'))), onError),
      subscribeCollection(
        'notifications',
        (items) => setNotificationLogs([...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp))),
        onError
      ),
      subscribeCollection(
        'bookingRequests',
        (items) => setBookingRequests([...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))),
        onError
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [showToast]);

  /** Fire-and-forget write: Firestore applies it locally at once and syncs in the background. */
  const persist = useCallback(
    (write: Promise<unknown>) => {
      write.catch((err) => {
        console.error('Erro ao guardar na base de dados:', err);
        showToast('Não foi possível guardar a alteração. Verifica a ligação e tenta de novo.', 'error');
      });
    },
    [showToast]
  );

  // Init Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const connectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: unknown) {
      console.error('Google Sign In error:', err);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    disconnectGoogleWorkspace();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  // Appointments actions
  const addAppointment = async (apptData: Omit<Appointment, 'id'>): Promise<Appointment> => {
    let newAppt: Appointment = {
      ...apptData,
      id: newId('appt'),
    };

    // If Google token available and sync requested, push to Google Calendar
    if (apptData.syncToGoogleCalendar && googleToken) {
      try {
        const gcalRes = await createGoogleCalendarEvent(newAppt, googleToken);
        newAppt = {
          ...newAppt,
          gcalEventId: gcalRes.id,
        };
      } catch (err) {
        console.error('Falha ao sincronizar com Google Agenda ao criar:', err);
      }
    }

    // DISPARO 100% AUTOMÁTICO DE CONFIRMAÇÃO (SEM NECESSIDADE DE VALIDAÇÃO MANUAL)
    if (settings.autoSendConfirmationOnBooking) {
      const confMsg = generateConfirmationMessage(newAppt, settings);
      let dispatched = false;

      // 1. WhatsApp Automático via Gateway
      if (settings.whatsappAutomationEnabled && newAppt.clientPhone) {
        try {
          await sendAutomatedWhatsApp(newAppt.clientPhone, confMsg.text, settings);
          logNotification({
            appointmentId: newAppt.id,
            clientName: newAppt.clientName,
            recipientContact: newAppt.clientPhone,
            type: 'confirmation',
            channel: 'whatsapp',
            status: 'sent',
            message: `[Disparo Automático] Confirmação enviada via WhatsApp de ${settings.whatsappPhoneNumber || settings.phone}`,
          });
          dispatched = true;
        } catch (e) {
          console.error('Erro no envio automático WhatsApp:', e);
        }
      }

      // 2. E-mail Automático via Gmail (se conectado)
      if (settings.emailAutomationEnabled && newAppt.clientEmail && googleToken) {
        try {
          await sendGmailMessage(
            {
              to: newAppt.clientEmail,
              toName: newAppt.clientName,
              subject: confMsg.subject,
              htmlContent: confMsg.html,
              fromName: settings.name,
            },
            googleToken
          );
          logNotification({
            appointmentId: newAppt.id,
            clientName: newAppt.clientName,
            recipientContact: newAppt.clientEmail,
            type: 'confirmation',
            channel: 'email',
            status: 'sent',
            message: `[Disparo Automático] ${confMsg.subject}`,
          });
          dispatched = true;
        } catch (e) {
          console.error('Erro no envio automático de email:', e);
        }
      }

      // 3. SMS Automático se ativado
      if (settings.smsAutomationEnabled && newAppt.clientPhone && settings.preferredChannels?.includes('sms')) {
        try {
          await sendAutomatedSms(newAppt.clientPhone, confMsg.text, settings);
          logNotification({
            appointmentId: newAppt.id,
            clientName: newAppt.clientName,
            recipientContact: newAppt.clientPhone,
            type: 'confirmation',
            channel: 'sms',
            status: 'sent',
            message: `[Disparo Automático] SMS enviado por ${settings.smsSenderId}`,
          });
          dispatched = true;
        } catch (e) {
          console.error('Erro no envio automático SMS:', e);
        }
      }

      // 4. Notificação no Sistema do iPad / Telemóvel (Confirmação Imediata da Marcação)
      if (settings.systemNotificationsEnabled) {
        const selectedArtist = artists.find((a) => a.id === newAppt.artistId);
        const artistName = selectedArtist ? selectedArtist.name : 'Artista';
        dispatchSystemNotification(`🗓️ Marcação Confirmada: ${newAppt.clientName}`, {
          body: `${newAppt.date} às ${newAppt.startTime} • ${newAppt.title || 'Sessão de Tatuagem'} (${artistName}).`,
          tag: `confirm-${newAppt.id}`,
        });
        logNotification({
          appointmentId: newAppt.id,
          clientName: newAppt.clientName,
          recipientContact: 'iPad / Telemóvel (Sistema)',
          type: 'confirmation',
          channel: 'system',
          status: 'sent',
          message: `Notificação nativa no sistema: Marcação confirmada para ${newAppt.clientName} em ${newAppt.date} às ${newAppt.startTime}.`,
          read: false,
        });
        dispatched = true;
      }

      if (dispatched) {
        newAppt.confirmationSent = true;
        newAppt.confirmationSentAt = new Date().toISOString();
      }
    }

    persist(saveItem('appointments', newAppt));
    return newAppt;
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<void> => {
    const existing = appointments.find((a) => a.id === id);
    if (!existing) return;

    const updated = { ...existing, ...updates };

    if (updated.gcalEventId && googleToken) {
      try {
        await updateGoogleCalendarEvent(updated.gcalEventId, updated, googleToken);
      } catch (err) {
        console.error('Erro ao atualizar no Google Agenda:', err);
      }
    }

    persist(saveItem('appointments', updated));
  };

  const deleteAppointment = async (id: string): Promise<boolean> => {
    const target = appointments.find((a) => a.id === id);
    if (!target) return false;

    if (target.gcalEventId && googleToken) {
      try {
        await deleteGoogleCalendarEvent(target.gcalEventId, googleToken);
      } catch (err) {
        console.error('Erro ao remover da Google Agenda:', err);
      }
    }

    persist(removeItem('appointments', id));
    showToast(`Marcação de ${target.clientName} cancelada e removida.`, 'info');
    return true;
  };

  const syncAppointmentToGoogle = async (apptId: string) => {
    const target = appointments.find((a) => a.id === apptId);
    if (!target) return;

    const token = await getAccessToken();
    if (!token) {
      showToast('Por favor liga a tua conta Google primeiro clicando no botão "Google Agenda".', 'info');
      return;
    }

    try {
      if (target.gcalEventId) {
        await updateGoogleCalendarEvent(target.gcalEventId, target, token);
      } else {
        const res = await createGoogleCalendarEvent(target, token);
        persist(patchItem('appointments', apptId, { gcalEventId: res.id, syncToGoogleCalendar: true }));
      }
      showToast('Marcação sincronizada com a Google Agenda!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      showToast(`Falha na sincronização: ${msg}`, 'error');
    }
  };

  // Clients actions
  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: newId('client'),
      createdAt: new Date().toISOString().split('T')[0],
    };
    persist(saveItem('clients', newClient));
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    persist(patchItem('clients', id, updates));
  };

  const deleteClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    persist(removeItem('clients', id));
    showToast(`Cliente "${client.name}" removido com sucesso.`, 'info');
  };

  const updateClinicalHistory = (clientId: string, history: ClinicalHistory) => {
    persist(patchItem('clients', clientId, { clinicalHistory: history }));
  };

  const addClientReference = (clientId: string, referenceData: Omit<TattooReference, 'id'>) => {
    const newRef: TattooReference = {
      ...referenceData,
      id: newId('ref'),
    };
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    persist(patchItem('clients', clientId, { references: [newRef, ...(client.references || [])] }));
  };

  const deleteClientReference = (clientId: string, refId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    persist(patchItem('clients', clientId, { references: (client.references || []).filter((r) => r.id !== refId) }));
  };

  // Artists actions
  const addArtist = (artistData: Omit<Artist, 'id'>): Artist => {
    const newArtist: Artist = {
      ...artistData,
      id: newId('artist'),
    };
    persist(saveItem('artists', newArtist));
    return newArtist;
  };

  const updateArtist = (id: string, updates: Partial<Artist>) => {
    persist(patchItem('artists', id, updates));
  };

  const deleteArtist = (id: string) => {
    const artist = artists.find((a) => a.id === id);
    if (!artist) return;
    persist(removeItem('artists', id));
    showToast(`Artista "${artist.name}" removido(a).`, 'info');
  };

  // Inventory actions
  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>): InventoryItem => {
    const newItem: InventoryItem = {
      ...itemData,
      id: newId('inv'),
    };
    persist(saveItem('inventory', newItem));
    return newItem;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    persist(patchItem('inventory', id, updates));
  };

  const deleteInventoryItem = (id: string) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    persist(removeItem('inventory', id));
    showToast(`Item "${item.name}" removido do inventário.`, 'info');
  };

  const adjustStockQuantity = (id: string, delta: number) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    // Never go below zero; otherwise use an atomic increment so concurrent edits from two devices add up.
    if (item.quantity + delta < 0) {
      persist(patchItem('inventory', id, { quantity: 0 }));
    } else {
      persist(incrementStock(id, delta));
    }
  };

  // Notifications
  const logNotification = useCallback((logData: Omit<NotificationLog, 'id' | 'timestamp'>) => {
    const newLog: NotificationLog = {
      ...logData,
      id: newId('notif'),
      timestamp: new Date().toISOString(),
      read: logData.read ?? false,
    };
    persist(saveItem('notifications', newLog));
  }, [persist]);

  const markNotificationAsRead = useCallback((id: string) => {
    persist(patchItem('notifications', id, { read: true }));
  }, [persist]);

  const markAllNotificationsAsRead = useCallback(() => {
    persist(
      batchWrite(
        notificationLogs
          .filter((n) => !n.read)
          .map((n) => ({ type: 'update' as const, name: 'notifications' as const, id: n.id, data: { read: true } }))
      )
    );
  }, [notificationLogs, persist]);

  const clearAllNotifications = useCallback(() => {
    persist(
      batchWrite(notificationLogs.map((n) => ({ type: 'delete' as const, name: 'notifications' as const, id: n.id })))
    );
  }, [notificationLogs, persist]);

  const requestSystemNotificationAccess = useCallback(async (): Promise<string> => {
    const perm = await requestSystemNotificationPermission();
    if (perm === 'granted') {
      showToast('Notificações no sistema ativadas para o teu iPad/Telemóvel!', 'success');
    } else if (perm === 'denied') {
      showToast('Permissão de notificações bloqueada pelo navegador. Ativa nas definições do browser.', 'error');
    }
    return perm;
  }, [showToast]);

  const testSystemNotification = useCallback(async (): Promise<boolean> => {
    const perm = await requestSystemNotificationPermission();
    if (perm !== 'granted') {
      showToast('Ativa as notificações do sistema primeiro para receber alertas no iPad/telemóvel.', 'info');
      return false;
    }
    const ok = await dispatchSystemNotification('🔔 InkStudio Pro: Alerta do Sistema', {
      body: 'As notificações nativas do sistema no teu iPad e telemóvel estão 100% operacionais!',
    });
    if (ok) {
      logNotification({
        clientName: 'Sistema Local',
        recipientContact: 'Dispositivo iPad/Telemóvel',
        type: 'custom',
        channel: 'system',
        status: 'sent',
        message: 'Notificação nativa disparada com sucesso no sistema operativo do iPad/Telemóvel.',
        read: false,
      });
      showToast('Notificação disparada com sucesso no sistema!', 'success');
      return true;
    }
    return false;
  }, [logNotification, showToast]);

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    persist(saveSettings(newSettings));
  };

  // Computed alerts
  const expiringItems = useMemo(() => {
    const now = new Date();
    return inventory
      .map((item) => {
        const exp = new Date(`${item.expirationDate}T00:00:00`);
        const diffMs = exp.getTime() - now.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return {
          item,
          daysUntilExpiration: days,
          isExpired: days < 0,
        };
      })
      .filter((entry) => entry.daysUntilExpiration <= 35) // items expiring in 35 days or expired
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => item.quantity <= item.minStockAlert);
  }, [inventory]);

  const upcoming24hAppointments = useMemo(() => {
    return appointments.filter(
      (a) => a.status !== 'cancelled' && isAppointmentIn24hWindow(a)
    );
  }, [appointments]);

  // Trigger de Envio de Lembretes 24h 100% Automático
  const triggerAutomatic24hBatch = useCallback(async (): Promise<number> => {
    const pending = appointments.filter(
      (a) => a.status !== 'cancelled' && isAppointmentIn24hWindow(a) && !a.reminder24hSent
    );

    if (pending.length === 0) return 0;

    let processedCount = 0;

    for (const appt of pending) {
      const reminderMsg = generate24hReminderMessage(appt, settings);
      let sentSuccess = false;

      // 1. WhatsApp Automático
      if (settings.whatsappAutomationEnabled && appt.clientPhone) {
        try {
          await sendAutomatedWhatsApp(appt.clientPhone, reminderMsg.text, settings);
          logNotification({
            appointmentId: appt.id,
            clientName: appt.clientName,
            recipientContact: appt.clientPhone,
            type: 'reminder_24h',
            channel: 'whatsapp',
            status: 'sent',
            message: `[Automação 24h] Lembrete disparado de +${settings.whatsappPhoneNumber || settings.phone} para +${appt.clientPhone}`,
          });
          sentSuccess = true;
        } catch (e) {
          console.error('Falha no WhatsApp automático 24h:', e);
        }
      }

      // 2. Email Automático
      if (settings.emailAutomationEnabled && appt.clientEmail && googleToken) {
        try {
          await sendGmailMessage(
            {
              to: appt.clientEmail,
              toName: appt.clientName,
              subject: reminderMsg.subject,
              htmlContent: reminderMsg.html,
              fromName: settings.name,
            },
            googleToken
          );
          logNotification({
            appointmentId: appt.id,
            clientName: appt.clientName,
            recipientContact: appt.clientEmail,
            type: 'reminder_24h',
            channel: 'email',
            status: 'sent',
            message: `[Automação 24h] ${reminderMsg.subject}`,
          });
          sentSuccess = true;
        } catch (e) {
          console.error('Falha no Email automático 24h:', e);
        }
      }

      // 3. SMS Automático
      if (settings.smsAutomationEnabled && appt.clientPhone && settings.preferredChannels?.includes('sms')) {
        try {
          await sendAutomatedSms(appt.clientPhone, reminderMsg.text, settings);
          logNotification({
            appointmentId: appt.id,
            clientName: appt.clientName,
            recipientContact: appt.clientPhone,
            type: 'reminder_24h',
            channel: 'sms',
            status: 'sent',
            message: `[Automação 24h] SMS enviado por ${settings.smsSenderId}`,
          });
          sentSuccess = true;
        } catch (e) {
          console.error('Falha no SMS automático 24h:', e);
        }
      }

      // 4. Notificação no Sistema do iPad / Telemóvel (Lembrete 24h)
      if (settings.systemNotificationsEnabled) {
        const selectedArtist = artists.find((a) => a.id === appt.artistId);
        const artistName = selectedArtist ? selectedArtist.name : 'Artista';
        dispatchSystemNotification(`⏰ Lembrete 24h: Marcação Amanhã!`, {
          body: `Sessão com ${appt.clientName} amanhã às ${appt.startTime} com ${artistName} (${appt.placement || 'Tatuagem'}).`,
          tag: `reminder-system-24h-${appt.id}`,
          requireInteraction: true,
        });
        logNotification({
          appointmentId: appt.id,
          clientName: appt.clientName,
          recipientContact: 'iPad / Telemóvel (Sistema)',
          type: 'reminder_24h',
          channel: 'system',
          status: 'sent',
          message: `Lembrete 24h nativo no sistema: Sessão com ${appt.clientName} amanhã às ${appt.startTime}.`,
          read: false,
        });
        sentSuccess = true;
      }

      if (sentSuccess) {
        persist(
          patchItem('appointments', appt.id, { reminder24hSent: true, reminder24hSentAt: new Date().toISOString() })
        );
        processedCount++;
      }
    }

    return processedCount;
  }, [appointments, artists, settings, googleToken, logNotification, persist]);

  // Background Runner: verifica e dispara lembretes de 24h automaticamente a cada 20 segundos
  useEffect(() => {
    if (!settings.autoSendReminder24h) return;

    // Disparo inicial imediato para apanhar marcações pendentes de 24h
    triggerAutomatic24hBatch();

    const interval = setInterval(() => {
      triggerAutomatic24hBatch();
    }, 20000);

    return () => clearInterval(interval);
  }, [settings.autoSendReminder24h, triggerAutomatic24hBatch]);

  // Test Methods
  const testAutomatedWhatsApp = async (targetPhone: string): Promise<boolean> => {
    try {
      const testMsg = `🔔 *[Teste de Conexão WhatsApp]*\nEstúdio: ${settings.name}\nNúmero Remetente: ${settings.whatsappPhoneNumber}\nStatus: Conexão ativa e envio 100% automático pronto para disparo de confirmações e lembretes de 24h.`;
      const res = await sendAutomatedWhatsApp(targetPhone, testMsg, settings);
      logNotification({
        appointmentId: 'test',
        clientName: 'Teste de Conexão',
        recipientContact: targetPhone,
        type: 'custom',
        channel: 'whatsapp',
        status: 'sent',
        message: res.summary,
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const testAutomatedEmail = async (targetEmail: string): Promise<boolean> => {
    if (!googleToken) {
      throw new Error('Google Workspace / Gmail não está conectado.');
    }
    try {
      await sendGmailMessage(
        {
          to: targetEmail,
          toName: 'Administrador do Estúdio',
          subject: `[InkStudio] Teste de Automação de E-mail - ${settings.name}`,
          htmlContent: `
            <div style="font-family: sans-serif; background-color: #09090b; color: #fff; padding: 24px; border-radius: 8px;">
              <h2 style="color: #10b981; margin: 0 0 10px 0;">✓ E-mail Automático Configurado</h2>
              <p>O envio automático a partir do estúdio <strong>${settings.name}</strong> está funcional.</p>
              <p style="color: #a1a1aa; font-size: 13px;">As confirmações e lembretes de 24h serão enviados silenciosamente para os clientes.</p>
            </div>
          `,
          fromName: settings.name,
        },
        googleToken
      );
      logNotification({
        appointmentId: 'test',
        clientName: 'Teste de Email',
        recipientContact: targetEmail,
        type: 'custom',
        channel: 'email',
        status: 'sent',
        message: `Teste de envio de e-mail automático entregue para ${targetEmail}`,
      });
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return (
    <StudioContext.Provider
      value={{
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        googleUser,
        googleToken,
        isConnectingGoogle,
        connectGoogle,
        disconnectGoogle,
        appointments,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        syncAppointmentToGoogle,
        clients,
        addClient,
        updateClient,
        deleteClient,
        updateClinicalHistory,
        addClientReference,
        deleteClientReference,
        artists,
        addArtist,
        updateArtist,
        deleteArtist,
        inventory,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        adjustStockQuantity,
        notificationLogs,
        logNotification,
        triggerAutomatic24hBatch,
        testAutomatedWhatsApp,
        testAutomatedEmail,
        testSystemNotification,
        requestSystemNotificationAccess,
        unreadNotificationCount,
        isNotificationCenterOpen,
        setIsNotificationCenterOpen,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        settings,
        updateSettings,
        bookingRequests,
        newBookingRequestCount,
        expiringItems,
        lowStockItems,
        upcoming24hAppointments,
        selectedClientId,
        setSelectedClientId,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio deve ser usado dentro de StudioProvider');
  }
  return context;
};
