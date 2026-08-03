"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// 90s/00s style guest names
const guestNames = [
  "Don Johnson", "MacGyver", "Knight Rider", "Magnum P.I.", 
  "Miami Vice", "A-Team", "Baywatch", "Saved Bell",
  "Fresh Prince", "Urkel", "Zack Morris", "Kelly Kapowski",
  "Screech", "Slater", "Mr. Feeny", "Cory Matthews",
  "Topanga", "Shawn Hunter", "Buffy", "Angel",
  "Xena", "Hercules", "Power Ranger", "Ninja Turtle"
];

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  country?: string;
  countryFlag?: string;
  phone?: string;
  isGuest: boolean;
  isAdmin?: boolean;
  isAuthor?: boolean;
  gamesPlayed: number;
  wins: number;
  coins: number; // Legacy - points
  bogxCoins: number; // BOGX currency
  authorEarnings?: number; // For authors
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  guestGamesPlayed: number;
  canPlayMore: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; needsVerification?: boolean; email?: string }>;
  register: (username: string, email: string, password: string, country?: string, countryFlag?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  incrementGuestGames: () => void;
  updateUser: (updates: Partial<User>) => void;
  syncPointsToDb: (pointsChange: number, isWin: boolean, skipGameResult?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate random guest name
const generateGuestName = () => {
  return guestNames[Math.floor(Math.random() * guestNames.length)];
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestGamesPlayed, setGuestGamesPlayed] = useState(0);
  const [guestWins, setGuestWins] = useState(0);
  const [guestName] = useState(generateGuestName());

  // Load from localStorage on mount, then refresh from API
  useEffect(() => {
    const savedUser = localStorage.getItem("sporttock_user");
    const savedGuestGames = localStorage.getItem("sporttock_guest_games");
    const savedGuestGamesDate = localStorage.getItem("sporttock_guest_games_date");
    const today = new Date().toISOString().split('T')[0];
    
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      // Set user but reset coins to 0 until API responds
      setUser({
        ...parsedUser,
        coins: 0,
        bogxCoins: 0,
      });
      
      // Immediately fetch fresh data from API to update coins/stats
      if (parsedUser.id) {
        fetch(`/api/user/points?userId=${parsedUser.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setUser(prev => prev ? {
                ...prev,
                coins: data.points || 0,
                bogxCoins: data.bogxCoins || 0,
                wins: data.wins || 0,
                gamesPlayed: data.gamesPlayed || 0,
              } : null);
            }
          })
          .catch(() => {});
      }
    }
    
    // Reset guest games if it's a new day
    if (savedGuestGamesDate !== today) {
      // New day - reset guest games
      localStorage.setItem("sporttock_guest_games", "0");
      localStorage.setItem("sporttock_guest_games_date", today);
      setGuestGamesPlayed(0);
    } else if (savedGuestGames) {
      // Same day - load saved games
      setGuestGamesPlayed(parseInt(savedGuestGames));
    }
  }, []);

  // Save to localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("sporttock_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("sporttock_user");
    }
  }, [user]);

  // Save guest games to localStorage
  useEffect(() => {
    localStorage.setItem("sporttock_guest_games", guestGamesPlayed.toString());
  }, [guestGamesPlayed]);

  // Global heartbeat - tell server user is online in the app
  useEffect(() => {
    const id = user?.id;
    if (!id || id === 'guest' || user?.isGuest) return;
    
    const sendHeartbeat = () => {
      fetch('/api/users/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, screen: 'app' })
      }).catch(() => {});
    };
    
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const isLoggedIn = user !== null && !user.isGuest;
  const canPlayMore = isLoggedIn || guestGamesPlayed < 5;

  const register = async (username: string, email: string, password: string, country?: string, countryFlag?: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      // Pick up a referral id captured from a ?ref= invite link
      let referredBy: string | undefined;
      if (typeof window !== 'undefined') {
        referredBy = localStorage.getItem('bogx_ref') || undefined;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, country, countryFlag, referredBy }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      
      // DON'T log in the user - they need to verify email first
      // Just return success so the UI can show the verification message
      // Consume the referral so it isn't reused
      if (typeof window !== 'undefined') localStorage.removeItem('bogx_ref');
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Connection error' };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; needsVerification?: boolean; email?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        console.error('Login failed:', data.error);
        // Check if needs verification
        if (data.needsVerification) {
          return { success: false, needsVerification: true, email: data.email };
        }
        return { success: false };
      }
      
      const newUser: User = {
        id: data.user._id,
        username: data.user.username,
        email: data.user.email,
        avatar: data.user.avatar,
        country: data.user.country,
        countryFlag: data.user.countryFlag,
        isGuest: false,
        isAdmin: data.user.isAdmin || false,
        isAuthor: data.user.isAuthor || false,
        gamesPlayed: data.user.gamesPlayed,
        wins: data.user.wins,
        coins: data.user.points || 0,
        bogxCoins: data.user.bogxCoins || 0,
        authorEarnings: data.user.authorEarnings || 0,
      };
      setUser(newUser);
      setGuestGamesPlayed(0);
      // Clear guest coin data - logged-in balance comes from server
      localStorage.removeItem('bogx_guest_coins');
      localStorage.removeItem('bogx_guest_read');
      // Mark that this is a REAL login action (not just an already-authenticated page
      // load from persisted localStorage) — the Welcome Back modal uses this flag to
      // decide whether to show, so it only appears right after actually logging in.
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bogx_just_logged_in', '1');
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false };
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bogx_just_logged_in');
    }
    setUser(null);
    localStorage.removeItem("sporttock_user");
  };

  const incrementGuestGames = () => {
    if (!isLoggedIn) {
      setGuestGamesPlayed(prev => prev + 1);
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
      // Notify leaderboards/rankings to refresh immediately when coins change
      if (updates.bogxCoins !== undefined || updates.coins !== undefined) {
        window.dispatchEvent(new CustomEvent('bogx-updated'));
      }
    } else if (updates.wins !== undefined) {
      // For guests, track wins separately
      setGuestWins(prev => prev + 1);
    }
  };

  const syncPointsToDb = async (pointsChange: number, isWin: boolean, skipGameResult?: boolean) => {
    if (!user || user.isGuest) return;
    
    try {
      const res = await fetch('/api/user/update-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          pointsChange,
          isWin,
          skipGameResult,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Update local user with DB values (bogxCoins is the single source of truth)
        setUser(prev => prev ? {
          ...prev,
          coins: data.bogxCoins ?? data.points,
          bogxCoins: data.bogxCoins ?? data.points,
          wins: data.wins,
          gamesPlayed: data.gamesPlayed,
        } : null);
        // Notify the central coins hook (useBogxCoins) to re-sync from server
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bogx-updated'));
        }
      }
    } catch (error) {
      console.error('Sync points error:', error);
    }
  };

  // Create guest user object for display purposes
  const displayUser: User | null = user || (guestGamesPlayed > 0 ? {
    id: "guest",
    username: guestName,
    isGuest: true,
    gamesPlayed: guestGamesPlayed,
    wins: guestWins,
    coins: 0,
    bogxCoins: 0,
  } : null);

  return (
    <AuthContext.Provider value={{
      user: displayUser,
      isLoggedIn,
      guestGamesPlayed,
      canPlayMore,
      login,
      register,
      logout,
      incrementGuestGames,
      updateUser,
      syncPointsToDb,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
