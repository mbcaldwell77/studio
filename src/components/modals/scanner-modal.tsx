"use client"

import { useEffect } from "react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface ScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (decodedText: string) => void
}

const qrcodeRegionId = "html5qr-code-full-region"

export function ScannerModal({ isOpen, onClose, onScan }: ScannerModalProps) {
  const { toast } = useToast()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const html5QrCode = new Html5Qrcode(qrcodeRegionId)
    let scannerRunning = true

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (scannerRunning) {
        scannerRunning = false
        onScan(decodedText)
        html5QrCode.stop().catch(err => console.error("Failed to stop scanner", err))
      }
    }
    const qrCodeErrorCallback = (errorMessage: string) => {
      // parse error, ideally ignore it.
    }

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
    }

    Html5Qrcode.getCameras()
      .then(() => {
        html5QrCode.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback
        ).catch(err => {
            toast({
              title: "Scanner Error",
              description: "Could not start the barcode scanner. Please ensure camera permissions are granted.",
              variant: "destructive",
            })
            console.error("Scanner start error", err)
        })
      })
      .catch(err => {
        toast({
          title: "Camera Error",
          description: "No camera found or permissions denied. Please enable camera access in your browser settings.",
          variant: "destructive",
        })
        console.error("Camera access error", err)
      })

    return () => {
      if (scannerRunning) {
        scannerRunning = false
        setTimeout(() => {
          html5QrCode.stop().catch(err => {
            // Ignore stop errors, can happen if already stopped
          });
        }, 100);
      }
    }
  }, [isOpen, onScan, toast])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Scan ISBN Barcode</DialogTitle>
          <DialogDescription>
            Center the book's barcode in the frame below.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <div id={qrcodeRegionId} className="w-full" />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}