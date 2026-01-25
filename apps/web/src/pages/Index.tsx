export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4 text-primary">Island Bitcoin Community</h1>
        <p className="text-lg text-muted-foreground mb-6">Welcome to the community webapp</p>
        
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-2 text-card-foreground">Tailwind CSS Test</h2>
          <p className="text-muted-foreground">Tailwind styling is working correctly</p>
          <p className="text-sm text-accent mt-2">Colors: primary, muted-foreground, card, border</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-2 text-card-foreground">Workspace Setup</h2>
          <p className="text-muted-foreground">
            Workspace dependencies configured: @island-bitcoin/shared, @island-bitcoin/nostr
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Path aliases: @/* and @island-bitcoin/*
          </p>
        </div>
      </div>
    </div>
  );
}
