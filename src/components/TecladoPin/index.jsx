import { useState } from 'react'

export default function TecladoPin({ onComplete, length = 4 }) {
    const [pin, setPin] = Array.isArray(length) ? [null, null] : useState('') // Internal if not controlled

    const handlePress = (num) => {
        if (pin.length < length) {
            const newPin = pin + num
            setPin(newPin)
            if (newPin.length === length) {
                onComplete(newPin)
                setTimeout(() => setPin(''), 500)
            }
        }
    }

    const handleDelete = () => setPin(pin.slice(0, -1))

    return (
        <div className="flex flex-col items-center gap-8">
            {/* PIN Dots */}
            <div className="flex gap-4">
                {[...Array(length)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 
            ${pin.length > i ? 'bg-primary border-primary scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'border-slate-300'}`}>
                    </div>
                ))}
            </div>

            {/* Grid Teclado */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => handlePress(num.toString())}
                        className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-black text-slate-800 
            hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center justify-center">
                        {num}
                    </button>
                ))}
                <button onClick={handleDelete}
                    className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center">
                    <span className="material-icons-round">backspace</span>
                </button>
                <button onClick={() => handlePress('0')}
                    className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-black text-slate-800 
          hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center justify-center">
                    0
                </button>
                <div className="w-16 h-16 flex items-center justify-center">
                    <span className="material-icons-round text-primary opacity-20">verified_user</span>
                </div>
            </div>
        </div>
    )
}
