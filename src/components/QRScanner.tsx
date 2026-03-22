import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { QrCode, RefreshCw, AlertCircle, X } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

interface QRScannerProps {
  onScanned: (data: any) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanned, isScanning, setIsScanning }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  const captureAndRead = useCallback(async () => {
    if (!webcamRef.current) return;

    setIsProcessing(true);
    setError(null);
    
    let currentAttempt = 0;
    
    const attemptRead = async (): Promise<boolean> => {
      try {
        currentAttempt++;
        setAttempts(currentAttempt);
        
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) throw new Error("CAMERA_ERROR");

        const base64Image = imageSrc.split(',')[1];
        const result = await geminiService.readQRCode(base64Image);
        
        if (result && Object.keys(result).length > 0) {
          onScanned(result);
          setIsScanning(false);
          setAttempts(0);
          return true;
        }
        
        if (currentAttempt < MAX_ATTEMPTS) {
          setError(`Tentative ${currentAttempt}/${MAX_ATTEMPTS} : QR Code non détecté. Assurez-vous que le code est bien à plat, sans reflets et centré.`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return await attemptRead();
        } else {
          setError(`Échec après ${MAX_ATTEMPTS} tentatives. Veuillez vérifier que le QR code est valide ou saisir les informations manuellement.`);
          return false;
        }
      } catch (err: any) {
        if (err.message === "CAMERA_ERROR") {
          setError("Erreur de caméra : Impossible d'accéder au flux vidéo. Vérifiez les permissions de votre navigateur.");
          return false;
        }
        if (currentAttempt < MAX_ATTEMPTS) {
          setError(`Erreur technique (Tentative ${currentAttempt}/${MAX_ATTEMPTS}). Vérifiez votre connexion et réessayez.`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return await attemptRead();
        } else {
          setError("Erreur persistante du service d'analyse. Veuillez fermer et réessayer ou saisir les données manuellement.");
          console.error(err);
          return false;
        }
      }
    };

    await attemptRead();
    setIsProcessing(false);
  }, [webcamRef, onScanned, setIsScanning]);

  if (!isScanning) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-drc-blue text-white">
          <div className="flex items-center gap-3">
            <QrCode className="w-6 h-6" />
            <h2 className="text-xl font-bold">Scanner QR Code</h2>
          </div>
          <button 
            onClick={() => {
              setIsScanning(false);
              setAttempts(0);
            }}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square shadow-inner border-2 border-slate-100">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: "environment",
                width: 720,
                height: 720
              }}
              className="w-full h-full object-cover"
              onUserMediaError={() => setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.")}
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 border-4 border-dashed border-drc-blue/50 m-12 pointer-events-none rounded-3xl">
              <div className="absolute inset-0 bg-drc-blue/5 animate-pulse" />
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-drc-blue rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-drc-blue rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-drc-blue rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-drc-blue rounded-br-lg" />
            </div>
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
              <button
                onClick={captureAndRead}
                disabled={isProcessing || attempts >= MAX_ATTEMPTS}
                className="bg-drc-blue text-white px-8 py-3 rounded-2xl hover:bg-drc-blue/90 transition-colors flex items-center gap-3 shadow-xl disabled:opacity-50 font-bold text-lg"
              >
                {isProcessing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <QrCode className="w-6 h-6" />
                )}
                {isProcessing ? 'Analyse...' : 'Scanner'}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-slate-500 text-sm font-medium px-4">
            Placez le QR code au centre du cadre pour le scanner.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
