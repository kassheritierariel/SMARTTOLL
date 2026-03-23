import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Vehicle, Transaction, Agent, Subscription, VehicleType, PaymentMethod, TollPost, Currency, TOLL_RATES, TransactionStatus } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const tollService = {
  // Vehicle Management
  async getVehicle(plate: string): Promise<Vehicle | null> {
    if (!auth.currentUser) return null;
    try {
      const docRef = doc(db, 'vehicles', plate.toUpperCase());
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Vehicle) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `vehicles/${plate}`);
      return null;
    }
  },

  async registerVehicle(vehicle: Vehicle) {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'vehicles', vehicle.plate.toUpperCase());
      await setDoc(docRef, {
        ...vehicle,
        plate: vehicle.plate.toUpperCase(),
        lastPassage: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vehicles/${vehicle.plate}`);
    }
  },

  // Transaction Management
  async createTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>) {
    const isOnline = navigator.onLine;
    const isAuthenticated = !!auth.currentUser;

    if (!isOnline || !isAuthenticated) {
      const offlineTx = {
        ...transaction,
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Timestamp.now(), // Use local timestamp for offline
        isOffline: true
      };
      
      const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      offlineTransactions.push(offlineTx);
      localStorage.setItem('offline_transactions', JSON.stringify(offlineTransactions));
      
      return offlineTx.id;
    }

    try {
      const colRef = collection(db, 'transactions');
      const docRef = await addDoc(colRef, {
        ...transaction,
        timestamp: serverTimestamp(),
      });

      // Update vehicle last passage
      await updateDoc(doc(db, 'vehicles', transaction.vehiclePlate.toUpperCase()), {
        lastPassage: serverTimestamp()
      });

      // If subscription, deduct balance
      if (transaction.paymentMethod === 'subscription' && transaction.userId) {
        // Note: In a real app, we'd handle currency conversion if subscription currency differs
        await updateDoc(doc(db, 'subscriptions', transaction.userId), {
          balance: increment(-transaction.amount)
        });
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  },

  isSyncing: false,
  async syncOfflineTransactions(onProgress?: (current: number, total: number) => void) {
    if (!navigator.onLine || !auth.currentUser || this.isSyncing) return;
    this.isSyncing = true;
    try {

    const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
    const total = offlineTransactions.length;
    if (total === 0) return;

    console.log(`Syncing ${total} offline transactions...`);
    
    const remainingTransactions = [];
    const errors = [];
    let current = 0;

    for (const tx of offlineTransactions) {
      try {
        if (onProgress) onProgress(current, total);
        const { id, isOffline, ...transactionData } = tx;
        
        // Convert stored timestamp back to proper format if needed, 
        // but serverTimestamp is better for sync
        // Check if already synced to prevent duplicates
        const q = query(
          collection(db, 'transactions'), 
          where('originalOfflineId', '==', id),
          limit(1)
        );
        const existingDocs = await getDocs(q);
        
        if (existingDocs.empty) {
          const colRef = collection(db, 'transactions');
          await addDoc(colRef, {
            ...transactionData,
            timestamp: serverTimestamp(),
            syncedAt: serverTimestamp(),
            originalOfflineId: id
          });

          // Update vehicle last passage
          await updateDoc(doc(db, 'vehicles', transactionData.vehiclePlate.toUpperCase()), {
            lastPassage: serverTimestamp()
          });

          // If subscription, deduct balance
          if (transactionData.paymentMethod === 'subscription' && transactionData.userId) {
            await updateDoc(doc(db, 'subscriptions', transactionData.userId), {
              balance: increment(-transactionData.amount)
            });
          }
        }
        current++;
        if (onProgress) onProgress(current, total);
      } catch (error) {
        console.error('Failed to sync transaction:', tx, error);
        remainingTransactions.push(tx);
        errors.push(error);
      }
    }

    localStorage.setItem('offline_transactions', JSON.stringify(remainingTransactions));
    
    if (errors.length > 0) {
      throw new Error(`Sync completed with ${errors.length} errors.`);
    }
    } finally {
      this.isSyncing = false;
    }
  },

  async cancelTransaction(transactionId: string, reason: string) {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'transactions', transactionId);
      await updateDoc(docRef, {
        status: 'cancelled',
        cancelReason: reason
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
    }
  },

  async confirmBankPayment(transactionId: string) {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'transactions', transactionId);
      await updateDoc(docRef, {
        status: 'completed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
    }
  },

  subscribeToTransactions(callback: (transactions: Transaction[]) => void) {
    if (!auth.currentUser) {
      console.warn('Subscription skipped: User not authenticated in Firebase.');
      return () => {};
    }
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      callback(transactions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
  },

  // Agent Management
  async getAgent(agentId: string): Promise<Agent | null> {
    if (!auth.currentUser && !agentId.startsWith('demo-')) return null;
    if (agentId === 'demo-agent-123') {
      return {
        id: 'demo-agent-123',
        name: 'Agent de Démonstration',
        email: 'demo@smarttoll.cd',
        role: 'agent',
        active: true,
      };
    }
    if (agentId === 'demo-admin-456') {
      return {
        id: 'demo-admin-456',
        name: 'Administrateur de Démo',
        email: 'admin-demo@smarttoll.cd',
        role: 'admin',
        active: true,
      };
    }
    try {
      const docRef = doc(db, 'agents', agentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Agent) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `agents/${agentId}`);
      return null;
    }
  },

  async createAgent(agent: Agent) {
    if (!auth.currentUser || agent.id === 'demo-agent-123') return;
    try {
      await setDoc(doc(db, 'agents', agent.id), agent);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `agents/${agent.id}`);
    }
  },

  async updateAgent(agentId: string, data: Partial<Agent>) {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'agents', agentId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `agents/${agentId}`);
    }
  },

  async deleteAgent(agentId: string) {
    if (!auth.currentUser || agentId.startsWith('demo-')) return;
    try {
      await deleteDoc(doc(db, 'agents', agentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `agents/${agentId}`);
    }
  },

  // Subscription Management
  async getSubscription(userId: string): Promise<Subscription | null> {
    if (!auth.currentUser) return null;
    try {
      const docRef = doc(db, 'subscriptions', userId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as Subscription) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `subscriptions/${userId}`);
      return null;
    }
  },

  async rechargeSubscription(userId: string, amount: number) {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'subscriptions', userId), {
        balance: increment(amount)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${userId}`);
    }
  },

  async getAllSubscriptions(): Promise<Subscription[]> {
    if (!auth.currentUser) return [];
    try {
      const querySnapshot = await getDocs(collection(db, 'subscriptions'));
      return querySnapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as Subscription));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'subscriptions');
      return [];
    }
  },

  async createSubscription(subscription: Subscription) {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'subscriptions', subscription.userId), subscription);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `subscriptions/${subscription.userId}`);
    }
  },

  // Toll Post Management
  async getTollPosts(): Promise<TollPost[]> {
    if (!auth.currentUser) return [];
    try {
      const querySnapshot = await getDocs(collection(db, 'tollPosts'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TollPost));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'tollPosts');
      return [];
    }
  },

  async createTollPost(post: Omit<TollPost, 'id'>) {
    if (!auth.currentUser) return;
    try {
      const docRef = await addDoc(collection(db, 'tollPosts'), post);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tollPosts');
    }
  },

  async updateTollPost(postId: string, data: Partial<TollPost>) {
    if (!auth.currentUser && !postId.startsWith('demo-')) return;
    try {
      await updateDoc(doc(db, 'tollPosts', postId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tollPosts/${postId}`);
    }
  },

  async deleteTollPost(postId: string) {
    if (!auth.currentUser && !postId.startsWith('demo-')) return;
    try {
      await deleteDoc(doc(db, 'tollPosts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tollPosts/${postId}`);
    }
  },

  // Tariff Management
  async getTariffs(): Promise<Record<VehicleType, Record<Currency, number>>> {
    if (!auth.currentUser) return TOLL_RATES;
    try {
      const docRef = doc(db, 'settings', 'tariffs');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as Record<VehicleType, Record<Currency, number>>;
      }
      return TOLL_RATES; // Fallback to constants
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/tariffs');
      return TOLL_RATES;
    }
  },

  async updateTariffs(tariffs: Record<VehicleType, Record<Currency, number>>) {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'settings', 'tariffs'), tariffs);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/tariffs');
    }
  },

  // Agent Management (Admin)
  async getAgents(): Promise<Agent[]> {
    if (!auth.currentUser) return [];
    try {
      const querySnapshot = await getDocs(collection(db, 'agents'));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'agents');
      return [];
    }
  },

  async seedDemoData() {
    try {
      // Ensure demo agents exist in the collection for Admin view
      const demoAgents = [
        {
          id: 'demo-agent-123',
          name: 'Agent de Démonstration',
          email: 'demo@smarttoll.cd',
          role: 'agent',
          active: true,
          postId: 'demo-post-1'
        },
        {
          id: 'demo-admin-456',
          name: 'Administrateur de Démo',
          email: 'admin-demo@smarttoll.cd',
          role: 'admin',
          active: true
        }
      ];

      for (const agent of demoAgents) {
        const agentDoc = await getDoc(doc(db, 'agents', agent.id));
        if (!agentDoc.exists()) {
          await setDoc(doc(db, 'agents', agent.id), agent);
        }
      }

      // Check if toll posts exist
      const posts = await this.getTollPosts();
      if (posts.length === 0) {
        await setDoc(doc(db, 'tollPosts', 'demo-post-1'), { name: 'Kasumbalesa', location: 'Haut-Katanga', active: true });
        await setDoc(doc(db, 'tollPosts', 'demo-post-2'), { name: 'Lufu', location: 'Kongo-Central', active: true });
        await setDoc(doc(db, 'tollPosts', 'demo-post-3'), { name: 'Kanyabayonga', location: 'Nord-Kivu', active: true });
      }

      // Add some demo transactions if none exist (check for demo agent specifically)
      const q = query(collection(db, 'transactions'), where('agentId', '==', 'demo-agent-123'), limit(1));
      const txSnap = await getDocs(q);
      
      if (txSnap.empty) {
        const demoPosts = await this.getTollPosts();
        const postId = demoPosts[0]?.id || 'demo-post';
        
        const demoTransactions = [
          {
            vehiclePlate: 'ABC-1234-CD',
            vehicleType: 'car' as VehicleType,
            amount: 5,
            currency: 'USD' as Currency,
            paymentMethod: 'cash' as PaymentMethod,
            agentId: 'demo-agent-123',
            agentName: 'Agent de Démonstration',
            postId: postId,
            postName: demoPosts[0]?.name || 'Kasumbalesa',
            status: 'completed' as TransactionStatus
          },
          {
            vehiclePlate: 'XYZ-9876-BC',
            vehicleType: 'truck' as VehicleType,
            amount: 25000,
            currency: 'CDF' as Currency,
            paymentMethod: 'mobile_money' as PaymentMethod,
            agentId: 'demo-agent-123',
            agentName: 'Agent de Démonstration',
            postId: postId,
            postName: demoPosts[0]?.name || 'Kasumbalesa',
            status: 'completed' as TransactionStatus
          }
        ];

        for (const tx of demoTransactions) {
          await addDoc(collection(db, 'transactions'), {
            ...tx,
            timestamp: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error seeding demo data:', error);
    }
  }
};
