"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface ScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (decodedText: string) => void
}

const qrcodeRegionId = "html5qr-code-full-region"

export function ScannerModal({ isOpen, onClose, onScan }: ScannerModalProps) {
  const { toast } = useToast()
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScannerInitializing, setIsScannerInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    // Function to stop the scanner
    const stopScanner = async () => {
      if (html5QrCodeRef.current) {
        try {
          // Check if the scanner is currently running before attempting to stop
          // Html5Qrcode.isScanning() is not a public method, so we rely on try/catch
          // or an internal state if the library provided one.
          // For robustness, we'll try to stop and catch any errors.
          await html5QrCodeRef.current.stop();
          console.log("Scanner stopped successfully.");
        } catch (err) {
          // This error can happen if the scanner was already stopped or not initialized
          console.warn("Failed to stop scanner gracefully (might already be stopped):", err);
        } finally {
          html5QrCodeRef.current = null; // Clear the ref
          setIsScannerInitializing(false);
          setCameraError(null);
        }
      }
    };

    // If modal is not open, stop the scanner and clear state
    if (!isOpen) {
      stopScanner();
      return;
    }

    // If modal is opening, initialize the scanner
    setIsScannerInitializing(true);
    setCameraError(null); // Clear previous errors

    // Create a new Html5Qrcode instance if one doesn't exist
    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(qrcodeRegionId);
    }

    const html5QrCode = html5QrCodeRef.current;
    let scannerActive = true; // Flag to prevent multiple scans/callbacks

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (scannerActive) {
        scannerActive = false; // Prevent further processing of scans
        onScan(decodedText); // Pass the scanned ISBN to the parent component
        html5QrCode.stop().catch(err => console.error("Failed to stop scanner after successful scan", err));
        onClose(); // Close the modal after a successful scan
      }
    };

    const qrCodeErrorCallback = (errorMessage: string) => {
      // This callback is called frequently during scanning, so avoid logging too much
      // console.log("QR Code Error:", errorMessage);
    };

    const config = {
      fps: 10, // Frames per second to scan
      qrbox: { width: 250, height: 150 }, // Size of the scanning box
      formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13], // Specifically target ISBN-13 barcodes
      disableFlip: false, // Allow scanning of flipped barcodes
    };

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          // Prefer the 'environment' (back) camera if available
          const environmentCamera = devices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
          const cameraId = environmentCamera ? environmentCamera.id : devices[0].id; // Fallback to first camera

          html5QrCode.start(
            cameraId, // Use the selected camera ID
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          )
          .then(() => {
            setIsScannerInitializing(false); // Scanner started successfully
            console.log("Scanner started.");
          })
          .catch(err => {
            setIsScannerInitializing(false);
            setCameraError("Could not start the barcode scanner. Please ensure camera permissions are granted and no other app is using the camera.");
            toast({
              title: "Scanner Error",
              description: "Could not start the barcode scanner. Please ensure camera permissions are granted.",
              variant: "destructive",
            });
            console.error("Scanner start error:", err);
          });
        } else {
          setIsScannerInitializing(false);
          setCameraError("No cameras found on this device.");
          toast({
            title: "Camera Error",
            description: "No camera found on this device. Barcode scanning is not available.",
            variant: "destructive",
          });
        }
      })
      .catch(err => {
        setIsScannerInitializing(false);
        setCameraError("Camera access denied. Please enable camera access in your browser settings.");
        toast({
          title: "Camera Error",
          description: "Camera access denied. Please enable camera access in your browser settings.",
          variant: "destructive",
        });
        console.error("Camera access error:", err);
      });

    // Cleanup function when component unmounts or isOpen becomes false
    return () => {
      // Use a timeout to ensure the scanner has a chance to stop properly
      // This can prevent "scanner already running" errors if the modal closes quickly.
      setTimeout(() => {
        stopScanner();
      }, 100);
    };
  }, [isOpen, onScan, onClose, toast]); // Add onClose to dependency array

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col h-full max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-headline">Scan ISBN Barcode</DialogTitle>
          <DialogDescription>
            Center the book's barcode in the frame below.
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex-grow flex items-center justify-center min-h-[200px] bg-gray-100 rounded-md overflow-hidden">
          {isScannerInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Initializing scanner...</p>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-100 text-destructive p-4 text-center z-10">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{cameraError}</p>
            </div>
          )}
          {/* The video element for the scanner will be rendered inside this div by html5-qrcode */}
          <div id={qrcodeRegionId} className="w-full h-full flex justify-center items-center">
            {/* Html5Qrcode will inject the video stream here */}
            {/* Add a placeholder if the scanner hasn't started yet and no error */}
            {!isScannerInitializing && !cameraError && (
              <div className="text-muted-foreground text-sm">
                Awaiting camera stream...
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
