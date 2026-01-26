// Event types for Island Bitcoin community events
// Based on community-webapp/src/types/events.ts

export interface EventBasicInfo {
  title: string;
  subtitle?: string;
  description: string;
  summary: string;
  type: string;
  tags?: string[];
  categories?: string[];
  accessibility?: {
    wheelchair_accessible?: boolean;
    sign_language?: boolean;
    live_captions?: boolean;
    other_accommodations?: string[];
  };
}

export interface EventDateTime {
  start: string;
  end: string;
  recurring?: {
    enabled: boolean;
    frequency?: string;
    end_date?: string;
    exceptions?: string[];
  };
  doors_open?: string;
  schedule?: Array<{
    time: string;
    duration: string;
    title: string;
    description?: string;
  }>;
}

export interface EventLocation {
  type: string;
  name: string;
  address?: {
    street?: string;
    city: string;
    state_province?: string;
    postal_code?: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  directions?: string;
  parking?: string;
  public_transit?: string;
}

export interface EventRegistration {
  required?: boolean;
  url?: string;
  email?: string;
  capacity?: {
    max: number;
    current: number;
    waitlist?: boolean;
  };
  fee?: {
    amount: number;
    currency: string;
    bitcoin_accepted?: boolean;
    lightning_accepted?: boolean;
    lightning_address?: string;
  };
  requirements?: {
    age_minimum?: number;
    prerequisites?: string[];
    bring_items?: string[];
    preparation?: string;
  };
}

export interface EventOrganizer {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  nostr?: {
    npub?: string;
    nip05?: string;
  };
  social?: {
    twitter?: string;
    telegram?: string;
  };
}

export interface EventSpeaker {
  name: string;
  title?: string;
  bio?: string;
  topics?: string[];
}

export interface EventSponsor {
  name: string;
  tier?: string;
  description?: string;
}

export interface EventCatering {
  provided?: boolean;
  type?: string;
  dietary_options?: string[];
  bitcoin_merchants?: Array<{
    name: string;
    accepts_lightning?: boolean;
  }>;
}

export interface EventData {
  id: string;
  status: string;
  basic_info: EventBasicInfo;
  datetime: EventDateTime;
  location: EventLocation;
  registration?: EventRegistration;
  organizer: EventOrganizer;
  speakers?: EventSpeaker[];
  sponsors?: EventSponsor[];
  media?: {
    featured_image?: string;
    thumbnail?: string;
    gallery?: string[];
  };
  catering?: EventCatering;
  extras?: {
    giveaways?: string[];
    activities?: string[];
    networking_session?: boolean;
  };
  target_audience?: {
    experience_level?: string[];
    interests?: string[];
    age_groups?: string[];
  };
  promotion?: {
    hashtags?: string[];
    marketing_materials?: {
      flyer?: string;
    };
  };
  metrics?: {
    expected_attendance?: number;
    success_metrics?: string[];
  };
  metadata?: {
    created_at?: string;
    updated_at?: string;
    submitted_by?: string;
    approved?: boolean;
    version?: number;
  };
}

export interface Event {
  event: EventData;
}

export interface EventWithDate {
  event: Event;
  nextDate: Date | null;
}
