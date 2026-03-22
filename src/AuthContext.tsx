import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from './firebase';
import { tollService } from './services/tollService';
import { Agent } from './types';

interface AuthContextType {
  user: User | null;
  agent: Agent | null;
  loading: boolean;
  login: () => Promise<void>;
  loginDemo: (role?: 'agent' | 'admin') => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  agent: null,
  loading: true,
  login: async () => {},
  loginDemo: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        let agentData = await tollService.getAgent(currentUser.uid);
        if (!agentData) {
          // Auto-create agent if it's the default admin or first time
          const isDefaultAdmin = currentUser.email === "kassheritier@telgroups.org";
          agentData = {
            id: currentUser.uid,
            name: currentUser.displayName || 'Anonymous Agent',
            email: currentUser.email || '',
            role: isDefaultAdmin ? 'admin' : 'agent',
            active: true,
          };
          await tollService.createAgent(agentData);
        }
        setAgent(agentData);
      } else {
        setAgent(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginDemo = async (role: 'agent' | 'admin' = 'agent') => {
    setLoading(true);
    // Mock user and agent for demo
    const demoId = role === 'admin' ? 'demo-admin-456' : 'demo-agent-123';
    const demoName = role === 'admin' ? 'Administrateur de Démo' : 'Agent de Démonstration';
    const demoEmail = role === 'admin' ? 'admin-demo@smarttoll.cd' : 'demo@smarttoll.cd';

    const demoUser = {
      uid: demoId,
      displayName: demoName,
      email: demoEmail,
      emailVerified: true,
      isAnonymous: false,
      phoneNumber: null,
      photoURL: null,
      providerId: 'demo',
    } as any;

    const demoAgent: Agent = {
      id: demoId,
      name: demoName,
      email: demoEmail,
      role: role,
      active: true,
    };

    setUser(demoUser);
    setAgent(demoAgent);
    
    // Seed data for demo
    await tollService.seedDemoData();
    
    setLoading(false);
  };

  const logout = async () => {
    if (user?.uid?.startsWith('demo-')) {
      setUser(null);
      setAgent(null);
    } else {
      await signOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, agent, loading, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
