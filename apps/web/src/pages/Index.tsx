import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Image, Menu, MapPin, X, ExternalLink } from "lucide-react";
import Logo from "@/assets/logo.svg?react";
import { useEvents, formatEventDate, formatLocation, getEventoUrl } from "@/hooks/useEvents";
import { useGallery } from "@/hooks/useGallery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoginButton } from "@/components/auth/LoginButton";
import { UserProfile } from "@/components/auth/UserProfile";
import { BitcoinTrivia } from "@/components/games/BitcoinTrivia";
import { Leaderboard } from "@/components/games/Leaderboard";
import { NostrFeed } from "@/components/social/NostrFeed";
import { NextEventCountdown } from "@/components/home/NextEventCountdown";
import { TriviaPulse } from "@/components/home/TriviaPulse";
import { cn } from "@/lib/utils";

const SITE_NAME = "Island Bitcoin";
const SITE_TAGLINE = "Bitcoiners in Paradise";
const SITE_DESCRIPTION = "Join the Caribbean's most vibrant Bitcoin community. Learn, play, and connect with fellow Bitcoiners.";

/** Pauses ambient video for users who prefer reduced motion. */
function useSafeAutoplayVideo(ref: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) video.pause();
      else video.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [ref]);
}

export default function Index() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useCurrentUser();
  const { events: upcomingEvents, isLoading: eventsLoading } = useEvents("upcoming");
  const previewEvents = upcomingEvents.slice(0, 3);
  const { images, isLoading: galleryLoading } = useGallery();
  const previewImages = useMemo(() => {
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  }, [images]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const footerVideoRef = useRef<HTMLVideoElement>(null);
  useSafeAutoplayVideo(heroVideoRef);
  useSafeAutoplayVideo(footerVideoRef);

  return (
    <Layout hideHeader hideFooter>
      {/* Fixed sand-blur backdrop: the whole page gets a whisper of beach; cards stay clean on top. */}
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/hero-beach-poster.jpg"
          alt=""
          className="h-full w-full object-cover blur-3xl scale-110 opacity-20"
        />
        <div className="absolute inset-0 bg-background/70" />
      </div>
      <div className="relative z-10 min-h-screen">
        <header role="banner" className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <Logo className="h-8 text-primary" aria-label="Island Bitcoin" />
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                <Link to="/events" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                  Events
                </Link>
                <Link to="/gallery" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                  Gallery
                </Link>
              </nav>

              <div className="flex items-center gap-2">
                {user ? <UserProfile className="hidden sm:flex" /> : <LoginButton className="hidden sm:flex" />}

                <Button variant="outline" size="icon" className="border-primary text-primary hover:bg-primary/10" onClick={() => setIsSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden py-16 sm:py-20 lg:py-32">
          {/* Calm Caribbean shoreline behind the hero. Mixkit #5016, free license, no attribution required. */}
          <video
            ref={heroVideoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-beach-poster.jpg"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src="/hero-beach.mp4" type="video/mp4" />
          </video>
          {/* Readability scrim over the video; blobs tint on top */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/55 to-background/80" />
          <div className="absolute inset-0">
            <div className="absolute top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-accent/20 rounded-full blur-3xl" />
          </div>

          {/* Wave seam: the shoreline hands off to the content below */}
          <svg
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute bottom-0 left-0 w-full h-14 text-background"
          >
            <path
              fill="currentColor"
              d="M0,52 C220,86 460,20 720,40 C980,60 1220,82 1440,44 L1440,80 L0,80 Z"
            />
          </svg>

          <div className="container relative mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {SITE_TAGLINE}
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 text-muted-foreground px-4 sm:px-0">{SITE_DESCRIPTION}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8" onClick={() => setIsSidebarOpen(true)}>
                  Join the Community
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => {
                    document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  View Events
                </Button>
              </div>

              <NextEventCountdown />
            </div>
          </div>
        </section>

        <section id="events-section" className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">Upcoming Events</h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">Bitcoin meetups, workshops, and celebrations across the islands</p>
            </div>

            {eventsLoading && (
              <div className="flex justify-center py-8">
                <Calendar className="h-8 w-8 text-primary/50 animate-pulse" />
              </div>
            )}

            {!eventsLoading && previewEvents.length > 0 && (
              <div
                className={cn(
                  "gap-6 mb-8 mx-auto",
                  previewEvents.length === 1 && "max-w-2xl",
                  previewEvents.length === 2 && "grid grid-cols-1 md:grid-cols-2 max-w-4xl",
                  previewEvents.length >= 3 && "grid grid-cols-1 md:grid-cols-3 max-w-6xl",
                )}
              >
                {previewEvents.map((event) => (
                    <div key={event.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all">
                      {event.cover && (
                        <div className="w-full h-36 overflow-hidden">
                          <img src={event.cover} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-primary mb-2 line-clamp-2">{event.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatEventDate(event.start_date, event.timezone)}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatLocation(event.location)}
                        </p>
                        {event.status !== "past" && (
                          <a
                            href={getEventoUrl(event.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            RSVP
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!eventsLoading && previewEvents.length === 0 && (
              <p className="text-center text-muted-foreground mb-8">No upcoming events at the moment. Check back soon!</p>
            )}

            <div className="text-center mt-8 space-y-4">
              <Link to="/events">
                <Button variant="default" className="bg-primary hover:bg-primary/90">
                  See All Events
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <TriviaPulse />

        <section className="py-12 sm:py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">Community Moments</h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">Capturing the spirit of Bitcoin adoption across the Caribbean</p>
            </div>

            {galleryLoading && (
              <div className="flex justify-center py-8">
                <Image className="h-8 w-8 text-primary/50 animate-pulse" />
              </div>
            )}

            {!galleryLoading && previewImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 max-w-7xl mx-auto px-4">
                {previewImages.map((image, index) => (
                  <div
                    key={image.url}
                    className="aspect-square relative overflow-hidden rounded-lg bg-muted cursor-pointer group"
                    onClick={() => setSelectedImage(image.url)}
                  >
                    <img
                      src={image.url}
                      alt={`Community photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                ))}
              </div>
            )}

            {!galleryLoading && previewImages.length === 0 && <p className="text-center text-muted-foreground mb-8">No gallery images available yet.</p>}

            <div className="text-center mt-8">
              <Link to="/gallery">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  <Image className="mr-2 h-4 w-4" />
                  View Gallery
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {import.meta.env.VITE_FEATURE_TRIVIA_GAME === "true" && (
          <section id="trivia-section" className="py-12 sm:py-16">
            <div className="container mx-auto px-4">
              <div className="text-center mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">Bitcoin Trivia</h2>
                <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">Test your knowledge and earn sats!</p>
              </div>
              <div className="max-w-2xl mx-auto">
                <BitcoinTrivia />
              </div>
            </div>
          </section>
        )}

        {(import.meta.env.VITE_FEATURE_LEADERBOARD === "true" || import.meta.env.VITE_FEATURE_COMMUNITY_FEED === "true") && (
          <section className="py-12 sm:py-16 bg-card/50">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {import.meta.env.VITE_FEATURE_LEADERBOARD === "true" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 text-foreground">Leaderboard</h2>
                    <Leaderboard />
                  </div>
                )}
                {import.meta.env.VITE_FEATURE_COMMUNITY_FEED === "true" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-4 text-foreground">Community Feed</h2>
                    <NostrFeed />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <footer role="contentinfo" className="relative overflow-hidden border-t border-border/40">
          <video
            ref={footerVideoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-beach-poster.jpg"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src="/hero-beach.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative container mx-auto px-4 py-20 sm:py-24 text-center">
            <p className="text-2xl sm:text-4xl font-bold text-white mb-3">See you on the beach.</p>
            <p className="text-white/70 text-sm sm:text-base mb-8 max-w-md mx-auto">
              Meetups, workshops, and celebrations — across the islands, all year round.
            </p>
            <Link to="/events">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8">
                Find the next meetup
              </Button>
            </Link>
            <p className=" text-sm text-white/50 mt-10">
              &copy; {new Date().getFullYear()} {SITE_NAME}
            </p>
          </div>
        </footer>

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {selectedImage && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50" onClick={() => setSelectedImage(null)}>
            <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
              <X className="h-8 w-8" />
            </button>
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    </Layout>
  );
}
