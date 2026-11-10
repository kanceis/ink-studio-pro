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
  /** Agreed to hear from the studio later on (the 2–3 month follow-up). ISO time it was given; unset = no. */
  marketingConsentAt?: string;
  /** Asked us to stop the follow-up messages (replied "parar"). Overrides everything else. */
  followUpOptOutAt?: string;
  language?: 'en' | ''; // came from the English site: write in English
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
  /** Messages after the session (see services/followUps.ts): when each one went out, or was skipped. */
  followUps?: Partial<Record<FollowUpKind, FollowUpMark>>;
}

/** d7 = one week after, d14 = two weeks after, m3 = about 2–3 months after (only with consent). */
export type FollowUpKind = 'd7' | 'd14' | 'm3';

export interface FollowUpMark {
  at: string; // ISO
  via: 'whatsapp' | 'email' | 'auto_email' | 'skipped';
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
export type NotificationType = 'confirmation' | 'reminder_24h' | 'aftercare' | 'follow_up' | 'custom' | 'stock_alert';

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

  /** Messages after a session (1 week, 2 weeks, 2–3 months). Off = the app doesn't list them. Default on. */
  followUpsEnabled?: boolean;
  /** The daily task on Cloudflare emails the due follow-ups by itself (needs RESEND_API_KEY there). Default off. */
  followUpAutoEmail?: boolean;
  /** Link for "leave us a Google review" in the two-week message. */
  googleReviewUrl?: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ---------------------------------------------------------------------------
// Website backoffice: content the public site reads (see firestore.rules)
// ---------------------------------------------------------------------------

export type PortfolioCategory = 'tattoo' | 'drawing' | 'art' | 'flash';

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
  artistId?: string; // which artist made it (matches PublicArtist.id)
  style?: string; // e.g. "Black & Red", "Sketch / Illustration"
  description?: string;
  image: UploadedImage;
  published: boolean; // only published items are visible on the site
  featured: boolean; // shown on the home page
  order: number; // lower first
  createdAt: string;
  // Flash only (category 'flash'): ready-to-tattoo designs
  flashNumber?: string; // e.g. "07"
  flashSize?: string; // e.g. "8 x 12 cm"
  flashSessions?: number;
  priceFrom?: number; // EUR
  available?: boolean; // false once it has been tattooed
}

/**
 * Shop item. Three kinds:
 *  - original: one-of-a-kind piece, status available/reserved/sold
 *  - edition: limited edition sold on the site with Stripe; stock is reserved at checkout
 *  - merch: print-on-demand product sold elsewhere (e.g. Redbubble), the site links out
 */
export type ShopItemKind = 'original' | 'edition' | 'merch';
export type ShopItemStatus = 'available' | 'reserved' | 'sold';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  title: string;
  description?: string;
  artistId?: string;
  medium?: string; // e.g. "Giclée em papel de algodão 300g"
  dimensions?: string; // e.g. "30 x 40 cm"
  year?: string;
  price: number; // EUR
  status: ShopItemStatus; // originals; editions become 'sold' when stock hits 0
  editionSize?: number; // editions: total copies (e.g. 25)
  stock?: number; // editions: copies left to sell
  reservedBy?: string; // originals: checkout reservation holding the piece (set by the server)
  shippingPrice?: number; // originals & editions: EUR, 0 = free
  paymentLink?: string; // originals: optional Stripe Payment Link
  externalUrl?: string; // merch: product page on Redbubble / Printful / ...
  image: UploadedImage;
  published: boolean;
  order: number;
  createdAt: string;
}

export type OrderStatus = 'paid' | 'shipped' | 'cancelled';

export interface ShopOrderLine {
  itemId: string;
  title: string;
  kind: ShopItemKind;
  quantity: number;
  unitPrice: number; // EUR
}

/** Written by the Stripe webhook (functions/api/stripe-webhook.ts). Id = Stripe Checkout Session id. */
export interface ShopOrder {
  id: string;
  lines: ShopOrderLine[];
  itemTitle: string; // summary, e.g. "Ruptura #3 + 2× Print Lobo"
  amountTotal: number; // EUR, including shipping
  shippingAmount?: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  status: OrderStatus;
  createdAt: string;
  shippedAt?: string;
  trackingNumber?: string;
  notes?: string;
}

export type BookingRequestStatus = 'new' | 'accepted' | 'declined';

export interface BookingRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  instagram?: string;
  artistId?: string; // artist chosen on the site (PublicArtist.id), empty = any
  artistName?: string;
  tattooType?: string; // 'Desenho novo' | 'Flash' | 'Cover-up' | 'Retoque'
  flashNumber?: string;
  firstTattoo?: boolean;
  idea: string;
  placement?: string;
  size?: string;
  style?: string;
  preferredDates?: string;
  referenceUrl?: string;
  language?: 'en'; // sent from the English site (/en/…): reply in English
  marketingConsentAt?: string; // ticked "you can get in touch again in a few months" (ISO)
  status: BookingRequestStatus;
  createdAt: string; // ISO timestamp
  adultConfirmedAt: string; // "I am 18+" ticked at (ISO), GDPR proof
  privacyAcceptedAt: string; // privacy policy accepted at (ISO), GDPR proof
  clientId?: string; // set when accepted
  internalNotes?: string;
}

/** An artist as shown on the public site. Internal data (commission, phone) stays private. */
export interface PublicArtist {
  id: string; // internal Artist id
  displayName: string; // e.g. "Arants", "Rock Ink", "Carolina"
  fullName?: string; // e.g. "Miguel Alves"
  bio?: string;
  instagram?: string; // one or more handles, comma-separated
  styles?: string; // e.g. "Sketch · Black & Red"
  priceFrom?: number; // EUR, optional "desde X €"
  photo?: UploadedImage;
  visible: boolean;
  acceptsBookings: boolean;
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
  merchStoreUrl?: string; // e.g. the Redbubble shop
  artists?: PublicArtist[];
  /** Show the Google reviews section (read live from Google by /api/reviews). Default on. */
  showGoogleReviews?: boolean;
  /** Up to 6 posts picked by hand for the Instagram section of the site. */
  instagramPosts?: InstagramPost[];
}

/** A post shown in the site's Instagram grid: a copy of the photo (in R2) and the link to the post. */
export interface InstagramPost {
  id: string;
  image: UploadedImage;
  url: string; // https://www.instagram.com/p/...
  alt?: string;
}
