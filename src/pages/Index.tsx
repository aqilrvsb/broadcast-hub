import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session && event === 'SIGNED_OUT') {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Broadcast System</h1>
              <p className="text-sm text-muted-foreground">WhatsApp Analytics</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-border hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Radio className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Welcome to Your Broadcast System
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {user?.email && (
                  <>
                    Logged in as <span className="text-primary font-medium">{user.email}</span>
                  </>
                )}
              </p>
              {user?.user_metadata?.full_name && (
                <p className="text-muted-foreground">
                  Hello, {user.user_metadata.full_name}!
                </p>
              )}
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-2">Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  View analytics and insights from your broadcasts
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-2">Messages</h3>
                <p className="text-sm text-muted-foreground">
                  Create and manage your broadcast messages
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-foreground mb-2">Reports</h3>
                <p className="text-sm text-muted-foreground">
                  Generate detailed reports and statistics
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
