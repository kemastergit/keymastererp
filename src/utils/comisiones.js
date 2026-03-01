import { db } from '../db/db'
import { Decimal } from 'decimal.js'

export async function processSaleCommissions(ventaId, ventaData, items) {
    const config = await db.config_empresa.get('main')
    if (!config?.comisiones_habilitadas) return

    const userId = ventaData.usuario_id
    if (!userId) return

    // Buscar configuración de comisión para el usuario
    const commConfig = await db.comisiones_config.where('user_id').equals(userId).and(c => c.active).first()
    if (!commConfig) return

    // Solo ventas de CONTADO generan comisión inmediata. 
    // Las de crédito se generan cuando se marca la cuenta como COBRADA (según requerimiento PAID).
    if (ventaData.tipo_pago !== 'CONTADO') return

    try {
        const totalUSD_Final = new Decimal(ventaData.total)
        let commissionUsd = new Decimal(0)
        let profitUsd = new Decimal(0)
        let totalCostUsd = new Decimal(0)

        // Usar los items pasados (que ya tienen el costo capturado al momento de la venta)
        for (const item of items) {
            totalCostUsd = totalCostUsd.plus(new Decimal(item.costo || 0).times(item.qty))
        }

        if (commConfig.commission_type === 'SALES_PCT') {
            commissionUsd = totalUSD_Final.times(new Decimal(commConfig.percentage).div(100))
        } else if (commConfig.commission_type === 'PROFIT_PCT') {
            profitUsd = totalUSD_Final.minus(totalCostUsd)
            if (profitUsd.gt(0)) {
                commissionUsd = profitUsd.times(new Decimal(commConfig.percentage).div(100))
            } else {
                commissionUsd = new Decimal(0)
            }
        }

        const now = new Date()
        await db.comisiones_log.add({
            user_id: userId,
            invoice_id: ventaId,
            invoice_total_usd: totalUSD_Final.toNumber(),
            invoice_cost_usd: totalCostUsd.toNumber(),
            profit_usd: profitUsd.toNumber(),
            commission_type: commConfig.commission_type,
            percentage: commConfig.percentage,
            commission_usd: commissionUsd.toNumber(),
            period_month: now.getMonth() + 1,
            period_year: now.getFullYear(),
            paid: false,
            created_at: now
        })
    } catch (err) {
        console.error('Error processing commissions:', err)
    }
}
