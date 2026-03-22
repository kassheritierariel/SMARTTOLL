import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, AlertCircle, X, CheckCircle2, Car, Truck, Bike, Bus } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { VehicleType } from '../types';

interface VehicleScannerProps {
  onRecognized: (plate: string, type: string) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
}

export const VehicleScanner: React.FC<VehicleScannerProps> = ({ onRecognized, isScanning, setIsScanning }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualType, setManualType] = useState<VehicleType>('car');
  const MAX_ATTEMPTS = 3;

  const captureAndRecognize = useCallback(async () => {
    if (!webcamRef.current || attempts >= MAX_ATTEMPTS) return;

    setIsProcessing(true);
    setError(null);
    
    try {
      const nextAttempt = attempts + 1;
      setAttempts(nextAttempt);
      
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error("CAMERA_ERROR");

      const base64Image = imageSrc.split(',')[1];
      const result = await geminiService.recognizePlate(base64Image);
      
      if (result && result.plate && result.plate.length >= 3) {
        onRecognized(result.plate, result.type);
        setIsScanning(false);
        setAttempts(0);
      } else {
        if (nextAttempt < MAX_ATTEMPTS) {
          setError(`Tentative ${nextAttempt}/${MAX_ATTEMPTS} : Plaque non détectée. Assurez-vous que la plaque est propre, bien éclairée et centrée dans le cadre.`);
        } else {
          setError(`Échec après ${MAX_ATTEMPTS} tentatives. L'IA n'arrive pas à lire la plaque. Veuillez passer à la saisie manuelle.`);
          setShowManualForm(true);
        }
      }
    } catch (err: any) {
      const nextAttempt = attempts + 1;
      if (err.message === "CAMERA_ERROR") {
        setError("Erreur de caméra : Impossible de capturer l'image. Vérifiez que la caméra n'est pas utilisée par une autre application.");
      } else if (err.message?.includes("API_KEY")) {
        setError("Erreur de service : Problème de configuration de l'IA. Veuillez contacter le support technique.");
      } else {
        if (nextAttempt < MAX_ATTEMPTS) {
          setError(`Erreur technique lors de la tentative ${nextAttempt}/${MAX_ATTEMPTS}. Veuillez vérifier votre connexion internet et réessayer.`);
        } else {
          setError("Erreur persistante. Veuillez utiliser la saisie manuelle pour ne pas bloquer le passage.");
          setShowManualForm(true);
        }
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }, [webcamRef, onRecognized, setIsScanning, attempts]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPlate.length >= 3) {
      onRecognized(manualPlate.toUpperCase(), manualType);
      setIsScanning(false);
      setAttempts(0);
      setShowManualForm(false);
    }
  };

  if (!isScanning) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-4 mb-8"
    >
      <div className="relative rounded-3xl overflow-hidden bg-black aspect-video shadow-2xl border-4 border-drc-blue/30">
        {!showManualForm ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: "environment",
                width: 1280,
                height: 720
              }}
              className="w-full h-full object-cover"
              onUserMediaError={() => setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.")}
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 pointer-events-none rounded-2xl">
              <div className="absolute inset-0 bg-drc-blue/10 animate-pulse" />
            </div>
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 flex-wrap">
              <button
                onClick={() => {
                  setIsScanning(false);
                  setAttempts(0);
                }}
                className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2 font-bold text-xs"
              >
                <X className="w-4 h-4" />
                Fermer
              </button>
              
              <button
                onClick={() => setShowManualForm(true)}
                className="bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2 font-bold text-xs shadow-lg"
              >
                <AlertCircle className="w-4 h-4" />
                Saisie Manuelle
              </button>

              <button
                onClick={captureAndRecognize}
                disabled={isProcessing || attempts >= MAX_ATTEMPTS}
                className="bg-drc-blue text-white px-6 py-2 rounded-xl hover:bg-drc-blue/90 transition-colors flex items-center gap-2 shadow-xl disabled:opacity-50 font-bold text-sm"
              >
                {isProcessing ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : attempts > 0 ? (
                  <RefreshCw className="w-5 h-5" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
                {isProcessing ? 'Analyse...' : attempts > 0 ? 'Réessayer' : 'Capturer'}
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-white p-8 flex flex-col items-center justify-center">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              Saisie Manuelle
            </h3>
            <form onSubmit={handleManualSubmit} className="w-full max-w-md space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Plaque d'immatriculation</label>
                <input
                  type="text"
                  value={manualPlate}
                  onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                  placeholder="Ex: AB-123-CD"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-drc-blue outline-none transition-all font-mono text-lg uppercase"
                  required
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Type de véhicule</label>
                <div className="grid grid-cols-4 gap-3">
                  {(['moto', 'car', 'bus', 'truck'] as VehicleType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setManualType(type)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        manualType === type 
                          ? 'border-drc-blue bg-drc-blue/5 text-drc-blue' 
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      {type === 'moto' && <Bike className="w-5 h-5" />}
                      {type === 'car' && <Car className="w-5 h-5" />}
                      {type === 'bus' && <Bus className="w-5 h-5" />}
                      {type === 'truck' && <Truck className="w-5 h-5" />}
                      <span className="text-[10px] font-bold uppercase">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-drc-blue text-white rounded-xl font-bold hover:bg-drc-blue/90 transition-all shadow-lg shadow-drc-blue/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && !showManualForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
            <button 
              onClick={() => setShowManualForm(true)}
              className="text-xs underline font-bold"
            >
              Saisie manuelle
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
