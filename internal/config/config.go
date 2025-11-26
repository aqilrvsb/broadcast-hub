package config

import "os"

type Config struct {
	Port                   int
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	JWTSecret              string
	BillplzAPIKey          string
	BillplzCollectionID    string
	ServerURL              string
}

func Load() *Config {
	port := 8080
	if p := os.Getenv("PORT"); p != "" {
		// Parse port if needed
	}

	return &Config{
		Port:                   port,
		SupabaseURL:            getEnv("SUPABASE_URL", "https://ubfmnynwmvxfkwfxshuv.supabase.co"),
		SupabaseAnonKey:        getEnv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZm1ueW53bXZ4Zmt3ZnhzaHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMjIyMTIsImV4cCI6MjA3OTY5ODIxMn0.sN5tA1dxUbYIdtbjUybrIrxAu3EXjZESDYfXU1MrduE"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		JWTSecret:              getEnv("JWT_SECRET", "chatbot-automation-secret-key-change-in-production"),
		BillplzAPIKey:          os.Getenv("BILLPLZ_API_KEY"),
		BillplzCollectionID:    os.Getenv("BILLPLZ_COLLECTION_ID"),
		ServerURL:              getEnv("SERVER_URL", "http://localhost:8080"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
