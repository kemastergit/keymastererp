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
        <div className="pb-10 animate-in fade-in duration-500 h-full overflow-y-auto custom-scroll pr-2">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2 uppercase">Licenciamiento del Sistema</h1>
                <div className="h-1 w-24 bg-primary mx-auto mb-4" />
                <p className="text-slate-500 text-sm tracking-widest uppercase font-bold">Tecnología de Vanguardia para tu Negocio</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
                {planes.map(p => (
                    <div key={p.id}
                        className={`relative group bg-white border-2 rounded-3xl overflow-hidden shadow-xl transition-all duration-300 hover:-translate-y-2
                        ${p.destacado ? 'border-primary scale-105 z-10 shadow-primary/20' : 'border-slate-200 hover:border-primary/50'}`}>

                        {p.destacado && (
                            <div className="absolute top-0 right-0 bg-primary text-[10px] font-black text-white px-4 py-1.5 rounded-bl-xl tracking-widest uppercase">
                                RECOMENDADO
                            </div>
                        )}

                        <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
                            <div className="text-4xl mb-3">{p.icon}</div>
                            <h2 className="font-black text-2xl text-slate-800 tracking-tight group-hover:text-primary transition-colors">{p.nombre}</h2>
                            <p className="text-primary font-bold text-[10px] tracking-widest uppercase mb-4">{p.sub}</p>

                            <div className="flex items-end justify-center gap-1 mb-1">
                                <span className="text-slate-400 text-sm pb-1 font-bold">$</span>
                                <span className="text-6xl font-black text-slate-800 tracking-tighter">{p.precio}</span>
                                <span className="text-slate-400 text-xs pb-1 uppercase tracking-tighter font-bold">Unico</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-2 bg-white inline-block px-3 py-1 rounded-full border border-slate-200 shadow-sm">+ ${p.mantenimiento}/MES DE SOPORTE</p>
                        </div>

                        <div className="p-6 bg-white">
                            <p className="text-xs text-slate-500 leading-relaxed text-center mb-6 italic min-h-[40px] font-medium">
                                "{p.desc}"
                            </p>

                            <ul className="space-y-3 mb-8">
                                {p.features.map((f, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-xs text-slate-600">
                                        <span className="material-icons-round text-primary text-sm">check_circle</span>
                                        <span className="font-bold tracking-tight">{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className={`w-full py-4 rounded-xl font-black text-sm tracking-widest transition-all shadow-lg
                                ${p.destacado ? 'bg-primary text-white hover:bg-red-700 shadow-primary/30' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}>
                                SOLICITAR PLAN
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 max-w-3xl mx-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center shadow-sm">
                <h3 className="font-black text-lg text-primary tracking-tight mb-2 uppercase flex items-center justify-center gap-2">
                    <span className="material-icons-round">support_agent</span> ¿Necesitas una solución a medida?
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-loose">
                    Todos nuestros planes incluyen instalación inicial remota, capacitación del personal y actualizaciones de seguridad de por vida.
                    Contáctanos directamente para requerimientos especiales de sucursales.
                </p>
            </div>
        </div>
    )
}

