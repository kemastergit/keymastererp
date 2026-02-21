import React from 'react'

const planes = [
    {
        id: 1,
        nombre: 'PLAN ESENCIAL',
        sub: 'Facturación Local',
        desc: 'Perfecto para una sola caja. Los datos se guardan de forma segura en el equipo de venta.',
        precio: '250',
        mantenimiento: '20',
        color: '#777777',
        icon: '👤',
        features: [
            'Licencia para 1 Computadora',
            'Base de Datos Local (Dexie)',
            'Control de Inventario y Ventas',
            'Facturación y Comprobantes',
            'Reportes de Ventas Diarios',
            'Garantía de Soporte Técnico'
        ]
    },
    {
        id: 3,
        nombre: 'SISTEMA CLOUD PRO',
        sub: 'Multi-Cajas Sincronizadas',
        desc: 'La solución definitiva para 3 o más computadoras. Sincroniza stock y precios al instante en todas las cajas.',
        precio: '650',
        mantenimiento: '30',
        color: '#dc2626',
        icon: '☁️',
        destacado: true,
        features: [
            'Conexión para 3 o más Computadoras',
            'Base de Datos en la Nube (Supabase)',
            'Sincronización Total de Stock/Precios',
            'Acceso Remoto desde su Celular/Casa',
            'Dashboard de Inteligencia de Negocios',
            'Respaldos Automáticos Diarios'
        ]
    }
]

export default function Planes() {
    return (
        <div className="pb-10 animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <h1 className="font-bebas text-5xl text-white tracking-[0.2em] mb-2 uppercase">Licenciamiento Guaicaipuro</h1>
                <div className="h-1 w-24 bg-rojo mx-auto mb-4" />
                <p className="text-muted font-raj text-sm tracking-widest uppercase">Tecnología de Vanguardia para tu Negocio</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
                {planes.map(p => (
                    <div key={p.id}
                        className={`relative group bg-g2 border-2 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:-translate-y-2
              ${p.destacado ? 'border-rojo scale-105 z-10' : 'border-borde hover:border-rojo/50'}`}>

                        {p.destacado && (
                            <div className="absolute top-0 right-0 bg-rojo text-[10px] font-bold text-white px-3 py-1 rounded-bl-lg tracking-widest uppercase">
                                RECOMENDADO
                            </div>
                        )}

                        <div className="p-6 text-center border-b border-borde">
                            <div className="text-4xl mb-3 opacity-80">{p.icon}</div>
                            <h2 className="font-bebas text-2xl text-white tracking-widest group-hover:text-rojo-bright transition-colors">{p.nombre}</h2>
                            <p className="text-rojo-bright font-bold text-[10px] tracking-widest uppercase mb-4">{p.sub}</p>

                            <div className="flex items-end justify-center gap-1 mb-1">
                                <span className="text-muted text-sm pb-1">$</span>
                                <span className="text-5xl font-bebas text-white tracking-tighter">{p.precio}</span>
                                <span className="text-muted text-xs pb-1 uppercase tracking-tighter font-bold">Unico</span>
                            </div>
                            <p className="text-[10px] text-muted font-bold tracking-widest">+ ${p.mantenimiento}/MES DE SOPORTE</p>
                        </div>

                        <div className="p-6">
                            <p className="text-xs text-muted leading-relaxed text-center mb-6 italic min-h-[40px]">
                                "{p.desc}"
                            </p>

                            <ul className="space-y-3 mb-8">
                                {p.features.map((f, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-xs text-slate-300">
                                        <span className="text-rojo">✔</span>
                                        <span className="font-raj font-semibold uppercase tracking-tight">{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className={`w-full py-3 rounded-xl font-bebas text-lg tracking-[0.2em] transition-all
                ${p.destacado ? 'bg-rojo text-white hover:bg-rojo-dark' : 'bg-g3 text-white border border-borde hover:bg-g4'}`}>
                                SOLICITAR PLAN
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 max-w-3xl mx-auto p-6 bg-g3/50 border border-borde rounded-2xl text-center">
                <h3 className="font-bebas text-xl text-rojo-bright tracking-widest mb-2 uppercase">¿Necitas una solución a medida?</h3>
                <p className="text-xs text-muted font-raj leading-loose">
                    Todos nuestros planes incluyen instalación inicial gratuita, capacitación del personal y actualizaciones de seguridad de por vida.
                    Contáctanos para presupuestos especiales de hardware (PCs, Impresoras Térmicas, Gavetas de Dinero).
                </p>
            </div>
        </div>
    )
}
