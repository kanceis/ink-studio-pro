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

// ---------------------------------------------------------------------------
// Website backoffice: content the public site reads (see firestore.rules)
// ---------------------------------------------------------------------------

export type PortfolioCategory = 'tattoo' | 'drawing' | 'art';

export interface UploadedImage {
  url: string; // public URL served by /img/<key>
  key: string; // object key in the R2 bucket
  width?: number;
  height?: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioCategory;
  style?: string; // e.g. "Black & Red", "Sketch / Illustration"
  description?: string;
  image: UploadedImage;
  published: boolean; // only published items are visible on the site
  featured: boolean; // shown on the home page
  order: number; // lower first
  createdAt: string;
}

export type ArtworkStatus = 'available' | 'reserved' | 'sold';

export interface Artwork {
  id: string;
  title: string;
  description?: string;
  medium?: string; // e.g. "Tinta-da-china sobre papel"
  dimensions?: string; // e.g. "30 x 40 cm"
  year?: string;
  price: number; // EUR
  status: ArtworkStatus;
  paymentLink?: string; // Stripe Payment Link for this piece
  image: UploadedImage;
  published: boolean;
  order: number;
  createdAt: string;
}

export type BookingRequestStatus = 'new' | 'accepted' | 'declined';

export interface BookingRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  instagram?: string;
  idea: string;
  placement?: string;
  size?: string;
  style?: string;
  preferredDates?: string;
  referenceUrl?: string;
  status: BookingRequestStatus;
  createdAt: string; // ISO timestamp
  clientId?: string; // set when accepted
  internalNotes?: string;
}

/** Studio info shown on the public site (meta/public). Everything here is public. */
export interface PublicProfile {
  name: string;
  tagline: string;
  bio: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  openingHours: string;
  depositInfo: string;
  bookingOpen: boolean;
}
