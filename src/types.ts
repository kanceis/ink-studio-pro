export type ThemeMode = 'dark' | 'light';

export type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

export interface TattooReference {
  id: string;
  title: string;
  imageUrl: string;
  type: 'past_work' | 'inspiration';
  date: string;
  placement?: string;
  notes?: string;
}

export interface ClinicalHistory {
  allergies: string[];
  skinConditions: string[];
  medications: string[];
  hasBleedingDisorder: boolean;
  hasDiabetes: boolean;
  hasEpilepsy: boolean;
  hasHeartCondition: boolean;
  isPregnantOrNursing: boolean;
  hasKeloidHistory: boolean;
  consentSigned: boolean;
  consentDate?: string;
  clinicalNotes?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  instagram?: string;
  notes?: string;
  clinicalHistory: ClinicalHistory;
  references: TattooReference[];
  createdAt: string;
}

export interface Artist {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  specialties: string[];
  commissionRate: number; // e.g. 60 for 60%
  active: boolean;
  workingDays: number[]; // 0=Sunday, 1=Monday, etc.
  bio?: string;
  color: string; // Calendar tag color
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  artistId: string;
  artistName: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  price: number;
  deposit: number;
  status: AppointmentStatus;
  placement: string;
  style: string;
  notes?: string;
  gcalEventId?: string;
  syncToGoogleCalendar?: boolean;
  confirmationSent: boolean;
  reminder24hSent: boolean;
  confirmationSentAt?: string;
  reminder24hSentAt?: string;
}

export type InventoryCategory = 'needles' | 'inks' | 'hygiene' | 'aftercare' | 'disposables' | 'equipment';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string; // 'unidades', 'frascos', 'caixas', 'litros', etc.
  minStockAlert: number;
  lotNumber: string;
  expirationDate: string; // YYYY-MM-DD
  openedDate?: string; // YYYY-MM-DD
  shelfLifeMonthsAfterOpening?: number;
  brand?: string;
  supplier?: string;
  notes?: string;
}

export type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'system';
export type NotificationType = 'confirmation' | 'reminder_24h' | 'aftercare' | 'custom' | 'stock_alert';

export interface NotificationLog {
  id: string;
  appointmentId?: string;
  clientName: string;
  recipientContact: string; // phone, email or 'iPad/Telemóvel'
  type: NotificationType;
  channel: NotificationChannel;
  status: 'sent' | 'pending' | 'failed';
  timestamp: string;
  message: string;
  read?: boolean;
}

export interface StudioSettings {
  name: string;
  address: string;
  phone: string; // Número principal do estúdio
  email: string; // E-mail principal do estúdio
  instagram: string;
  currency: string;
  description: string;
  openingHours: string;
  defaultReminderHours: number;
  cancellationNoticeHours: number;
  
  // Notificações no Sistema do iPad e Telemóvel
  systemNotificationsEnabled: boolean;
  
  // Conexão e Automação WhatsApp (100% automático sem validar)
  whatsappAutomationEnabled: boolean;
  whatsappPhoneNumber: string;
  whatsappProvider: 'whatsapp_business_api' | 'cloud_api' | 'evolution_api';
  whatsappConnectionStatus: 'connected' | 'disconnected' | 'connecting';
  whatsappConnectedAt?: string;
  
  // Conexão e Automação de E-mail (100% automático)
  emailAutomationEnabled: boolean;
  
  // Conexão e Automação SMS
  smsAutomationEnabled: boolean;
  smsSenderId: string;
  
  // Triggers de disparo totalmente automático
  autoSendConfirmationOnBooking: boolean;
  autoSendReminder24h: boolean;
  preferredChannels: NotificationChannel[];
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
