import { useState } from "react";
import { Link } from "react-router-dom";
import { Image, AlertCircle, RefreshCw, ArrowLeft, X } from "lucide-react";
import { useGallery } from "@/hooks/useGallery";
import { cn } from "@/lib/utils";

export default function Gallery() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { images, isLoading, error, refresh } = useGallery();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Community Gallery
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Photos from Bitcoin meetups and events across the Caribbean
          </p>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12" data-testid="loading-indicator">
            <Image className="h-12 w-12 text-primary/50 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center max-w-2xl mx-auto">
            <AlertCircle className="h-12 w-12 text-destructive/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">Unable to load gallery</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Please try again later
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && images.length === 0 && (
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center">
            <Image className="h-12 w-12 text-muted-foreground/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">No images found</h3>
            <p className="text-sm text-muted-foreground">
              Check back soon for community photos
            </p>
          </div>
        )}

        {!isLoading && !error && images.length > 0 && (
          <div
            data-testid="gallery-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            {images.map((image, index) => (
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
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
