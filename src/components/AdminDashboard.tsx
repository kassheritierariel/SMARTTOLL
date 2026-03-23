import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin,
  InfoWindow
} from '@vis.gl/react-google-maps';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Car, 
  Truck, 
  Bike,
  Bus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  Search,
  MoreVertical,
  ShieldCheck,
  UserPlus,
  MapPin,
  Settings,
  History,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  X,
  Trash2,
  CreditCard,
  Wallet,
  Eye,
  Navigation,
  User,
  Edit2
} from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { tollService } from '../services/tollService';
import { Transaction, TOLL_RATES, VehicleType, EXCHANGE_RATE, Currency, Agent, TollPost, Subscription } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'overview' | 'transactions' | 'agents' | 'posts' | 'tariffs' | 'subscriptions';

export const AdminDashboard: React.FC = () => {
  const { user, agent, loading, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [posts, setPosts] = useState<TollPost[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tariffs, setTariffs] = useState<Record<VehicleType, Record<Currency, number>>>(TOLL_RATES);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState<string | null>(null);
  const [transactionToCancel, setTransactionToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<number>(0);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingPost, setEditingPost] = useState<TollPost | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [newAgent, setNewAgent] = useState<{ name: string; email: string; role: 'agent' | 'admin'; postId: string }>({ 
    name: '', email: '', role: 'agent', postId: '' 
  });
  const [newPost, setNewPost] = useState<{ name: string; location: string; latitude?: number; longitude?: number }>({ 
    name: '', 
    location: '',
    latitude: -4.3224,
    longitude: 15.3070
  });
  const [newSubscription, setNewSubscription] = useState<Subscription>({
    userId: '',
    balance: 0,
    currency: 'USD',
    planType: 'basic'
  });
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>('all');
  const [transactionAgentFilter, setTransactionAgentFilter] = useState<string>('all');
  const [transactionPostFilter, setTransactionPostFilter] = useState<string>('all');
  const [transactionStartDate, setTransactionStartDate] = useState<string>('');
  const [transactionEndDate, setTransactionEndDate] = useState<string>('');
  const [agentPostFilter, setAgentPostFilter] = useState<string>('all');
  const [agentSearchQuery, setAgentSearchQuery] = useState<string>('');
  const [agentPage, setAgentPage] = useState(1);
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [postPage, setPostPage] = useState(1);
  const [selectedPostDetails, setSelectedPostDetails] = useState<TollPost | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const itemsPerPage = 10;
  
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchSearch = tx.vehiclePlate.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                          tx.vehicleType.toLowerCase().includes(transactionSearch.toLowerCase());
      const matchStatus = transactionStatusFilter === 'all' || tx.status === transactionStatusFilter;
      const matchAgent = transactionAgentFilter === 'all' || tx.agentId === transactionAgentFilter;
      const matchPost = transactionPostFilter === 'all' || tx.postId === transactionPostFilter;
      
      let matchDate = true;
      if (tx.timestamp) {
        const txDate = tx.timestamp.toDate ? tx.timestamp.toDate() : new Date(tx.timestamp);
        if (transactionStartDate) {
          const start = new Date(transactionStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) matchDate = false;
        }
        if (transactionEndDate) {
          const end = new Date(transactionEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) matchDate = false;
        }
      }

      return matchSearch && matchStatus && matchAgent && matchPost && matchDate;
    });
  }, [transactions, transactionSearch, transactionStatusFilter, transactionAgentFilter, transactionPostFilter, transactionStartDate, transactionEndDate]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      const matchPost = agentPostFilter === 'all' || a.postId === agentPostFilter;
      const matchSearch = a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) || 
                          a.email.toLowerCase().includes(agentSearchQuery.toLowerCase());
      return matchPost && matchSearch;
    });
  }, [agents, agentPostFilter, agentSearchQuery]);

  const filteredPosts = useMemo(() => {
    return posts.filter(p => 
      p.name.toLowerCase().includes(postSearchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(postSearchQuery.toLowerCase())
    );
  }, [posts, postSearchQuery]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(s => 
      s.userId.toLowerCase().includes(subscriptionSearch.toLowerCase()) ||
      s.planType.toLowerCase().includes(subscriptionSearch.toLowerCase())
    );
  }, [subscriptions, subscriptionSearch]);

  // Robust admin check
  const isAdmin = agent?.role === 'admin' || user?.email === 'kassheritier@telgroups.org';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-drc-blue rounded-2xl flex items-center justify-center text-white shadow-xl animate-bounce">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-12 text-center border border-slate-100"
        >
          <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-8">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Accès Refusé</h1>
          <p className="text-slate-500 leading-relaxed mb-8">
            Désolé, vous n'avez pas les privilèges nécessaires pour accéder au tableau de bord administrateur. 
            Veuillez contacter l'administrateur principal si vous pensez qu'il s'agit d'une erreur.
          </p>
          <button 
            onClick={logout}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
          >
            Se déconnecter
          </button>
        </motion.div>
      </div>
    );
  }

  const handleUpdateAgentRole = async (agentId: string, newRole: 'agent' | 'admin') => {
    try {
      const agentToUpdate = agents.find(a => a.id === agentId);
      if (!agentToUpdate) return;
      
      await tollService.updateAgent(agentId, { ...agentToUpdate, role: newRole });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, role: newRole } : a));
      alert(`Rôle mis à jour: ${newRole.toUpperCase()}`);
    } catch (error) {
      console.error('Error updating agent role:', error);
      alert('Erreur lors de la mise à jour du rôle');
    }
  };

  const handleDownloadTransactions = () => {
    const headers = ['ID', 'Plaque', 'Type', 'Montant', 'Devise', 'Méthode', 'Date', 'Status', 'Agent', 'Poste', 'Latitude', 'Longitude', 'Adresse'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.vehiclePlate,
        tx.vehicleType,
        tx.amount,
        tx.currency,
        tx.paymentMethod,
        tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
        tx.status,
        tx.agentId,
        tx.postId,
        tx.location?.latitude || '',
        tx.location?.longitude || '',
        `"${(tx.location?.address || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAgents = () => {
    const headers = ['ID', 'Nom', 'Email', 'Rôle', 'Poste', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...filteredAgents.map(a => [
        a.id,
        a.name,
        a.email,
        a.role,
        posts.find(p => p.id === a.postId)?.name || 'Non assigné',
        a.active ? 'Actif' : 'Inactif'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `agents_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSubscriptions = () => {
    const headers = ['ID Utilisateur', 'Plan', 'Solde', 'Devise'];
    const csvContent = [
      headers.join(','),
      ...filteredSubscriptions.map(s => [
        s.userId,
        s.planType,
        s.balance,
        s.currency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `subscriptions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const unsubscribe = tollService.subscribeToTransactions(setTransactions);
    
    const fetchData = async () => {
      const [agentsList, postsList, tariffsData, subscriptionsList] = await Promise.all([
        tollService.getAgents(),
        tollService.getTollPosts(),
        tollService.getTariffs(),
        tollService.getAllSubscriptions()
      ]);
      setAgents(agentsList);
      setPosts(postsList);
      setTariffs(tariffsData);
      setSubscriptions(subscriptionsList);
    };
    fetchData();

    return () => {
      unsubscribe();
      setAgentSearchQuery('');
      setAgentPage(1);
    };
  }, [agent]);

  const handleUpdateTariff = async () => {
    setIsSaving(true);
    try {
      await tollService.updateTariffs(tariffs);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce poste ?')) return;
    try {
      await tollService.deleteTollPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      alert('Poste supprimé avec succès');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Erreur lors de la suppression du poste');
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Robust email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const email = newAgent.email.trim();
    
    if (!email) {
      setEmailError("L'adresse email est requise.");
      return;
    }
    
    if (!emailRegex.test(email)) {
      setEmailError("Veuillez entrer une adresse email valide (ex: nom@domaine.com).");
      return;
    }
    
    setEmailError(null);
    setIsSaving(true);
    try {
      const agentData = { ...newAgent, email };
      if (editingAgent) {
        await tollService.updateAgent(editingAgent.id, agentData);
        setAgents(agents.map(a => a.id === editingAgent.id ? { ...a, ...agentData } : a));
      } else {
        const id = Math.random().toString(36).substring(7);
        await tollService.createAgent({ ...agentData, id, active: true });
        setAgents([...agents, { ...agentData, id, active: true }]);
      }
      setShowAddAgentModal(false);
      setEditingAgent(null);
      setNewAgent({ name: '', email: '', role: 'agent', postId: '' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingPost) {
        // We don't have updateTollPost in tollService yet, let's assume it exists or add it
        // For now I'll just use setDoc via tollService if I add it
        await tollService.updateTollPost(editingPost.id, newPost);
        setPosts(posts.map(p => p.id === editingPost.id ? { ...p, ...newPost } : p));
      } else {
        const id = await tollService.createTollPost(newPost);
        if (id) {
          setPosts([...posts, { ...newPost, id }]);
        }
      }
      setShowAddPostModal(false);
      setEditingPost(null);
      setNewPost({ 
        name: '', 
        location: '',
        latitude: -4.3224,
        longitude: 15.3070
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!transactionToCancel || !cancelReason) return;
    setIsCancelling(true);
    try {
      await tollService.cancelTransaction(transactionToCancel, cancelReason);
      setTransactionToCancel(null);
      setCancelReason('');
    } catch (err) {
      console.error('Failed to cancel transaction:', err);
      alert("Erreur lors de l'annulation");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmBankPayment = async (id: string) => {
    if (!window.confirm("Confirmer la réception du paiement bancaire pour cette transaction ?")) return;
    
    try {
      await tollService.confirmBankPayment(id);
    } catch (err) {
      alert("Erreur lors de la confirmation");
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await tollService.createSubscription(newSubscription);
      setSubscriptions([...subscriptions, newSubscription]);
      setShowAddSubscriptionModal(false);
      setNewSubscription({ userId: '', balance: 0, currency: 'USD', planType: 'basic' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRechargeModal) return;
    setIsSaving(true);
    try {
      await tollService.rechargeSubscription(showRechargeModal, rechargeAmount);
      setSubscriptions(subscriptions.map(s => 
        s.userId === showRechargeModal ? { ...s, balance: s.balance + rechargeAmount } : s
      ));
      setShowRechargeModal(null);
      setRechargeAmount(0);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setIsSaving(true);
    try {
      await tollService.deleteAgent(agentToDelete);
      setAgents(agents.filter(a => a.id !== agentToDelete));
      setAgentToDelete(null);
    } catch (err) {
      console.error('Failed to delete agent:', err);
      alert("Erreur lors de la suppression de l'agent");
    } finally {
      setIsSaving(false);
    }
  };

  // Stats calculation
  const totalRevenueUSD = transactions.reduce((sum, tx) => {
    if (tx.status === 'cancelled') return sum;
    const amountInUSD = tx.currency === 'USD' ? tx.amount : tx.amount / EXCHANGE_RATE;
    return sum + amountInUSD;
  }, 0);

  const totalRevenueCDF = transactions.reduce((sum, tx) => {
    if (tx.status === 'cancelled') return sum;
    const amountInCDF = tx.currency === 'CDF' ? tx.amount : tx.amount * EXCHANGE_RATE;
    return sum + amountInCDF;
  }, 0);

  const vehicleStats = transactions.reduce((acc, tx) => {
    if (tx.status === 'cancelled') return acc;
    acc[tx.vehicleType] = (acc[tx.vehicleType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const paymentStats = transactions.reduce((acc, tx) => {
    if (tx.status === 'cancelled') return acc;
    acc[tx.paymentMethod] = (acc[tx.paymentMethod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const agentRevenueStats = transactions.reduce((acc, tx) => {
    if (tx.status === 'cancelled') return acc;
    const amountInDisplayCurrency = tx.currency === displayCurrency 
      ? tx.amount 
      : (displayCurrency === 'USD' ? tx.amount / EXCHANGE_RATE : tx.amount * EXCHANGE_RATE);
    
    const agent = agents.find(a => a.id === tx.agentId);
    const agentName = agent ? agent.name : tx.agentId;
    acc[agentName] = (acc[agentName] || 0) + amountInDisplayCurrency;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { 
      label: 'Revenu Total', 
      value: displayCurrency === 'USD' 
        ? `${totalRevenueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
        : `${totalRevenueCDF.toLocaleString()} CDF`, 
      icon: DollarSign, 
      color: 'bg-emerald-500', 
      trend: '+12.5%' 
    },
    { label: 'Véhicules Traités', value: transactions.length, icon: TrendingUp, color: 'bg-drc-blue', trend: '+5.2%' },
    { label: 'Agents Actifs', value: agents.length.toString(), icon: Users, color: 'bg-orange-500', trend: '0%' },
    { label: 'Taux de Fraude', value: '0.2%', icon: ShieldCheck, color: 'bg-red-500', trend: '-2.1%' },
  ];

  // Chart Data Processing
  const getChartData = () => {
    const now = new Date();
    const data: Record<string, number> = {};
    
    transactions.forEach(tx => {
      if (tx.status === 'cancelled') return;
      const date = new Date(tx.timestamp);
      let key = '';
      
      if (timeRange === 'today') {
        key = format(date, 'HH:00');
      } else if (timeRange === 'week') {
        key = format(date, 'EEE', { locale: fr });
      } else {
        key = format(date, 'dd MMM', { locale: fr });
      }
      
      const amountInDisplayCurrency = tx.currency === displayCurrency 
        ? tx.amount 
        : (displayCurrency === 'USD' ? tx.amount / EXCHANGE_RATE : tx.amount * EXCHANGE_RATE);
        
      data[key] = (data[key] || 0) + amountInDisplayCurrency;
    });

    return Object.entries(data).map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const chartData = getChartData();

  const vehicleData = Object.entries(vehicleStats).map(([name, value]) => ({ name, value }));
  const paymentData = Object.entries(paymentStats).map(([name, value]) => ({ name, value }));
  const agentRevenueData = Object.entries(agentRevenueStats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {transactionToCancel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Confirmer l'annulation</h3>
                <p className="text-slate-500 text-sm mt-2">
                  Êtes-vous sûr de vouloir annuler cette transaction ? Cette action est irréversible.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Raison de l'annulation</label>
                  <textarea 
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ex: Erreur de saisie, Paiement refusé..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setTransactionToCancel(null);
                      setCancelReason('');
                    }}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Garder
                  </button>
                  <button 
                    onClick={handleCancelTransaction}
                    disabled={!cancelReason || isCancelling}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCancelling ? <ShieldCheck className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Currency Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Vue d'ensemble</h2>
          <p className="text-slate-500">Suivi en temps réel des performances du réseau</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          {(['USD', 'CDF'] as Currency[]).map((curr) => (
            <button
              key={curr}
              onClick={() => setDisplayCurrency(curr)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                displayCurrency === curr
                  ? 'bg-drc-blue text-white shadow-lg shadow-drc-blue/20'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-${stat.color === 'bg-drc-blue' ? 'drc-blue' : stat.color.split('-')[1]}-200 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart Simulation */}
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-drc-blue/10 rounded-xl flex items-center justify-center text-drc-blue">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Flux de revenus</h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['Aujourd\'hui', 'Semaine', 'Mois'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t === 'Aujourd\'hui' ? 'today' : t === 'Semaine' ? 'week' : 'month')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    (t === 'Aujourd\'hui' && timeRange === 'today') ||
                    (t === 'Semaine' && timeRange === 'week') ||
                    (t === 'Mois' && timeRange === 'month')
                      ? 'bg-white text-drc-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(value) => displayCurrency === 'USD' ? `$${value}` : `${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number) => [
                    displayCurrency === 'USD' 
                      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                      : `${value.toLocaleString()} CDF`,
                    'Revenu'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Distribution Pie Chart */}
        <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-8">Répartition par type</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vehicleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {vehicleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {vehicleData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-medium text-slate-600 capitalize">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-8">Méthodes de paiement</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={32}>
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-8">Performance des agents</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentRevenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  tickFormatter={(value) => displayCurrency === 'USD' ? `$${value}` : `${value/1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: number) => [
                    displayCurrency === 'USD' 
                      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                      : `${value.toLocaleString()} CDF`,
                    'Revenu'
                  ]}
                />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40}>
                  {agentRevenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-8">Alertes récentes</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900">Paiement en attente</h4>
                <p className="text-sm text-amber-700">3 véhicules en attente de confirmation bancaire au poste de Kasumbalesa.</p>
                <span className="text-[10px] font-bold text-amber-500 uppercase mt-2 block">Il y a 5 minutes</span>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900">Objectif atteint</h4>
                <p className="text-sm text-emerald-700">Le poste de Lualaba a atteint 100% de son objectif journalier.</p>
                <span className="text-[10px] font-bold text-emerald-500 uppercase mt-2 block">Il y a 2 heures</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const startIndex = (transactionPage - 1) * itemsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Journal des transactions</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-drc-blue transition-colors" />
              <input 
                type="text"
                placeholder="Filtrer par plaque ou type..."
                value={transactionSearch}
                onChange={(e) => {
                  setTransactionSearch(e.target.value);
                  setTransactionPage(1);
                }}
                className="pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-drc-blue/20 focus:bg-white transition-all w-48 lg:w-56"
              />
              {transactionSearch && (
                <button 
                  onClick={() => {
                    setTransactionSearch('');
                    setTransactionPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <Users className="w-4 h-4 text-slate-400" />
              <select 
                value={transactionAgentFilter}
                onChange={(e) => {
                  setTransactionAgentFilter(e.target.value);
                  setTransactionPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer max-w-[120px]"
              >
                <option value="all">Tous les agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <MapPin className="w-4 h-4 text-slate-400" />
              <select 
                value={transactionPostFilter}
                onChange={(e) => {
                  setTransactionPostFilter(e.target.value);
                  setTransactionPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer max-w-[120px]"
              >
                <option value="all">Tous les postes</option>
                {posts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={transactionStatusFilter}
                onChange={(e) => {
                  setTransactionStatusFilter(e.target.value);
                  setTransactionPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
              >
                <option value="all">Tous les status</option>
                <option value="completed">Complété</option>
                <option value="cancelled">Annulé</option>
                <option value="awaiting_bank_proof">Attente Banque</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-1">
                <input 
                  type="date"
                  value={transactionStartDate}
                  onChange={(e) => {
                    setTransactionStartDate(e.target.value);
                    setTransactionPage(1);
                  }}
                  className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date"
                  value={transactionEndDate}
                  onChange={(e) => {
                    setTransactionEndDate(e.target.value);
                    setTransactionPage(1);
                  }}
                  className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                />
              </div>
              {(transactionStartDate || transactionEndDate) && (
                <button 
                  onClick={() => {
                    setTransactionStartDate('');
                    setTransactionEndDate('');
                    setTransactionPage(1);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button 
              onClick={handleDownloadTransactions}
              className="p-2 text-slate-400 hover:text-drc-blue transition-colors bg-slate-50 rounded-xl border border-slate-100"
              title="Télécharger CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Plaque</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Montant</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Méthode</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Heure</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-slate-50/50 transition-colors group ${tx.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 group-hover:text-drc-blue transition-colors">{tx.vehiclePlate}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 capitalize">{tx.vehicleType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{tx.amount.toLocaleString()} {tx.currency}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 uppercase">{tx.paymentMethod.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd MMM, HH:mm', { locale: fr }) : 'Just now'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest ${
                        tx.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        tx.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.status}
                      </span>
                      {tx.status === 'cancelled' && tx.cancelReason && (
                        <p className="text-[10px] text-red-400 mt-1 italic">"{tx.cancelReason}"</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {tx.status === 'awaiting_bank_proof' && (
                          <button 
                            onClick={() => tx.id && handleConfirmBankPayment(tx.id)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-emerald-50 px-3 py-1 rounded-lg"
                          >
                            Confirmer
                          </button>
                        )}
                        {tx.status !== 'cancelled' && (
                          <button 
                            onClick={() => tx.id && setTransactionToCancel(tx.id)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                    Aucune transaction trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-sm text-slate-500">
              Affichage de <span className="font-bold text-slate-900">{startIndex + 1}</span> à <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredTransactions.length)}</span> sur <span className="font-bold text-slate-900">{filteredTransactions.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={transactionPage === 1}
                onClick={() => setTransactionPage(prev => prev - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Précédent
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setTransactionPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      transactionPage === page
                        ? 'bg-drc-blue text-white shadow-lg shadow-drc-blue/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                disabled={transactionPage === totalPages}
                onClick={() => setTransactionPage(prev => prev + 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAgents = () => {
    const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
    const startIndex = (agentPage - 1) * itemsPerPage;
    const paginatedAgents = filteredAgents.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gestion des Agents</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher un agent..."
                  value={agentSearchQuery}
                  onChange={(e) => {
                    setAgentSearchQuery(e.target.value);
                    setAgentPage(1);
                  }}
                  className="pl-9 pr-9 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-drc-blue/20 transition-all w-48"
                />
                {agentSearchQuery && (
                  <button 
                    onClick={() => {
                      setAgentSearchQuery('');
                      setAgentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={agentPostFilter}
                  onChange={(e) => {
                    setAgentPostFilter(e.target.value);
                    setAgentPage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                >
                  <option value="all">Tous les postes</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleDownloadAgents}
                className="p-2 text-slate-400 hover:text-drc-blue transition-colors bg-slate-50 rounded-xl border border-slate-100"
                title="Télécharger CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button 
            onClick={() => {
              setEmailError(null);
              setShowAddAgentModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-drc-blue text-white rounded-xl text-sm font-semibold hover:bg-drc-blue/90 transition-all shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter Agent
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nom</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Rôle</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Poste Assigné</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAgents.length > 0 ? (
                paginatedAgents.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{a.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{a.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={a.role}
                        onChange={(e) => handleUpdateAgentRole(a.id, e.target.value as 'agent' | 'admin')}
                        className="text-xs font-bold uppercase text-slate-500 bg-transparent border-none focus:ring-0 cursor-pointer hover:text-drc-blue transition-colors"
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {posts.find(p => p.id === a.postId)?.name || 'Non assigné'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest ${
                        a.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {a.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => {
                            setEditingAgent(a);
                            setNewAgent({ name: a.name, email: a.email, role: a.role, postId: a.postId || '' });
                            setEmailError(null);
                            setShowAddAgentModal(true);
                          }}
                          className="text-xs font-bold text-drc-blue hover:underline"
                        >
                          Modifier
                        </button>
                        <button 
                          onClick={() => setAgentToDelete(a.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Supprimer l'agent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    Aucun agent trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-sm text-slate-500">
              Affichage de <span className="font-bold text-slate-900">{startIndex + 1}</span> à <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredAgents.length)}</span> sur <span className="font-bold text-slate-900">{filteredAgents.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={agentPage === 1}
                onClick={() => setAgentPage(prev => prev - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Précédent
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setAgentPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      agentPage === page
                        ? 'bg-drc-blue text-white shadow-lg shadow-drc-blue/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                disabled={agentPage === totalPages}
                onClick={() => setAgentPage(prev => prev + 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Agent Deletion Confirmation Modal */}
        <AnimatePresence>
          {agentToDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Supprimer l'agent</h3>
                  <p className="text-slate-500 text-sm mt-2">
                    Êtes-vous sûr de vouloir supprimer cet agent ? Cette action supprimera définitivement l'accès de l'agent au système.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setAgentToDelete(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleDeleteAgent}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <ShieldCheck className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Supprimer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderPosts = () => {
    const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
    const startIndex = (postPage - 1) * itemsPerPage;
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Postes de Péage</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Rechercher un poste..."
                value={postSearchQuery}
                onChange={(e) => {
                  setPostSearchQuery(e.target.value);
                  setPostPage(1);
                }}
                className="pl-9 pr-9 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-drc-blue/20 transition-all w-48"
              />
              {postSearchQuery && (
                <button 
                  onClick={() => {
                    setPostSearchQuery('');
                    setPostPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowAddPostModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-drc-blue text-white rounded-xl text-sm font-semibold hover:bg-drc-blue/90 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Nouveau Poste
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 lg:p-8">
          {paginatedPosts.length > 0 ? (
            paginatedPosts.map((p) => (
              <div key={p.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-drc-blue/20 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-drc-blue shadow-sm group-hover:scale-110 transition-transform">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {p.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{p.location}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Agents: {agents.filter(a => a.postId === p.id).length}</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setEditingPost(p);
                        setNewPost({ 
                          name: p.name, 
                          location: p.location,
                          latitude: p.latitude || -4.3224,
                          longitude: p.longitude || 15.3070
                        });
                        setShowAddPostModal(true);
                      }}
                      className="text-xs font-bold text-drc-blue hover:underline"
                    >
                      Modifier
                    </button>
                    <button 
                      onClick={() => handleDeletePost(p.id)}
                      className="text-xs font-bold text-red-500 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-500 italic">
              Aucun poste trouvé
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-sm text-slate-500">
              Affichage de <span className="font-bold text-slate-900">{startIndex + 1}</span> à <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredPosts.length)}</span> sur <span className="font-bold text-slate-900">{filteredPosts.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={postPage === 1}
                onClick={() => setPostPage(prev => prev - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Précédent
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setPostPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      postPage === page
                        ? 'bg-drc-blue text-white shadow-lg shadow-drc-blue/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                disabled={postPage === totalPages}
                onClick={() => setPostPage(prev => prev + 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTariffs = () => (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 lg:p-8 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configuration des Tarifs</h2>
        <button 
          onClick={handleUpdateTariff}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2 bg-drc-blue text-white rounded-xl text-sm font-semibold hover:bg-drc-blue/90 transition-all shadow-md disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(['moto', 'car', 'bus', 'truck'] as VehicleType[]).map((type) => (
            <div key={type} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm">
                  {type === 'moto' && <Bike className="w-5 h-5" />}
                  {type === 'car' && <Car className="w-5 h-5" />}
                  {type === 'bus' && <Bus className="w-5 h-5" />}
                  {type === 'truck' && <Truck className="w-5 h-5" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 capitalize">{type}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tarif USD</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input 
                      type="number" 
                      step="0.1"
                      value={tariffs[type].USD}
                      onChange={(e) => setTariffs({
                        ...tariffs,
                        [type]: { ...tariffs[type], USD: parseFloat(e.target.value) }
                      })}
                      className="w-full pl-7 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-drc-blue outline-none text-sm font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tarif CDF</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="100"
                      value={tariffs[type].CDF}
                      onChange={(e) => setTariffs({
                        ...tariffs,
                        [type]: { ...tariffs[type], CDF: parseFloat(e.target.value) }
                      })}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-drc-blue outline-none text-sm font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">CDF</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSubscriptions = () => {
    const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);
    const startIndex = (subscriptionPage - 1) * itemsPerPage;
    const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gestion des Abonnements</h2>
            <p className="text-sm text-slate-500">{filteredSubscriptions.length} abonnements au total</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Rechercher..."
                value={subscriptionSearch}
                onChange={(e) => {
                  setSubscriptionSearch(e.target.value);
                  setSubscriptionPage(1);
                }}
                className="pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-drc-blue outline-none w-64"
              />
              {subscriptionSearch && (
                <button 
                  onClick={() => {
                    setSubscriptionSearch('');
                    setSubscriptionPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <button 
              onClick={handleDownloadSubscriptions}
              className="p-2 text-slate-400 hover:text-drc-blue transition-colors bg-slate-50 rounded-xl border border-slate-100"
              title="Télécharger CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowAddSubscriptionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-drc-blue text-white rounded-xl text-sm font-semibold hover:bg-drc-blue/90 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Nouvel Abonnement
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">ID Utilisateur</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type de Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Solde</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Devise</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSubscriptions.length > 0 ? (
                paginatedSubscriptions.map((s) => (
                  <tr key={s.userId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{s.userId}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest ${
                        s.planType === 'premium' ? 'bg-drc-blue/10 text-drc-blue' :
                        s.planType === 'corporate' ? 'bg-purple-50 text-purple-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {s.planType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{s.balance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{s.currency}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setShowRechargeModal(s.userId)}
                        className="flex items-center gap-1 ml-auto px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <Wallet className="w-3 h-3" />
                        Recharger
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                    Aucun abonnement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-sm text-slate-500">
              Affichage de <span className="font-bold text-slate-900">{startIndex + 1}</span> à <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredSubscriptions.length)}</span> sur <span className="font-bold text-slate-900">{filteredSubscriptions.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={subscriptionPage === 1}
                onClick={() => setSubscriptionPage(p => p - 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Précédent
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setSubscriptionPage(page)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      subscriptionPage === page
                        ? 'bg-drc-blue text-white shadow-lg shadow-drc-blue/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                disabled={subscriptionPage === totalPages}
                onClick={() => setSubscriptionPage(p => p + 1)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const DRCFlag = () => (
    <svg className="w-6 h-4 rounded-sm shadow-sm" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#007FFF"/>
      <path d="M0 600L800 0H600L0 450V600Z" fill="#CE1021"/>
      <path d="M0 600L800 0H700L0 525V600Z" fill="#F7D618"/>
      <path d="M0 450L600 0H700L0 525V450Z" fill="#F7D618"/>
      <polygon points="100,100 120,160 180,160 130,200 150,260 100,220 50,260 70,200 20,160 80,160" fill="#F7D618"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 relative pt-10 lg:pt-12">
      {agent?.id?.startsWith('demo-') && (
        <div className="fixed top-0 left-0 right-0 bg-drc-yellow text-drc-blue py-1 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-center z-[100] shadow-sm flex items-center justify-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          Mode Démonstration - Les données sont réinitialisées périodiquement
          <ShieldCheck className="w-3 h-3" />
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-drc-blue rounded-2xl flex items-center justify-center text-white shadow-xl">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SmartToll <span className="text-drc-red">RDC</span></h1>
                <DRCFlag />
              </div>
              <div className="flex flex-col">
                <p className="text-slate-500 font-medium leading-none">Administration Centrale • {agent?.name}</p>
                <span className="text-[8px] font-bold text-drc-yellow uppercase tracking-[0.2em] mt-1">Justice • Paix • Travail</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              {(['USD', 'CDF'] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setDisplayCurrency(c)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    displayCurrency === c 
                      ? 'bg-drc-blue text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'transactions', label: 'Transactions', icon: History },
            { id: 'agents', label: 'Agents', icon: Users },
            { id: 'posts', label: 'Postes', icon: MapPin },
            { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
            { id: 'tariffs', label: 'Tarifs', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-drc-blue shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'transactions' && renderTransactions()}
          {activeTab === 'agents' && renderAgents()}
          {activeTab === 'posts' && renderPosts()}
          {activeTab === 'subscriptions' && renderSubscriptions()}
          {activeTab === 'tariffs' && renderTariffs()}
        </motion.div>

        {/* Modals */}
        <AnimatePresence>
          {showAddAgentModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">{editingAgent ? 'Modifier l\'Agent' : 'Ajouter un Agent'}</h3>
                  <button onClick={() => { setShowAddAgentModal(false); setEditingAgent(null); setEmailError(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <form onSubmit={handleAddAgent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom Complet</label>
                    <input 
                      required
                      type="text"
                      value={newAgent.name}
                      onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                    <input 
                      required
                      type="email"
                      value={newAgent.email}
                      onChange={(e) => {
                        setNewAgent({ ...newAgent, email: e.target.value });
                        if (emailError) setEmailError(null);
                      }}
                      className={`w-full px-4 py-3 bg-slate-50 border ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-drc-blue'} rounded-xl outline-none transition-all`}
                    />
                    {emailError && (
                      <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {emailError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Poste Assigné</label>
                    <select
                      value={newAgent.postId}
                      onChange={(e) => setNewAgent({ ...newAgent, postId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    >
                      <option value="">Sélectionner un poste</option>
                      {posts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-drc-blue text-white py-4 rounded-2xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Enregistrement...' : editingAgent ? 'Mettre à jour' : 'Créer l\'Agent'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showAddPostModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">{editingPost ? 'Modifier le Poste' : 'Nouveau Poste'}</h3>
                  <button onClick={() => { setShowAddPostModal(false); setEditingPost(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <form onSubmit={handleAddPost} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nom du Poste</label>
                    <input 
                      required
                      type="text"
                      value={newPost.name}
                      onChange={(e) => setNewPost({ ...newPost, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Localisation</label>
                    <input 
                      required
                      type="text"
                      value={newPost.location}
                      onChange={(e) => setNewPost({ ...newPost, location: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Latitude</label>
                      <input 
                        required
                        type="number"
                        step="any"
                        value={newPost.latitude}
                        onChange={(e) => setNewPost({ ...newPost, latitude: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Longitude</label>
                      <input 
                        required
                        type="number"
                        step="any"
                        value={newPost.longitude}
                        onChange={(e) => setNewPost({ ...newPost, longitude: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-drc-blue text-white py-4 rounded-2xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Enregistrement...' : editingPost ? 'Mettre à jour' : 'Créer le Poste'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {showAddSubscriptionModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Nouvel Abonnement</h3>
                  <button onClick={() => setShowAddSubscriptionModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <form onSubmit={handleCreateSubscription} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ID Utilisateur</label>
                    <input 
                      required
                      type="text"
                      value={newSubscription.userId}
                      onChange={(e) => setNewSubscription({ ...newSubscription, userId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type de Plan</label>
                    <select
                      value={newSubscription.planType}
                      onChange={(e) => setNewSubscription({ ...newSubscription, planType: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    >
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="corporate">Corporate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Solde Initial</label>
                    <input 
                      required
                      type="number"
                      value={newSubscription.balance}
                      onChange={(e) => setNewSubscription({ ...newSubscription, balance: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Devise</label>
                    <select
                      value={newSubscription.currency}
                      onChange={(e) => setNewSubscription({ ...newSubscription, currency: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-drc-blue text-white py-4 rounded-2xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Création...' : 'Créer l\'Abonnement'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          {selectedPostDetails && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-drc-blue/10 rounded-2xl flex items-center justify-center text-drc-blue">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedPostDetails.name}</h3>
                      <p className="text-slate-500 text-sm">{selectedPostDetails.location}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPostDetails(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Interactive Map */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Navigation className="w-4 h-4" />
                      Localisation Géographique
                    </h4>
                    <div className="aspect-video bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative shadow-inner">
                      <APIProvider apiKey={(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                        <Map
                          style={{ width: '100%', height: '100%' }}
                          defaultCenter={{ 
                            lat: selectedPostDetails.latitude || -4.3224, 
                            lng: selectedPostDetails.longitude || 15.3070 
                          }}
                          defaultZoom={13}
                          gestureHandling={'greedy'}
                          disableDefaultUI={false}
                          mapId={'bf51a910020fa1cf'} // Example Map ID for Advanced Markers
                        >
                          <AdvancedMarker
                            position={{ 
                              lat: selectedPostDetails.latitude || -4.3224, 
                              lng: selectedPostDetails.longitude || 15.3070 
                            }}
                            title={selectedPostDetails.name}
                          >
                            <Pin background={'#007FFF'} borderColor={'#FFFFFF'} glyphColor={'#FFFFFF'} />
                          </AdvancedMarker>
                        </Map>
                      </APIProvider>
                      {!(import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                          <div className="bg-white p-4 rounded-2xl shadow-xl max-w-xs">
                            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-900">Clé API Google Maps manquante</p>
                            <p className="text-[10px] text-slate-500 mt-1">Veuillez configurer VITE_GOOGLE_MAPS_API_KEY dans les secrets pour activer la carte interactive.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Agents */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Agents Assignés ({agents.filter(a => a.postId === selectedPostDetails.id).length})
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {agents.filter(a => a.postId === selectedPostDetails.id).length > 0 ? (
                        agents.filter(a => a.postId === selectedPostDetails.id).map(agent => (
                          <div key={agent.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{agent.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{agent.email}</p>
                            </div>
                            <div className={`ml-auto w-2 h-2 rounded-full ${agent.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`}></div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-sm text-slate-400 italic">Aucun agent assigné à ce poste.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <button 
                    onClick={() => {
                      setEditingPost(selectedPostDetails);
                      setNewPost({ 
                        name: selectedPostDetails.name, 
                        location: selectedPostDetails.location,
                        latitude: selectedPostDetails.latitude || -4.3224,
                        longitude: selectedPostDetails.longitude || 15.3070
                      });
                      setShowAddPostModal(true);
                      setSelectedPostDetails(null);
                    }}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier le poste
                  </button>
                  <button 
                    onClick={() => setSelectedPostDetails(null)}
                    className="flex-1 py-4 bg-drc-blue text-white rounded-2xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showRechargeModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Recharger le Compte</h3>
                  <button onClick={() => setShowRechargeModal(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <form onSubmit={handleRecharge} className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-4">Recharge pour l'utilisateur: <span className="font-bold text-slate-900">{showRechargeModal}</span></p>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Montant à ajouter</label>
                    <input 
                      required
                      autoFocus
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(parseFloat(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                  >
                    {isSaving ? 'Recharge...' : 'Confirmer la Recharge'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);
