import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Image, Menu, MapPin } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { Sidebar } from "@/components/layout/Sidebar";
import { BitcoinTrivia } from "@/components/games/BitcoinTrivia";
import { Leaderboard } from "@/components/games/Leaderboard";
import { NostrFeed } from "@/components/social/NostrFeed";

const SITE_NAME = "Island Bitcoin";
const SITE_TAGLINE = "Bitcoin Paradise";
const SITE_DESCRIPTION =
  "Join the Caribbean's most vibrant Bitcoin community. Learn, play, and connect with fellow Bitcoiners.";

export default function Index() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { events: upcomingEvents, isLoading: eventsLoading } = useEvents("upcoming");
  const previewEvents = upcomingEvents.slice(0, 3);

  return (
    <Layout hideHeader hideFooter>
      <div className="min-h-screen bg-gradient-to-b from-muted via-background to-muted/30">
        <header
          role="banner"
          className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border"
        >
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <img
                  src="https://raw.githubusercontent.com/islandbitcoin/islandbitcoin-community/4cfeb962c33fff5e6f5561c37ddca3c469c25793/gallery/Island%20Bitcoin%20Logo.jpg"
                  alt="Island Bitcoin Logo"
                  className="h-16 w-16 rounded-full"
                />
              </Link>
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden py-16 sm:py-20 lg:py-32">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-accent/20 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {SITE_TAGLINE}
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 text-muted-foreground px-4 sm:px-0">
                {SITE_DESCRIPTION}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  Join the Community
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                  onClick={() => {
                    document
                      .getElementById("events-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  View Events
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="events-section" className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">
                Upcoming Events
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">
                Bitcoin meetups, workshops, and celebrations across the islands
              </p>
            </div>

            {eventsLoading && (
              <div className="flex justify-center py-8">
                <Calendar className="h-8 w-8 text-primary/50 animate-pulse" />
              </div>
            )}

            {!eventsLoading && previewEvents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-6xl mx-auto">
                {previewEvents.map((item) => {
                  const event = item.event.event;
                  const location = event.location;
                  const locationString = location?.address
                    ? `${location.address.city}, ${location.address.country}`
                    : location?.name || 'Caribbean';
                  
                  return (
                    <div key={event.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-primary/30 transition-all">
                      <h3 className="text-lg font-semibold text-primary mb-2 line-clamp-2">
                        {event.basic_info.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.datetime.start).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {locationString}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {!eventsLoading && previewEvents.length === 0 && (
              <p className="text-center text-muted-foreground mb-8">
                No upcoming events at the moment. Check back soon!
              </p>
            )}

            <div className="text-center mt-8 space-y-4">
              <Link to="/events">
                <Button
                  variant="default"
                  className="bg-primary hover:bg-primary/90"
                >
                  See All Events
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">
                Community Moments
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">
                Capturing the spirit of Bitcoin adoption across the Caribbean
              </p>
            </div>

            <div className="text-center mt-8">
              <Link to="/gallery">
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <Image className="mr-2 h-4 w-4" />
                  View Gallery
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-foreground">
                Bitcoin Trivia
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground px-4 sm:px-0">
                Test your knowledge and earn sats!
              </p>
            </div>
            <div className="max-w-2xl mx-auto">
              <BitcoinTrivia />
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-foreground">
                  Leaderboard
                </h2>
                <Leaderboard />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-4 text-foreground">
                  Community Feed
                </h2>
                <NostrFeed />
              </div>
            </div>
          </div>
        </section>

        <footer
          role="contentinfo"
          className="py-8 sm:py-12 bg-muted/50 border-t border-border"
        >
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">
                  &copy; {new Date().getFullYear()} {SITE_NAME}. Built with B
                  and islands
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vibed with{" "}
                  <a
                    href="https://soapbox.pub/tools/mkstack/"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    MKStack
                  </a>
                </p>
              </div>
              <div className="flex gap-2 sm:gap-4">
                <Link to="/about">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                  >
                    About
                  </Button>
                </Link>
                <a
                  href="https://github.com/islandbitcoin/islandbitcoin-community/tree/main/mediakit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                  >
                    Media Kit
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </footer>

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
    </Layout>
  );
}
