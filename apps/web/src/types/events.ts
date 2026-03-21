// Evento Embed API event shape (no-auth, CORS-friendly)
export interface EventoEmbedEvent {
  id: string;
  title: string;
  description: string | null;
  cover: string | null;
  start_date: string;
  end_date: string | null;
  timezone: string;
  location: {
    name: string;
    city: string | null;
    country: string | null;
  } | null;
  url: string;
  creator: {
    username: string;
    image: string | null;
    verified: boolean;
  };
  status: 'upcoming' | 'ongoing' | 'past';
}

// Evento Public API event shape (keyed, richer data)
export interface EventoPublicEvent {
  id: string;
  title: string;
  description: string;
  cover: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  timezone: string;
  status: 'published';
  visibility: 'public';
  cost: number | null;
  created_at: string;
  creator: {
    id: string;
    username: string;
    image: string;
    verification_status: string | null;
  };
  links: {
    spotify_url: string | null;
    wavlake_url: string | null;
  };
  contributions: {
    cashapp: string | null;
    venmo: string | null;
    paypal: string | null;
    btc_lightning: string | null;
  };
}

// Guest object from Public API
export interface EventoGuest {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  verification_status: string | null;
  rsvp_status: 'yes' | 'maybe' | 'no';
  rsvp_date: string;
}

// Convenience alias
export type Event = EventoEmbedEvent;
