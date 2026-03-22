import React, { useContext, useState, useEffect } from 'react';
import { AuthProvider, AuthContext } from './AuthContext';
import { AgentDashboard } from './components/AgentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Car, 
  ArrowRight, 
  RefreshCw,
  Lock,
  Zap,
  Shield,
  BarChart3,
  Wifi,
  Smartphone,
  CheckCircle2,
  Globe,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';

const DRCFlag = ({ className = "w-8 h-5" }: { className?: string }) => (
  <svg className={`${className} rounded-sm shadow-sm`} viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#007FFF"/>
    <path d="M0 600L800 0H600L0 450V600Z" fill="#CE1021"/>
    <path d="M0 600L800 0H700L0 525V600Z" fill="#F7D618"/>
    <path d="M0 450L600 0H700L0 525V450Z" fill="#F7D618"/>
    <polygon points="100,100 120,160 180,160 130,200 150,260 100,220 50,260 70,200 20,160 80,160" fill="#F7D618"/>
  </svg>
);

const HeroSlider: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { login, loginDemo } = useContext(AuthContext);

  const slides = [
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1545147986-a9d6f210df77?auto=format&fit=crop&q=80&w=1920',
      title: 'Reconnaissance IA de Pointe',
      description: "Notre système identifie instantanément les véhicules et les plaques d'immatriculation grâce à une intelligence artificielle avancée, même dans des conditions difficiles.",
      badge: 'Technologie IA'
    },
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=1920',
      title: 'Paiements Multi-Canaux Sécurisés',
      description: "Payez en toute simplicité via Mobile Money (M-Pesa, Orange Money, Airtel Money), carte bancaire ou abonnement. Une traçabilité totale pour chaque franc congolais.",
      badge: 'Fintech & Sécurité'
    },
    {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1920',
      title: 'Mode Hors-Ligne & Synchronisation',
      description: "L'application fonctionne parfaitement sans connexion internet. Les données sont stockées localement et synchronisées automatiquement dès que le réseau est rétabli.",
      badge: 'PWA & Résilience'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative w-full overflow-hidden bg-slate-900 min-h-[700px] flex items-center">
      {slides.map((slide, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: currentSlide === index ? 1 : 0 }}
          transition={{ duration: 1.5 }}
          className={`absolute inset-0 w-full h-full ${currentSlide === index ? 'z-10' : 'z-0'}`}
        >
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: currentSlide === index ? 1.1 : 1 }}
            transition={{ duration: 10, ease: "linear" }}
            className="w-full h-full"
          >
            <img 
              src={slide.url} 
              className="w-full h-full object-cover opacity-60"
              alt={slide.title}
              referrerPolicy="no-referrer"
            />
          </motion.div>
          
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent flex items-center px-12 md:px-24">
            <div className="max-w-2xl space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: currentSlide === index ? 1 : 0, y: currentSlide === index ? 0 : 20 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-drc-blue/20 text-drc-blue rounded-full text-xs font-bold uppercase tracking-widest border border-drc-blue/30 backdrop-blur-sm"
              >
                <Zap className="w-4 h-4" />
                {slide.badge}
              </motion.div>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: currentSlide === index ? 1 : 0, y: currentSlide === index ? 0 : 20 }}
                transition={{ delay: 0.7 }}
                className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight"
              >
                {slide.title.split(' ').map((word, i) => (
                  <span key={i} className={word === 'RDC' ? 'text-drc-red' : word === 'Péage' ? 'text-drc-blue' : ''}>
                    {word}{' '}
                  </span>
                ))}
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: currentSlide === index ? 1 : 0, y: currentSlide === index ? 0 : 20 }}
                transition={{ delay: 0.9 }}
                className="text-xl text-slate-300 leading-relaxed"
              >
                {slide.description}
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: currentSlide === index ? 1 : 0, y: currentSlide === index ? 0 : 20 }}
                transition={{ delay: 1.1 }}
                className="flex flex-col sm:flex-row items-center gap-4 pt-4"
              >
                <button 
                  onClick={login}
                  className="w-full sm:w-auto bg-drc-blue text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-drc-blue/90 transition-all shadow-xl shadow-drc-blue/20 flex items-center justify-center gap-3 group"
                >
                  Démarrer maintenant
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => loginDemo('agent')}
                    className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md text-white px-8 py-5 rounded-2xl font-bold text-lg border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-5 h-5 text-drc-yellow" />
                    Démo Agent
                  </button>
                  <button 
                    onClick={() => loginDemo('admin')}
                    className="flex-1 sm:flex-none bg-white/10 backdrop-blur-md text-white px-8 py-5 rounded-2xl font-bold text-lg border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Démo Admin
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}

      {/* Slider Controls */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all ${currentSlide === i ? 'w-12 bg-drc-blue' : 'w-2 bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { login, loginDemo, loading } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto w-full px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-drc-blue rounded-xl flex items-center justify-center text-white shadow-lg">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
              SmartToll <span className="text-drc-red">RDC</span>
              <DRCFlag />
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">République Démocratique du Congo</span>
                <span className="text-[8px] font-bold text-drc-yellow uppercase tracking-[0.2em] mt-0.5">Justice • Paix • Travail</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <button 
              onClick={() => loginDemo('agent')}
              disabled={loading}
              className="text-slate-600 hover:text-drc-blue px-4 py-2 rounded-xl font-bold text-sm transition-all"
            >
              Démo Agent
            </button>
            <button 
              onClick={() => loginDemo('admin')}
              disabled={loading}
              className="text-slate-600 hover:text-drc-blue px-4 py-2 rounded-xl font-bold text-sm transition-all"
            >
              Démo Admin
            </button>
          </div>
          <button 
            onClick={login}
            disabled={loading}
            className="bg-drc-blue text-white px-6 py-2.5 rounded-xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            Connexion Agent
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center w-full">
        <section className="w-full">
          <HeroSlider />
        </section>

        <div className="px-6 max-w-7xl mx-auto w-full">
          {/* Video Introduction Section */}
        <section id="demo-video" className="py-24 w-full">
          <div className="max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white bg-slate-900 group"
            >
              <video 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                poster="https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&q=80&w=1920"
                autoPlay
                muted
                loop
                playsInline
              >
                <source src="https://assets.mixkit.co/videos/preview/mixkit-highway-traffic-at-night-with-car-lights-4456-large.mp4" type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-drc-blue/80 via-transparent to-transparent flex flex-col justify-end p-12">
                <div className="max-w-2xl">
                  <h3 className="text-3xl font-bold text-white mb-4">Une gestion fluide et intelligente en RDC</h3>
                  <p className="text-drc-blue/80 text-lg leading-relaxed">
                    Découvrez comment SmartToll transforme l'expérience de péage congolais grâce à l'intelligence artificielle.
                  </p>
                </div>
              </div>
              <div className="absolute top-8 right-8">
                <DRCFlag />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform cursor-pointer">
                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">Comment ça marche ?</h3>
            <p className="text-slate-500">Un processus simple et automatisé pour vos agents sur le terrain.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Scan de Plaque", desc: "L'agent scanne la plaque d'immatriculation avec la caméra de sa tablette ou son smartphone.", icon: Car },
              { step: "02", title: "Identification IA", desc: "L'IA reconnaît automatiquement le type de véhicule et applique le tarif correspondant.", icon: Zap },
              { step: "03", title: "Paiement Flexible", desc: "Encaissement via Mobile Money, Espèces, Carte ou Virement bancaire.", icon: Smartphone },
              { step: "04", title: "Reçu Instantané", desc: "Impression du reçu thermique ou envoi d'un QR code de confirmation.", icon: CheckCircle2 }
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-8 bg-white rounded-3xl border border-slate-200 shadow-sm"
              >
                <span className="absolute -top-4 -left-4 w-12 h-12 bg-drc-blue text-white rounded-xl flex items-center justify-center font-bold shadow-lg">
                  {item.step}
                </span>
                <div className="w-12 h-12 bg-drc-blue/10 rounded-2xl flex items-center justify-center text-drc-blue mb-6 mt-2">
                  <item.icon className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Offline Mode Section */}
        <section className="py-24 w-full bg-drc-blue rounded-[3rem] px-8 md:px-16 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-drc-red/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-xs font-bold uppercase tracking-widest border border-white/10">
                <Wifi className="w-4 h-4" />
                Continuité de Service
              </div>
              <h3 className="text-4xl md:text-5xl font-bold tracking-tight">
                Fonctionne même <span className="text-drc-yellow">sans connexion</span> internet
              </h3>
              <p className="text-lg text-white/80 leading-relaxed">
                Ne perdez plus jamais une transaction à cause d'une panne réseau. SmartToll enregistre tout localement et synchronise automatiquement dès que le signal revient.
              </p>
              <ul className="space-y-4">
                {[
                  "Stockage local sécurisé des transactions",
                  "Synchronisation automatique intelligente",
                  "Indicateur de statut de connexion en temps réel",
                  "Zéro interruption pour les agents"
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-white">
                    <CheckCircle2 className="w-5 h-5 text-drc-yellow" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-drc-yellow rounded-lg animate-pulse" />
                    <span className="font-bold text-drc-yellow">Mode Hors Ligne Actif</span>
                  </div>
                  <span className="text-xs text-white/40 uppercase tracking-widest">Poste de Péage Kasumbalesa</span>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-white/5 rounded-xl border border-white/5 flex items-center px-4 justify-between">
                      <div className="w-24 h-2 bg-white/10 rounded-full" />
                      <div className="w-12 h-2 bg-white/10 rounded-full" />
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-sm text-white/60">Transactions en attente</span>
                  <span className="bg-drc-red px-3 py-1 rounded-full text-xs font-bold">12</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="py-12 w-full border-y border-slate-100">
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24 opacity-30 grayscale">
            {["Ministère des Transports", "Banque Centrale", "Direction des Routes", "Police Nationale", "Fonds Routier"].map(p => (
              <span key={p} className="text-xl font-black tracking-tighter uppercase italic">{p}</span>
            ))}
          </div>
        </section>

        {/* Statistics Section */}
        <section className="py-24 w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Transactions", value: "1M+", icon: Database },
              { label: "Postes de Péage", value: "50+", icon: LayoutDashboard },
              { label: "Disponibilité", value: "99.9%", icon: Wifi },
              { label: "Réduction Fraude", value: "45%", icon: ShieldCheck }
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="w-12 h-12 bg-drc-blue/10 rounded-2xl flex items-center justify-center text-drc-blue mx-auto mb-4">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-4xl font-black text-slate-900 mb-1">{stat.value}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="relative">
              <div className="absolute -inset-4 bg-drc-blue/5 rounded-[3rem] -rotate-3" />
              <img 
                src="https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=800" 
                alt="Infrastructure routière" 
                className="relative rounded-[2.5rem] shadow-2xl object-cover aspect-square"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-8 -right-8 bg-white p-6 rounded-3xl shadow-xl border border-slate-100 max-w-[200px]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Système Actif</span>
                </div>
                <p className="text-sm font-bold text-slate-900">Surveillance 24/7 de vos infrastructures</p>
              </div>
            </div>
          </div>
          <div className="space-y-8 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-drc-blue/10 text-drc-blue rounded-full text-xs font-bold uppercase tracking-widest border border-drc-blue/20">
              <Globe className="w-4 h-4" />
              Notre Mission
            </div>
            <h3 className="text-4xl font-bold text-slate-900 leading-tight">
              Digitaliser le transport pour un <span className="text-drc-blue">développement durable</span>
            </h3>
            <p className="text-lg text-slate-500 leading-relaxed">
              SmartToll n'est pas seulement un logiciel de caisse. C'est une plateforme complète conçue pour transformer la gestion des infrastructures routières en Afrique. 
            </p>
            <div className="space-y-6">
              {[
                { title: "Transparence Totale", desc: "Chaque centime collecté est tracé et auditable en temps réel par les autorités." },
                { title: "Expérience Usager", desc: "Réduction drastique des files d'attente grâce à l'identification automatique par IA." },
                { title: "Maintenance Prédictive", desc: "Utilisation des données de trafic pour planifier les réparations des routes." }
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 bg-drc-blue/10 rounded-xl flex items-center justify-center text-drc-blue flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">Fonctionnalités Clés</h3>
            <p className="text-slate-500">Une solution complète pour la gestion moderne des infrastructures routières.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {[
              { icon: Shield, title: "Anti-Fraude", desc: "Suivi en temps réel de chaque transaction pour une transparence totale et une réduction des pertes." },
              { icon: Car, title: "Reconnaissance IA", desc: "Identification automatique des plaques et types de véhicules via Gemini pour une saisie ultra-rapide." },
              { icon: BarChart3, title: "Analytique Avancée", desc: "Tableaux de bord détaillés pour une gestion financière précise et des prévisions de trafic." },
              { icon: Globe, title: "Multi-Postes", desc: "Gérez plusieurs postes de péage depuis une interface centrale unique pour les administrateurs." },
              { icon: Database, title: "Historique Complet", desc: "Archivez chaque passage avec photo de la plaque et détails du paiement pour audit ultérieur." },
              { icon: Lock, title: "Sécurité Bancaire", desc: "Protocoles de sécurité de haut niveau pour protéger les données sensibles et les transactions financières." }
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-left hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-drc-blue/10 rounded-2xl flex items-center justify-center text-drc-blue mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mobile First Section */}
        <section className="py-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-100">
              <Smartphone className="w-4 h-4" />
              Optimisé pour le terrain
            </div>
            <h3 className="text-4xl font-bold text-slate-900 leading-tight">
              Une application <span className="text-emerald-600">mobile-first</span> pour vos agents
            </h3>
            <p className="text-lg text-slate-500 leading-relaxed">
              Conçue pour être utilisée sur des tablettes et smartphones durcis, notre interface est pensée pour une manipulation rapide, même avec des gants ou sous un soleil éclatant.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: "Interface Tactile", desc: "Boutons larges et contrastés." },
                { title: "Mode Sombre/Clair", desc: "Adaptation automatique à la luminosité." },
                { title: "Faible Consommation", desc: "Optimisé pour durer toute la journée." },
                { title: "Scan Rapide", desc: "Mise au point instantanée de la caméra." }
              ].map(item => (
                <div key={item.title} className="space-y-2">
                  <h4 className="font-bold text-slate-900">{item.title}</h4>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-100 rounded-[3rem] rotate-3 -z-10" />
            <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border-8 border-slate-800">
              <div className="bg-slate-50 rounded-[1.5rem] aspect-[9/16] overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-12 bg-white border-b border-slate-100 flex items-center justify-between px-4">
                  <div className="w-8 h-2 bg-slate-200 rounded-full" />
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-200 rounded-full" />
                    <div className="w-2 h-2 bg-slate-200 rounded-full" />
                  </div>
                </div>
                <div className="p-6 pt-16 space-y-6">
                  <div className="h-40 bg-drc-blue rounded-2xl flex items-center justify-center text-white">
                    <Car className="w-12 h-12" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded-full w-3/4" />
                    <div className="h-4 bg-slate-200 rounded-full w-1/2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 bg-white border border-slate-200 rounded-xl" />
                    <div className="h-12 bg-white border border-slate-200 rounded-xl" />
                  </div>
                  <div className="h-14 bg-drc-blue rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">Ils nous font confiance</h3>
            <p className="text-slate-500">Découvrez les retours de nos partenaires sur le terrain.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Jean Kabamba", role: "Directeur des Transports", text: "SmartToll a radicalement changé notre façon de percevoir les taxes. La transparence est désormais au cœur de notre gestion.", avatar: "JK" },
              { name: "Marie Mwamba", role: "Agent de Péage Senior", text: "Le mode hors ligne est une bénédiction. Même pendant les orages, nous continuons à travailler sans stress.", avatar: "MM" },
              { name: "Patrick Lelo", role: "Administrateur Système", text: "L'intégration de l'IA pour la lecture des plaques a réduit le temps de passage de 60% par véhicule.", avatar: "PL" }
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-drc-blue/10 rounded-full flex items-center justify-center text-drc-blue font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{t.name}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
                <p className="text-slate-500 italic leading-relaxed">"{t.text}"</p>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-drc-blue/5 rounded-full flex items-center justify-center -z-10 opacity-50" />
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 w-full">
          <div className="bg-drc-blue rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-drc-blue/20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-drc-yellow/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-drc-red/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
            <div className="relative z-10 max-w-3xl mx-auto space-y-8">
              <h3 className="text-4xl md:text-5xl font-bold tracking-tight">Prêt à moderniser notre réseau routier ?</h3>
              <p className="text-xl text-white/80">Rejoignez les dizaines de postes de péage qui font déjà confiance à SmartToll pour le développement de la RDC.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={login}
                  className="w-full sm:w-auto bg-white text-drc-blue px-10 py-5 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all shadow-xl flex items-center justify-center gap-3"
                >
                  Démarrer l'essai gratuit
                  <ArrowRight className="w-6 h-6" />
                </button>
                <button className="w-full sm:w-auto bg-drc-red text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-drc-red/90 transition-all border border-drc-red/20 shadow-lg shadow-drc-red/20">
                  Contacter un expert
                </button>
              </div>
            </div>
          </div>
        </section>
        {/* Security Section */}
        <section className="py-24 w-full bg-slate-900 rounded-[3rem] p-12 md:p-20 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-drc-blue/20 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-drc-blue rounded-full text-xs font-bold uppercase tracking-widest border border-white/10">
                <ShieldCheck className="w-4 h-4" />
                Sécurité de niveau bancaire
              </div>
              <h3 className="text-4xl font-bold leading-tight">
                Vos données sont <span className="text-drc-blue">protégées</span> et auditables
              </h3>
              <p className="text-lg text-slate-400 leading-relaxed">
                Nous utilisons des protocoles de chiffrement de pointe pour garantir que chaque transaction est infalsifiable et que les fonds arrivent à destination en toute sécurité.
              </p>
              <div className="space-y-6">
                {[
                  { title: "Chiffrement AES-256", desc: "Toutes les données sensibles sont chiffrées au repos et en transit." },
                  { title: "Audit Trail complet", desc: "Chaque action d'un agent est enregistrée et horodatée." },
                  { title: "Conformité RGPD", desc: "Respect strict de la vie privée et de la protection des données." }
                ].map(item => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-6 h-6 bg-drc-blue/20 rounded-full flex items-center justify-center text-drc-blue flex-shrink-0 mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold">{item.title}</h4>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-64 h-64 bg-drc-blue rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(0,127,255,0.3)] border-8 border-drc-blue/50">
                <ShieldCheck className="w-32 h-32 text-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">Plans & Tarification</h3>
            <p className="text-slate-500">Choisissez le plan qui correspond à la taille de votre réseau.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Starter", price: "499", features: ["Jusqu'à 3 postes", "Support 24/7", "Mode Offline", "Rapports PDF"], color: "slate" },
              { name: "Pro", price: "1299", features: ["Jusqu'à 15 postes", "IA Avancée", "API Intégration", "Analytique Live"], color: "drc-blue", popular: true },
              { name: "Entreprise", price: "Sur devis", features: ["Postes illimités", "Serveur Dédié", "Formation sur site", "Audit annuel"], color: "slate" }
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`p-8 rounded-[2.5rem] border ${plan.popular ? 'border-drc-blue ring-4 ring-drc-blue/5' : 'border-slate-100'} bg-white relative flex flex-col`}
              >
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-drc-blue text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Le plus populaire</span>
                )}
                <h4 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h4>
                <div className="mb-8">
                  <span className="text-4xl font-black text-slate-900">{plan.price === "Sur devis" ? "" : "$"}{plan.price}</span>
                  {plan.price !== "Sur devis" && <span className="text-slate-400 text-sm">/mois</span>}
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-4 rounded-2xl font-bold transition-all ${plan.popular ? 'bg-drc-blue text-white hover:bg-drc-blue/90 shadow-lg shadow-drc-blue/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Choisir ce plan
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Team Section */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">L'équipe derrière SmartToll</h3>
            <p className="text-slate-500">Des experts passionnés par la transformation numérique de l'Afrique.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { name: "Kassi Héritier", role: "Fondateur & CEO", avatar: "KH" },
              { name: "Sarah Mbuyi", role: "Directrice Technique", avatar: "SM" },
              { name: "Alain Bokilo", role: "Lead IA", avatar: "AB" },
              { name: "Fifi Kalanga", role: "Responsable Opérations", avatar: "FK" }
            ].map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center group"
              >
                <div className="w-32 h-32 bg-slate-100 rounded-full mx-auto mb-6 flex items-center justify-center text-slate-400 font-bold text-2xl group-hover:bg-drc-blue group-hover:text-white transition-all">
                  {m.avatar}
                </div>
                <h4 className="font-bold text-slate-900">{m.name}</h4>
                <p className="text-sm text-slate-500">{m.role}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 w-full">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">Questions Fréquentes</h3>
            <p className="text-slate-500">Tout ce que vous devez savoir sur SmartToll.</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              { q: "Comment fonctionne la reconnaissance des plaques ?", a: "Nous utilisons l'intelligence artificielle Gemini pour analyser en temps réel le flux vidéo de la caméra et extraire le numéro de plaque ainsi que le type de véhicule." },
              { q: "Que se passe-t-il en cas de coupure d'électricité ?", a: "L'application est optimisée pour les terminaux mobiles sur batterie. Les données sont stockées localement et synchronisées dès que le courant et le réseau reviennent." },
              { q: "Quels sont les modes de paiement supportés ?", a: "Nous supportons les espèces, toutes les cartes bancaires, les virements avec QR code et les principaux opérateurs de Mobile Money (M-Pesa, Orange Money, Airtel Money)." },
              { q: "Est-ce que le système est conforme aux lois locales ?", a: "Oui, SmartToll est conçu pour respecter les réglementations fiscales et de transport en vigueur, avec des rapports d'audit exportables." }
            ].map((faq, i) => (
              <motion.details
                key={faq.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-bold text-slate-900 group-open:bg-slate-50 transition-colors">
                  {faq.q}
                  <ArrowRight className="w-5 h-5 group-open:rotate-90 transition-transform text-drc-blue" />
                </summary>
                <div className="p-6 text-slate-500 text-sm leading-relaxed border-t border-slate-50">
                  {faq.a}
                </div>
              </motion.details>
            ))}
          </div>
        </section>

        {/* Awards Section */}
        <section className="py-12 w-full flex flex-wrap items-center justify-center gap-12 opacity-50">
          {[
            "Innovation Award 2025",
            "Top 10 African Startups",
            "Best Transport Solution",
            "Fintech Excellence 2024"
          ].map(award => (
            <div key={award} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">{award}</span>
            </div>
          ))}
        </section>

        {/* Newsletter Section */}
        <section className="py-24 w-full">
          <div className="bg-slate-100 rounded-[3rem] p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-md space-y-4">
              <h3 className="text-3xl font-bold text-slate-900">Restez informé</h3>
              <p className="text-slate-500">Inscrivez-vous à notre newsletter pour recevoir les dernières actualités sur la mobilité intelligente.</p>
            </div>
            <div className="w-full max-w-md flex flex-col sm:flex-row gap-4">
              <input type="email" placeholder="votre@email.com" className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-drc-blue transition-all" />
              <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all">
                S'abonner
              </button>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-24 w-full grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h3 className="text-3xl font-bold text-slate-900">Besoin d'une démonstration personnalisée ?</h3>
            <p className="text-slate-500 leading-relaxed">Nos experts sont à votre disposition pour vous accompagner dans la digitalisation de vos infrastructures routières.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600">
                <div className="w-10 h-10 bg-drc-blue/10 rounded-xl flex items-center justify-center text-drc-blue">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="font-bold">+243 818 261 297</span>
              </div>
              <div className="flex items-center gap-4 text-slate-600">
                <div className="w-10 h-10 bg-drc-blue/10 rounded-xl flex items-center justify-center text-drc-blue">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="font-bold">contact@smarttoll.cd</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Nom" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-drc-blue transition-all" />
              <input type="text" placeholder="Prénom" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-drc-blue transition-all" />
            </div>
            <input type="email" placeholder="Email professionnel" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-drc-blue transition-all" />
            <textarea placeholder="Votre message" rows={4} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-drc-blue transition-all resize-none" />
            <button className="w-full bg-drc-blue text-white py-5 rounded-2xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20">
              Envoyer la demande
            </button>
          </div>
        </section>
      </div>
    </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-drc-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-drc-blue/20">
                <Car className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">SmartToll <span className="text-drc-red">RDC</span></span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">Digitalisation et modernisation des infrastructures routières en République Démocratique du Congo.</p>
            <div className="flex gap-4">
              {["twitter", "linkedin", "facebook"].map(s => (
                <div key={s} className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 hover:bg-drc-blue/10 hover:text-drc-blue transition-colors cursor-pointer">
                  <Globe className="w-4 h-4" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Produit</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Fonctionnalités</li>
              <li onClick={() => loginDemo('agent')} className="hover:text-drc-blue cursor-pointer transition-colors">Démo Agent</li>
              <li onClick={() => loginDemo('admin')} className="hover:text-drc-blue cursor-pointer transition-colors">Démo Admin</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">API</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Compagnie</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li className="hover:text-drc-blue cursor-pointer transition-colors">À propos</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Mission</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Carrières</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Légal</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Confidentialité</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">CGU</li>
              <li className="hover:text-drc-blue cursor-pointer transition-colors">Mentions légales</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
          <span>© 2026 SmartToll Manager. Propulsé par Kassheritier|+243818261297.</span>
          <div className="flex gap-8">
            <span className="hover:text-drc-blue cursor-pointer transition-colors">Plan du site</span>
            <span className="hover:text-drc-blue cursor-pointer transition-colors">Cookies</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, agent, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-drc-blue rounded-2xl flex items-center justify-center text-white shadow-xl animate-bounce">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Chargement du système...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const isAdmin = agent?.role === 'admin' || user?.email === 'kassheritier@telgroups.org';

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return <AgentDashboard />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
