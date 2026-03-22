/**
 * Service for managing Bluetooth thermal printers using Web Bluetooth API.
 * This service handles device discovery, connection, and sending ESC/POS commands.
 */

export interface PrinterDevice {
  id: string;
  name: string;
  connected: boolean;
  device: any;
}

class PrinterService {
  private device: any | null = null;
  private characteristic: any | null = null;

  /**
   * Request a Bluetooth device and connect to it.
   * Filters for devices with the 'printer' service or similar.
   */
  async connect(): Promise<PrinterDevice> {
    try {
      // Request Bluetooth device
      // Many thermal printers use the 000018f0-0000-1000-8000-00805f9b34fb service
      // or generic access. We'll try to be broad but focused on common printer UUIDs.
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'Printer' },
          { namePrefix: 'MTP' },
          { namePrefix: 'Thermal' }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'generic_access']
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT server');

      // Find the primary service
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      
      // Find the characteristic for writing data
      // Common characteristic UUID for thermal printers
      const characteristics = await service.getCharacteristics();
      this.characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;

      if (!this.characteristic) {
        throw new Error('No writable characteristic found on the printer');
      }

      this.device = device;
      
      return {
        id: device.id,
        name: device.name || 'Unknown Printer',
        connected: true,
        device: device
      };
    } catch (error) {
      if (error instanceof Error && (error.name === 'NotFoundError' || error.name === 'AbortError' || error.message.includes('User cancelled'))) {
        // User cancelled the requestDevice() chooser
        throw error;
      }
      console.error('Bluetooth connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the current printer.
   */
  async disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  /**
   * Send ESC/POS commands to the printer.
   */
  async print(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Printer not connected');
    }

    // Split data into chunks if it's too large (MTU limits)
    const CHUNK_SIZE = 20;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
    }
  }

  /**
   * Helper to format a receipt for a toll transaction.
   */
  async printReceipt(transaction: any) {
    const encoder = new TextEncoder();
    
    // Basic ESC/POS commands
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;

    // QR Code data
    const qrData = JSON.stringify({
      id: transaction.id,
      plate: transaction.vehiclePlate,
      type: transaction.vehicleType,
      amount: transaction.amount,
      currency: transaction.currency,
      post: transaction.tollPostName
    });

    const qrDataBytes = encoder.encode(qrData);
    const pL = (qrDataBytes.length + 3) % 256;
    const pH = Math.floor((qrDataBytes.length + 3) / 256);

    const commands = [
      // Initialize printer
      ESC, 0x40,
      
      // Center alignment
      ESC, 0x61, 0x01,
      
      // Bold on
      ESC, 0x45, 0x01,
      ...encoder.encode('FONER - RDC\n'),
      ...encoder.encode('SYSTEME DE PEAGE NATIONAL\n'),
      ESC, 0x45, 0x00, // Bold off
      
      ...encoder.encode('--------------------------------\n'),
      
      // Left alignment
      ESC, 0x61, 0x00,
      ...encoder.encode(`DATE: ${new Date().toLocaleString()}\n`),
      ...encoder.encode(`TICKET: ${transaction.id.slice(-8).toUpperCase()}\n`),
      ...encoder.encode(`PLAQUE: ${transaction.vehiclePlate}\n`),
      ...encoder.encode(`TYPE: ${transaction.vehicleType}\n`),
      ...encoder.encode(`POSTE: ${transaction.tollPostName || 'N/A'}\n`),
      
      ...encoder.encode('--------------------------------\n'),
      
      // Right alignment for amount
      ESC, 0x61, 0x02,
      ESC, 0x45, 0x01,
      ...encoder.encode(`TOTAL: ${transaction.amount} ${transaction.currency}\n`),
      ESC, 0x45, 0x00,
      
      // Center alignment for QR Code
      ESC, 0x61, 0x01,
      ...encoder.encode('\n'),
      
      // QR Code: Set model (Model 2)
      GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      // QR Code: Set size (Size 6)
      GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06,
      // QR Code: Set error correction level (Level L)
      GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30,
      // QR Code: Store data in symbol storage area
      GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...qrDataBytes,
      // QR Code: Print the symbol
      GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30,
      
      ...encoder.encode('\nMERCI ET BON VOYAGE!\n'),
      ...encoder.encode('www.foner.cd\n'),
      
      // Feed and cut (if supported)
      LF, LF, LF,
      GS, 0x56, 0x42, 0x00
    ];

    await this.print(new Uint8Array(commands));
  }
}

export const printerService = new PrinterService();
