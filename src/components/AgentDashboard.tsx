import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { 
  Car, 
  Truck, 
  Bike, 
  Bus,
  CreditCard, 
  Banknote, 
  Smartphone, 
  History, 
  LogOut, 
  LayoutDashboard,
  Search,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  X,
  MapPin,
  Building2,
  Landmark,
  Repeat,
  QrCode,
  Camera,
  Wifi,
  WifiOff,
  Zap,
  Bell,
  Calendar,
  Inbox,
  Settings,
  ShieldCheck,
  Users,
  CloudUpload,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Hash,
  Clock,
  AlertTriangle,
  Info,
  XCircle
} from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { tollService } from '../services/tollService';
import { geminiService } from '../services/geminiService';
import { printerService, PrinterDevice } from '../services/printerService';
import { VehicleScanner } from './VehicleScanner';
import { QRScanner } from './QRScanner';
import { VehicleType, PaymentMethod, Transaction, TOLL_RATES, Currency, TollPost, TransactionStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { GoogleGenAI } from "@google/genai";

interface AppNotification {
  id: string;
  type: 'low_balance' | 'payment_failure' | 'info';
  message: string;
  timestamp: Date;
  read: boolean;
}

export const AgentDashboard: React.FC = () => {
  const { agent, logout } = useContext(AuthContext);
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [currency, setCurrency] = useState<Currency>('CDF');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tollPosts, setTollPosts] = useState<TollPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState<Transaction | null>(null);
  const [lastConfirmedTransaction, setLastConfirmedTransaction] = useState<Transaction | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBankPaymentQr, setShowBankPaymentQr] = useState<Transaction | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  const generateTutorialVideo = async () => {
    try {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // After opening, we assume success as per instructions
      }

      setIsGeneratingVideo(true);
      setGenerationStatus('Initialisation de la génération...');

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A professional tutorial video for SmartToll RDC agents, specifically demonstrating the Offline Mode and AI Data Synchronization. The scene shows an agent in a remote DRC location with no internet (indicated by a "No Signal" icon). The agent successfully scans a vehicle plate and records a transaction, with the app showing "Saved Offline". Then, the agent moves to an area with signal, and the app automatically starts a "Syncing with AI" process with a modern progress bar. The video ends with a "Sync Complete" confirmation and a data dashboard updating. High quality, 1080p, clear UI overlays, educational and reassuring tone.',
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      setGenerationStatus('Génération de la vidéo en cours (cela peut prendre quelques minutes)...');

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        // @ts-ignore
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        setGenerationStatus('Téléchargement de la vidéo...');
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': process.env.API_KEY || '',
          },
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      }
    } catch (err: any) {
      console.error('Video generation failed:', err);
      const errorMessage = err.message || JSON.stringify(err);
      if (errorMessage.includes('Requested entity was not found') || errorMessage.includes('PERMISSION_DENIED')) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
      setError("Échec de la génération de la vidéo. Veuillez vérifier que votre clé API provient d'un projet Google Cloud avec facturation activée et que l'API Veo est activée.");
    } finally {
      setIsGeneratingVideo(false);
      setGenerationStatus('');
    }
  };

  const [tariffs, setTariffs] = useState<Record<VehicleType, Record<Currency, number>>>(TOLL_RATES);
  const [mmOperator, setMmOperator] = useState<'MTN' | 'Orange' | 'Airtel'>('MTN');
  const [isScanning, setIsScanning] = useState(false);
  const [isQRScanning, setIsQRScanning] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [view, setView] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterVehicleType, setFilterVehicleType] = useState<VehicleType | 'all'>('all');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
  const [filterPayment, setFilterPayment] = useState<PaymentMethod | 'all'>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [recognizedType, setRecognizedType] = useState<VehicleType | null>(null);
  const [suggestedTariff, setSuggestedTariff] = useState<{ amount: number; currency: Currency } | null>(null);
  const [lastScanFailedType, setLastScanFailedType] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<PrinterDevice | null>(null);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const addNotification = (type: AppNotification['type'], message: string) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleQRScanned = (data: any) => {
    if (!data || Object.keys(data).length === 0) {
      setError("Le QR code est vide ou illisible.");
      return;
    }

    let foundData = false;

    // Direct properties
    if (data.plate) { setPlate(data.plate.toUpperCase()); foundData = true; }
    if (data.type && ['moto', 'car', 'bus', 'truck'].includes(data.type)) { setVehicleType(data.type as VehicleType); foundData = true; }
    if (data.paymentMethod && ['cash', 'mobile_money', 'card', 'subscription', 'bank_transfer'].includes(data.paymentMethod)) { setPaymentMethod(data.paymentMethod as PaymentMethod); foundData = true; }
    if (data.currency && ['USD', 'CDF'].includes(data.currency)) { setCurrency(data.currency as Currency); foundData = true; }
    if (data.operator && ['MTN', 'Orange', 'Airtel'].includes(data.operator)) { setMmOperator(data.operator as any); foundData = true; }

    // Nested content
    if (data.content && typeof data.content === 'string') {
      try {
        const parsed = JSON.parse(data.content);
        if (parsed.plate) { setPlate(parsed.plate.toUpperCase()); foundData = true; }
        if (parsed.type && ['moto', 'car', 'bus', 'truck'].includes(parsed.type)) { setVehicleType(parsed.type as VehicleType); foundData = true; }
        if (parsed.paymentMethod) { setPaymentMethod(parsed.paymentMethod as PaymentMethod); foundData = true; }
        if (parsed.currency) { setCurrency(parsed.currency as Currency); foundData = true; }
      } catch (e) {
        // Plain string content - check if it's a plate
        const plateCandidate = data.content.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        if (plateCandidate.length >= 3 && plateCandidate.length <= 15) {
          setPlate(plateCandidate);
          foundData = true;
        }
      }
    }

    if (foundData) {
      setSuccessMessage("Détails de la transaction extraits avec succès !");
      addNotification('info', "QR Code scanné : les champs ont été pré-remplis.");
    } else {
      setError("Aucune information exploitable n'a été trouvée dans le QR code.");
    }
    
    setTimeout(() => setSuccessMessage(null), 4000);
    setIsQRScanning(false);
  };

  const MM_ACCOUNTS = {
    MTN: { number: "*126#", merchant: "MTN-TOLL-001", color: "bg-yellow-400" },
    Orange: { number: "#144#", merchant: "ORANGE-TOLL-002", color: "bg-orange-500" },
    Airtel: { number: "*128#", merchant: "AIRTEL-TOLL-003", color: "bg-red-600" }
  };

  const updatePendingCount = () => {
    const offlineTxs = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
    setPendingSyncCount(offlineTxs.length);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      tollService.syncOfflineTransactions((current, total) => setSyncProgress({ current, total }))
        .then(() => {
          updatePendingCount();
          setSyncProgress(null);
        })
        .catch(err => {
          console.error('Sync failed:', err);
          setError("Échec de la synchronisation des données hors ligne.");
          setSyncProgress(null);
        });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      tollService.syncOfflineTransactions((current, total) => setSyncProgress({ current, total }))
        .then(() => {
          updatePendingCount();
          setSyncProgress(null);
        })
        .catch(err => {
          console.error(err);
          setSyncProgress(null);
        });
    }
    updatePendingCount();

    // Inactivity simulation for low balance notification
    let inactivityTimer: NodeJS.Timeout;
    let hasNotified = false;

    const resetInactivityTimer = () => {
      if (hasNotified) return;
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        addNotification('low_balance', "Alerte Inactivité: L'abonnement du véhicule 1234AB01 est presque épuisé (Solde: 2.500 CDF).");
        hasNotified = true;
      }, 5000);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer));
    
    // Initial start
    resetInactivityTimer();

    const unsubscribe = tollService.subscribeToTransactions((serverTxs) => {
      const offlineTxs = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      setTransactions([...offlineTxs, ...serverTxs]);
      updatePendingCount();
    });

    const fetchData = async () => {
      try {
        const [posts, tariffsData] = await Promise.all([
          tollService.getTollPosts(),
          tollService.getTariffs()
        ]);
        setTollPosts(posts);
        setTariffs(tariffsData);
        if (posts.length > 0) setSelectedPostId(posts[0].id);
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    fetchData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      unsubscribe();
    };
  }, []);

  const handleRecognized = async (recognizedPlate: string, type: string) => {
    setPlate(recognizedPlate);
    if (['moto', 'car', 'bus', 'truck'].includes(type)) {
      const vType = type as VehicleType;
      setVehicleType(vType);
      setRecognizedType(vType);
      setSuggestedTariff({ amount: tariffs[vType][currency], currency });
      setLastScanFailedType(false);
      setSuccessMessage(`Véhicule reconnu : ${recognizedPlate} (${type}). Tarif suggéré : ${tariffs[vType][currency]} ${currency}`);
    } else {
      setRecognizedType(null);
      setSuggestedTariff(null);
      setLastScanFailedType(true);
      setSuccessMessage(`Plaque reconnue : ${recognizedPlate}. Type non identifié.`);
      setError("Le type de véhicule n'a pas pu être identifié automatiquement. Veuillez le sélectionner manuellement ci-dessous.");
    }
    setIsScanning(false);

    // Capture location during scan
    const locationCoords = await getCurrentLocation();
    if (locationCoords) {
      const address = await geminiService.getAddressFromLocation(locationCoords.latitude, locationCoords.longitude);
      setCurrentLocation({
        ...locationCoords,
        address: address || undefined
      });
    }
  };

  const resetForm = () => {
    setPlate('');
    setVehicleType('car');
    setPaymentMethod('cash');
    setCurrency('CDF');
    setRecognizedType(null);
    setSuggestedTariff(null);
    setLastScanFailedType(false);
    setError(null);
    setSuccessMessage(null);
    setLastConfirmedTransaction(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate || !agent || !selectedPostId) {
      if (!selectedPostId) setError("Veuillez sélectionner un poste de péage.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    if (!selectedPostId) {
      setError("Veuillez sélectionner un poste de péage avant de continuer.");
      setIsProcessing(false);
      return;
    }

    // Plate validation: Alphanumeric and hyphens only, 3-15 characters
    const plateRegex = /^[A-Z0-9-]{3,15}$/;
    if (!plateRegex.test(plate.toUpperCase())) {
      setError("Format de plaque invalide. Utilisez uniquement des lettres, chiffres et tirets (3-15 caractères).");
      setIsProcessing(false);
      return;
    }

    // Vehicle type validation
    const validVehicleTypes: VehicleType[] = ['moto', 'car', 'bus', 'truck'];
    if (!vehicleType || !validVehicleTypes.includes(vehicleType)) {
      setError("Veuillez sélectionner un type de véhicule valide (moto, voiture, bus ou camion).");
      setIsProcessing(false);
      return;
    }

    if (paymentMethod === 'mobile_money' && !['MTN', 'Orange', 'Airtel'].includes(mmOperator)) {
      setError("Veuillez sélectionner un opérateur Mobile Money valide (MTN, Orange ou Airtel).");
      setIsProcessing(false);
      return;
    }

    try {
      const amount = tariffs[vehicleType][currency];
      const upperPlate = plate.toUpperCase();
      
      // Get current location
      const locationCoords = await getCurrentLocation();
      let locationData: any = null;
      if (locationCoords) {
        const address = await geminiService.getAddressFromLocation(locationCoords.latitude, locationCoords.longitude);
        locationData = {
          ...locationCoords,
          address: address || undefined
        };
      }

      // Check if vehicle exists or register it
      let vehicle = await tollService.getVehicle(upperPlate);
      if (!vehicle) {
        await tollService.registerVehicle({ plate: upperPlate, type: vehicleType });
      }

      const status: TransactionStatus = paymentMethod === 'bank_transfer' ? 'awaiting_bank_proof' : 'completed';
      const tollPostName = tollPosts.find(p => p.id === selectedPostId)?.name || 'N/A';

      const transactionId = await tollService.createTransaction({
        vehiclePlate: upperPlate,
        vehicleType,
        amount,
        currency,
        paymentMethod,
        agentId: agent.id,
        postId: selectedPostId,
        tollPostName,
        status,
        mmOperator: paymentMethod === 'mobile_money' ? mmOperator : undefined,
        location: locationData || undefined
      });

      const newTx: Transaction = {
        id: transactionId || `offline-${Date.now()}`,
        vehiclePlate: upperPlate,
        vehicleType,
        amount,
        currency,
        paymentMethod,
        agentId: agent.id,
        postId: selectedPostId,
        tollPostName,
        status,
        timestamp: { toDate: () => new Date() } as any,
        isOffline: !isOnline,
        mmOperator: paymentMethod === 'mobile_money' ? mmOperator : undefined,
        location: locationData || undefined
      };

      resetForm();
      
      if (!isOnline) {
        setSuccessMessage(`Passage enregistré hors ligne pour ${upperPlate}. Il sera synchronisé dès le retour de la connexion.`);
        // Update local transaction list immediately for offline
        const offlineTxs = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        setTransactions([...offlineTxs, ...transactions.filter(t => !t.isOffline)]);
        updatePendingCount();
      } else {
        setSuccessMessage(status === 'awaiting_bank_proof' 
          ? `Bordereau généré pour ${upperPlate}. En attente de preuve bancaire.`
          : `Passage enregistré pour ${upperPlate} (${amount} ${currency})`
        );
      }
      
      setShowReceipt(newTx);
      setLastConfirmedTransaction(newTx);
    } catch (err) {
      setError("Erreur lors de l'enregistrement. Veuillez réessayer.");
      addNotification('payment_failure', `Échec du paiement pour la plaque ${plate.toUpperCase()}.`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!transactionToCancel || !cancelReason) return;
    setIsCancelling(true);
    try {
      await tollService.cancelTransaction(transactionToCancel, cancelReason);
      addNotification('info', "Transaction annulée avec succès.");
      setTransactionToCancel(null);
      setCancelReason('');
    } catch (err) {
      console.error('Failed to cancel transaction:', err);
      setError("Erreur lors de l'annulation de la transaction.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConnectPrinter = async () => {
    setIsConnectingPrinter(true);
    try {
      const device = await printerService.connect();
      setConnectedPrinter(device);
      addNotification('info', `Imprimante ${device.name} connectée avec succès.`);
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotFoundError' || err.name === 'AbortError' || err.message.includes('User cancelled'))) {
        // User cancelled, do nothing
        return;
      }
      console.error('Failed to connect printer:', err);
      setError("Impossible de se connecter à l'imprimante. Vérifiez que le Bluetooth est activé.");
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const handleDisconnectPrinter = async () => {
    try {
      await printerService.disconnect();
      setConnectedPrinter(null);
      addNotification('info', "Imprimante déconnectée.");
    } catch (err) {
      console.error('Failed to disconnect printer:', err);
    }
  };

  const handlePrint = async () => {
    if (connectedPrinter && showReceipt) {
      try {
        await printerService.printReceipt({
          ...showReceipt,
          tollPostName: tollPosts.find(p => p.id === showReceipt.postId)?.name
        });
        addNotification('info', "Impression lancée...");
      } catch (err) {
        console.error('Printing failed:', err);
        setError("L'impression Bluetooth a échoué. Vérifiez que l'imprimante est allumée et à portée. Tentative d'impression via le navigateur...");
        // Fallback to browser print if bluetooth fails
        setTimeout(() => window.print(), 1000);
      }
    } else {
      window.print();
    }
  };

  const filteredTransactions = useMemo(() => {
    const getTxDate = (tx: Transaction) => {
      if (tx.timestamp?.toDate) return tx.timestamp.toDate();
      if (tx.timestamp?.seconds) return new Date(tx.timestamp.seconds * 1000);
      if (tx.timestamp instanceof Date) return tx.timestamp;
      return new Date();
    };

    const getTxTime = (tx: Transaction) => {
      if (tx.timestamp?.toDate) return tx.timestamp.toDate().getTime();
      if (tx.timestamp?.seconds) return tx.timestamp.seconds * 1000;
      if (tx.timestamp instanceof Date) return tx.timestamp.getTime();
      return Date.now();
    };

    return transactions
      .filter(tx => {
        const matchPlate = tx.vehiclePlate.toLowerCase().includes(filterPlate.toLowerCase());
        const matchVehicleType = filterVehicleType === 'all' || tx.vehicleType === filterVehicleType;
        const matchStatus = filterStatus === 'all' || tx.status === filterStatus;
        const matchPayment = filterPayment === 'all' || tx.paymentMethod === filterPayment;
        
        const txDate = getTxDate(tx);
        const matchStartDate = !filterStartDate || txDate >= new Date(filterStartDate);
        const matchEndDate = !filterEndDate || txDate <= new Date(new Date(filterEndDate).setHours(23, 59, 59, 999));
        
        return matchPlate && matchVehicleType && matchStatus && matchPayment && matchStartDate && matchEndDate;
      })
      .sort((a, b) => {
        const timeA = getTxTime(a);
        const timeB = getTxTime(b);
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [transactions, filterPlate, filterVehicleType, filterStatus, filterPayment, filterStartDate, filterEndDate, sortOrder]);

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
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative">
      {/* Persistent Connectivity Header */}
      <header className={`flex-shrink-0 z-[100] flex items-center justify-center px-4 py-3 shadow-lg border-b transition-colors overflow-hidden ${
        !isOnline 
          ? 'bg-amber-500 border-amber-600 text-white' 
          : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-4 max-w-screen-2xl w-full justify-between">
          <div className="flex items-center gap-3 lg:gap-6">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-all active:scale-90"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-drc-blue rounded-xl flex items-center justify-center text-white shadow-md">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black text-white tracking-tighter hidden sm:block">
                SmartToll <span className="text-drc-red">RDC</span>
              </h1>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all shadow-sm ${
                isOnline 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-red-600 text-white border-red-700 animate-pulse ring-4 ring-red-600/20'
              }`}>
                {isOnline ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5" />
                )}
                <span className="hidden md:inline">{isOnline ? 'Système en Ligne' : 'MODE HORS LIGNE'}</span>
                <span className="md:hidden">{isOnline ? 'Live' : 'OFFLINE'}</span>
              </div>

              {pendingSyncCount > 0 && (
                <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 border border-indigo-500/30">
                  <CloudUpload className={`w-3.5 h-3.5 ${syncProgress ? 'animate-bounce' : 'animate-pulse'}`} />
                  {pendingSyncCount} <span className="hidden sm:inline">en attente</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Sync Progress - Desktop */}
            {syncProgress && (
              <div className="hidden md:flex items-center gap-3 min-w-[150px] lg:min-w-[200px]">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  />
                </div>
                <span className="text-[10px] font-black opacity-70">{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
              </div>
            )}

            {/* Sync Action */}
            {isOnline && pendingSyncCount > 0 && !syncProgress && (
              <button 
                onClick={() => tollService.syncOfflineTransactions((current, total) => setSyncProgress({ current, total }))
                  .then(() => {
                    updatePendingCount();
                    setSyncProgress(null);
                  })
                  .catch(console.error)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20 border border-emerald-400/30"
              >
                Synchroniser
              </button>
            )}
            
            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-xl transition-all active:scale-90 ${showNotifications ? 'bg-drc-blue text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <Bell className="w-6 h-6" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-slate-900">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {agent?.id?.startsWith('demo-') && (
        <div className="bg-drc-yellow text-drc-blue py-1 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-center z-[100] shadow-sm flex items-center justify-center gap-2 w-full flex-shrink-0">
          <Zap className="w-3 h-3" />
          Mode Démonstration - Les données sont réinitialisées périodiquement
          <Zap className="w-3 h-3" />
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto
          w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-drc-blue rounded-2xl flex items-center justify-center text-white shadow-xl">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
                SmartToll <span className="text-drc-red">RDC</span>
              </h1>
              <div className="flex items-center gap-2">
                <DRCFlag />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">République Démocratique du Congo</span>
                  <span className="text-[8px] font-bold text-drc-yellow uppercase tracking-[0.2em] mt-0.5">Justice • Paix • Travail</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowVideoModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 text-drc-blue rounded-2xl font-bold text-sm hover:bg-white/10 transition-all border border-white/10 shadow-sm group"
        >
          <div className="w-8 h-8 bg-drc-blue rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform">
            <Zap className="w-4 h-4" />
          </div>
          Tutoriel Utilisation
        </button>

        <button 
          onClick={() => {
            setView('dashboard');
            setIsQRScanning(true);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 text-drc-blue rounded-2xl font-bold text-sm hover:bg-white/10 transition-all border border-white/10 shadow-sm group"
        >
          <div className="w-8 h-8 bg-drc-blue rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform">
            <QrCode className="w-4 h-4" />
          </div>
          Scanner QR Code
        </button>

        <button 
          onClick={() => {
            setView('dashboard');
            setIsScanning(true);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 text-drc-blue rounded-2xl font-bold text-sm hover:bg-white/10 transition-all border border-white/10 shadow-sm group"
        >
          <div className="w-8 h-8 bg-drc-blue rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform">
            <Camera className="w-4 h-4" />
          </div>
          Scanner Véhicule
        </button>

        <button 
          onClick={connectedPrinter ? handleDisconnectPrinter : handleConnectPrinter}
          disabled={isConnectingPrinter}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all border shadow-sm group ${
            connectedPrinter 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
              : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform ${
            connectedPrinter ? 'bg-emerald-500' : 'bg-slate-700'
          }`}>
            {isConnectingPrinter ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="leading-tight">{connectedPrinter ? 'Imprimante Connectée' : 'Connecter Imprimante'}</p>
            {connectedPrinter && <p className="text-[10px] opacity-50 truncate">{connectedPrinter.name}</p>}
          </div>
        </button>

        <nav className="flex-1 space-y-2">
          <motion.button 
            whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (view === 'dashboard') {
                // Reset form if already on dashboard
                setPlate('');
                setVehicleType('car');
                setPaymentMethod('cash');
                setCurrency('CDF');
                setRecognizedType(null);
                setLastScanFailedType(false);
                setSuccessMessage("Formulaire réinitialisé.");
                setTimeout(() => setSuccessMessage(null), 2000);
              } else {
                setView('dashboard');
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              view === 'dashboard' ? 'bg-drc-blue/20 text-drc-blue' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Nouveau Passage
          </motion.button>
          <motion.button 
            whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              view === 'history' ? 'bg-drc-blue/20 text-drc-blue' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <History className="w-5 h-5" />
            Historique
          </motion.button>
          <motion.button 
            whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              view === 'settings' ? 'bg-drc-blue/20 text-drc-blue' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Settings className="w-5 h-5" />
            Paramètres
          </motion.button>
        </nav>

        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 font-bold border border-white/10">
              {agent?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{agent?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{agent?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar scroll-smooth transition-all">
        <div className="max-w-6xl mx-auto">
          {view === 'dashboard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Registration Form */}
              <section className="space-y-6">
                {/* Help Card */}
                <div className="bg-gradient-to-br from-drc-blue to-blue-700 p-8 rounded-[2.5rem] shadow-2xl shadow-drc-blue/20 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-drc-red/10 rounded-full blur-2xl" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg group-hover:rotate-6 transition-transform">
                        <Zap className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tight leading-none mb-1">DÉMO SMARTTOLL</h3>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Intelligence Artificielle & Mode Hors Ligne</p>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium leading-relaxed opacity-90 mb-8 max-w-md">
                      Découvrez comment SmartToll révolutionne la collecte des péages en RDC avec la reconnaissance automatique des plaques et la synchronisation intelligente des données.
                    </p>
                    
                    <button 
                      onClick={() => setShowVideoModal(true)}
                      className="flex items-center gap-3 px-8 py-4 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-700 transition-all shadow-xl active:scale-95 group/btn border border-slate-700"
                    >
                      <Zap className="w-5 h-5 group-hover/btn:scale-125 transition-transform" />
                      VOIR LA DÉMONSTRATION
                      <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Toll Post Selection */}
                <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <MapPin className="w-4 h-4 text-drc-blue" />
                    Poste de péage
                  </label>
                  <select
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-drc-blue focus:border-transparent outline-none transition-all font-medium text-slate-100"
                  >
                    <option value="">Sélectionner un poste</option>
                    {tollPosts.map(post => (
                      <option key={post.id} value={post.id} className="bg-slate-900">{post.name}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-900 p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-800">
                  <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white tracking-tight">Enregistrer un passage</h2>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsQRScanning(true)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all border border-slate-700 font-bold text-xs"
                          title="Scanner QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                          QR
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const locationCoords = await getCurrentLocation();
                            if (locationCoords) {
                              const address = await geminiService.getAddressFromLocation(locationCoords.latitude, locationCoords.longitude);
                              setCurrentLocation({
                                ...locationCoords,
                                address: address || undefined
                              });
                            }
                            setShowQrModal(true);
                          }}
                          disabled={!plate}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-500 rounded-xl hover:bg-slate-700 transition-all border border-slate-700 font-bold disabled:opacity-50"
                          title="Générer QR de Paiement"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Highly Visible Scanner Button */}
                    <button
                      type="button"
                      onClick={() => setIsScanning(true)}
                      className="w-full flex flex-col items-center justify-center gap-3 py-8 bg-drc-blue text-white rounded-3xl hover:bg-drc-blue/90 transition-all shadow-2xl shadow-drc-blue/30 font-black text-xl group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span>SCANNER LA PLAQUE</span>
                        <span className="text-[10px] font-bold opacity-70 tracking-[0.3em] uppercase mt-1">Reconnaissance IA Automatique</span>
                      </div>
                    </button>
                  </div>
                  
                  <VehicleScanner 
                    onRecognized={handleRecognized} 
                    isScanning={isScanning} 
                    setIsScanning={setIsScanning} 
                  />

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Plaque d'immatriculation</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={plate}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                            setPlate(val);
                            setRecognizedType(null);
                            setSuggestedTariff(null);
                            setLastScanFailedType(false);
                          }}
                          placeholder="Ex: AB-123-CD"
                          className="w-full pl-12 pr-14 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-drc-blue focus:border-transparent transition-all uppercase font-mono text-lg text-white placeholder-slate-600"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setIsQRScanning(true)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-drc-blue hover:bg-drc-blue/5 rounded-lg transition-all"
                          title="Scanner QR Code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-semibold text-slate-300">Type de véhicule</label>
                        {recognizedType && (
                          <span className="text-[10px] font-bold bg-drc-blue/10 text-drc-blue px-2 py-0.5 rounded-full animate-pulse">
                            RECONNU PAR SCANNER
                          </span>
                        )}
                      </div>

                      <AnimatePresence>
                        {recognizedType && suggestedTariff && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 p-3 bg-drc-blue/5 border border-drc-blue/20 rounded-xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-drc-blue text-white rounded-full flex items-center justify-center shadow-lg shadow-drc-blue/20">
                                <Zap className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-drc-blue uppercase tracking-wider">Tarif IA Suggéré</p>
                                <p className="text-lg font-black text-white">
                                  {suggestedTariff.amount.toLocaleString()} {suggestedTariff.currency}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Basé sur</p>
                              <p className="text-xs font-bold text-slate-300 uppercase">{recognizedType}</p>
                            </div>
                          </motion.div>
                        )}
                        {lastScanFailedType && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-3"
                          >
                            <div className="flex items-center gap-2 text-amber-500">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase">Type non identifié par le scanner</span>
                            </div>
                            <div className="relative">
                              <select
                                value={vehicleType}
                                onChange={(e) => {
                                  setVehicleType(e.target.value as VehicleType);
                                  setLastScanFailedType(false);
                                }}
                                className="w-full pl-4 pr-10 py-3 bg-slate-800 border border-amber-500/30 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-amber-500 outline-none appearance-none cursor-pointer"
                              >
                                <option value="" disabled className="bg-slate-900">Sélectionner manuellement...</option>
                                <option value="moto" className="bg-slate-900">Moto</option>
                                <option value="car" className="bg-slate-900">Voiture / SUV</option>
                                <option value="bus" className="bg-slate-900">Bus / Minibus</option>
                                <option value="truck" className="bg-slate-900">Camion / Poids Lourd</option>
                              </select>
                              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 rotate-90" />
                            </div>
                            <p className="text-[10px] text-amber-400 italic">Veuillez confirmer le type pour appliquer le bon tarif.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['moto', 'car', 'bus', 'truck'] as VehicleType[]).map((type) => {
                          const isSuggested = recognizedType === type;
                          const isSelected = vehicleType === type;
                          const amount = tariffs[type][currency];
                          
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setVehicleType(type);
                                setLastScanFailedType(false);
                                if (recognizedType === type) {
                                  // Keep the suggestion active if they click it
                                }
                              }}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all relative group ${
                                isSelected 
                                  ? 'border-drc-blue bg-drc-blue/20 text-drc-blue ring-2 ring-drc-blue/20' 
                                  : isSuggested
                                    ? 'border-drc-blue/30 bg-slate-800 text-slate-400 hover:border-drc-blue/50'
                                    : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                              {isSuggested && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-drc-blue text-white rounded-full flex items-center justify-center shadow-lg animate-bounce z-10">
                                  <Zap className="w-3.5 h-3.5" />
                                </div>
                              )}
                              {isSelected && !isSuggested && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-drc-blue text-white rounded-full flex items-center justify-center shadow-sm z-10">
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                              )}
                              
                              <div className={`p-2 rounded-lg transition-colors ${
                                isSelected ? 'bg-drc-blue/10' : 'bg-slate-700 shadow-sm'
                              }`}>
                                {type === 'moto' && <Bike className="w-5 h-5" />}
                                {type === 'car' && <Car className="w-5 h-5" />}
                                {type === 'bus' && <Bus className="w-5 h-5" />}
                                {type === 'truck' && <Truck className="w-5 h-5" />}
                              </div>
                              
                              <div className="text-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider block">{type}</span>
                                <span className={`text-xs font-black ${isSelected ? 'text-drc-blue' : 'text-white'}`}>
                                  {amount.toLocaleString()} {currency}
                                </span>
                              </div>

                              {isSuggested && !isSelected && (
                                <div className="absolute inset-0 bg-drc-blue/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[8px] font-black text-drc-blue uppercase bg-white px-2 py-1 rounded-full shadow-sm">Suggéré</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">Devise</label>
                        <div className="flex bg-slate-800 p-1 rounded-xl">
                          {(['USD', 'CDF'] as Currency[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCurrency(c)}
                              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                currency === c 
                                  ? 'bg-slate-700 text-drc-blue shadow-sm' 
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">Mode de paiement</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(['cash', 'mobile_money', 'card', 'subscription', 'bank_transfer'] as PaymentMethod[]).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPaymentMethod(method)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                                paymentMethod === method 
                                  ? 'border-drc-blue bg-drc-blue/20 text-drc-blue' 
                                  : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                              {method === 'cash' && <Banknote className="w-5 h-5" />}
                              {method === 'mobile_money' && <Smartphone className="w-5 h-5" />}
                              {method === 'card' && <CreditCard className="w-5 h-5" />}
                              {method === 'subscription' && <Repeat className="w-5 h-5" />}
                              {method === 'bank_transfer' && <Landmark className="w-5 h-5" />}
                              <span className="text-[8px] font-bold uppercase text-center leading-tight">
                                {method.replace('_', ' ')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {paymentMethod === 'mobile_money' && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Opérateur Mobile Money</label>
                            <span className="text-[10px] font-bold text-drc-blue bg-drc-blue/10 px-2 py-0.5 rounded-full">VALIDATION REQUISE</span>
                          </div>
                          <div className="flex gap-2">
                            {(['MTN', 'Orange', 'Airtel'] as const).map((op) => (
                              <button
                                key={op}
                                type="button"
                                onClick={() => setMmOperator(op)}
                                className={`flex-1 py-3 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                                  mmOperator === op 
                                    ? `bg-slate-700 border-drc-blue text-drc-blue shadow-md transform scale-105` 
                                    : 'bg-slate-900 border-transparent text-slate-500 hover:bg-slate-800'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full ${MM_ACCOUNTS[op].color}`} />
                                {op}
                              </button>
                            ))}
                          </div>
                          
                          {/* Demo Account Info */}
                          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Compte Démo {mmOperator}</p>
                              <p className="text-sm font-mono font-bold text-slate-300">{MM_ACCOUNTS[mmOperator].merchant}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase">Code USSD</p>
                              <p className="text-sm font-mono font-bold text-drc-blue">{MM_ACCOUNTS[mmOperator].number}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {vehicleType && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden"
                        >
                          {/* Decorative background element */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-drc-blue/20 rounded-full blur-3xl -mr-16 -mt-16" />
                          <div className="absolute bottom-0 left-0 w-24 h-24 bg-drc-red/10 rounded-full blur-2xl -ml-12 -mb-12" />

                          <div className="relative flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Total à percevoir</span>
                                {recognizedType === vehicleType && (
                                  <span className="flex items-center gap-1 text-[8px] font-black bg-drc-blue text-white px-2 py-0.5 rounded-full uppercase">
                                    <Zap className="w-2 h-2" />
                                    Validé par IA
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tighter text-white">
                                  {tariffs[vehicleType][currency].toLocaleString()}
                                </span>
                                <span className="text-xl font-bold text-drc-blue">{currency}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-2 ml-auto border border-slate-700">
                                {vehicleType === 'moto' && <Bike className="w-6 h-6 text-white" />}
                                {vehicleType === 'car' && <Car className="w-6 h-6 text-white" />}
                                {vehicleType === 'bus' && <Bus className="w-6 h-6 text-white" />}
                                {vehicleType === 'truck' && <Truck className="w-6 h-6 text-white" />}
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{vehicleType}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {successMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-3 p-4 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 text-sm font-medium"
                        >
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                          {successMessage}
                        </motion.div>
                      )}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-3 p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 text-sm font-medium"
                        >
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 font-bold flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        Réinitialiser
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#0066CC' }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isProcessing}
                        className="flex-1 bg-drc-blue text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-drc-blue/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            Confirmer le passage
                            <ArrowRight className="w-6 h-6" />
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setIsQRScanning(true)}
                        className="px-6 bg-slate-800 text-slate-400 rounded-2xl font-bold transition-all hover:bg-slate-700 flex items-center justify-center border border-slate-700"
                        title="Scanner QR Code"
                      >
                        <QrCode className="w-6 h-6" />
                      </motion.button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (lastConfirmedTransaction) {
                          setShowReceipt(lastConfirmedTransaction);
                          setTimeout(handlePrint, 100);
                        }
                      }}
                      disabled={!lastConfirmedTransaction}
                      className={`w-full mt-4 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border ${
                        lastConfirmedTransaction 
                          ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 shadow-xl' 
                          : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <Printer className={`w-6 h-6 ${lastConfirmedTransaction ? 'text-drc-blue' : 'text-slate-600'}`} />
                      Imprimer le reçu
                    </button>
                  </form>
                </div>
              </section>

              {/* Recent Transactions */}
              <section className="space-y-6">
                <div className="bg-slate-900 p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-800 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Derniers passages</h2>
                    <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-full uppercase tracking-widest">Live</span>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-slate-600">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>Aucun passage enregistré aujourd'hui</p>
                      </div>
                    ) : (
                      transactions.slice(0, 10).map((tx) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ y: -4 }}
                          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group ${
                            tx.status === 'cancelled' 
                              ? 'bg-red-500/5 border-red-500/20 opacity-60' 
                              : 'bg-slate-800/50 border-slate-800 hover:border-drc-blue/40 hover:shadow-lg hover:shadow-drc-blue/10'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            tx.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                            tx.status === 'awaiting_bank_proof' ? 'bg-amber-500/20 text-amber-400' :
                            tx.vehicleType === 'truck' ? 'bg-orange-500/20 text-orange-400' :
                            tx.vehicleType === 'bus' ? 'bg-emerald-500/20 text-emerald-400' :
                            tx.vehicleType === 'car' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {tx.vehicleType === 'moto' && <Bike className="w-6 h-6" />}
                            {tx.vehicleType === 'car' && <Car className="w-6 h-6" />}
                            {tx.vehicleType === 'bus' && <Bus className="w-6 h-6" />}
                            {tx.vehicleType === 'truck' && <Truck className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-mono font-bold uppercase transition-colors ${
                              tx.status === 'cancelled' ? 'text-red-400' : 
                              tx.status === 'awaiting_bank_proof' ? 'text-amber-400' :
                              'text-white group-hover:text-drc-blue'
                            }`}>
                              {tx.vehiclePlate}
                              {tx.status === 'cancelled' && <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">ANNULÉ</span>}
                              {tx.status === 'awaiting_bank_proof' && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">ATTENTE BANQUE</span>}
                              {tx.isOffline && <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full animate-pulse">HORS LIGNE</span>}
                            </p>
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), 'dd/MM/yy HH:mm', { locale: fr }) : 'Just now'}
                              </p>
                              {tx.location && (
                                <p className="text-[10px] text-slate-600 flex items-center gap-1 truncate max-w-[150px]" title={tx.location.address || `${tx.location.latitude}, ${tx.location.longitude}`}>
                                  <MapPin className="w-2.5 h-2.5" />
                                  {tx.location.address || `${tx.location.latitude.toFixed(4)}, ${tx.location.longitude.toFixed(4)}`}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className={`font-bold ${tx.status === 'cancelled' ? 'text-red-400 line-through' : 'text-white'}`}>
                                {tx.amount.toLocaleString()} {tx.currency}
                              </p>
                              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-tighter">{tx.paymentMethod.replace('_', ' ')}</p>
                            </div>
                            {tx.status !== 'cancelled' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setShowReceipt(tx)}
                                  className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                                  title="Imprimer le ticket"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setTransactionToCancel(tx.id || null)}
                                  className="p-2 bg-slate-800 text-red-400 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all border border-slate-700"
                                  title="Annuler la transaction"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                  {transactions.length > 10 && (
                    <button 
                      onClick={() => setView('history')}
                      className="mt-6 w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      Voir tout l'historique
                    </button>
                  )}
                </div>
              </section>
            </div>
          ) : view === 'history' ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('dashboard')}
                    className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                    title="Retour au tableau de bord"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Historique des passages</h2>
                    <p className="text-slate-500 text-sm">Consultez et filtrez tous les enregistrements</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(filterPlate || filterVehicleType !== 'all' || filterStatus !== 'all' || filterPayment !== 'all' || filterStartDate || filterEndDate) && (
                    <button 
                      onClick={() => {
                        setFilterPlate('');
                        setFilterVehicleType('all');
                        setFilterStatus('all');
                        setFilterPayment('all');
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }}
                      className="text-xs font-bold text-red-400 hover:underline px-4 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      Effacer les filtres
                    </button>
                  )}
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all border border-slate-700"
                  >
                    <RefreshCw className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''} transition-transform`} />
                    {sortOrder === 'desc' ? 'Plus récents' : 'Plus anciens'}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plaque</label>
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      value={filterPlate}
                      onChange={(e) => setFilterPlate(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all uppercase font-mono text-sm text-white placeholder-slate-600"
                    />
                  </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</label>
                  </div>
                  <select 
                    value={filterVehicleType}
                    onChange={(e) => setFilterVehicleType(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all font-medium text-sm appearance-none cursor-pointer text-white"
                  >
                    <option value="all" className="bg-slate-900">Tous les types</option>
                    <option value="moto" className="bg-slate-900">Moto</option>
                    <option value="car" className="bg-slate-900">Voiture</option>
                    <option value="bus" className="bg-slate-900">Bus</option>
                    <option value="truck" className="bg-slate-900">Camion</option>
                  </select>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Statut</label>
                  </div>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all font-medium text-sm appearance-none cursor-pointer text-white"
                  >
                    <option value="all" className="bg-slate-900">Tous les statuts</option>
                    <option value="completed" className="bg-slate-900">Complété</option>
                    <option value="pending" className="bg-slate-900">En attente</option>
                    <option value="awaiting_bank_proof" className="bg-slate-900">Attente Banque</option>
                    <option value="failed" className="bg-slate-900">Échoué</option>
                    <option value="cancelled" className="bg-slate-900">Annulé</option>
                  </select>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Paiement</label>
                  </div>
                  <select 
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all font-medium text-sm appearance-none cursor-pointer text-white"
                  >
                    <option value="all" className="bg-slate-900">Tous les modes</option>
                    <option value="cash" className="bg-slate-900">Espèces</option>
                    <option value="mobile_money" className="bg-slate-900">Mobile Money</option>
                    <option value="card" className="bg-slate-900">Carte</option>
                    <option value="subscription" className="bg-slate-900">Abonnement</option>
                    <option value="bank_transfer" className="bg-slate-900">Virement</option>
                  </select>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Début</label>
                  </div>
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all font-medium text-sm cursor-pointer text-white [color-scheme:dark]"
                  />
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 hover:border-drc-blue/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fin</label>
                  </div>
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-drc-blue transition-all font-medium text-sm cursor-pointer text-white [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* History Table/List */}
              <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 border-b border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Heure</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Localisation</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plaque</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Montant</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Paiement</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Statut</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                            Aucune transaction trouvée avec ces filtres
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                              {(() => {
                                const date = tx.timestamp?.toDate ? tx.timestamp.toDate() : 
                                             tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) :
                                             tx.timestamp instanceof Date ? tx.timestamp : null;
                                return date ? format(date, 'dd/MM/yy HH:mm', { locale: fr }) : 'Just now';
                              })()}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                              {tx.location ? (
                                <div className="flex flex-col">
                                  <span className="font-medium truncate max-w-[150px] text-slate-300" title={tx.location.address}>
                                    {tx.location.address || 'Coordonnées GPS'}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {tx.location.latitude.toFixed(4)}, {tx.location.longitude.toFixed(4)}
                                  </span>
                                </div>
                              ) : (
                                <span className="italic text-slate-600">Non disponible</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono font-bold text-white uppercase">{tx.vehiclePlate}</span>
                              {tx.isOffline && <span className="ml-2 w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse" title="Hors ligne" />}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-400 capitalize">{tx.vehicleType}</td>
                            <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                              {tx.amount.toLocaleString()} {tx.currency}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                              {tx.paymentMethod.replace('_', ' ')}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                                tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                tx.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                'bg-amber-500/10 text-amber-500'
                              }`}>
                                {tx.status === 'completed' ? 'Validé' : 
                                 tx.status === 'cancelled' ? 'Annulé' : 'En attente'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setShowReceipt(tx)}
                                  className="p-2 text-slate-500 hover:text-drc-blue hover:bg-drc-blue/10 rounded-lg transition-all"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                {tx.status !== 'cancelled' && (
                                  <button 
                                    onClick={() => setTransactionToCancel(tx.id || null)}
                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Annuler"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
          {view === 'settings' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 max-w-4xl"
            >
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter">Paramètres</h2>
                <p className="text-slate-400 font-medium">Gérez vos préférences et les périphériques connectés</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-drc-blue/10 rounded-2xl flex items-center justify-center text-drc-blue">
                      <Printer className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Imprimantes</h3>
                      <p className="text-xs text-slate-500">Gestion des étiquettes et reçus</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {connectedPrinter ? (
                      <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <div>
                            <p className="text-sm font-bold text-white">{connectedPrinter.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Bluetooth • Connecté</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleDisconnectPrinter}
                          className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-red-500"
                          title="Déconnecter"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-slate-700 rounded-full" />
                          <div>
                            <p className="text-sm font-bold text-slate-500">Aucune imprimante</p>
                            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Déconnecté</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={handleConnectPrinter}
                      disabled={isConnectingPrinter}
                      className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {isConnectingPrinter ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      {connectedPrinter ? 'Changer d\'imprimante' : 'Rechercher des périphériques'}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Sécurité</h3>
                      <p className="text-xs text-slate-500">Session et accès</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm font-medium text-slate-400">Verrouillage automatique</span>
                      <div className="w-10 h-5 bg-drc-blue rounded-full relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm font-medium text-slate-400">Mode haute sécurité</span>
                      <div className="w-10 h-5 bg-slate-800 rounded-full relative cursor-pointer">
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-slate-600 rounded-full shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-drc-blue/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <h3 className="font-bold text-white mb-8 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-drc-blue" />
                  Système de Notifications
                </h3>
                <div className="space-y-6 relative z-10">
                  <p className="text-sm text-slate-400">
                    Configurez et testez les alertes du système. Les notifications vous informent des événements critiques en temps réel.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => addNotification('low_balance', "Alerte: Le solde de l'abonnement pour le véhicule 1234AB01 est critique (2.500 CDF).")}
                      className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left hover:bg-amber-500/20 transition-all group"
                    >
                      <AlertTriangle className="w-6 h-6 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-amber-500">Simuler Solde Bas</p>
                      <p className="text-[10px] text-amber-600 mt-1">Alerte abonnement</p>
                    </button>
                    <button
                      onClick={() => addNotification('payment_failure', "Échec: Le paiement Mobile Money pour la transaction #TX9876 a échoué.")}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-left hover:bg-red-500/20 transition-all group"
                    >
                      <XCircle className="w-6 h-6 text-red-500 mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-red-500">Simuler Échec Paiement</p>
                      <p className="text-[10px] text-red-700 mt-1">Erreur de transaction</p>
                    </button>
                    <button
                      onClick={() => addNotification('info', "Info: Une nouvelle mise à jour du tarif pour les camions sera appliquée demain.")}
                      className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-left hover:bg-blue-500/20 transition-all group"
                    >
                      <Info className="w-6 h-6 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-blue-500">Simuler Info Générale</p>
                      <p className="text-[10px] text-blue-600 mt-1">Information système</p>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-drc-blue/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <h3 className="font-bold text-white mb-8 flex items-center gap-2">
                  <Users className="w-5 h-5 text-drc-blue" />
                  Informations de l'agent
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nom Complet</p>
                    <p className="text-xl font-bold text-white">{agent?.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identifiant Agent</p>
                    <p className="text-xl font-bold text-white font-mono">{agent?.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Poste Actuel</p>
                    <p className="text-xl font-bold text-white">
                      {tollPosts.find(p => p.id === selectedPostId)?.name || 'Non assigné'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dernière Connexion</p>
                    <p className="text-xl font-bold text-white">{format(new Date(), 'dd MMMM yyyy', { locale: fr })}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 print-receipt"
            >
              {/* Header with Toll Post Prominence */}
              <div className={`${showReceipt.status === 'awaiting_bank_proof' ? 'bg-drc-yellow' : 'bg-drc-blue'} p-8 text-white relative`}>
                <button 
                  onClick={() => setShowReceipt(null)}
                  className="absolute right-6 top-6 p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                    {showReceipt.status === 'awaiting_bank_proof' ? (
                      <QrCode className="w-8 h-8 text-white" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    )}
                  </div>
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full mb-2">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {showReceipt.tollPostName || tollPosts.find(p => p.id === showReceipt.postId)?.name || 'Poste de péage'}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black tracking-tight">
                    {showReceipt.status === 'awaiting_bank_proof' ? 'Bordereau de Paiement' : 'Paiement Réussi'}
                  </h3>
                  <p className="text-white/70 text-xs mt-1 font-medium">
                    {showReceipt.status === 'awaiting_bank_proof' ? 'À présenter à la banque' : 'Reçu de passage officiel'}
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Vehicle Type Prominence */}
                <div className="flex items-center justify-between p-6 bg-slate-800/50 rounded-[2rem] border border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Véhicule & Type</p>
                    <p className="text-xl font-black text-white font-mono tracking-tighter">{showReceipt.vehiclePlate}</p>
                    <p className="text-xs font-bold text-drc-blue uppercase tracking-wider">{showReceipt.vehicleType}</p>
                  </div>
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center border border-slate-700">
                    {showReceipt.vehicleType === 'moto' && <Bike className="w-10 h-10 text-slate-500" />}
                    {showReceipt.vehicleType === 'car' && <Car className="w-10 h-10 text-slate-500" />}
                    {showReceipt.vehicleType === 'bus' && <Bus className="w-10 h-10 text-slate-500" />}
                    {showReceipt.vehicleType === 'truck' && <Truck className="w-10 h-10 text-slate-500" />}
                  </div>
                </div>

                {/* QR Code and Amount */}
                <div className="flex flex-col items-center space-y-6">
                  <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                    <QRCodeSVG 
                      value={JSON.stringify({
                        id: showReceipt.id,
                        plate: showReceipt.vehiclePlate,
                        type: showReceipt.vehicleType,
                        amount: showReceipt.amount,
                        currency: showReceipt.currency,
                        post: showReceipt.tollPostName || tollPosts.find(p => p.id === showReceipt.postId)?.name
                      })} 
                      size={160}
                      level="H"
                    />
                  </div>
                  
                  <div className="text-center">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Montant Total</p>
                    <p className="text-5xl font-black text-white tracking-tighter">
                      {showReceipt.amount.toLocaleString()} 
                      <span className={`text-2xl ml-1 font-bold ${showReceipt.status === 'awaiting_bank_proof' ? 'text-drc-yellow' : 'text-drc-blue'}`}>
                        {showReceipt.currency}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Transaction Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Hash className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Référence</span>
                    </div>
                    <p className="text-xs font-bold text-white font-mono">#{showReceipt.id?.slice(-8).toUpperCase()}</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <CreditCard className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Paiement</span>
                    </div>
                    <p className="text-xs font-bold text-white capitalize truncate">
                      {showReceipt.paymentMethod.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Heure</span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {showReceipt.timestamp?.toDate ? format(showReceipt.timestamp.toDate(), 'HH:mm') : format(new Date(), 'HH:mm')}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Date</span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {showReceipt.timestamp?.toDate ? format(showReceipt.timestamp.toDate(), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  {showReceipt.location && (
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-1 col-span-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Localisation</span>
                      </div>
                      <p className="text-xs font-bold text-white truncate">
                        {showReceipt.location.address || `${showReceipt.location.latitude.toFixed(4)}, ${showReceipt.location.longitude.toFixed(4)}`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setShowBankPaymentQr(showReceipt)}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <QrCode className="w-5 h-5" />
                    QR de Paiement Bancaire
                  </button>
                  {!connectedPrinter && (
                    <button 
                      onClick={handleConnectPrinter}
                      disabled={isConnectingPrinter}
                      className="w-full flex items-center justify-center gap-2 bg-drc-blue/10 text-drc-blue py-3 rounded-2xl font-bold hover:bg-drc-blue/20 transition-all border border-drc-blue/20"
                    >
                      {isConnectingPrinter ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                      Connecter une imprimante Bluetooth
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button 
                      onClick={handlePrint}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-lg shadow-slate-950/50"
                    >
                      <Printer className="w-5 h-5" />
                      {connectedPrinter ? 'Imprimer le reçu' : 'Imprimer (Navigateur)'}
                    </button>
                    <button 
                      onClick={() => setShowReceipt(null)}
                      className="flex-1 bg-slate-800 text-slate-400 py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-4 text-center border-t border-slate-800">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Merci de votre passage • SmartToll Manager</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Cancellation Confirmation Modal */}
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
              className="bg-slate-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-8 border border-slate-800"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Confirmer l'annulation</h3>
                <p className="text-slate-400 text-sm mt-2">
                  Êtes-vous sûr de vouloir annuler cette transaction ? Cette action est irréversible.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Raison de l'annulation</label>
                  <textarea 
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ex: Erreur de saisie, Paiement refusé..."
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none min-h-[100px] placeholder:text-slate-600"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setTransactionToCancel(null);
                      setCancelReason('');
                    }}
                    className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Garder
                  </button>
                  <button 
                    onClick={handleCancelTransaction}
                    disabled={!cancelReason || isCancelling}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCancelling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Video Tutorial Modal */}
        {showVideoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl p-8 border border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-drc-blue/10 rounded-xl flex items-center justify-center text-drc-blue">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Tutoriel Online/Offline</h3>
                </div>
                <button 
                  onClick={() => setShowVideoModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden mb-6 relative group">
                {videoUrl ? (
                  <video src={videoUrl} controls className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                    {isGeneratingVideo ? (
                      <>
                        <RefreshCw className="w-12 h-12 mb-4 animate-spin text-drc-blue/40" />
                        <p className="text-lg font-bold">{generationStatus}</p>
                        <p className="text-sm text-slate-400 mt-2 max-w-xs">
                          Nous créons une vidéo personnalisée pour vous montrer le fonctionnement du mode Online/Offline.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Zap className="w-8 h-8 text-drc-blue/40" />
                        </div>
                        <p className="text-lg font-bold">Aucune vidéo générée</p>
                        <p className="text-sm text-slate-400 mt-2 mb-6 max-w-xs">
                          Générez une vidéo de démonstration pour voir comment l'application gère les passages en mode connecté et hors ligne.
                        </p>
                        <button 
                          onClick={generateTutorialVideo}
                          className="px-6 py-3 bg-drc-blue text-white rounded-xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 flex items-center gap-2"
                        >
                          <Zap className="w-4 h-4" />
                          Générer la vidéo (AI)
                        </button>
                        <p className="text-[10px] text-slate-500 mt-4">
                          Nécessite une clé API Google Cloud avec facturation activée.
                          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline ml-1">En savoir plus</a>
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm mb-1">
                    <Wifi className="w-4 h-4" />
                    Mode Online
                  </div>
                  <p className="text-xs text-emerald-400/80 leading-relaxed">Synchronisation instantanée avec le serveur central.</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-sm mb-1">
                    <WifiOff className="w-4 h-4" />
                    Mode Offline
                  </div>
                  <p className="text-xs text-amber-400/80 leading-relaxed">Stockage local sécurisé et synchronisation automatique au retour.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* QR Code Modal for Payment */}
        {showQrModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center border border-slate-800"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-drc-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <QrCode className="w-8 h-8 text-drc-blue" />
                </div>
                <h3 className="text-xl font-bold text-white">QR de Paiement</h3>
                <p className="text-slate-400 text-sm">Scannez pour confirmer le paiement</p>
              </div>

              <div className="bg-slate-800/50 p-6 rounded-3xl mb-6 flex flex-col items-center border border-slate-800">
                <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      plate,
                      type: vehicleType,
                      amount: tariffs[vehicleType][currency],
                      currency,
                      post: tollPosts.find(p => p.id === selectedPostId)?.name || 'N/A',
                      location: currentLocation?.address || 'N/A',
                      timestamp: new Date().toISOString()
                    })}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white font-mono uppercase">{plate}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {vehicleType} • {tollPosts.find(p => p.id === selectedPostId)?.name || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-8 text-left bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Plaque</span>
                  <span className="text-white font-bold font-mono">{plate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Type</span>
                  <span className="text-white font-bold capitalize">{vehicleType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Poste</span>
                  <span className="text-white font-bold">{tollPosts.find(p => p.id === selectedPostId)?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Montant</span>
                  <span className="text-drc-blue font-bold">{tariffs[vehicleType][currency]} {currency}</span>
                </div>
              </div>

              <button 
                onClick={() => setShowQrModal(false)}
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all shadow-lg flex items-center justify-center gap-2 border border-slate-700"
              >
                <X className="w-5 h-5" />
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Bank Payment QR Modal */}
        {showBankPaymentQr && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center border border-slate-800"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                  <Landmark className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Paiement Bancaire</h3>
                <p className="text-slate-400 text-sm">Scannez avec votre application bancaire</p>
              </div>

              <div className="bg-slate-800/50 p-6 rounded-3xl mb-6 flex flex-col items-center border border-slate-800">
                <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                  <QRCodeSVG 
                    value={`SMARTTOLL-PAY:${showBankPaymentQr.id}:${showBankPaymentQr.amount}:${showBankPaymentQr.currency}:${showBankPaymentQr.vehiclePlate}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Référence Transaction</p>
                  <p className="text-sm font-mono font-bold text-white mb-2">#{showBankPaymentQr.id.slice(-8).toUpperCase()}</p>
                  <p className="text-2xl font-black text-emerald-500">{showBankPaymentQr.amount.toLocaleString()} {showBankPaymentQr.currency}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Ce QR code contient les informations nécessaires pour un virement bancaire instantané sécurisé.
                </p>
                <button 
                  onClick={() => setShowBankPaymentQr(null)}
                  className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[80] lg:z-[45]"
            />
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="fixed top-20 right-4 bottom-4 w-full max-w-[350px] bg-slate-900 rounded-[2.5rem] shadow-2xl z-[85] lg:z-[50] flex flex-col overflow-hidden border border-slate-800"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-drc-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-drc-blue/20">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight">Notifications</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Centre d'alertes agent</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-700 mb-4">
                      <Inbox className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aucune notification</p>
                    <p className="text-xs text-slate-600 mt-1">Vous êtes à jour !</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <motion.div
                      layout
                      key={notif.id}
                      className={`p-4 rounded-2xl border transition-all relative group ${
                        notif.read ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-800/50 border-drc-blue/20 shadow-sm'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          notif.type === 'low_balance' ? 'bg-amber-500/10 text-amber-500' :
                          notif.type === 'payment_failure' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {notif.type === 'low_balance' && <AlertTriangle className="w-5 h-5" />}
                          {notif.type === 'payment_failure' && <XCircle className="w-5 h-5" />}
                          {notif.type === 'info' && <Info className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-relaxed ${notif.read ? 'text-slate-400' : 'text-white font-bold'}`}>
                            {notif.message}
                          </p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(notif.timestamp, 'HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="absolute top-2 right-2 p-1.5 bg-slate-800 shadow-sm border border-slate-700 rounded-lg text-drc-blue opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Marquer comme lu"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-4 bg-slate-900 border-t border-slate-800 grid grid-cols-2 gap-3">
                  <button
                    onClick={markAllAsRead}
                    className="py-2.5 text-[10px] font-black uppercase tracking-widest text-drc-blue bg-slate-800 border border-drc-blue/20 rounded-xl hover:bg-slate-700 transition-all"
                  >
                    Tout marquer lu
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 bg-slate-800 border border-red-500/20 rounded-xl hover:bg-slate-700 transition-all"
                  >
                    Effacer tout
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <QRScanner 
        isScanning={isQRScanning}
        setIsScanning={setIsQRScanning}
        onScanned={handleQRScanned}
      />

      {/* Floating Action Button for Scanner (Mobile Only) */}
      <div className="fixed bottom-8 right-8 z-[100] lg:hidden">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsScanning(true)}
          className="w-16 h-16 bg-drc-blue text-white rounded-full shadow-2xl shadow-drc-blue/40 flex items-center justify-center border-4 border-slate-950"
        >
          <Camera className="w-8 h-8" />
        </motion.button>
      </div>
    </div>
  );
};
