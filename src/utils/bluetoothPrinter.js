/**
 * BluetoothPrinter.js
 * Utilidad para manejar la conexión y envío de datos ESC/POS a impresoras térmicas Bluetooth
 * usando la Web Bluetooth API.
 */

export class BluetoothPrinter {
    constructor() {
        this.device = null;
        this.characteristic = null;
        this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
    }

    async connect() {
        if (!navigator.bluetooth) {
            throw new Error('Tu navegador no soporta Bluetooth Web o no estás en una conexión segura (HTTPS/Localhost)');
        }

        try {
            this.status = 'CONNECTING';

            // Usamos filtros más amplios para asegurar que aparezca la impresora
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
                    { namePrefix: 'Inner' },
                    { namePrefix: 'RPPA' },
                    { namePrefix: 'MPT' },
                    { namePrefix: 'MTP' },
                    { namePrefix: 'Printer' },
                    { namePrefix: 'ZJ' },
                    { namePrefix: 'POS' },
                    { namePrefix: 'BT-' }
                ],
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    '0000ae30-0000-1000-8000-00805f9b34fb',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
                ]
            });

            const server = await this.device.gatt.connect();
            const services = await server.getPrimaryServices();
            let writeChar = null;

            for (const service of services) {
                const chars = await service.getCharacteristics();
                for (const char of chars) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        writeChar = char;
                        break;
                    }
                }
                if (writeChar) break;
            }

            if (!writeChar) {
                throw new Error('No se encontró el canal de escritura en esta impresora');
            }

            this.characteristic = writeChar;
            this.status = 'CONNECTED';
            return true;
        } catch (error) {
            console.error('Error de conexión Bluetooth:', error);
            this.status = 'DISCONNECTED';
            throw error;
        }
    }

    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.status = 'DISCONNECTED';
        this.characteristic = null;
        this.device = null;
    }

    async sendRaw(data) {
        if (!this.characteristic) throw new Error('No hay impresora conectada');
        const chunkSize = 20;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await this.characteristic.writeValue(chunk);
        }
    }

    static CMD = {
        INIT: new Uint8Array([0x1B, 0x40]),
        ALIGN_LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
        ALIGN_CENTER: new Uint8Array([0x1B, 0x61, 0x01]),
        ALIGN_RIGHT: new Uint8Array([0x1B, 0x61, 0x02]),
        BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]),
        BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
        FEED: new Uint8Array([0x0A]),
        FULL_CUT: new Uint8Array([0x1D, 0x56, 0x00])
    };

    async printVenta(venta, config) {
        console.log("Iniciando printVenta...", { venta, config });
        if (!venta || !venta.items) {
            console.error("No hay datos de venta o items para imprimir");
            throw new Error("Datos de venta incompletos");
        }

        try {
            if (!this.isConnected()) {
                console.log("No conectado, intentando conectar...");
                await this.connect();
            }

            const is80mm = config?.papel_bt === '80mm';
            const width = is80mm ? 48 : 32;
            console.log("Configurando ticket:", { width, is80mm });

            const encoder = new TextEncoder();

            const line = "-".repeat(width) + "\n";

            const center = (text) => {
                const spaces = Math.max(0, Math.floor((width - text.length) / 2));
                return " ".repeat(spaces) + text + "\n";
            };

            const justify = (left, right) => {
                const spaces = Math.max(1, width - left.length - right.length);
                return left + " ".repeat(spaces) + right + "\n";
            };

            const fmtUSD = (v) => "$" + (v || 0).toFixed(2);

            let content = [
                BluetoothPrinter.CMD.INIT,
                BluetoothPrinter.CMD.ALIGN_CENTER,
                BluetoothPrinter.CMD.BOLD_ON,
                encoder.encode(center(config?.nombre || "AUTO. GUAICAIPURO")),
                BluetoothPrinter.CMD.BOLD_OFF,
                encoder.encode(center("RIF: " + (config?.rif || ""))),
                encoder.encode(center(config?.direccion1 || "")),
                encoder.encode(center(config?.telefonos || "")),
                encoder.encode(line),
                encoder.encode(center("NOTA DE ENTREGA #" + (venta.nro || "---"))),
                encoder.encode(center(new Date(venta.fecha).toLocaleString())),
                encoder.encode(line),
                BluetoothPrinter.CMD.ALIGN_LEFT,
                encoder.encode("CLIENTE: " + (venta.cliente_nombre || venta.cliente || "Mostrador") + "\n"),
                encoder.encode(line),
                BluetoothPrinter.CMD.BOLD_ON,
                encoder.encode(justify("DESCRIPCION", "TOTAL")),
                BluetoothPrinter.CMD.BOLD_OFF,
                encoder.encode(line),
            ];

            for (const item of venta.items || []) {
                const desc = item.descripcion.substring(0, width - 10);
                const total = fmtUSD(item.precio * item.qty);
                content.push(encoder.encode(justify(`${item.qty}x ${desc}`, total)));
            }

            content.push(encoder.encode(line));
            const subtotal = (venta.items || []).reduce((acc, i) => acc + (i.precio * i.qty), 0);

            content.push(encoder.encode(justify("SUBTOTAL:", fmtUSD(subtotal))));
            if (venta.iva > 0) content.push(encoder.encode(justify("IVA (16%):", fmtUSD(venta.iva))));

            content.push(BluetoothPrinter.CMD.BOLD_ON);
            content.push(encoder.encode(justify("TOTAL USD:", fmtUSD(venta.total))));
            content.push(BluetoothPrinter.CMD.BOLD_OFF);

            if (venta.tasa) {
                const totalBS = (venta.total * venta.tasa).toFixed(2);
                content.push(encoder.encode(justify("TOTAL BS:", totalBS + " Bs")));
                content.push(encoder.encode(center("(Tasa: " + venta.tasa + " Bs/$)")));
            }

            content.push(encoder.encode(line));
            content.push(BluetoothPrinter.CMD.ALIGN_CENTER);
            content.push(encoder.encode(center(config?.mensaje_pie || config?.mensajePie || "¡Gracias!")));
            content.push(encoder.encode("\n\n\n\n"));
            content.push(BluetoothPrinter.CMD.FULL_CUT);

            console.log("Enviando comandos raw...");
            for (const cmd of content) {
                await this.sendRaw(cmd);
            }
            console.log("Impresión finalizada con éxito.");
            return true;
        } catch (error) {
            console.error("Error en proceso de impresión:", error);
            throw error;
        }
    }

    async testPrint() {
        try {
            if (!this.isConnected()) await this.connect();
            const encoder = new TextEncoder();
            const content = [
                BluetoothPrinter.CMD.INIT,
                BluetoothPrinter.CMD.ALIGN_CENTER,
                BluetoothPrinter.CMD.BOLD_ON,
                encoder.encode("AUTOMOTORES GUAICAIPURO\n"),
                BluetoothPrinter.CMD.BOLD_OFF,
                encoder.encode("--------------------------------\n"),
                encoder.encode("Prueba de Impresora Bluetooth\n"),
                encoder.encode("Estado: FUNCIONANDO\n"),
                encoder.encode("¡Conexión Exitosa!\n\n\n\n"),
            ];
            for (const cmd of content) await this.sendRaw(cmd);
            return true;
        } catch (error) {
            throw error;
        }
    }

    isConnected() {
        return this.device && this.device.gatt.connected && this.characteristic;
    }
}

export const btPrinter = new BluetoothPrinter();
